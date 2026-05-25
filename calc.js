// ============================================================
// DBL Item Builder — Moteur de calcul
// ============================================================
// Expose window.DBL_CALC.calculerStats(...)
// ------------------------------------------------------------

(function () {
  const STATS = window.DBL_DATA.STATS;

  // Liste des stats cibles utilisées pour l'affichage final
  const STATS_CIBLES = [
    "attaque_physique",
    "attaque_energie",
    "defense_physique",
    "defense_energie",
    "points_de_vie",
    "vitesse_regen_ki",
    "critique",
    "vanish_recover",
    "force",
    "degats_infliges",
    "degats_energie_infliges",
    "degats_tech_spe",
    "degats_ultime",
    "quantite_regen_force",
    "garde_contre_degats",
  ];

  // Fallback FR — utilisé si i18n.js n'est pas encore disponible
  const _LABELS_FR = {
    attaque_physique:        "Attaque physique",
    attaque_energie:         "Attaque d'énergie",
    defense_physique:        "Défense physique",
    defense_energie:         "Défense d'énergie",
    points_de_vie:           "Points de vie",
    vitesse_regen_ki:        "Vitesse de régén. du Ki",
    critique:                "Critique",
    vanish_recover:          "Vanish Recover",
    force:                   "Force",
    degats_infliges:         "Dégâts infligés",
    degats_energie_infliges: "Dégâts d'énergie infligés",
    degats_tech_spe:         "Dégâts tech. spéciale",
    degats_ultime:           "Dégâts tech. ultime",
    quantite_regen_force:    "Quantité de régénération",
    garde_contre_degats:     "Garde contre les dégâts",
  };
  // Proxy dynamique : retourne toujours le label dans la langue courante
  const LABELS_CIBLES = new Proxy({}, {
    get(_, key)   { return window.DBL_I18N ? window.DBL_I18N.T('labels.' + key) : (_LABELS_FR[key] || key); },
    has(_, key)   { return key in _LABELS_FR; },
    ownKeys()     { return Object.keys(_LABELS_FR); },
    getOwnPropertyDescriptor(_, key) {
      return key in _LABELS_FR ? { enumerable: true, configurable: true } : undefined;
    },
  });

  // Interpole entre valeur_min et valeur_max selon un ratio 0..1 (1 = max)
  function interpolerValeur(ligne, ratio) {
    const r = ratio == null ? 1 : Math.max(0, Math.min(1, ratio));
    return ligne.valeur_min + (ligne.valeur_max - ligne.valeur_min) * r;
  }

  // Vrai si la condition est remplie compte tenu des conditions utilisateur.
  // - mode "per_member" : remplie dès qu'il y a ≥1 membre d'un tag (OR)
  // - mode "and"        : TOUS les tags doivent être présents (≥1 chacun)
  // - sinon (threshold) : OR logique sur les tags
  function conditionRemplie(ligne, conditions) {
    if (!ligne.condition) return true;
    const c = ligne.condition;
    const tags = c.tags_requis && c.tags_requis.length ? c.tags_requis : [c.tag_requis];
    const seuilEffectif = c.mode === "per_member" ? 1 : (c.seuil || 1);
    if (c.mode === "and") {
      return tags.every((tag) => (conditions[tag] || 0) >= seuilEffectif);
    }
    // OR par défaut
    return tags.some((tag) => (conditions[tag] || 0) >= seuilEffectif);
  }

  // Calcule le multiplicateur appliqué à une ligne :
  //  - mode "per_member" : nombre de membres du tag (avec capping doux à 6)
  //  - sinon : 1 si condition remplie
  function multiplicateurCondition(ligne, conditions) {
    if (!ligne.condition) return 1;
    const c = ligne.condition;
    if (c.mode !== "per_member") return 1;
    const tags = c.tags_requis && c.tags_requis.length ? c.tags_requis : [c.tag_requis];
    // On somme le compte sur les tags listés (mode OR : on prend le max pour ne pas double-compter)
    let count = 0;
    for (const tag of tags) {
      count = Math.max(count, conditions[tag] || 0);
    }
    return Math.min(count, 6);
  }

  // Calcule le résumé des effets cumulés des 3 items.
  //
  // Paramètres :
  //   items        : tableau de 3 items (chaque slot peut être null)
  //   conditions   : { "Saiyan": 3, "Type physique": 2, ... }
  //   choixValeurs : { "0-0": 1.0, "0-1": 0.5, ... } — clé = "slot-ligne", ratio 0..1
  //   personnage   : optionnel. Si fourni, ajoute "base" et "final" par stat.
  function calculerStats({ items, conditions, choixValeurs, personnage }) {
    conditions = conditions || {};
    choixValeurs = choixValeurs || {};

    // --- Initialiser les accumulateurs par stat cible ---
    const accumulateurs = {};
    for (const cible of STATS_CIBLES) {
      accumulateurs[cible] = { base: 0, pur: 0, direct: 0 };
    }

    const passifs = [];
    const conditionsActives = [];
    const conditionsInactives = [];

    // --- Parcourir chaque slot ---
    items.forEach((item, slotIdx) => {
      if (!item) return;

      item.lignes.forEach((ligne, ligneIdx) => {
        // Cas passif : on l'isole, on ne calcule rien
        if (ligne.est_passif) {
          passifs.push({
            itemNom: item.nom,
            slot: slotIdx,
            description: ligne.description_passif,
          });
          return;
        }

        // Récupérer les méta-données de la stat
        const meta = STATS[ligne.stat];
        if (!meta) {
          console.warn("Stat inconnue dans la ligne :", ligne);
          return;
        }

        // Récupérer le ratio choisi par l'utilisateur (défaut = max)
        const cle = `${slotIdx}-${ligneIdx}`;
        const ratio = choixValeurs[cle];
        const valeurBase = interpolerValeur(ligne, ratio);

        // Vérifier la condition + récupérer le multiplicateur per_member
        const active = conditionRemplie(ligne, conditions);
        const mult = multiplicateurCondition(ligne, conditions);
        const valeur = valeurBase * mult;

        if (ligne.condition) {
          const c = ligne.condition;
          const tagPrincipal = (c.tags_requis && c.tags_requis[0]) || c.tag_requis;
          const valeurActuelle = conditions[tagPrincipal] || 0;
          const infoCondition = {
            itemNom: item.nom,
            slot: slotIdx,
            ligneIdx,
            description: c.description,
            tag: tagPrincipal,
            tags: c.tags_requis || [c.tag_requis],
            mode: c.mode || "threshold",
            seuil: c.seuil || 1,
            multiplicateur: mult,
            valeurActuelle,
            valeur,
            statLabel: meta.label,
          };
          if (active) conditionsActives.push(infoCondition);
          else conditionsInactives.push(infoCondition);
        }

        if (!active) return; // ligne conditionnelle non remplie : ignorée du calcul

        // Cumuler dans le bon bucket
        accumulateurs[meta.cible][meta.type] += valeur;
      });
    });

    // --- Construire le résumé par stat ---
    const stats = {};
    for (const cible of STATS_CIBLES) {
      const bonusBase = accumulateurs[cible].base;
      const bonusPur = accumulateurs[cible].pur;
      const bonusDirect = accumulateurs[cible].direct;

      // Multiplicateur équivalent : (1 + base%) × (1 + pur%) × (1 + direct%)
      // Permet à l'utilisateur de voir le gain final agnostique du personnage.
      const multTotal =
        (1 + bonusBase / 100) *
        (1 + bonusPur / 100) *
        (1 + bonusDirect / 100);
      const gainPct = (multTotal - 1) * 100;

      const entry = {
        cible,
        label: LABELS_CIBLES[cible],
        bonusBase,
        bonusPur,
        bonusDirect,
        multTotal,
        gainPct,
        // Vrai si au moins un bonus est non nul
        hasBonus: bonusBase > 0 || bonusPur > 0 || bonusDirect > 0,
      };

      // Si personnage fourni, on calcule aussi base et final
      if (personnage && personnage.stats_base) {
        entry.base = personnage.stats_base[cible] || 0;
        entry.final = entry.base * multTotal;
      }

      stats[cible] = entry;
    }

    return {
      stats,
      passifs,
      conditionsActives,
      conditionsInactives,
    };
  }

  window.DBL_CALC = {
    calculerStats,
    interpolerValeur,
    conditionRemplie,
    multiplicateurCondition,
    STATS_CIBLES,
    LABELS_CIBLES,
  };
})();
