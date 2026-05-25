// ============================================================
// DBL Item Builder — UI + wiring
// ============================================================

(function () {
  const { ITEMS, STATS, PERSONNAGES } = window.DBL_DATA;
  const { calculerStats, interpolerValeur, conditionRemplie: condRemplieCalc, LABELS_CIBLES, STATS_CIBLES } = window.DBL_CALC;

  // Vrai si l'item est compatible avec le personnage.
  // tagsPorteur est en CNF : [["A","B"], ["C"]] = (A AND B) OR C
  // Un perso "possède" : ses traits + son cardCode.
  function isCompatible(item, character) {
    if (!character) return null; // pas de perso sélectionné = compat inconnue
    if (!item.tagsPorteur || !item.tagsPorteur.length) return true; // aucune restriction
    const owned = new Set([...(character.traits || []), character.cardCode].filter(Boolean));
    return item.tagsPorteur.some((group) => group.every((tag) => owned.has(tag)));
  }

  // Formate les Tag/Trait Conditions porteur en libellé lisible.
  // Structure CNF : [ ["A","B"], ["C"] ] → "(A • B) ou C"
  function formatTagsPorteur(tags) {
    if (!tags || !tags.length) return null;
    const groups = tags.map((g) => g.join(" • "));
    if (groups.length === 1) return groups[0];
    return groups.map((g) => `(${g})`).join(" ou ");
  }

  // Labels d'affichage pour les raretés
  const RARITY_LABELS = {
    platinum:       "PLATINUM",
    awakenedunique: "UNIQUE ÉVEILLÉ",
    unique:         "UNIQUE",
    awakenedgold:   "OR ÉVEILLÉ",
    gold:           "OR",
    awakenedsilver: "ARGENT ÉVEILLÉ",
    silver:         "ARGENT",
    awakenedbronze: "BRONZE ÉVEILLÉ",
    bronze:         "BRONZE",
    iron:           "FER",
    event:          "ÉVÉNEMENT",
  };
  const rarityLabel = (r) => RARITY_LABELS[r] || (r || "").toUpperCase();

  // ===== ÉTAT GLOBAL =====
  // L'équipe DBL = 2 trios = 6 personnages. Chaque slot a son propre build
  // (perso + Z tier + 3 items). Le leader (1 sur 6) distribue/reçoit sa
  // Cap Z sans restriction de tag.
  function emptyTeamSlot() {
    return {
      character: null,
      zTier: 4,
      items: [null, null, null],
      // itemChoices[itemSlotIdx] = { lineIdx: chosenAltIdx } pour les lignes "OR"
      itemChoices: [{}, {}, {}],
    };
  }

  // === Détection des passifs avec choix aléatoire "A - OR - B" ===
  // Le jeu génère aléatoirement l'une des deux options ; on laisse l'utilisateur choisir.
  function parseOrPassif(description) {
    if (!description || !description.includes(" - OR - ")) return null;
    const STATS = window.DBL_DATA.STATS;
    const labelToKey = {};
    for (const [key, meta] of Object.entries(STATS)) {
      labelToKey[meta.label.toLowerCase()] = key;
    }
    const parts = description.split(" - OR - ");
    const alts = [];
    for (const part of parts) {
      // Pattern : "LABEL X.XX ~ Y.YY%"  (point ou virgule décimale)
      const m = part.trim().match(/^(.+?)\s+(-?\d+(?:[.,]\d+)?)\s*~\s*(-?\d+(?:[.,]\d+)?)\s*%?\s*$/i);
      if (!m) return null;
      const label = m[1].trim();
      const key = labelToKey[label.toLowerCase()];
      if (!key) return null;
      alts.push({
        label,
        stat: key,
        valeur_min: parseFloat(m[2].replace(",", ".")),
        valeur_max: parseFloat(m[3].replace(",", ".")),
      });
    }
    return alts.length >= 2 ? alts : null;
  }

  // Sépare les lignes d'items en deux groupes pour affichage : "base" et "pur+direct".
  // Permet d'afficher séparément la couche additive (base) et la couche multiplicative (pur)
  // dans le tableau "Résumé des effets cumulés".
  function splitItemsByType(items) {
    const STATS = window.DBL_DATA.STATS;
    const baseItems = [];
    const purItems = [];
    for (const item of items) {
      if (!item) continue;
      const baseLines = [];
      const purLines = [];
      for (const l of item.lignes) {
        if (l.est_passif) continue;
        const meta = STATS[l.stat];
        if (!meta) continue;
        if (meta.type === "base") baseLines.push(l);
        else purLines.push(l); // "pur" et "direct" affichés ensemble
      }
      if (baseLines.length) baseItems.push({ ...item, lignes: baseLines });
      if (purLines.length)  purItems.push({  ...item, lignes: purLines  });
    }
    return { baseItems, purItems };
  }

  // Retourne active.items mais avec les passifs OR remplacés par la ligne stat choisie.
  // Utilisé par le calcul ET par le rendu pour rester cohérent.
  function getActiveItemsWithChoices() {
    const teamSlot = state.team[state.activeSlot];
    const choices = teamSlot.itemChoices || [{}, {}, {}];
    return active.items.map((item, slotIdx) => {
      if (!item) return null;
      const slotChoices = choices[slotIdx] || {};
      let needsClone = false;
      const lignes = item.lignes.map((l, lineIdx) => {
        if (!l.est_passif) return l;
        const alts = parseOrPassif(l.description_passif);
        if (!alts) return l;
        const chosenIdx = slotChoices[lineIdx] ?? 0;
        const chosen = alts[chosenIdx] || alts[0];
        needsClone = true;
        return {
          stat: chosen.stat,
          valeur_min: chosen.valeur_min,
          valeur_max: chosen.valeur_max,
          condition: null,
          slot: l.slot,
        };
      });
      return needsClone ? { ...item, lignes } : item;
    });
  }

  const state = {
    team: Array.from({ length: 6 }, emptyTeamSlot),
    activeSlot: 0,           // perso actuellement édité dans l'UI
    leaderSlot: 0,           // perso désigné comme leader
    noLeader: false,         // true = simule une équipe sans leader (bypass désactivé)
    conditions: {},          // tag => nombre de membres (saisie utilisateur, reste global)
    modalSlot: null,         // index du slot d'ITEM (0..2) ouvert dans la modale
    modalRarityFilter: null,
    modalSearch: "",
    modalCompatOnly: false,
    charRarityFilter: null,
    charElementFilter: null,
  };

  // Retourne l'index effectif du leader (-1 si mode "sans leader" activé).
  function effectiveLeaderSlot() {
    return state.noLeader ? -1 : state.leaderSlot;
  }

  // Retourne le Set des IDs de personnages déjà placés dans l'équipe,
  // en excluant le slot actif (pour autoriser le remplacement).
  function getUsedCharIds() {
    const ids = new Set();
    state.team.forEach((slot, i) => {
      if (i !== state.activeSlot && slot.character) {
        // Double clé : id en priorité, cardCode en fallback
        const key = slot.character.id || slot.character.cardCode;
        if (key) ids.add(key);
      }
    });
    return ids;
  }

  // Retourne la clé unique d'un personnage (cohérente avec getUsedCharIds).
  function charKey(p) {
    return p.id || p.cardCode || null;
  }

  // ===== ACCESSEURS D'ALIAS (perso actif) =====
  // Pour ne pas tout réécrire en `state.team[state.activeSlot].xxx`, on expose
  // des getters dynamiques sur un proxy `active`.
  const active = new Proxy({}, {
    get(_, key) { return state.team[state.activeSlot][key]; },
    set(_, key, value) { state.team[state.activeSlot][key] = value; return true; },
  });

  // Renvoie true si le perso bénéficie de sa propre Z Ability (match avec tags)
  function characterMatchesZ(character, zEntry) {
    if (!zEntry) return false;
    const tags = zEntry.conditionTags || [];
    if (tags.length === 0) return true; // pas de condition → s'applique toujours
    const owned = new Set([...(character.traits || []), character.cardCode].filter(Boolean));
    return tags.some((t) => owned.has(t));
  }

  // Conditions effectives = saisies utilisateur + traits + cardCode + element du perso
  // L'élément (YEL/BLU/RED/GRN/PUR/LGT) compte comme un tag car certaines
  // Z Zenkai conditionnent sur l'élément du combattant.
  function getEffectiveConditionsFor(character) {
    const conds = { ...state.conditions };
    if (character) {
      for (const trait of character.traits || []) {
        if ((conds[trait] || 0) < 1) conds[trait] = 1;
      }
      if (character.cardCode && (conds[character.cardCode] || 0) < 1) {
        conds[character.cardCode] = 1;
      }
      if (character.element && (conds[character.element] || 0) < 1) {
        conds[character.element] = 1;
      }
    }
    return conds;
  }
  function getEffectiveConditions() {
    return getEffectiveConditionsFor(active.character);
  }

  // Comptage automatique des traits de toute l'équipe.
  // Utilisé pour les conditions d'items du type "si N « Saiyan » font
  // partie de l'équipe" ou "par combattant de l'équipe de « X »".
  // On génère aussi des formes préfixées ("Classe : X", "Personnage : nom (code)")
  // pour matcher les item tags qui gardent leurs préfixes.
  function getTeamTagCounts() {
    const counts = {};
    for (const slot of state.team) {
      if (!slot.character) continue;
      const c = slot.character;
      for (const trait of c.traits || []) {
        counts[trait] = (counts[trait] || 0) + 1;
        const cls = "Classe : " + trait;
        counts[cls] = (counts[cls] || 0) + 1;
      }
      if (c.element) counts[c.element] = (counts[c.element] || 0) + 1;
      if (c.cardCode) {
        counts[c.cardCode] = (counts[c.cardCode] || 0) + 1;
        if (c.nom) {
          const key = `Personnage : ${c.nom.trim()} (${c.cardCode})`;
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    }
    // Override utilisateur (le user peut booster un compte au-delà de l'auto)
    for (const [k, v] of Object.entries(state.conditions)) {
      counts[k] = Math.max(counts[k] || 0, v);
    }
    return counts;
  }

  // Construit la liste des bonus Z appliqués à un slot d'équipe.
  // ──────────────────────────────────────────────────────────────
  // Mécanique DBL :
  // - Les Cap Z des 6 perso se propagent à TOUS les perso de l'équipe
  //   (selon les conditions de la Z et les traits du receveur).
  // - Privilège du LEADER :
  //   • Comme RECEVEUR : le leader reçoit TOUT sans condition (de toute
  //     source, même hors trio — il est sur le terrain pour SA bataille
  //     et bénéficie d'une stat-base maximale).
  //   • Comme ÉMETTEUR : sa Z s'applique sans condition UNIQUEMENT à
  //     ses 2 coéquipiers de trio (avec qui il combat). Aux autres, sa
  //     Z applique les conditions normales (comme un perso lambda).
  // ──────────────────────────────────────────────────────────────
  function buildTeamZItemsFor(targetSlotIdx) {
    const target = state.team[targetSlotIdx];
    if (!target || !target.character) return [];

    const targetTrio = Math.floor(targetSlotIdx / 3);
    const targetIsLeader = targetSlotIdx === effectiveLeaderSlot();

    const items = [];
    for (let i = 0; i < state.team.length; i++) {
      const sender = state.team[i];
      if (!sender.character) continue;

      const senderTrio = Math.floor(i / 3);
      const senderIsLeader = i === effectiveLeaderSlot();
      const leaderInvolved =
        targetIsLeader ||
        (senderIsLeader && senderTrio === targetTrio);

      // Conditions du receveur (ses propres traits) — utilisées pour pré-évaluer les Z
      const targetConds = getEffectiveConditionsFor(target.character);

      // Helper : crée un item virtuel pour un set de lignes Z
      // Les conditions Z sont PRÉ-ÉVALUÉES contre les traits du receveur
      // (avec leader bypass) et stripées. L'engine n'a plus à les checker.
      const pushZItem = (lignesSrc, label, kind, tier) => {
        if (!lignesSrc) return;
        const tierLab = ["I", "II", "III", "IV"][tier - 1];
        const adapted = [];
        for (const l of lignesSrc) {
          if (l.est_passif) { adapted.push(l); continue; }
          if (l.condition && !leaderInvolved) {
            // Évaluer la condition contre les traits du receveur
            if (!condRemplieCalc(l, targetConds)) continue; // ligne non applicable
          }
          // Inclure la ligne sans condition (déjà validée ou leader bypass)
          adapted.push({ ...l, condition: null });
        }
        const isSelf = i === targetSlotIdx;
        items.push({
          id: `_z_${kind}_${i}_${tier}`,
          nom: isSelf
            ? `${label} ${tierLab} (soi)`
            : `${label} ${tierLab} — ${sender.character.nom.trim()} (slot ${i + 1})`,
          isVirtual: true,
          isZBonus: true,
          kind,
          sourceSlot: i,
          tier,
          lignes: adapted,           // pour le moteur (filtrées + sans condition)
          lignesAll: lignesSrc,      // original (pour l'affichage du bilan détaillé)
          tagsPorteur: [],
        });
      };

      // 1) Cap Z classique — utilise le tier choisi par l'utilisateur
      if (sender.character.zAbilities) {
        const z = sender.character.zAbilities.find((z) => z.tier === sender.zTier);
        if (z) pushZItem(z.lignes, "Cap. Z", "z", sender.zTier);
      }
      // 2) Cap Z Zenkai — TOUJOURS au max (tier IV), s'ajoute en plus
      if (sender.character.zAbilitiesZenkai) {
        const zk = sender.character.zAbilitiesZenkai.find((z) => z.tier === 4);
        if (zk) pushZItem(zk.lignes, "Cap. Z Zenkai", "zenkai", 4);
      }
    }
    return items;
  }

  // ===== FORMATAGE =====
  const fmtInt = (n) => Math.round(n).toLocaleString("fr-FR");
  const fmtPct = (n) => n.toFixed(2).replace(".", ",") + "%";
  const fmtRange = (l) =>
    l.valeur_min === l.valeur_max
      ? `${l.valeur_max.toFixed(2)}%`
      : `${l.valeur_min.toFixed(2)} ~ ${l.valeur_max.toFixed(2)}%`;

  // ===== HELPERS =====
  function statLabel(statKey) {
    return STATS[statKey] ? STATS[statKey].label : statKey;
  }

  // Liste unique des tags requis par les conditions des items équipés.
  // Accepte les deux schémas : tag_requis (string) ou tags_requis (array, scraper v1.1)
  function getRequiredTags() {
    const tags = new Set();
    active.items.forEach((item) => {
      if (!item) return;
      item.lignes.forEach((l) => {
        if (!l.condition) return;
        const t = l.condition.tags_requis && l.condition.tags_requis.length
          ? l.condition.tags_requis
          : [l.condition.tag_requis];
        t.forEach((tag) => tag && tags.add(tag));
      });
    });
    return Array.from(tags);
  }

  // ===== SÉLECTEUR DE PERSONNAGE (modale) =====
  const charSearchEl = document.getElementById("char-search");
  const charModalEl = document.getElementById("char-modal");
  const charModalCloseEl = document.getElementById("char-modal-close");
  const charModalTitleEl = document.getElementById("char-modal-title");
  const charSuggestionsEl = document.getElementById("char-suggestions");
  const charFiltersEl = document.getElementById("char-filters");
  const charSelectedEl = document.getElementById("char-selected");
  const charTraitsEl = document.getElementById("char-traits");
  const buildEmptyEl = document.getElementById("build-empty");

  // openCharModal/closeCharModal : ouvre la modale pour le slot actif.
  // L'utilisateur arrive ici depuis le « + » d'un team slot (vide).
  function openCharModal() {
    charModalTitleEl.textContent = `Personnage — Slot ${state.activeSlot + 1}`;
    charSearchEl.value = "";
    renderCharFilters();
    renderCharSuggestions("");
    charModalEl.classList.remove("hidden");
    setTimeout(() => charSearchEl.focus(), 20);
    // Force la hauteur du panel + de la liste en pixels (bypass de tout problème CSS/cache)
    forceCharModalSize();
  }
  function closeCharModal() {
    charModalEl.classList.add("hidden");
  }
  // Force le panel à occuper tout le viewport et la liste à prendre tout l'espace restant.
  // Cas typique : si le grid/flex ne s'applique pas (cache CSS, override sournois), JS gagne.
  function forceCharModalSize() {
    const panel = charModalEl.querySelector(".modal-panel");
    const list = charModalEl.querySelector(".char-modal-list");
    if (!panel || !list) return;
    requestAnimationFrame(() => {
      const vh = window.innerHeight;
      panel.style.cssText += `
        position: fixed !important;
        top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
        width: 100vw !important;
        height: ${vh}px !important;
        max-height: none !important;
        max-width: none !important;
        margin: 0 !important;
        border-radius: 0 !important;
        border: 0 !important;
      `;
      // Mesure la hauteur des éléments avant la liste
      const header = panel.querySelector(".modal-header");
      const search = panel.querySelector(".search-input");
      const filters = panel.querySelector(".char-filters");
      const used =
        (header?.offsetHeight || 0) +
        (search?.offsetHeight || 0) +
        (filters?.offsetHeight || 0);
      list.style.cssText += `
        height: ${vh - used}px !important;
        max-height: ${vh - used}px !important;
        overflow-y: auto !important;
        flex: none !important;
      `;
    });
  }
  // Si le viewport change pendant que la modale est ouverte, on recalcule.
  window.addEventListener("resize", () => {
    if (!charModalEl.classList.contains("hidden")) forceCharModalSize();
  });

  const CHAR_RARITIES = ["SPARKING", "ULTRA", "LEGEND"];
  const CHAR_ELEMENTS = ["BLU", "RED", "GRN", "YEL", "PUR", "LGT"];

  function renderCharFilters() {
    const counts = { rar: {}, el: {} };
    for (const p of PERSONNAGES) {
      counts.rar[p.rarete] = (counts.rar[p.rarete] || 0) + 1;
      counts.el[p.element] = (counts.el[p.element] || 0) + 1;
    }
    const rarPills = [
      `<button class="char-filter-pill ${state.charRarityFilter === null ? "active" : ""}" data-char-rarity="">Toutes</button>`,
      ...CHAR_RARITIES.filter((r) => counts.rar[r]).map(
        (r) => `<button class="char-filter-pill ${state.charRarityFilter === r ? "active" : ""}" data-char-rarity="${r}">${r} <span class="pill-count">${counts.rar[r]}</span></button>`,
      ),
    ];
    const elPills = [
      `<button class="char-filter-pill char-elem-pill ${state.charElementFilter === null ? "active" : ""}" data-char-element="">Tous</button>`,
      ...CHAR_ELEMENTS.filter((el) => counts.el[el]).map(
        (el) => `<button class="char-filter-pill char-elem-pill elem-${el.toLowerCase()} ${state.charElementFilter === el ? "active" : ""}" data-char-element="${el}">${el} <span class="pill-count">${counts.el[el]}</span></button>`,
      ),
    ];
    charFiltersEl.innerHTML = `
      <div class="char-filter-row">${rarPills.join("")}</div>
      <div class="char-filter-row">${elPills.join("")}</div>
    `;
  }

  function getFilteredChars() {
    return PERSONNAGES.filter((p) => {
      if (state.charRarityFilter && p.rarete !== state.charRarityFilter) return false;
      if (state.charElementFilter && p.element !== state.charElementFilter) return false;
      return true;
    });
  }

  function renderCharSuggestions(filter) {
    const q = (filter || "").toLowerCase().trim();
    const pool = getFilteredChars();
    let matches;
    if (!q) {
      // Pas de filtre texte → on affiche TOUT (la modale est plein écran, l'utilisateur scrolle).
      matches = pool;
    } else {
      matches = pool.filter(
        (p) =>
          p.nom.toLowerCase().includes(q) ||
          (p.cardCode || "").toLowerCase().includes(q) ||
          (p.traits || []).some((t) => t.toLowerCase().includes(q)),
      );
    }

    if (matches.length === 0) {
      charSuggestionsEl.innerHTML = `<li class="char-suggestion-empty">Aucun personnage trouvé</li>`;
      return;
    }

    const usedIds = getUsedCharIds();
    charSuggestionsEl.innerHTML = matches
      .map((p) => {
        const isTaken = usedIds.has(charKey(p));
        const elementClass = `elem-${(p.element || "").toLowerCase()}`;
        const img = p.image
          ? `<img class="char-suggestion-img" src="${p.image}" alt="" loading="lazy" onerror="this.style.display='none'" />`
          : `<div class="char-suggestion-img char-suggestion-img-placeholder">?</div>`;
        return `
          <li data-char-id="${p.id}" class="${elementClass}${isTaken ? " is-taken" : ""}" ${isTaken ? 'aria-disabled="true"' : ''}>
            ${img}
            <span class="char-suggestion-element">${p.element || ""}</span>
            <span class="char-suggestion-name">${p.nom.trim()}</span>
            <small class="char-suggestion-code">${p.cardCode || ""} · ${p.rarete}</small>
            ${isTaken ? '<span class="char-taken-badge">Déjà dans l\'équipe</span>' : ""}
          </li>
        `;
      })
      .join("");
  }

  // Handler clic filtres
  charFiltersEl.addEventListener("click", (e) => {
    const rBtn = e.target.closest("button[data-char-rarity]");
    if (rBtn) {
      const v = rBtn.dataset.charRarity;
      state.charRarityFilter = v === "" ? null : v;
      renderCharFilters();
      renderCharSuggestions(charSearchEl.value);
      return;
    }
    const eBtn = e.target.closest("button[data-char-element]");
    if (eBtn) {
      const v = eBtn.dataset.charElement;
      state.charElementFilter = v === "" ? null : v;
      renderCharFilters();
      renderCharSuggestions(charSearchEl.value);
    }
  });

  function renderCharSelected() {
    if (!active.character) {
      charSelectedEl.classList.add("hidden");
      charSelectedEl.innerHTML = "";
      return;
    }
    const p = active.character;
    const elementClass = `elem-${(p.element || "").toLowerCase()}`;
    const img = p.image
      ? `<img class="char-selected-img" src="${p.image}" alt="" onerror="this.style.display='none'" />`
      : `<div class="char-selected-img char-selected-img-placeholder">?</div>`;
    charSelectedEl.classList.remove("hidden");
    charSelectedEl.innerHTML = `
      <div class="char-selected-card ${elementClass}">
        ${img}
        <div class="char-selected-info">
          <div class="char-selected-element">${p.element || ""}</div>
          <div class="char-selected-name">${p.nom.trim()}</div>
          <div class="char-selected-code">${p.cardCode || ""} · ${p.rarete}</div>
        </div>
        <button class="char-selected-clear" data-action="clear-char" type="button" aria-label="Désélectionner">×</button>
      </div>
    `;
  }

  function renderCharTraits() {
    if (!active.character) {
      charTraitsEl.classList.add("hidden");
      charTraitsEl.innerHTML = "";
      return;
    }
    charTraitsEl.classList.remove("hidden");
    const traits = active.character.traits || [];
    charTraitsEl.innerHTML = `
      <div class="char-traits-head">Traits (${traits.length})</div>
      <div class="char-traits-pills">
        ${traits.map((t) => `<span class="trait-pill">${t}</span>`).join("")}
      </div>
    `;
  }

  const charZAbilityEl = document.getElementById("char-zability");
  const Z_LABEL = ["I", "II", "III", "IV"];

  function renderCharZAbility() {
    if (!active.character || (!active.character.zAbilities?.length && !active.character.zAbilitiesZenkai?.length)) {
      charZAbilityEl.classList.add("hidden");
      charZAbilityEl.innerHTML = "";
      return;
    }
    charZAbilityEl.classList.remove("hidden");
    const tiers = active.character.zAbilities || active.character.zAbilitiesZenkai;
    const conds = getEffectiveConditionsFor(active.character);
    const activeIsLeader = state.activeSlot === effectiveLeaderSlot();

    const pills = tiers
      .map((z) => {
        const cls = z.tier === active.zTier ? "active" : "";
        return `<button class="z-pill ${cls}" data-z-tier="${z.tier}" type="button">${Z_LABEL[z.tier - 1]}</button>`;
      })
      .join("");

    // Regroupe les lignes d'un set Z par condition (header)
    const buildGroups = (lignesSrc) => {
      const groups = [];
      let lastKey = "__init__";
      for (const l of lignesSrc) {
        let key;
        if (l.est_passif) key = "__passif__";
        else if (!l.condition) key = "__nocond__";
        else key = `${l.condition.mode || "threshold"}|${(l.condition.tags_requis || []).join(",")}`;
        if (key !== lastKey) {
          groups.push({ key, condition: l.condition || null, est_passif: !!l.est_passif, lignes: [] });
          lastKey = key;
        }
        groups[groups.length - 1].lignes.push(l);
      }
      return groups;
    };

    const renderHeader = (g) => {
      if (g.est_passif) return "";
      if (!g.condition) {
        return `<div class="z-group-header is-nocond">Toujours actif :</div>`;
      }
      const tags = g.condition.tags_requis || [];
      const sep = g.condition.mode === "and" ? " et " : " ou ";
      const prefix = g.condition.mode === "and" ? "À la fois " : "";
      const tagPills = tags
        .map((t) => `<span class="z-cond-tag">${t}</span>`)
        .join(`<span class="z-cond-sep">${sep.trim()}</span>`);
      const ok = activeIsLeader || condRemplieCalc({ condition: g.condition }, conds);
      const leaderBadge = activeIsLeader && !condRemplieCalc({ condition: g.condition }, conds)
        ? ` <span class="z-leader-bypass" title="Activé via le privilège Leader">★ Leader bypass</span>`
        : "";
      return `
        <div class="z-group-header ${ok ? "is-ok" : "is-ko"}">
          ${prefix}${tagPills} <span class="z-cond-marker">${ok ? "✓" : "✗"}</span>${leaderBadge}
        </div>
      `;
    };

    const renderLineGroup = (g) =>
      g.lignes.map((l) => {
        if (l.est_passif) {
          return `<div class="z-line z-passif">⚡ ${l.description_passif}</div>`;
        }
        const lab = STATS[l.stat] ? STATS[l.stat].label : l.stat;
        const val = l.valeur_max.toFixed(0);
        return `<div class="z-line">· ${lab} +${val}%</div>`;
      }).join("");

    // Construit la section HTML d'un set Z (classique ou Zenkai)
    const renderZSection = (lignesSrc, label, isZenkaiSection) => {
      if (!lignesSrc || !lignesSrc.length) return "";
      const groups = buildGroups(lignesSrc);
      const groupsHTML = groups
        .map((g) => `<div class="z-group">${renderHeader(g)}${renderLineGroup(g)}</div>`)
        .join("");
      const badge = isZenkaiSection
        ? `<span class="z-zenkai-badge">ZENKAI</span>`
        : "";
      return `
        <div class="z-set ${isZenkaiSection ? "z-set-zenkai" : "z-set-classic"}">
          <div class="z-set-title">${label} ${badge}</div>
          <div class="char-zability-groups">${groupsHTML}</div>
        </div>
      `;
    };

    // Section Z classique — tier choisi par l'utilisateur
    const zCur = active.character.zAbilities?.find((z) => z.tier === active.zTier);
    const zSection = zCur ? renderZSection(zCur.lignes, `Cap. Z ${Z_LABEL[active.zTier - 1]}`, false) : "";
    // Section Z Zenkai — TOUJOURS au max (tier IV)
    const zkCur = active.character.zAbilitiesZenkai?.find((z) => z.tier === 4);
    const zkSection = zkCur ? renderZSection(zkCur.lignes, "Cap. Z Zenkai IV (max)", true) : "";

    charZAbilityEl.innerHTML = `
      <div class="char-zability-head">
        <span class="char-zability-label">Cap. Z${active.character.isZenkai ? " + Zenkai" : ""}</span>
        <div class="char-zability-pills">${pills}</div>
      </div>
      ${zSection}
      ${zkSection}
    `;
  }

  charZAbilityEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-z-tier]");
    if (!btn) return;
    active.zTier = parseInt(btn.dataset.zTier, 10);
    renderCharZAbility();
    renderResults();
  });

  function renderCharPicker() {
    renderCharFilters();
    renderCharSelected();
    renderCharTraits();
    renderCharZAbility();
  }

  function selectCharacter(p) {
    active.character = p || null;
    active.zTier = 4; // reset au max à chaque nouveau perso
    charSearchEl.value = "";
    closeCharModal();
    renderTeamGrid();
    renderCharSelected();
    renderCharTraits();
    renderCharZAbility();
    renderBuildState();
    renderResults();
    if (!modal.classList.contains("hidden")) {
      renderRarityFilters();
      renderItemList();
    }
  }

  // Affiche soit l'état vide (gros « ＋ »), soit les slots items selon que le slot actif a un perso.
  function renderBuildState() {
    const hasChar = !!active.character;
    buildEmptyEl.classList.toggle("hidden", hasChar);
    const slotsEl = document.querySelector(".slots");
    const subheadEl = document.querySelector(".build-subhead");
    if (slotsEl) slotsEl.style.display = hasChar ? "" : "none";
    if (subheadEl) subheadEl.style.display = hasChar ? "" : "none";
  }

  // ===== TEAM GRID =====
  const teamGridEl = document.getElementById("team-grid");
  const buildTitleEl = document.getElementById("build-title");

  function renderTeamGrid() {
    const slots = state.team.map((slot, i) => {
      const c = slot.character;
      const isActive = i === state.activeSlot;
      // On garde le marquage visuel du leader désigné, mais grisé si noLeader actif
      const isLeader = i === state.leaderSlot;
      const empty = !c;
      const elementClass = c ? `elem-${(c.element || "").toLowerCase()}` : "";
      const img = c && c.image
        ? `<img class="team-card-img" src="${c.image}" alt="" onerror="this.style.display='none'" />`
        : `<div class="team-card-img team-card-img-empty">+</div>`;
      const name = c ? c.nom.trim() : "Vide";
      const code = c ? `${c.cardCode || ""} · Z ${["I","II","III","IV"][slot.zTier - 1]}` : "Cliquer pour ajouter";
      const nbItems = slot.items.filter(Boolean).length;
      return `
        <div class="team-card ${isActive ? "is-active" : ""} ${empty ? "is-empty" : ""} ${elementClass}" data-team-slot="${i}">
          <button class="team-leader-toggle ${isLeader ? "is-leader" : ""} ${state.noLeader ? "is-leader-disabled" : ""}" data-leader-toggle="${i}" title="Désigner comme Leader" type="button">★</button>
          ${img}
          <div class="team-card-info">
            <div class="team-card-name" title="${name}">${name}</div>
            <div class="team-card-code">${code}</div>
            ${empty ? "" : `<div class="team-card-items">${nbItems}/3 items</div>`}
          </div>
        </div>
      `;
    });
    teamGridEl.innerHTML = `
      <div class="team-trio">${slots.slice(0, 3).join("")}</div>
      <div class="team-trio-sep">Trio A ↑ · Trio B ↓</div>
      <div class="team-trio">${slots.slice(3, 6).join("")}</div>
    `;
    // Mise à jour du titre du panel build
    const activeChar = active.character;
    const showLeaderBadge = !state.noLeader && state.activeSlot === state.leaderSlot;
    buildTitleEl.innerHTML = `Build du Slot ${state.activeSlot + 1}${activeChar ? ` — <span style="color:var(--accent)">${activeChar.nom.trim()}</span>` : ""}${showLeaderBadge ? " <span class=\"build-title-leader\">★ Leader</span>" : ""}`;
    renderNoLeaderBtn();
  }

  teamGridEl.addEventListener("click", (e) => {
    const leaderBtn = e.target.closest("[data-leader-toggle]");
    if (leaderBtn) {
      e.stopPropagation();
      state.leaderSlot = parseInt(leaderBtn.dataset.leaderToggle, 10);
      renderTeamGrid();
      renderResults();
      return;
    }
    const card = e.target.closest("[data-team-slot]");
    if (!card) return;
    const slotIdx = parseInt(card.dataset.teamSlot, 10);
    const wasEmpty = !state.team[slotIdx].character;
    state.activeSlot = slotIdx;
    // Re-render tout l'éditeur pour refléter le slot actif
    renderTeamGrid();
    renderCharSelected();
    renderCharTraits();
    renderCharZAbility();
    renderBuildState();
    renderSlots();
    renderConditions();
    renderResults();
    // Si le slot était vide, on enchaîne sur la sélection d'un perso via modale
    if (wasEmpty) openCharModal();
  });

  // Recherche dans le modal char : filtre la liste à la volée
  charSearchEl.addEventListener("input", () => renderCharSuggestions(charSearchEl.value));
  // Préserve le focus du champ recherche quand on clique sur un filtre
  charFiltersEl.addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) e.preventDefault();
  });
  charSuggestionsEl.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-char-id]");
    if (!li) return;
    if (li.classList.contains("is-taken")) return; // déjà dans l'équipe
    const p = PERSONNAGES.find((p) => p.id === li.dataset.charId);
    if (p) selectCharacter(p);
  });
  // Fermeture du modal char
  charModalCloseEl.addEventListener("click", closeCharModal);
  charModalEl.querySelector("[data-char-modal-close]").addEventListener("click", closeCharModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !charModalEl.classList.contains("hidden")) closeCharModal();
  });

  // Bouton « Ajouter un personnage » de l'état vide du build
  buildEmptyEl.addEventListener("click", (e) => {
    if (e.target.closest('[data-action="open-char-modal"]')) openCharModal();
  });

  // Clic sur le bouton "×" du perso sélectionné dans le build
  charSelectedEl.addEventListener("click", (e) => {
    if (e.target.closest('[data-action="clear-char"]')) {
      selectCharacter(null);
    }
  });

  // ===== MODALE D'ITEMS =====
  const modal = document.getElementById("item-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalClose = document.getElementById("modal-close");
  const itemSearch = document.getElementById("item-search");
  const itemList = document.getElementById("item-list");

  const rarityFiltersEl = document.getElementById("rarity-filters");

  function openItemModal(slotIdx) {
    state.modalSlot = slotIdx;
    modalTitle.textContent = `Choisir un item — Slot ${slotIdx + 1}`;
    itemSearch.value = "";
    state.modalSearch = "";
    // Active automatiquement le filtre "Compatibles" si un perso est sélectionné.
    state.modalCompatOnly = !!active.character;
    renderRarityFilters();
    renderItemList();
    modal.classList.remove("hidden");
    setTimeout(() => itemSearch.focus(), 20);
    forceItemModalSize();
  }

  function closeItemModal() {
    modal.classList.add("hidden");
    state.modalSlot = null;
  }

  // Force taille du modal items (même approche que forceCharModalSize)
  function forceItemModalSize() {
    const panel = modal.querySelector(".modal-panel");
    const list = modal.querySelector(".item-list");
    if (!panel || !list) return;
    requestAnimationFrame(() => {
      const vh = window.innerHeight;
      panel.style.cssText += `
        position: fixed !important;
        top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
        width: 100vw !important;
        height: ${vh}px !important;
        max-height: none !important;
        max-width: none !important;
        margin: 0 !important;
        border-radius: 0 !important;
        border: 0 !important;
      `;
      const header = panel.querySelector(".modal-header");
      const search = panel.querySelector(".search-input");
      const filters = panel.querySelector(".rarity-filters");
      const used =
        (header?.offsetHeight || 0) +
        (search?.offsetHeight || 0) +
        (filters?.offsetHeight || 0);
      list.style.cssText += `
        height: ${vh - used}px !important;
        max-height: ${vh - used}px !important;
        overflow-y: auto !important;
        flex: none !important;
      `;
    });
  }
  window.addEventListener("resize", () => {
    if (!modal.classList.contains("hidden")) forceItemModalSize();
  });

  // Pills de filtre rareté : "Tous" + une pill par rareté présente dans le catalogue
  function renderRarityFilters() {
    const counts = {};
    for (const it of ITEMS) counts[it.rarete] = (counts[it.rarete] || 0) + 1;
    // Ordre fixe d'affichage
    const ordre = ["platinum", "awakenedunique", "unique", "awakenedgold", "gold", "awakenedsilver", "silver", "awakenedbronze", "bronze", "iron", "event"];
    const presentes = ordre.filter((r) => counts[r]);
    const total = ITEMS.length;
    const pills = [
      `<button class="rarity-pill ${state.modalRarityFilter === null ? "active" : ""}" data-rarity-filter="">Tous <span class="pill-count">${total}</span></button>`,
      ...presentes.map((r) => `<button class="rarity-pill ${state.modalRarityFilter === r ? "active" : ""}" data-rarity-filter="${r}">${rarityLabel(r)} <span class="pill-count">${counts[r]}</span></button>`),
    ];
    // Pill "Compatibles seulement" — visible uniquement si un perso est sélectionné
    if (active.character) {
      const compatCount = ITEMS.filter((it) => isCompatible(it, active.character)).length;
      pills.push(`<button class="rarity-pill compat-pill ${state.modalCompatOnly ? "active" : ""}" data-compat-only="1">✓ Compatibles <span class="pill-count">${compatCount}</span></button>`);
    }
    rarityFiltersEl.innerHTML = pills.join("");
  }

  // Ordre canonique d'affichage des raretés (du plus fort au plus faible)
  const RARITY_ORDER = [
    "platinum",
    "awakenedunique",
    "unique",
    "awakenedgold",
    "gold",
    "awakenedsilver",
    "silver",
    "awakenedbronze",
    "bronze",
    "iron",
    "event",
  ];
  const RARITY_ORDER_MAP = Object.fromEntries(RARITY_ORDER.map((r, i) => [r, i]));

  function renderItemList() {
    const q = state.modalSearch.toLowerCase().trim();
    const matches = ITEMS.filter((it) => {
      // Filtre rareté
      if (state.modalRarityFilter && it.rarete !== state.modalRarityFilter) return false;
      // Filtre compatibilité
      if (state.modalCompatOnly && active.character && !isCompatible(it, active.character)) return false;
      // Filtre texte
      if (!q) return true;
      if (it.nom.toLowerCase().includes(q)) return true;
      return it.lignes.some((l) => {
        if (l.est_passif) return (l.description_passif || "").toLowerCase().includes(q);
        return statLabel(l.stat).toLowerCase().includes(q);
      });
    });

    // Tri par rareté (ordre canonique) — items de même rareté gardent leur ordre catalogue
    matches.sort((a, b) => {
      const ra = RARITY_ORDER_MAP[a.rarete] ?? 99;
      const rb = RARITY_ORDER_MAP[b.rarete] ?? 99;
      return ra - rb;
    });

    if (matches.length === 0) {
      itemList.innerHTML = `<li style="color: var(--text-soft); cursor: default; grid-column: 1 / -1; padding: 14px; text-align: center;">Aucun item trouvé</li>`;
      return;
    }

    itemList.innerHTML = matches
      .map((it) => {
        // Regroupement par slot interne (1, 2, 3, 4)
        const lignesParSlot = {};
        for (const l of it.lignes) {
          const sn = l.slot || 1;
          if (!lignesParSlot[sn]) lignesParSlot[sn] = [];
          lignesParSlot[sn].push(l);
        }
        const renderLigneModal = (l) => {
          if (l.est_passif) {
            return `<div><span class="passive-marker">⚡ Passif :</span> ${l.description_passif}</div>`;
          }
          const cond = l.condition ? ` <em style="color:var(--text-soft)">(${l.condition.description})</em>` : "";
          const val = l.valeur_max.toFixed(2).replace(".", ",");
          return `<div>+${val}% ${statLabel(l.stat)}${cond}</div>`;
        };
        const slotsOrdered = Object.keys(lignesParSlot).map(Number).sort((a, b) => a - b);
        const lignes = slotsOrdered
          .map((sn) => {
            const label = sn === 4 ? `Slot ${sn} <span class="slot-7">★7</span>` : `Slot ${sn}`;
            return `
              <div class="modal-slot-group">
                <div class="modal-slot-label">${label}</div>
                ${lignesParSlot[sn].map(renderLigneModal).join("")}
              </div>
            `;
          })
          .join("");
        const img = it.image
          ? `<img class="item-img" src="${it.image}" alt="" loading="lazy" onerror="this.style.display='none'" />`
          : `<div class="item-img item-img-placeholder">?</div>`;
        const tagsLine = formatTagsPorteur(it.tagsPorteur);
        const tagsHTML = tagsLine
          ? `<div class="item-tags-porteur" title="Compatible avec : ${tagsLine}">${tagsLine}</div>`
          : "";
        const compat = isCompatible(it, active.character);
        let compatBadge = "";
        let compatClass = "";
        if (compat === true) {
          compatBadge = `<span class="compat-badge compat-yes" title="Compatible avec ${active.character.nom.trim()}">✓</span>`;
          compatClass = "is-compat";
        } else if (compat === false) {
          compatBadge = `<span class="compat-badge compat-no" title="Incompatible avec ${active.character.nom.trim()}">✗</span>`;
          compatClass = "is-incompat";
        }
        return `
          <li data-id="${it.id}" class="${compatClass}">
            <div class="item-card-row">
              <div class="item-pick" data-pick="${it.id}">
                ${img}
                <div class="item-info">
                  <div class="item-name" title="${it.nom}">
                    ${compatBadge}
                    <span class="item-rarete-pill rarete-${it.rarete}">${rarityLabel(it.rarete)}</span>${it.nom}
                  </div>
                  ${tagsHTML}
                </div>
              </div>
              <button class="item-toggle" data-toggle="${it.id}" aria-label="Voir les détails" type="button">▾</button>
            </div>
            <div class="item-lignes hidden" data-lignes="${it.id}">${lignes}</div>
          </li>
        `;
      })
      .join("");
  }

  modalClose.addEventListener("click", closeItemModal);
  modal.querySelector(".modal-backdrop").addEventListener("click", closeItemModal);
  itemSearch.addEventListener("input", () => {
    state.modalSearch = itemSearch.value;
    renderItemList();
  });
  rarityFiltersEl.addEventListener("click", (e) => {
    const compatBtn = e.target.closest("button[data-compat-only]");
    if (compatBtn) {
      state.modalCompatOnly = !state.modalCompatOnly;
      renderRarityFilters();
      renderItemList();
      return;
    }
    const btn = e.target.closest("button[data-rarity-filter]");
    if (!btn) return;
    const v = btn.dataset.rarityFilter;
    state.modalRarityFilter = v === "" ? null : v;
    renderRarityFilters();
    renderItemList();
  });
  itemList.addEventListener("click", (e) => {
    // Toggle "voir détails" — n'effectue pas de sélection
    const toggleBtn = e.target.closest("button[data-toggle]");
    if (toggleBtn) {
      const id = toggleBtn.dataset.toggle;
      const block = itemList.querySelector(`[data-lignes="${id}"]`);
      if (block) {
        const open = !block.classList.contains("hidden");
        block.classList.toggle("hidden", open);
        toggleBtn.textContent = open ? "▾" : "▴";
      }
      return;
    }
    // Sélection : clic sur la zone "pick" (image + nom)
    const pick = e.target.closest("[data-pick]");
    if (!pick) return;
    const item = ITEMS.find((it) => it.id === pick.dataset.pick);
    if (!item) return;
    const _animSlot = state.modalSlot; // capture avant closeItemModal (qui null-ise modalSlot)
    active.items[state.modalSlot] = item;
    closeItemModal();
    renderAll();
    motionPopSlot(_animSlot);
  });

  // ===== RENDU : SLOTS =====
  function renderSlots() {
    for (let i = 0; i < 3; i++) {
      const el = document.querySelector(`[data-slot-content="${i}"]`);
      const item = active.items[i];

      if (!item) {
        el.className = "slot-content empty";
        el.innerHTML = "+ Choisir un item";
        el.onclick = () => openItemModal(i);
        continue;
      }

      el.className = "slot-content filled";
      el.onclick = null;

      // Regroupement par slot interne de l'item (1, 2, 3, 4)
      // On garde l'index ORIGINAL de la ligne dans item.lignes (utile pour les choix OR)
      const lignesParSlot = {};
      item.lignes.forEach((l, lineIdx) => {
        const sn = l.slot || 1;
        if (!lignesParSlot[sn]) lignesParSlot[sn] = [];
        lignesParSlot[sn].push({ l, lineIdx });
      });

      const teamSlot = state.team[state.activeSlot];
      if (!teamSlot.itemChoices) teamSlot.itemChoices = [{}, {}, {}];
      const slotChoices = teamSlot.itemChoices[i] || {};

      const renderLigne = (l, lineIdx) => {
        if (l.est_passif) {
          // OR-choice : passif "A - OR - B" → UI de sélection
          const alts = parseOrPassif(l.description_passif);
          if (alts) {
            const selected = slotChoices[lineIdx] ?? 0;
            const altsHTML = alts.map((alt, idx) => `
              <button class="or-choice ${idx === selected ? 'is-selected' : ''}"
                      data-or-choice="${i}:${lineIdx}:${idx}" type="button">
                <span class="or-mark">${idx === selected ? '●' : '○'}</span>
                <span class="or-text">+${alt.valeur_max.toFixed(0)}% <strong>${alt.label}</strong></span>
              </button>
            `).join("");
            return `
              <div class="slot-ligne-or">
                <div class="slot-ligne-or-head"><span class="bullet">⚡</span>Choix aléatoire — sélectionne ta ligne :</div>
                <div class="slot-ligne-or-options">${altsHTML}</div>
              </div>
            `;
          }
          return `<div class="slot-ligne passive"><span class="bullet">⚡</span>${l.description_passif}</div>`;
        }
        const conditionRemplie = condRemplieCalc(l, getTeamTagCounts());
        const cls = l.condition ? (conditionRemplie ? "active" : "inactive") : "";
        const valeur = interpolerValeur(l, 1); // toujours max
        const condBadge = l.condition
          ? ` <em style="color:var(--text-soft); font-size:10px">(${l.condition.description})</em>`
          : "";
        return `<div class="slot-ligne ${cls}">
                  <span class="bullet">${conditionRemplie ? "+" : "—"}</span>
                  <span class="ligne-text">${fmtPct(valeur)} ${statLabel(l.stat)}</span>${condBadge}
                </div>`;
      };

      const slotsOrdered = Object.keys(lignesParSlot).map(Number).sort((a, b) => a - b);
      const slotsHTML = slotsOrdered
        .map((sn) => {
          const label = sn === 4 ? `Slot ${sn} <span class="slot-7">★7</span>` : `Slot ${sn}`;
          return `
            <div class="item-slot-group">
              <div class="item-slot-label">${label}</div>
              <div class="item-slot-lignes">${lignesParSlot[sn].map(({ l, lineIdx }) => renderLigne(l, lineIdx)).join("")}</div>
            </div>
          `;
        })
        .join("");

      const slotTagsLine = formatTagsPorteur(item.tagsPorteur);
      const slotTagsHTML = slotTagsLine
        ? `<div class="slot-item-tags">Compatible : ${slotTagsLine}</div>`
        : "";
      el.innerHTML = `
        <div class="slot-item-rarete">${rarityLabel(item.rarete)}</div>
        <div class="slot-item-name">${item.nom}</div>
        ${slotTagsHTML}
        <div class="slot-lignes">${slotsHTML}</div>
        <div class="slot-actions">
          <button class="btn" data-action="change" data-slot="${i}">Changer</button>
          <button class="btn danger" data-action="clear" data-slot="${i}">Retirer</button>
        </div>
      `;
    }
  }

  // Délégation pour les boutons d'action dans les slots
  document.querySelector(".slots").addEventListener("click", (e) => {
    // OR-choice : clic sur une alternative
    const orBtn = e.target.closest("[data-or-choice]");
    if (orBtn) {
      const [slotStr, lineIdxStr, altStr] = orBtn.dataset.orChoice.split(":");
      const slotIdx = +slotStr;
      const lineIdx = +lineIdxStr;
      const alt = +altStr;
      const teamSlot = state.team[state.activeSlot];
      if (!teamSlot.itemChoices) teamSlot.itemChoices = [{}, {}, {}];
      if (!teamSlot.itemChoices[slotIdx]) teamSlot.itemChoices[slotIdx] = {};
      teamSlot.itemChoices[slotIdx][lineIdx] = alt;
      renderAll();
      return;
    }
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const slot = parseInt(btn.dataset.slot, 10);
    if (btn.dataset.action === "change") openItemModal(slot);
    if (btn.dataset.action === "clear") {
      active.items[slot] = null;
      renderAll();
    }
  });

  // ===== RENDU : CONDITIONS =====
  const conditionsPanel = document.getElementById("conditions-panel");
  const conditionsInputs = document.getElementById("conditions-inputs");

  function renderConditions() {
    const tags = getRequiredTags();
    if (tags.length === 0) {
      conditionsPanel.classList.add("hidden");
      return;
    }
    conditionsPanel.classList.remove("hidden");
    const autoCounts = getTeamTagCounts();

    conditionsInputs.innerHTML = tags
      .map((tag) => {
        const userVal = state.conditions[tag] ?? 0;
        const autoVal = autoCounts[tag] || 0;
        const effective = Math.max(userVal, autoVal);
        let seuils = [];
        active.items.forEach((it) => {
          if (!it) return;
          it.lignes.forEach((l) => {
            if (l.condition && l.condition.tag_requis === tag) seuils.push(l.condition.seuil);
          });
        });
        const maxSeuil = seuils.length ? Math.max(...seuils) : 0;
        const ok = effective >= maxSeuil;
        return `
          <div class="cond-row">
            <div class="cond-info">
              <div class="cond-label">« ${tag} » dans l'équipe ${ok ? "<span class='cond-ok'>✓</span>" : "<span class='cond-ko'>✗</span>"}</div>
              <div class="cond-hint">Auto : <strong>${autoVal}</strong> · Seuil requis : ${maxSeuil}</div>
            </div>
            <input type="number" min="0" max="6" value="${userVal}" data-tag="${tag}" title="Override manuel (compte effectif = max(auto, manuel))" />
          </div>
        `;
      })
      .join("");
  }

  conditionsInputs.addEventListener("input", (e) => {
    const input = e.target.closest("input[data-tag]");
    if (!input) return;
    const v = parseInt(input.value, 10);
    state.conditions[input.dataset.tag] = isNaN(v) ? 0 : v;
    renderSlots();
    renderResults();
  });

  // ===== RENDU : RÉSULTATS =====
  const statsGrid = document.getElementById("stats-grid");
  const passifsZone = document.getElementById("passifs-zone");
  const inactiveZone = document.getElementById("inactive-zone");

    // Stats regroupées par catégorie thématique
    const DISPLAY_GROUPS = [
      {
        slug: "vie",
        titre: "Vie",
        stats: [
          { cible: "force",                 label: "Force" },
          { cible: "quantite_regen_force",  label: "Quantité de régénération" },
        ],
      },
      {
        slug: "attaque",
        titre: "Attaque",
        stats: [
          { cible: "attaque_physique",      label: "Strike ATK" },
          { cible: "attaque_energie",       label: "Blast ATK" },
          { cible: "critique",              label: "Critical Rate" },
          { cible: "degats_tech_spe",       label: "Dégâts technique spéciale" },
          { cible: "degats_ultime",         label: "Dégâts technique ultime" },
        ],
      },
      {
        slug: "defense",
        titre: "Défense",
        stats: [
          { cible: "defense_physique",      label: "Strike DEF" },
          { cible: "defense_energie",       label: "Blast DEF" },
        ],
      },
      {
        slug: "utilitaire",
        titre: "Utilitaire",
        stats: [
          { cible: "vitesse_regen_ki",      label: "Ki Recover" },
          { cible: "vanish_recover",        label: "Vanish Recover" },
        ],
      },
    ];

  function renderResults() {
    renderZBilan();
    const noItems = active.items.every((s) => !s);
    const noZ = buildTeamZItemsFor(state.activeSlot).length === 0;
    if (noItems && noZ) {
      statsGrid.innerHTML = `<p class="placeholder" style="color: var(--text-soft); font-size: 13px; margin: 0;">Équipe au moins un item (ou sélectionne un perso) pour voir le résumé des effets.</p>`;
      passifsZone.innerHTML = `<p class="placeholder">Aucun effet passif.</p>`;
      inactiveZone.innerHTML = "";
      return;
    }

    // Calculs SÉPARÉS pour distinguer ce qui vient des items vs des Cap Z.
    // Les conditions sont team-wide (auto-détection des traits de toute l'équipe).
    // Les items "OR" (ex : "ATK énergie OR ATK physique") sont résolus selon le choix utilisateur.
    const zItems = buildTeamZItemsFor(state.activeSlot);
    const effCond = getTeamTagCounts();
    const resolvedItems = getActiveItemsWithChoices();
    const itemOnlyItems = resolvedItems.filter(Boolean);

    // Split item lines par TYPE (base / pur+direct) pour affichage séparé
    // base = "Attaque physique DE BASE" / "Force de base" ...
    // pur  = "Attaque physique" / "Critique" (pur) + "Dégâts infligés" (direct)
    const splitItems = splitItemsByType(itemOnlyItems);

    // Split Z items par KIND (Cap Z classique vs Zenkai)
    const zClassicItems = zItems.filter((it) => it.kind === "z");
    const zZenkaiItems  = zItems.filter((it) => it.kind === "zenkai");

    const itemBaseResult = calculerStats({ items: splitItems.baseItems, conditions: effCond });
    const itemPurResult  = calculerStats({ items: splitItems.purItems,  conditions: effCond });
    const zClassicResult = calculerStats({ items: zClassicItems, conditions: effCond });
    const zZenkaiResult  = calculerStats({ items: zZenkaiItems, conditions: effCond });
    const itemResult     = calculerStats({ items: itemOnlyItems, conditions: effCond }); // pour stats-cell items unifié si besoin
    const zResult        = calculerStats({ items: zItems,        conditions: effCond });
    // `result` = calcul combiné (additif par type, multiplicatif entre types) → utilisé comme Total.
    const result         = calculerStats({ items: [...resolvedItems, ...zItems], conditions: effCond });

    // ===== ORDRE DE CALCUL DBL =====
    // Cap Z et items partagent les MÊMES buckets base/pur/direct par stat.
    // Les bonus "de base" (Cap Z + items) s'additionnent dans la couche base,
    // les "pur" (Cap Z + items) dans la couche pur, idem direct.
    // Puis : final = base_stat × (1 + bonusBase) × (1 + bonusPur) × (1 + bonusDirect).
    //
    // Conséquence : les lignes pures des items "prennent en compte" les Cap Z (qui
    // sont déjà cumulées dans la couche base), car la multiplication des couches
    // amplifie le pur sur une base plus grande. C'est précisément le calc déjà fait
    // par `result` (qui combine items + zItems). On l'utilise directement comme Total.
    const combinedStats = result.stats;

    // --- Rendu groupé : Vie / Attaque / Défense / Utilitaire ---
    // 5 colonnes par stat : Items (base) / Cap Z / Cap Z Zenkai / Items (pur) / Total
    const renderStatRow = ({ cible, label }) => {
      const s    = combinedStats[cible];
      const sib  = itemBaseResult.stats[cible];   // Items (base)
      const sip  = itemPurResult.stats[cible];    // Items (pur + direct)
      const szc  = zClassicResult.stats[cible];   // Cap Z classique
      const szk  = zZenkaiResult.stats[cible];    // Cap Z Zenkai
      const hasBonus = s && s.hasBonus;
      if (!hasBonus) {
        return `
          <div class="stat-row stat-row-empty">
            <div class="stat-row-label">${label}</div>
            <div class="stat-row-val"><span class="stat-empty">—</span></div>
          </div>`;
      }
      const fmtMult = (v) => "× " + v.toFixed(3).replace(".", ",");
      const fmtGain = (v) => "+" + v.toFixed(2).replace(".", ",") + "%";
      const cell = (cls, label, source) => {
        if (!source || !source.hasBonus) {
          return `<div class="stat-cell ${cls} stat-cell-dim">
            <span class="stat-cell-label">${label}</span>
            <span class="stat-cell-mult">—</span>
          </div>`;
        }
        return `<div class="stat-cell ${cls}">
          <span class="stat-cell-label">${label}</span>
          <span class="stat-cell-mult">${fmtMult(source.multTotal)}</span>
          <span class="stat-cell-gain">${fmtGain(source.gainPct)}</span>
        </div>`;
      };
      const cells =
        cell("stat-cell-item-base", "Items (base)", sib) +
        cell("stat-cell-z",         "Cap Z",        szc) +
        cell("stat-cell-z-zenkai",  "Cap Z Zenkai", szk) +
        cell("stat-cell-item-pur",  "Items (pur)",  sip) +
        cell("stat-cell-total",     "Total",        s);
      return `
        <div class="stat-row stat-row-split">
          <div class="stat-row-label">${label}</div>
          <div class="stat-row-cells">${cells}</div>
        </div>`;
    };

    statsGrid.innerHTML = DISPLAY_GROUPS
      .map((g) => {
        const rows = g.stats.map(renderStatRow).join("");
        return `
          <div class="stat-group stat-group-${g.slug}">
            <div class="stat-group-title">${g.titre}</div>
            <div class="stat-group-rows">${rows}</div>
          </div>
        `;
      })
      .join("");
    motionStaggerStats();
    motionFlashStats();

    // --- Passifs ---
    if (result.passifs.length === 0) {
      passifsZone.innerHTML = `<p class="placeholder">Aucun effet passif sur les items équipés.</p>`;
    } else {
      // Regroupement par item (clé = slot + nom) pour ne pas dupliquer
      // l'entête « source » à chaque ligne.
      const groups = [];
      const groupsByKey = {};
      for (const p of result.passifs) {
        const key = `${p.slot}-${p.itemNom}`;
        if (!groupsByKey[key]) {
          const g = { slot: p.slot, itemNom: p.itemNom, descriptions: [] };
          groupsByKey[key] = g;
          groups.push(g);
        }
        groupsByKey[key].descriptions.push(p.description);
      }

      passifsZone.innerHTML = groups
        .map((g) => {
          const lignes = g.descriptions
            .map((d) => {
              // Sous-effets (commencent par "-" ou "·") sont indentés
              const isSub = /^[-·•]\s*/.test(d);
              const cleaned = d.replace(/^[-·•]\s*/, "");
              return `<div class="passif-line ${isSub ? "is-sub" : ""}">${cleaned}</div>`;
            })
            .join("");
          return `
            <div class="callout passive">
              <div class="callout-tag">⚡</div>
              <div class="callout-content">
                <div class="callout-source"><strong>${g.itemNom}</strong> · slot ${g.slot + 1}</div>
                <div class="passif-list">${lignes}</div>
              </div>
            </div>
          `;
        })
        .join("");
    }

    // --- Conditions non remplies ---
    if (result.conditionsInactives.length === 0) {
      inactiveZone.innerHTML = "";
    } else {
      inactiveZone.innerHTML = result.conditionsInactives
        .map(
          (c) => `
          <div class="callout inactive">
            <div class="callout-tag">❓ Inactif</div>
            <div>
              <div class="callout-body">
                <strong>+${fmtPct(c.valeur).replace("%","")}% ${c.statLabel}</strong> — ${c.description}
              </div>
              <div class="callout-source">
                Source : ${c.itemNom} (slot ${c.slot + 1}) — ${c.valeurActuelle}/${c.seuil} « ${c.tag} »
              </div>
            </div>
          </div>
        `
        )
        .join("");
    }
  }

  // ===== BILAN CAP Z =====
  const zBilanEl = document.getElementById("z-bilan");
  // Toutes les stats potentiellement affectées par des Cap Z (cohérent avec DISPLAY_GROUPS)
  const Z_BILAN_STATS = [
    { cible: "force",                 label: "Force" },
    { cible: "quantite_regen_force",  label: "Régénération" },
    { cible: "attaque_physique",      label: "Strike ATK" },
    { cible: "attaque_energie",       label: "Blast ATK" },
    { cible: "critique",              label: "Critical" },
    { cible: "degats_infliges",       label: "Dégâts" },
    { cible: "degats_energie_infliges", label: "Dégâts énergie" },
    { cible: "degats_tech_spe",       label: "Dégâts spé." },
    { cible: "degats_ultime",         label: "Dégâts ultime" },
    { cible: "defense_physique",      label: "Strike DEF" },
    { cible: "defense_energie",       label: "Blast DEF" },
    { cible: "garde_contre_degats",   label: "Garde" },
    { cible: "vitesse_regen_ki",      label: "Ki Recover" },
    { cible: "vanish_recover",        label: "Vanish" },
  ];

  function renderZBilan() {
    const occupied = state.team
      .map((s, i) => ({ ...s, idx: i }))
      .filter((s) => s.character);
    if (occupied.length === 0) {
      zBilanEl.innerHTML = `<p class="placeholder">Aucun perso dans l'équipe.</p>`;
      return;
    }

    // --- Calcul des totaux par stat sur l'ensemble de l'équipe ---
    // Pour chaque stat, on accumule les gainPct reçus par chaque perso occupé.
    const statTotals = {};
    for (const slot of occupied) {
      const zItems = buildTeamZItemsFor(slot.idx);
      if (zItems.length === 0) continue;
      const conds = getEffectiveConditionsFor(slot.character);
      const result = calculerStats({ items: zItems, conditions: conds });
      for (const cible of Object.keys(result.stats)) {
        const s = result.stats[cible];
        if (!s.hasBonus) continue;
        if (!statTotals[cible]) {
          statTotals[cible] = { label: s.label, totalGain: 0, count: 0, max: 0 };
        }
        statTotals[cible].totalGain += s.gainPct;
        statTotals[cible].count++;
        if (s.gainPct > statTotals[cible].max) statTotals[cible].max = s.gainPct;
      }
    }
    // Trier par totalGain décroissant
    const orderedTotals = Object.entries(statTotals)
      .sort((a, b) => b[1].totalGain - a[1].totalGain);

    const totauxHTML = orderedTotals.length === 0
      ? `<p class="placeholder">Aucun bonus Z chiffrable sur l'équipe.</p>`
      : orderedTotals
          .map(([cible, t]) => {
            const totalFmt = t.totalGain.toFixed(1).replace(".", ",");
            const avg = t.totalGain / t.count;
            const avgFmt = avg.toFixed(1).replace(".", ",");
            const maxFmt = t.max.toFixed(1).replace(".", ",");
            return `
              <div class="z-totals-row">
                <div class="z-totals-label">${t.label}</div>
                <div class="z-totals-total">+${totalFmt}%</div>
                <div class="z-totals-detail">${t.count} perso · moy. +${avgFmt}% · max +${maxFmt}%</div>
              </div>
            `;
          })
          .join("");

    // Total global = somme de tous les gainPct sur tous les perso et toutes les stats
    const grandTotal = orderedTotals.reduce((sum, [, t]) => sum + t.totalGain, 0);
    const grandStatsCount = orderedTotals.length;
    const grandLinesCount = orderedTotals.reduce((sum, [, t]) => sum + t.count, 0);
    const grandTotalFmt = grandTotal.toFixed(0);

    const totauxSection = `
      <div class="z-grand-total">
        <div class="z-grand-total-label">Total global équipe</div>
        <div class="z-grand-total-value">+${grandTotalFmt}%</div>
        <div class="z-grand-total-detail">${grandLinesCount} applications de Z sur ${grandStatsCount} stats</div>
      </div>
      <div class="z-totals">
        <div class="z-totals-title">Totaux par stat (équipe)</div>
        ${totauxHTML}
      </div>
    `;

    // Format compact d'une condition (pour les pills inline)
    const condLabel = (l) => {
      if (!l.condition) return null;
      const tags = l.condition.tags_requis || [];
      const sep = l.condition.mode === "and" ? " et " : " ou ";
      const prefix = l.condition.mode === "and" ? "à la fois " : "";
      return prefix + tags.join(sep);
    };

    const perCharSection = occupied
      .map((slot) => {
        const isLeader = slot.idx === effectiveLeaderSlot();
        const trio = Math.floor(slot.idx / 3);
        const zItems = buildTeamZItemsFor(slot.idx);
        const conds = getEffectiveConditionsFor(slot.character);
        const result = calculerStats({ items: zItems, conditions: conds });

        // Pour chaque source Z, on liste ligne par ligne ce qui s'applique
        const sourcesBlocks = zItems.map((zi) => {
          const isSelf = zi.sourceSlot === slot.idx;
          const senderSlot = state.team[zi.sourceSlot];
          const senderTrio = Math.floor(zi.sourceSlot / 3);
          const senderIsLeader = zi.sourceSlot === effectiveLeaderSlot();
          // Indique si cette source a été bypassée par le leader (sender ou target leader, même trio cible)
          const wasBypassed =
            (slot.idx === effectiveLeaderSlot()) ||
            (senderIsLeader && senderTrio === trio);

          // Pour l'affichage, on prend les lignes ORIGINALES (lignesAll)
          // afin de pouvoir montrer les ✗ pour les lignes non-applicables.
          const displayLignes = zi.lignesAll || zi.lignes;
          const linesHTML = displayLignes
            .filter((l) => !l.est_passif)
            .map((l) => {
              const ok = wasBypassed || !l.condition || condRemplieCalc(l, conds);
              const lab = STATS[l.stat]?.label || l.stat;
              const val = l.valeur_max.toFixed(0);
              const cond = condLabel(l);
              const condHTML = cond
                ? `<span class="z-detail-cond ${ok ? "is-ok" : "is-ko"}">[${cond}]</span>`
                : "";
              return `<div class="z-detail-line ${ok ? "is-ok" : "is-ko"}">
                <span class="z-detail-mark">${ok ? "✓" : "✗"}</span>
                <span class="z-detail-stat">+${val}% ${lab}</span>
                ${condHTML}
              </div>`;
            })
            .join("");

          const totalLines = displayLignes.filter((l) => !l.est_passif).length;
          const activeLines = displayLignes
            .filter((l) => !l.est_passif)
            .filter((l) => wasBypassed || !l.condition || condRemplieCalc(l, conds))
            .length;

          const senderNom = isSelf ? "Soi" : (senderSlot.character?.nom.trim() || "?");
          const tierLab = ["I", "II", "III", "IV"][zi.tier - 1];
          const trioLab = senderTrio === 0 ? "Trio A" : "Trio B";
          const bypassBadge = wasBypassed
            ? ` <span class="z-leader-bypass">★ Leader bypass</span>`
            : "";

          return `
            <div class="z-source-block ${activeLines === totalLines ? "all-applied" : activeLines === 0 ? "none-applied" : "partial-applied"}">
              <div class="z-source-head">
                <span class="z-source-title">${senderNom}${senderIsLeader ? " ★" : ""} <small>(${trioLab}, Z ${tierLab})</small></span>
                <span class="z-source-cov">${activeLines}/${totalLines} lignes</span>
                ${bypassBadge}
              </div>
              <div class="z-source-lines">${linesHTML || '<span class="placeholder">Aucune ligne chiffrable</span>'}</div>
            </div>
          `;
        }).join("");

        // Cumul stats (compact)
        const bonusList = Z_BILAN_STATS
          .map(({ cible, label }) => {
            const s = result.stats[cible];
            if (!s || !s.hasBonus) return null;
            const multFmt = s.multTotal.toFixed(3).replace(".", ",");
            const gainFmt = s.gainPct.toFixed(2).replace(".", ",");
            return `<div class="z-bilan-stat"><span class="z-bilan-stat-label">${label}</span><span class="z-bilan-stat-mult">×${multFmt} <small>(+${gainFmt}%)</small></span></div>`;
          })
          .filter(Boolean)
          .join("");

        const img = slot.character.image
          ? `<img class="z-bilan-img" src="${slot.character.image}" alt="" onerror="this.style.display='none'"/>`
          : `<div class="z-bilan-img"></div>`;
        const tierLab = ["I", "II", "III", "IV"][slot.zTier - 1];

        return `
          <div class="z-bilan-row ${isLeader ? "is-leader" : ""}">
            <div class="z-bilan-head">
              ${img}
              <div class="z-bilan-name">
                ${isLeader ? `<span class="z-bilan-star">★</span>` : ""}
                <strong>${slot.character.nom.trim()}</strong>
                <span class="z-bilan-tier">Cap Z ${tierLab}</span>
                <span class="z-bilan-trio">${trio === 0 ? "Trio A" : "Trio B"}</span>
              </div>
            </div>
            <div class="z-bilan-sources-detail">${sourcesBlocks}</div>
            <div class="z-bilan-total-label">Cumul stats (Cap Z uniquement)</div>
            <div class="z-bilan-stats">${bonusList || `<span class="placeholder">Aucun bonus Z cumulable</span>`}</div>
          </div>
        `;
      })
      .join("");

    zBilanEl.innerHTML = totauxSection + `<div class="z-bilan-grid">${perCharSection}</div>`;
  }

  // ===== RENDU GLOBAL =====
  function renderAll() {
    renderConditions();
    renderSlots();
    renderResults();
  }

  // ===== BOUTON "SANS LEADER" =====
  const noLeaderBtn = document.getElementById("no-leader-btn");

  function renderNoLeaderBtn() {
    if (!noLeaderBtn) return;
    noLeaderBtn.classList.toggle("is-active", state.noLeader);
    const textEl  = noLeaderBtn.querySelector(".no-leader-text");
    const badgeEl = noLeaderBtn.querySelector(".no-leader-badge");
    if (textEl)  textEl.textContent  = state.noLeader ? "Réactiver le leader" : "Désactiver le leader";
    if (badgeEl) badgeEl.textContent = state.noLeader ? "ON"  : "OFF";
    if (badgeEl) badgeEl.classList.toggle("is-on", state.noLeader);
  }

  noLeaderBtn.addEventListener("click", () => {
    state.noLeader = !state.noLeader;
    renderTeamGrid();       // met à jour les étoiles + appelle renderNoLeaderBtn
    renderCharZAbility();   // met à jour le badge "Leader bypass"
    renderResults();        // recalcule les Cap Z sans leader
  });

  // ===== MOTION DESIGN =====
  // Vanilla JS — GPU only (transform + opacity). Aucune dépendance.
  const _rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Scroll reveal : panels glissent vers le haut en entrant dans le viewport
  function motionInitScrollReveal() {
    if (_rm) return;
    const panels = document.querySelectorAll('.panel:not(#conditions-panel)');
    // Masquer instantanément (sans transition) puis révéler avec IO
    panels.forEach((el, i) => {
      el.dataset.motion = 'hidden';
      el.style.setProperty('--reveal-delay', `${Math.min(i, 5) * 70}ms`);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.dataset.motion = 'visible'; // déclenche la transition CSS
        io.unobserve(e.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' });
    panels.forEach(el => io.observe(el));
  }

  // 2. Stagger des stat-rows : animation-delay échelonné à chaque recalcul
  function motionStaggerStats() {
    if (_rm) return;
    document.querySelectorAll('.stat-row-split').forEach((row, i) => {
      row.style.animationDelay = `${i * 40}ms`;
    });
  }

  // 3. Flash orange des cellules non-vides au recalcul
  function motionFlashStats() {
    if (_rm) return;
    document.querySelectorAll('.stat-cell:not(.stat-cell-dim)').forEach(cell => {
      cell.classList.remove('is-flashing');
      void cell.offsetWidth; // force reflow pour relancer l'animation
      cell.classList.add('is-flashing');
    });
  }

  // 4. Pop-in bounce du slot item après équipement
  function motionPopSlot(slotIdx) {
    if (_rm) return;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-slot-content="${slotIdx}"]`);
      if (!el) return;
      el.classList.remove('is-popping');
      void el.offsetWidth;
      el.classList.add('is-popping');
    });
  }

  // ===== INIT =====
  renderTeamGrid();
  renderCharPicker();
  renderCharTraits();
  renderBuildState();
  renderAll();
  motionInitScrollReveal();
})();
