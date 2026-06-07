// ============================================================
// DBL Item Builder — UI + wiring
// ============================================================

(function () {
  const { ITEMS, STATS, PERSONNAGES } = window.DBL_DATA;
  const { calculerStats, interpolerValeur, conditionRemplie: condRemplieCalc, multiplicateurCondition: multCondCalc, LABELS_CIBLES, STATS_CIBLES } = window.DBL_CALC;

  // Raccourci traduction — toujours utiliser T() pour les chaînes UI
  const T = (key, params) => window.DBL_I18N.T(key, params);

  // ===== PATCH : CORRECTION DES CONDITIONS ZENKAI Z =====
  // Le scraper a mal interprété les Zenkai Z au format « Attribut : X » et
  // « Classe : Y » : il a extrait les phrases complètes comme tags au lieu
  // des noms entre guillemets. Ce correcteur tourne une seule fois au
  // chargement et répare les tags_requis de chaque ligne Zenkai Z cassée.
  // ------------------------------------------------------------
  const _ATTR_TO_ELEM = {
    "Attribut : Bleu":    "BLU",
    "Attribut : Rouge":   "RED",
    "Attribut : Vert":    "GRN",
    "Attribut : Jaune":   "YEL",
    "Attribut : Violet":  "PUR",
    "Attribut : Lumière": "LGT",
    "Attribut : Clair":   "LGT",
  };
  function _mapZenkaiTag(raw) {
    if (_ATTR_TO_ELEM[raw]) return _ATTR_TO_ELEM[raw];
    // "Classe : X" → "X"  (getTeamTagCounts stocke déjà "X" en direct)
    const m = raw.match(/^(?:Classe|[ÉE]pisode)\s*:\s*(.+)$/i);
    if (m) return m[1].trim();
    return raw;
  }
  function _patchZenkaiCond(cond, texteBrut) {
    if (!cond || !cond.tags_requis) return cond;
    // Détecte une condition cassée : les tags contiennent des phrases
    const broken = cond.tags_requis.some(
      t => t.includes('«') || t.includes('personnage') || /^(Lors|augmente)/i.test(t)
    );
    if (!broken) return cond;
    // Extrait les contenus entre « » depuis les tags et le texteBrut
    const src = cond.tags_requis.join(' ') + ' ' + (texteBrut || '');
    const extracted = [...src.matchAll(/«\s*([^»]+?)\s*»/g)].map(m => m[1].trim());
    if (!extracted.length) return cond;
    const newTags = [...new Set(extracted.map(_mapZenkaiTag))];
    const mode = /à la fois|\bà la fois\b/i.test(texteBrut || '') ? "and" : "threshold";
    return { ...cond, mode, tags_requis: newTags, tag_requis: newTags[0] || cond.tag_requis };
  }
  (function _patchAllZenkaiConditions() {
    for (const p of PERSONNAGES) {
      if (!p.zAbilitiesZenkai) continue;
      for (const z of p.zAbilitiesZenkai) {
        const txt = z.texteBrut || '';
        for (const l of z.lignes || []) {
          if (l.condition) l.condition = _patchZenkaiCond(l.condition, txt);
        }
      }
    }
  })();

  // ── PATCH RUNTIME : passifs Cap Z chiffrables "… augmente de N% …" ─────────
  // Le scraper laisse certains tiers de Cap Z en texte passif (ex. ULTRA "Cell
  // Parfait" : tiers 3-4 en passif contenant "augmente de 42% la défense et
  // l'attaque d'énergie de base des « Cyborg »…"). On les convertit en lignes
  // chiffrées pour qu'elles soient calculées (et fusionnées par tier ensuite).
  (function _convertZPassives() {
    const NORM = (s) => s.toLowerCase().replace(/[’‘]/g, "'")
      .replace(/\bd'/g, "").replace(/\bl'/g, "")
      .replace(/\b(la|le|les|du|des|de|votre|vos|aux|au)\b/g, " ")
      .replace(/\s+/g, " ").trim();
    const stripPrefix = (t) => t.replace(/^(Classe|Épisode|Episode|Style de combat|Personnage|Attribut)\s*:\s*/i, "").trim();
    function phraseToStats(phrase) {
      let p = NORM(phrase);
      const deBase = /\bbase\b/.test(p);
      p = p.replace(/\bbase\b/g, "").replace(/\s+/g, " ").trim();
      const suf = deBase ? "_de_base" : "";
      if (/dégâts ultimes/.test(p)) return ["degats_ultime"];
      if (/dégâts.*énergie.*infligés|dégâts.*infligés.*énergie/.test(p)) return ["degats_energie_infliges"];
      if (/dégâts.*infligés/.test(p)) return ["degats_infliges"];
      if (/force/.test(p)) return ["force_de_base"];
      const phys = /physique/.test(p), ener = /énergie|energie/.test(p);
      const atk = /attaque/.test(p), def = /défense|defense/.test(p);
      const out = [];
      if (atk && phys) out.push("attaque_physique" + suf);
      if (atk && ener) out.push("attaque_energie" + suf);
      if (def && phys) out.push("defense_physique" + suf);
      if (def && ener) out.push("defense_energie" + suf);
      return out.length ? out : null;
    }
    function parseZPassive(desc) {
      if (!desc) return null;
      const flat = desc.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
      if (!/augmente de \d/i.test(flat)) return null;
      if (/\bcontre\b/i.test(flat)) return null; // situationnel → reste passif
      const parts = flat.split(/augmente de /i).slice(1);
      const lines = [];
      for (const piece of parts) {
        const m = piece.match(/^([\d.,]+)\s*%\s*(.+)$/);
        if (!m) continue;
        const val = parseFloat(m[1].replace(",", "."));
        let rest = m[2].replace(/\s+et\s*$/, "").trim();
        const tags = [...rest.matchAll(/«\s*([^»]+?)\s*»/g)].map((x) => stripPrefix(x[1].trim()));
        let statPhrase = rest;
        const gi = rest.indexOf("«");
        if (gi >= 0) statPhrase = rest.slice(0, gi);
        statPhrase = statPhrase.replace(/\s+(par les|par membre|par|des|de|pour les|aux|à)\s*$/i, "").trim();
        const stats = phraseToStats(statPhrase);
        if (!stats) return null; // formulation inconnue → on garde le passif tel quel
        let cond = null;
        if (tags.length) {
          const clause = rest;
          const seuilM = clause.match(/au\s+moins\s+(\d+)/i);
          let seuil = seuilM ? parseInt(seuilM[1], 10) : 1;
          if (/\bautres?\b/i.test(clause)) seuil += 1; // "un autre" → un de plus que le porteur
          // AND seulement si "à la fois" ; sinon "des A et des B" = OR (threshold)
          const mode = (tags.length > 1 && /\bà la fois\b/i.test(clause)) ? "and" : "threshold";
          cond = { mode, seuil, tag_requis: tags[0], tags_requis: tags, description: flat };
        }
        for (const st of stats) lines.push({ stat: st, valeur_min: val, valeur_max: val, condition: cond });
      }
      return lines.length ? lines : null;
    }
    for (const p of PERSONNAGES) {
      for (const sets of [p.zAbilities, p.zAbilitiesZenkai]) {
        if (!sets) continue;
        for (const z of sets) {
          if (!z.lignes) continue;
          const out = [];
          for (const l of z.lignes) {
            if (l.est_passif && l.description_passif) {
              const conv = parseZPassive(l.description_passif);
              if (conv) { out.push(...conv); continue; }
            }
            out.push(l);
          }
          z.lignes = out;
        }
      }
    }
  })();

  // ── PATCH RUNTIME : seuils des conditions "threshold" ─────────────────────
  // (a) "si au moins N « X »" : le scraper ratait le "au moins" → seuil=1 ; on
  //     relit la description pour fixer N.
  // (b) "si un AUTRE « X »" / "autre que soi" : le porteur compte déjà, il faut
  //     donc un membre DE PLUS dans le trio → seuil += 1.
  (function _fixThresholdSeuils() {
    const reNum = /si\s+(?:au\s+moins\s+)?(\d+)\s*[«»]/i;
    for (const item of ITEMS) {
      for (const l of item.lignes || []) {
        if (!l.condition || l.condition.mode !== 'threshold') continue;
        const desc = l.condition.description || '';
        let seuil = l.condition.seuil || 1;
        const m = reNum.exec(desc);
        if (m) seuil = Math.max(seuil, parseInt(m[1], 10));
        if (/\bautres?\b/i.test(desc)) seuil += 1;
        l.condition.seuil = seuil;
      }
    }
  })();

  // ── CORRECTIONS MANUELLES : erreurs de la donnée source (fr.dblegends.net) ──
  // Certaines fiches du site contiennent des lignes erronées. On les retire ici
  // (survit aux re-scrapes, contrairement à une édition d'items.js).
  // Doit tourner AVANT la fusion "- OR -" pour que le séparateur orphelin
  // résultant soit ensuite nettoyé automatiquement.
  (function _manualDataFixes() {
    // item id → motifs de description_passif à supprimer
    const REMOVE_PASSIF = {
      // SPARKING !! - Trunks : Mai (Soutien) : option OR slot 3 fantôme (erreur source)
      equip_30025: [/détruit 1 carte de l['’]adversaire/i],
    };
    for (const item of ITEMS) {
      const patterns = REMOVE_PASSIF[item.id];
      if (!patterns || !item.lignes) continue;
      item.lignes = item.lignes.filter((l) =>
        !(l.est_passif && l.description_passif && patterns.some((re) => re.test(l.description_passif)))
      );
    }
  })();

  // ── PATCH RUNTIME : fusion des choix "- OR -" éclatés par le scraper ──────
  // Le scraper coupe parfois un choix « A - OR - B » en 3 lignes :
  //   [ligne A] / [passif "- OR -"] / [ligne B]
  // ce qui laisse une ligne "- OR -" orpheline ET fait compter A ET B (alors
  // que le joueur n'en obtient qu'UN). On recolle ces triplets :
  //   • STAT || STAT (sans condition) → un passif "Label A X~Y% - OR - Label B…"
  //     que parseOrPassif transforme en choix (une seule option comptée).
  //   • PASSIF || PASSIF → un seul passif "A - OR - B" (effets non chiffrés).
  //   • cas mixtes / en bord → on retire juste le séparateur orphelin.
  (function _mergeSplitOrPassives() {
    const isOrSep = (l) => l && l.est_passif && typeof l.description_passif === "string"
      && /^-*\s*OR\s*-*$/i.test(l.description_passif.trim());
    const fmtN = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
    const statPart = (l) => {
      const meta = STATS[l.stat];
      if (!meta) return null;
      return `${meta.label} ${fmtN(l.valeur_min)} ~ ${fmtN(l.valeur_max)}%`;
    };
    for (const item of ITEMS) {
      const L = item.lignes;
      if (!L || !L.some(isOrSep)) continue;
      const out = [];
      for (let k = 0; k < L.length; k++) {
        const l = L[k];
        if (isOrSep(l)) {
          const prev = out[out.length - 1];
          const next = L[k + 1];
          const prevStat = prev && !prev.est_passif && prev.condition == null && STATS[prev.stat];
          const nextStat = next && !next.est_passif && next.condition == null && STATS[next.stat];
          const prevPas = prev && prev.est_passif && prev.description_passif && !isOrSep(prev);
          const nextPas = next && next.est_passif && next.description_passif && !isOrSep(next);
          if (prevStat && nextStat) {
            out[out.length - 1] = {
              est_passif: true,
              description_passif: `${statPart(prev)} - OR - ${statPart(next)}`,
              slot: prev.slot,
            };
            k++; // saute la ligne B (consommée)
            continue;
          }
          if (prevPas && nextPas) {
            out[out.length - 1] = {
              ...prev,
              description_passif: prev.description_passif.trim() + " - OR - " + next.description_passif.trim(),
            };
            k++;
            continue;
          }
          continue; // séparateur orphelin (bord / mixte) → on le retire
        }
        out.push(l);
      }
      item.lignes = out;
    }
  })();

  // ── PATCH RUNTIME : passifs chiffrables "Augmente de X ~ Y% …" ────────────
  // Le scraper laisse certains bonus conditionnels en texte (est_passif).
  // On les convertit en lignes calculables au MAX (valeur_max = Y), avec leur
  // condition (threshold / per_member). La fourchette X~Y représente la plage
  // que le joueur peut obtenir ; on retient la borne haute.
  // Cas laissés en passif : situationnels ("… contre les « X »"), choix "- OR -",
  // et toute formulation de stat non reconnue (défaut sûr).
  (function _convertRangePassives() {
    // Normalise une phrase de stat en retirant articles/élisions ("l'attaque
    // d'énergie" → "attaque énergie") pour matcher quel que soit l'ordre des mots.
    const NORM = (s) => s.toLowerCase().replace(/[’‘]/g, "'")
      .replace(/\bd'/g, "").replace(/\bl'/g, "")
      .replace(/\b(la|le|les|du|des|de|votre|vos)\b/g, " ")
      .replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
    // Phrase normalisée (sans articles) → clés de stats (pur / HP / dégâts directs)
    const PHRASE = {
      "défense et attaque physique":  ["defense_physique", "attaque_physique"],
      "défense et attaque énergie":   ["defense_energie", "attaque_energie"],
      "attaque physique":             ["attaque_physique"],
      "attaque énergie":              ["attaque_energie"],
      "défense physique":             ["defense_physique"],
      "défense énergie":              ["defense_energie"],
      "attaque physique et énergie":  ["attaque_physique", "attaque_energie"],
      "attaque physique et défense énergie": ["attaque_physique", "defense_energie"],
      "défense énergie et attaque physique": ["defense_energie", "attaque_physique"],
      "défense physique et énergie":  ["defense_physique", "defense_energie"],
      "attaque physique et énergie et défense physique et énergie":
        ["attaque_physique", "attaque_energie", "defense_physique", "defense_energie"],
      "force max":                    ["force_de_base"],
      "dégâts infligés":              ["degats_infliges"],
      "dégâts physiques infligés":    ["degats_infliges"],
      "dégâts ultimes infligés":      ["degats_ultime"],
    };
    const phraseToStats = (p) => PHRASE[NORM(p)] || null;
    // Construit une condition depuis une clause "« A » [plus/et/ou « B »] …"
    function buildCond(clause) {
      const tags = [...clause.matchAll(/«\s*([^»]+?)\s*»/g)].map((x) => x[1].trim());
      if (!tags.length) return null;
      const seuilM = clause.match(/au\s+moins\s+(\d+)/i);
      let seuil = seuilM ? parseInt(seuilM[1], 10) : 1;
      // "si un AUTRE … " / "… autre que soi" : le porteur compte déjà, il faut
      // donc UN DE PLUS dans le trio → on incrémente le seuil.
      if (/\bautres?\b/i.test(clause)) seuil += 1;
      // AND seulement si "plus"/"à la fois" ; sinon "A ou B" / "A et B" = OR
      const mode = (tags.length > 1 && /\bplus\b|\bà la fois\b/i.test(clause)) ? "and" : "threshold";
      return { mode, seuil, tag_requis: tags[0], tags_requis: tags };
    }
    function parseCond(rest) {
      const s = rest;
      // "… par combattant de l'équipe portant ce même équipement" → per_member (même item)
      if (/portant ce m[êe]me [ée]quipement/i.test(s)) {
        return {
          phrase: s.replace(/\s*par combattant de l['’]?[ée]quipe portant ce m[êe]me [ée]quipement.*/i, ""),
          cond: { mode: "per_member", seuil: 1, tag_requis: null, tags_requis: [] },
        };
      }
      // "… par combattant de l'équipe de « X »" / "… par membre « X » dans l'équipe" → per_member
      let m = s.match(/\s*par (?:combattant de l['’]?[ée]quipe(?: de)?|membre)\s*«\s*([^»]+?)\s*»(?:\s*dans l['’]?[ée]quipe)?.*/i);
      if (m) {
        const t = m[1].trim();
        return { phrase: s.slice(0, m.index), cond: { mode: "per_member", seuil: 1, tag_requis: t, tags_requis: [t] } };
      }
      // "… si « A » [plus/et/ou « B »] …" → threshold / and selon la liaison
      const siM = s.match(/\bsi\b/i);
      if (siM) {
        const clause = s.slice(siM.index);
        if (/\bcontre\b/i.test(clause)) return null; // situationnel
        return { phrase: s.slice(0, siM.index), cond: buildCond(clause) };
      }
      if (/\bcontre\b/i.test(s)) return null; // situationnel (selon l'adversaire) → reste passif
      return { phrase: s, cond: null };       // inconditionnel
    }
    function convert(desc) {
      if (!desc) return null;
      // Aplatir les retours à la ligne (\r\n) qui empêchaient le matching.
      const flat = desc.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
      if (/ - OR - /.test(flat)) return null;
      // Format 1 : "Augmente de X~Y% STAT [si/par COND]"
      let m = flat.match(/^Augmente de\s+([\d.,]+)\s*~\s*([\d.,]+)\s*%\s*(.+)$/i);
      if (m) {
        const vmin = parseFloat(m[1].replace(",", "."));
        const vmax = parseFloat(m[2].replace(",", "."));
        const pc = parseCond(m[3].replace(/\.\s*$/, ""));
        if (!pc) return null;
        const stats = phraseToStats(pc.phrase);
        if (!stats) return null; // formulation inconnue → reste passif
        return stats.map((stat) => ({ stat, valeur_min: vmin, valeur_max: vmax,
          condition: pc.cond ? { ...pc.cond, description: flat } : null }));
      }
      // Format 2 : "Si/Quand … fait/font partie des combattants de l'équipe, STAT X~Y%"
      //   (condition de composition d'équipe placée en TÊTE)
      m = flat.match(/^(?:si|quand)\b(.+?f(?:ait|ont) partie des combattants de l['’]équipe)\s*,\s*(.+?)\s+([\d.,]+)\s*~\s*([\d.,]+)\s*%?\.?$/i);
      if (m) {
        if (/\bcontre\b/i.test(flat)) return null;
        const cond = buildCond(m[1]);
        if (!cond) return null;
        const stats = phraseToStats(m[2]);
        if (!stats) return null;
        return stats.map((stat) => ({
          stat,
          valeur_min: parseFloat(m[3].replace(",", ".")),
          valeur_max: parseFloat(m[4].replace(",", ".")),
          condition: { ...cond, description: flat },
        }));
      }
      return null;
    }
    for (const item of ITEMS) {
      if (!item.lignes) continue;
      let changed = false;
      const out = [];
      for (const l of item.lignes) {
        if (l.est_passif && l.description_passif) {
          const conv = convert(l.description_passif);
          if (conv) {
            for (const nl of conv) out.push({ ...nl, slot: l.slot });
            changed = true;
            continue;
          }
        }
        out.push(l);
      }
      if (changed) item.lignes = out;
    }
  })();

  // Codes d'élément : les persos stockent l'anglais (BLU, RED…),
  // les items la version française (BLE, RGE…). On mappe EN -> FR pour
  // qu'une condition porteur sur l'élément matche dans les deux sens.
  const _ELEM_EN_TO_FR = {
    BLU: "BLE", RED: "RGE", GRN: "VER",
    YEL: "JAU", PUR: "VIO", LGT: "LUM",
  };

  // Tags possédés par un perso : traits + cardCode + élément (EN et alias FR).
  function ownedTags(character) {
    const tags = [...(character.traits || []), character.cardCode];
    if (character.element) {
      tags.push(character.element);
      if (_ELEM_EN_TO_FR[character.element]) tags.push(_ELEM_EN_TO_FR[character.element]);
    }
    return new Set(tags.filter(Boolean));
  }

  // Vrai si l'item est compatible avec le personnage.
  // tagsPorteur est en CNF : [["A","B"], ["C"]] = (A AND B) OR C
  // Un perso "possède" : ses traits + son cardCode + son élément.
  function isCompatible(item, character) {
    if (!character) return null; // pas de perso sélectionné = compat inconnue
    if (!item.tagsPorteur || !item.tagsPorteur.length) return true; // aucune restriction
    const owned = ownedTags(character);
    return item.tagsPorteur.some((group) => group.every((tag) => owned.has(tag)));
  }

  // Formate les Tag/Trait Conditions porteur en libellé lisible.
  // Structure CNF : [ ["A","B"], ["C"] ] → "(A • B) ou C"
  function formatTagsPorteur(tags) {
    if (!tags || !tags.length) return null;
    const groups = tags.map((g) => g.join(" • "));
    if (groups.length === 1) return groups[0];
    return groups.map((g) => `(${g})`).join(` ${T('cond.or')} `);
  }

  // Labels d'affichage pour les raretés — dynamique selon la langue
  const rarityLabel = (r) => {
    if (!r) return "";
    const t = T('rarity.' + r);
    // Si la clé n'est pas dans le dict, T() retourne la clé brute — on normalise en UPPER
    return (t && t !== 'rarity.' + r) ? t : r.toUpperCase();
  };

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

  // Retourne les items d'un slot d'équipe donné avec les passifs OR
  // remplacés par la ligne stat choisie.
  function getItemsWithChoicesFor(teamSlotIdx) {
    const teamSlot = state.team[teamSlotIdx];
    if (!teamSlot) return [null, null, null];
    const choices = teamSlot.itemChoices || [{}, {}, {}];
    return teamSlot.items.map((item, slotIdx) => {
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

  // Retourne active.items mais avec les passifs OR remplacés par la ligne stat choisie.
  // Utilisé par le calcul ET par le rendu pour rester cohérent.
  function getActiveItemsWithChoices() {
    return getItemsWithChoicesFor(state.activeSlot);
  }

  const state = {
    team: Array.from({ length: 6 }, emptyTeamSlot),
    activeSlot: 0,           // perso ANALYSÉ (panneaux par-perso : Résumé / Effets non calculés)
    charTargetSlot: null,    // slot CIBLE d'un ajout/changement de perso (≠ analyse)
    leaderSlot: 0,           // perso désigné comme leader
    noLeader: false,         // true = simule une équipe sans leader (bypass désactivé)
    conditions: {},          // tag => nombre de membres (saisie utilisateur, reste global)
    modalSlot: null,         // index du slot d'ITEM (0..2) ouvert dans la modale
    modalCharSlot: null,     // index du perso (0..5) dont on édite un item
    detailsCharSlot: null,   // index du perso dont on consulte les détails d'items
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
    const target = state.charTargetSlot ?? state.activeSlot;
    state.team.forEach((slot, i) => {
      if (i !== target && slot.character) {
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
        // Les conditions d'items gardent leur préfixe de catégorie
        // ("Classe : X", "Épisode : X", "Style de combat : X"). La catégorie
        // du trait étant inconnue ici, on ajoute toutes les variantes (les
        // préfixes non pertinents ne sont jamais référencés par une condition).
        for (const pre of ["Classe : ", "Épisode : ", "Style de combat : "]) {
          counts[pre + trait] = (counts[pre + trait] || 0) + 1;
        }
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

  // ─────────────────────────────────────────────────────────────
  // CONDITIONS D'ITEMS : MÉCANIQUE DE SCOPE
  // ─────────────────────────────────────────────────────────────
  // Règle 1 — Conditions de classe/trait ("si N « Classe : X » font partie
  //   des combattants de l'équipe") : elles ne regardent que les 3 combattants
  //   du MÊME TRIO que le porteur de l'item.
  // Règle 2 — Conditions "même équipement" ("par combattant portant ce même
  //   équipement") : elles comptent sur l'ÉQUIPE ENTIÈRE (les 6 slots).
  //   Le scraper produit mode:"per_member" + tag_requis:null + tags_requis:[].
  //   On injecte un tag synthétique "__same_item__:${itemId}" pour que le
  //   moteur calc.js puisse l'évaluer sans modification.
  // ─────────────────────────────────────────────────────────────

  // Compte les traits uniquement pour les 3 membres du trio du slot donné.
  // applyOverrides : inclure les overrides manuels (true par défaut).
  function getTrioTagCountsFor(slotIdx, applyOverrides = true) {
    const trioStart = Math.floor(slotIdx / 3) * 3;
    const counts = {};
    for (let i = trioStart; i < trioStart + 3; i++) {
      const slot = state.team[i];
      if (!slot.character) continue;
      const c = slot.character;
      for (const trait of c.traits || []) {
        counts[trait] = (counts[trait] || 0) + 1;
        // Les conditions d'items gardent leur préfixe de catégorie
        // ("Classe : X", "Épisode : X", "Style de combat : X"). La catégorie
        // du trait étant inconnue ici, on ajoute toutes les variantes (les
        // préfixes non pertinents ne sont jamais référencés par une condition).
        for (const pre of ["Classe : ", "Épisode : ", "Style de combat : "]) {
          counts[pre + trait] = (counts[pre + trait] || 0) + 1;
        }
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
    if (applyOverrides) {
      for (const [k, v] of Object.entries(state.conditions)) {
        counts[k] = Math.max(counts[k] || 0, v);
      }
    }
    return counts;
  }

  // Construit le conditions object pour évaluer les items d'un slot :
  // - Traits/classes  → trio-scoped (avec overrides manuels)
  // - Même équipement → team-wide via tag synthétique "__same_item__:${id}"
  function buildItemConditions(slotIdx) {
    const counts = getTrioTagCountsFor(slotIdx, true);
    for (const slot of state.team) {
      for (const item of slot.items) {
        if (!item) continue;
        const tag = '__same_item__:' + item.id;
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return counts;
  }

  // Clone les items en injectant un tag synthétique sur les lignes
  // "portant ce même équipement" (mode per_member + tags vides),
  // afin que calc.js puisse les évaluer normalement.
  function patchSameItemTags(items) {
    return items.map(item => {
      if (!item) return null;
      const hasSameItem = item.lignes.some(
        l => l.condition && l.condition.mode === 'per_member' &&
             !l.condition.tag_requis && (!l.condition.tags_requis || !l.condition.tags_requis.length)
      );
      if (!hasSameItem) return item;
      const syntheticTag = '__same_item__:' + item.id;
      return {
        ...item,
        lignes: item.lignes.map(l => {
          if (!l.condition || l.condition.mode !== 'per_member' ||
              l.condition.tag_requis || (l.condition.tags_requis && l.condition.tags_requis.length)) {
            return l;
          }
          return { ...l, condition: { ...l.condition, tag_requis: syntheticTag, tags_requis: [syntheticTag] } };
        })
      };
    });
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
  // Cumule les lignes d'une Cap Z sur les tiers 1..maxTier.
  // Le scraper stocke les tiers en DELTAS (chaque tier ne liste que ce qu'il
  // ajoute/modifie) alors qu'en jeu la Cap Z est cumulative. Sans ça, certains
  // perso (ex. ULTRA "Cell Parfait") n'ont que des passifs au tier 4 et leurs
  // boosts chiffrés (placés aux tiers 1-2) étaient ignorés.
  //  - lignes chiffrées : on garde, PAR STAT, la valeur la plus haute (= tier max) ;
  //  - passifs : tous, dédupliqués par description.
  function mergeZLines(sets, maxTier) {
    const chiffrByStat = new Map();
    const passifs = [];
    const seenPassif = new Set();
    for (const z of sets || []) {
      if (z.tier > maxTier) continue;
      for (const l of z.lignes || []) {
        if (l.est_passif) {
          const d = (l.description_passif || "").trim();
          if (d && !seenPassif.has(d)) { seenPassif.add(d); passifs.push(l); }
          continue;
        }
        const prev = chiffrByStat.get(l.stat);
        if (!prev || (l.valeur_max || 0) > (prev.valeur_max || 0)) chiffrByStat.set(l.stat, l);
      }
    }
    return [...chiffrByStat.values(), ...passifs];
  }

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
            ? `${label} ${tierLab} (${T('item.self')})`
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

      // 1) Cap Z classique — cumul des tiers 1..tier choisi (max par stat + passifs)
      if (sender.character.zAbilities && sender.character.zAbilities.length) {
        const lignes = mergeZLines(sender.character.zAbilities, sender.zTier);
        if (lignes.length) pushZItem(lignes, T('z.capz.label'), "z", sender.zTier);
      }
      // 2) Cap Z Zenkai — cumul jusqu'au tier IV, s'ajoute en plus
      if (sender.character.zAbilitiesZenkai && sender.character.zAbilitiesZenkai.length) {
        const lignes = mergeZLines(sender.character.zAbilitiesZenkai, 4);
        if (lignes.length) pushZItem(lignes, `${T('z.capz.label')} Zenkai`, "zenkai", 4);
      }
    }
    return items;
  }

  // ===== FORMATAGE =====
  const fmtInt   = (n) => Math.round(n).toLocaleString(window.DBL_I18N?.getLang() === 'en' ? 'en-US' : 'fr-FR');
  // Séparateur décimal selon la langue : virgule en FR, point en EN
  const fmtDec   = (s) => window.DBL_I18N?.getLang() === 'en' ? s : s.replace(".", ",");
  const fmtPct   = (n) => fmtDec(n.toFixed(2)) + "%";
  const fmtRange = (l) =>
    l.valeur_min === l.valeur_max
      ? `${fmtDec(l.valeur_max.toFixed(2))}%`
      : `${fmtDec(l.valeur_min.toFixed(2))} ~ ${fmtDec(l.valeur_max.toFixed(2))}%`;

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
    charModalTitleEl.textContent = T('charmodal.title', { n: state.activeSlot + 1 });
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
    state.charTargetSlot = null; // annule une cible d'ajout/changement abandonnée
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
      `<button class="char-filter-pill ${state.charRarityFilter === null ? "active" : ""}" data-char-rarity="">${T('filter.all')}</button>`,
      ...CHAR_RARITIES.filter((r) => counts.rar[r]).map(
        (r) => `<button class="char-filter-pill ${state.charRarityFilter === r ? "active" : ""}" data-char-rarity="${r}">${r} <span class="pill-count">${counts.rar[r]}</span></button>`,
      ),
    ];
    const elPills = [
      `<button class="char-filter-pill char-elem-pill ${state.charElementFilter === null ? "active" : ""}" data-char-element="">${T('filter.all')}</button>`,
      ...CHAR_ELEMENTS.filter((el) => counts.el[el]).map(
        (el) => `<button class="char-filter-pill char-elem-pill elem-${el.toLowerCase()} ${state.charElementFilter === el ? "active" : ""}" data-char-element="${el}">${T('elem.' + el)} <span class="pill-count">${counts.el[el]}</span></button>`,
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
      charSuggestionsEl.innerHTML = `<li class="char-suggestion-empty">${T('char.notfound')}</li>`;
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
            <span class="char-suggestion-element">${p.element ? T('elem.' + p.element) : ""}</span>
            <span class="char-suggestion-name">${p.nom.trim()}</span>
            <small class="char-suggestion-code">${p.cardCode || ""} · ${p.rarete}</small>
            ${isTaken ? `<span class="char-taken-badge">${T('char.taken')}</span>` : ""}
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
    if (!charSelectedEl) return; // élément retiré par la refonte
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
          <div class="char-selected-element">${p.element ? T('elem.' + p.element) : ""}</div>
          <div class="char-selected-name">${p.nom.trim()}</div>
          <div class="char-selected-code">${p.cardCode || ""} · ${p.rarete}</div>
        </div>
        <button class="char-selected-clear" data-action="clear-char" type="button" aria-label="${T('char.deselect')}">×</button>
      </div>
    `;
  }

  function renderCharTraits() {
    if (!charTraitsEl) return; // élément retiré par la refonte
    if (!active.character) {
      charTraitsEl.classList.add("hidden");
      charTraitsEl.innerHTML = "";
      return;
    }
    charTraitsEl.classList.remove("hidden");
    const traits = active.character.traits || [];
    charTraitsEl.innerHTML = `
      <div class="char-traits-head">${T('char.traits', { n: traits.length })}</div>
      <div class="char-traits-pills">
        ${traits.map((t) => `<span class="trait-pill">${t}</span>`).join("")}
      </div>
    `;
  }

  const charZAbilityEl = document.getElementById("char-zability");
  const Z_LABEL = ["I", "II", "III", "IV"];

  function renderCharZAbility() {
    if (!charZAbilityEl) return; // élément retiré par la refonte
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
        return `<div class="z-group-header is-nocond">${T('z.always')}</div>`;
      }
      const tags = g.condition.tags_requis || [];
      const sep = ` ${g.condition.mode === "and" ? T('cond.and') : T('cond.or')} `;
      const prefix = g.condition.mode === "and" ? T('cond.allof') + " " : "";
      const tagPills = tags
        .map((t) => `<span class="z-cond-tag">${t}</span>`)
        .join(`<span class="z-cond-sep">${sep.trim()}</span>`);
      const ok = activeIsLeader || condRemplieCalc({ condition: g.condition }, conds);
      const leaderBadge = activeIsLeader && !condRemplieCalc({ condition: g.condition }, conds)
        ? ` <span class="z-leader-bypass" title="${T('z.leadertitle')}">${T('z.leaderbadge')}</span>`
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
    const zSection = zCur ? renderZSection(zCur.lignes, `${T('z.capz.label')} ${Z_LABEL[active.zTier - 1]}`, false) : "";
    // Section Z Zenkai — TOUJOURS au max (tier IV)
    const zkCur = active.character.zAbilitiesZenkai?.find((z) => z.tier === 4);
    const zkSection = zkCur ? renderZSection(zkCur.lignes, T('z.zenkai.label'), true) : "";

    charZAbilityEl.innerHTML = `
      <div class="char-zability-head">
        <span class="char-zability-label">${T('z.capz.label')}${active.character.isZenkai ? " + Zenkai" : ""}</span>
        <div class="char-zability-pills">${pills}</div>
      </div>
      ${zSection}
      ${zkSection}
    `;
  }

  // (Le sélecteur de niveau Z est désormais intégré à chaque ligne de la grille builder.)

  function renderCharPicker() {
    renderCharFilters();
    renderCharSelected();
    renderCharTraits();
    renderCharZAbility();
  }

  function selectCharacter(p) {
    // Garde de sécurité : bloquer les doublons même si l'UI ne l'a pas stoppé
    if (p) {
      const key = charKey(p);
      if (key && getUsedCharIds().has(key)) return;
    }
    // Slot cible = celui qu'on édite (ajout/changement) ; par défaut le perso analysé.
    const target = state.charTargetSlot ?? state.activeSlot;
    state.team[target].character = p || null;
    state.team[target].zTier = 4; // reset au max à chaque nouveau perso
    // On ne déplace le focus d'analyse QUE si le perso analysé n'existe plus
    // (1er perso, ou on vient de vider le slot analysé). Ajouter un coéquipier
    // dans un autre slot ne vole donc pas le focus.
    if (!state.team[state.activeSlot] || !state.team[state.activeSlot].character) {
      state.activeSlot = target;
    }
    state.charTargetSlot = null;
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
    if (!buildEmptyEl) return; // élément retiré par la refonte
    const hasChar = !!active.character;
    buildEmptyEl.classList.toggle("hidden", hasChar);
    const slotsEl = document.querySelector(".slots");
    const subheadEl = document.querySelector(".build-subhead");
    if (slotsEl) slotsEl.style.display = hasChar ? "" : "none";
    if (subheadEl) subheadEl.style.display = hasChar ? "" : "none";
  }

  // ===== BUILDER GRID (1 ligne par perso : carte perso | 3 items) =====
  const builderGridEl = document.getElementById("builder-grid");

  // Rendu d'une ligne d'effet d'item (reprend la logique de l'ancien renderSlots)
  function renderItemLigne(l, lineIdx, item, itemSlotIdx, displayConds, slotChoices) {
    if (l.est_passif) {
      const alts = parseOrPassif(l.description_passif);
      if (alts) {
        const selected = slotChoices[lineIdx] ?? 0;
        const altsHTML = alts.map((alt, idx) => `
          <button class="or-choice ${idx === selected ? 'is-selected' : ''}" data-or-choice="${itemSlotIdx}:${lineIdx}:${idx}" type="button">
            <span class="or-mark">${idx === selected ? '●' : '○'}</span>
            <span class="or-text">+${alt.valeur_max.toFixed(0)}% <strong>${alt.label}</strong></span>
          </button>`).join("");
        return `<div class="slot-ligne-or"><div class="slot-ligne-or-head"><span class="bullet">⚡</span>${T('slot.or.head')}</div><div class="slot-ligne-or-options">${altsHTML}</div></div>`;
      }
      const passifTxt = (l.description_passif || "");
      if (passifTxt.includes(" - OR - ")) {
        const opts = passifTxt.split(" - OR - ");
        const optsHTML = opts.map((o, idx) => {
          const sep = idx > 0 ? `<div class="passive-or-sep"><span>${T('cond.or')}</span></div>` : "";
          return `${sep}<div class="passive-or-opt">${o.trim().replace(/\r?\n/g, "<br>")}</div>`;
        }).join("");
        return `<div class="slot-ligne passive passive-or"><div class="slot-ligne-or-head"><span class="bullet">⚡</span>${T('slot.or.passive')}</div><div class="passive-or-body">${optsHTML}</div></div>`;
      }
      return `<div class="slot-ligne passive"><span class="bullet">⚡</span>${passifTxt.replace(/\r?\n/g, "<br>")}</div>`;
    }
    let lineToEval = l;
    if (l.condition?.mode === 'per_member' && !l.condition.tag_requis && !(l.condition.tags_requis?.length)) {
      const syntheticTag = '__same_item__:' + item.id;
      lineToEval = { ...l, condition: { ...l.condition, tag_requis: syntheticTag, tags_requis: [syntheticTag] } };
    }
    const conditionRemplie = condRemplieCalc(lineToEval, displayConds);
    const cls = l.condition ? (conditionRemplie ? "active" : "inactive") : "";
    let valeur = interpolerValeur(l, 1);
    if (conditionRemplie && lineToEval.condition?.mode === 'per_member') {
      const mult = multCondCalc(lineToEval, displayConds);
      if (mult > 1) valeur *= mult;
    }
    const condBadge = l.condition
      ? ` <em style="color:var(--text-soft); font-size:10px">(${l.condition.description})</em>` : "";
    return `<div class="slot-ligne ${cls}"><span class="bullet">${conditionRemplie ? "+" : "—"}</span><span class="ligne-text">${fmtPct(valeur)} ${statLabel(l.stat)}</span>${condBadge}</div>`;
  }

  // Icône compacte d'un item dans la ligne builder (vide ou rempli).
  function itemIconHTML(charSlot, itemSlotIdx) {
    const item = state.team[charSlot].items[itemSlotIdx];
    if (!item) {
      return `<button class="builder-item-icon empty" data-open-item="${charSlot}:${itemSlotIdx}" type="button" title="${T('slot.choose')}">＋</button>`;
    }
    const rar = (item.rarete || "").toLowerCase();
    const img = item.image
      ? `<img src="${item.image}" alt="${item.nom}" onerror="this.style.display='none'" />`
      : `<span class="builder-item-icon-fallback">${(item.nom || '?').slice(0, 2)}</span>`;
    return `<button class="builder-item-icon filled rar-${rar}" data-open-item="${charSlot}:${itemSlotIdx}" type="button" title="${item.nom}">${img}</button>`;
  }

  // HTML détaillé d'un slot d'item (vide ou rempli) — utilisé dans la modale de détails.
  function itemDetailHTML(charSlot, itemSlotIdx) {
    const teamSlot = state.team[charSlot];
    const item = teamSlot.items[itemSlotIdx];
    if (!item) {
      return `<div class="builder-item empty" data-open-item="${charSlot}:${itemSlotIdx}">${T('slot.choose')}</div>`;
    }
    const displayConds = buildItemConditions(charSlot);
    if (!teamSlot.itemChoices) teamSlot.itemChoices = [{}, {}, {}];
    const slotChoices = teamSlot.itemChoices[itemSlotIdx] || {};
    const lignesParSlot = {};
    item.lignes.forEach((l, lineIdx) => {
      const sn = l.slot || 1;
      (lignesParSlot[sn] = lignesParSlot[sn] || []).push({ l, lineIdx });
    });
    const slotsHTML = Object.keys(lignesParSlot).map(Number).sort((a, b) => a - b).map((sn) => {
      const label = sn === 4 ? `Slot ${sn} <span class="slot-7">★7</span>` : `Slot ${sn}`;
      return `<div class="item-slot-group"><div class="item-slot-label">${label}</div><div class="item-slot-lignes">${lignesParSlot[sn].map(({ l, lineIdx }) => renderItemLigne(l, lineIdx, item, itemSlotIdx, displayConds, slotChoices)).join("")}</div></div>`;
    }).join("");
    const tagsLine = formatTagsPorteur(item.tagsPorteur);
    const tagsHTML = tagsLine ? `<div class="slot-item-tags">${T('slot.compatible')} ${tagsLine}</div>` : "";
    return `<div class="builder-item filled">
      <div class="slot-item-rarete">${rarityLabel(item.rarete)}</div>
      <div class="slot-item-name">${item.nom}</div>
      ${tagsHTML}
      <div class="slot-lignes">${slotsHTML}</div>
      <div class="slot-actions">
        <button class="btn" data-item-change="${charSlot}:${itemSlotIdx}">${T('slot.change')}</button>
        <button class="btn danger" data-item-clear="${charSlot}:${itemSlotIdx}">${T('slot.remove')}</button>
      </div>
    </div>`;
  }

  // Carte perso compacte (colonne 1)
  function charCellHTML(charSlot) {
    const slot = state.team[charSlot];
    const c = slot.character;
    if (!c) {
      return `<div class="builder-char is-empty" data-add-char="${charSlot}">
        <span class="builder-char-add-icon">＋</span>
        <span class="builder-char-add-text">${T('team.card.add')}</span>
      </div>`;
    }
    const isLeader = charSlot === state.leaderSlot;
    const elementClass = `elem-${(c.element || "").toLowerCase()}`;
    const img = c.image
      ? `<img class="builder-char-img" src="${c.image}" alt="" onerror="this.style.display='none'" />`
      : `<div class="builder-char-img"></div>`;
    const zPills = ["I", "II", "III", "IV"].map((lab, idx) =>
      `<button class="builder-z-pill ${slot.zTier === idx + 1 ? 'active' : ''}" data-ztier="${charSlot}:${idx + 1}" type="button" title="Cap Z ${lab}">${lab}</button>`).join("");
    return `<div class="builder-char ${elementClass}">
      <button class="builder-leader ${isLeader ? 'is-leader' : ''} ${state.noLeader ? 'is-leader-disabled' : ''}" data-leader="${charSlot}" title="${T('team.leader.title')}" type="button">★</button>
      ${img}
      <div class="builder-char-info">
        <div class="builder-char-name" title="${c.nom.trim()}">${c.nom.trim()}</div>
        <div class="builder-char-code">${c.cardCode || ""}</div>
        <div class="builder-char-tools">
          <button class="builder-char-act" data-change-char="${charSlot}" title="${T('slot.change')}" type="button">✎</button>
          <button class="builder-char-act is-danger" data-remove-char="${charSlot}" title="${T('slot.remove')}" type="button">✕</button>
        </div>
      </div>
      <div class="builder-z-large">
        <span class="builder-z-large-label">${T('z.capz.label')}</span>
        <div class="builder-z">${zPills}</div>
      </div>
    </div>`;
  }

  function builderRowHTML(charSlot) {
    const slot = state.team[charSlot];
    const isActive = charSlot === state.activeSlot;
    const items = slot.character
      ? `<div class="builder-items">
           <div class="builder-item-icons">${[0, 1, 2].map((j) => itemIconHTML(charSlot, j)).join("")}</div>
           <button class="builder-items-details" data-open-details="${charSlot}" type="button" title="${T('items.details')}" aria-label="${T('items.details')}">▾</button>
         </div>`
      : `<div class="builder-items builder-items--locked" aria-hidden="true" title="${T('builder.items.empty')}">
           <div class="builder-item-icons">${[0, 1, 2].map(() => `<span class="builder-item-icon empty">＋</span>`).join("")}</div>
           <span class="builder-items-details">▾</span>
         </div>`;
    return `<div class="builder-row ${isActive ? 'is-active' : ''}" data-row="${charSlot}">${charCellHTML(charSlot)}${items}</div>`;
  }

  // Nom conservé (renderTeamGrid) pour ne pas casser les appels existants.
  function renderTeamGrid() {
    if (!builderGridEl) return;
    // Chaque trio dans son propre conteneur → 2 colonnes côte à côte sur écran large
    // (évite le grand vide entre le nom et les boutons Cap Z quand le builder est pleine largeur).
    const trio = (label, idxs) =>
      `<div class="builder-trio"><div class="builder-trio-label">${label}</div>${idxs.map(builderRowHTML).join("")}</div>`;
    builderGridEl.innerHTML = trio(T('trio.a'), [0, 1, 2]) + trio(T('trio.b'), [3, 4, 5]);
    renderNoLeaderBtn();
  }

  builderGridEl.addEventListener("click", (e) => {
    const t = e.target;
    // Flèche → ouvre la modale de détails des items du perso
    const det = t.closest("[data-open-details]");
    if (det) { openDetailsModal(+det.dataset.openDetails); return; }
    // Étoile leader
    const lead = t.closest("[data-leader]");
    if (lead) { e.stopPropagation(); state.leaderSlot = +lead.dataset.leader; renderTeamGrid(); renderResults(); return; }
    // Niveau Cap Z
    const zt = t.closest("[data-ztier]");
    if (zt) { const [cs, tier] = zt.dataset.ztier.split(":"); state.team[+cs].zTier = +tier; renderTeamGrid(); renderResults(); return; }
    // Choix OR (passif chiffrable)
    const orBtn = t.closest("[data-or-choice]");
    if (orBtn) {
      const row = orBtn.closest("[data-row]");
      const charSlot = +row.dataset.row;
      const [slotStr, lineIdxStr, altStr] = orBtn.dataset.orChoice.split(":");
      const ts = state.team[charSlot];
      if (!ts.itemChoices) ts.itemChoices = [{}, {}, {}];
      if (!ts.itemChoices[+slotStr]) ts.itemChoices[+slotStr] = {};
      ts.itemChoices[+slotStr][+lineIdxStr] = +altStr;
      renderAll();
      return;
    }
    // Item : changer / vider / ouvrir (slot vide)
    const chg = t.closest("[data-item-change]");
    if (chg) { const [cs, is] = chg.dataset.itemChange.split(":"); openItemModal(+cs, +is); return; }
    const clr = t.closest("[data-item-clear]");
    if (clr) { const [cs, is] = clr.dataset.itemClear.split(":"); state.team[+cs].items[+is] = null; renderAll(); return; }
    const openIt = t.closest("[data-open-item]");
    if (openIt) { const [cs, is] = openIt.dataset.openItem.split(":"); openItemModal(+cs, +is); return; }
    // Perso : changer (✎) → on édite ET on analyse ce perso
    const chgChar = t.closest("[data-change-char]");
    if (chgChar) { state.charTargetSlot = +chgChar.dataset.changeChar; state.activeSlot = state.charTargetSlot; renderTeamGrid(); renderResults(); openCharModal(); return; }
    // Retirer (✕) → on vide ce slot sans toucher au focus d'analyse
    const rmChar = t.closest("[data-remove-char]");
    if (rmChar) { state.charTargetSlot = +rmChar.dataset.removeChar; selectCharacter(null); return; }
    // Ajouter (carte vide) → on cible ce slot mais on GARDE le perso analysé
    const addChar = t.closest("[data-add-char]");
    if (addChar) { state.charTargetSlot = +addChar.dataset.addChar; renderTeamGrid(); openCharModal(); return; }
    // Clic ailleurs sur une ligne occupée → sélectionne ce perso (Résumé à droite)
    const row = t.closest("[data-row]");
    if (row && state.team[+row.dataset.row].character) {
      state.activeSlot = +row.dataset.row;
      renderTeamGrid();
      renderResults();
    }
  });

  // ===== MODALE DÉTAILS DES ITEMS (par perso) =====
  const detailsModalEl = document.getElementById("details-modal");
  const detailsModalBody = document.getElementById("details-modal-body");
  const detailsModalTitle = document.getElementById("details-modal-title");

  function renderDetailsModal() {
    const cs = state.detailsCharSlot;
    if (cs == null || !detailsModalBody) return;
    const c = state.team[cs].character;
    if (detailsModalTitle) detailsModalTitle.textContent = c ? T('items.details.title', { name: c.nom.trim() }) : T('items.details');
    detailsModalBody.innerHTML = `<div class="details-items">${[0, 1, 2].map((j) => itemDetailHTML(cs, j)).join("")}</div>`;
  }
  function openDetailsModal(charSlot) {
    state.detailsCharSlot = charSlot;
    renderDetailsModal();
    if (detailsModalEl) detailsModalEl.classList.remove("hidden");
  }
  function closeDetailsModal() {
    if (detailsModalEl) detailsModalEl.classList.add("hidden");
    state.detailsCharSlot = null;
  }
  if (detailsModalEl) {
    detailsModalEl.querySelector("[data-details-close]")?.addEventListener("click", closeDetailsModal);
    document.getElementById("details-modal-close")?.addEventListener("click", closeDetailsModal);
    detailsModalBody.addEventListener("click", (e) => {
      const t = e.target;
      // Choix OR
      const orBtn = t.closest("[data-or-choice]");
      if (orBtn) {
        const cs = state.detailsCharSlot;
        const [slotStr, lineIdxStr, altStr] = orBtn.dataset.orChoice.split(":");
        const ts = state.team[cs];
        if (!ts.itemChoices) ts.itemChoices = [{}, {}, {}];
        if (!ts.itemChoices[+slotStr]) ts.itemChoices[+slotStr] = {};
        ts.itemChoices[+slotStr][+lineIdxStr] = +altStr;
        renderDetailsModal();
        renderAll();
        return;
      }
      // Changer / ajouter → ferme les détails et ouvre le sélecteur d'items
      const chg = t.closest("[data-item-change]") || t.closest("[data-open-item]");
      if (chg) {
        const data = chg.dataset.itemChange || chg.dataset.openItem;
        const [cs, is] = data.split(":");
        closeDetailsModal();
        openItemModal(+cs, +is);
        return;
      }
      // Retirer → on vide et on rafraîchit (modale reste ouverte)
      const clr = t.closest("[data-item-clear]");
      if (clr) {
        const [cs, is] = clr.dataset.itemClear.split(":");
        state.team[+cs].items[+is] = null;
        renderAll();
        renderDetailsModal();
        return;
      }
    });
  }

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

  // (Ajout/suppression de perso désormais gérés via la grille builder.)

  // ===== MODALE D'ITEMS =====
  const modal = document.getElementById("item-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalClose = document.getElementById("modal-close");
  const itemSearch = document.getElementById("item-search");
  const itemList = document.getElementById("item-list");

  const rarityFiltersEl = document.getElementById("rarity-filters");

  function openItemModal(charSlot, slotIdx) {
    // Le perso ciblé devient le perso actif → toute la logique de compatibilité
    // (active.character) reste correcte sans modification supplémentaire.
    if (typeof charSlot === "number") state.activeSlot = charSlot;
    state.modalCharSlot = state.activeSlot;
    state.modalSlot = slotIdx;
    modalTitle.textContent = T('itemmodal.title.slot', { n: slotIdx + 1 });
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
    state.modalCharSlot = null;
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
      `<button class="rarity-pill ${state.modalRarityFilter === null ? "active" : ""}" data-rarity-filter="">${T('filter.all')} <span class="pill-count">${total}</span></button>`,
      ...presentes.map((r) => `<button class="rarity-pill ${state.modalRarityFilter === r ? "active" : ""}" data-rarity-filter="${r}">${rarityLabel(r)} <span class="pill-count">${counts[r]}</span></button>`),
    ];
    // Pill "Compatibles seulement" — visible uniquement si un perso est sélectionné
    if (active.character) {
      const compatCount = ITEMS.filter((it) => isCompatible(it, active.character)).length;
      pills.push(`<button class="rarity-pill compat-pill ${state.modalCompatOnly ? "active" : ""}" data-compat-only="1">${T('filter.compat')} <span class="pill-count">${compatCount}</span></button>`);
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
      itemList.innerHTML = `<li style="color: var(--text-soft); cursor: default; grid-column: 1 / -1; padding: 14px; text-align: center;">${T('item.notfound')}</li>`;
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
            return `<div><span class="passive-marker">⚡ ${T('passif.label')} :</span> ${l.description_passif}</div>`;
          }
          const cond = l.condition ? ` <em style="color:var(--text-soft)">(${l.condition.description})</em>` : "";
          const val = fmtDec(l.valeur_max.toFixed(2));
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
        const rar = (it.rarete || "").toLowerCase();
        const img = `<div class="item-img is-framed rar-${rar}">${it.image
          ? `<img src="${it.image}" alt="" loading="lazy" onerror="this.style.display='none'" />`
          : `<span class="item-img-placeholder">?</span>`}</div>`;
        const tagsLine = formatTagsPorteur(it.tagsPorteur);
        const tagsHTML = tagsLine
          ? `<div class="item-tags-porteur" title="${T('slot.compatible')} ${tagsLine}">${tagsLine}</div>`
          : "";
        const compat = isCompatible(it, active.character);
        let compatBadge = "";
        let compatClass = "";
        if (compat === true) {
          compatBadge = `<span class="compat-badge compat-yes" title="${T('item.compat.yes', { name: active.character.nom.trim() })}">✓</span>`;
          compatClass = "is-compat";
        } else if (compat === false) {
          compatBadge = `<span class="compat-badge compat-no" title="${T('item.compat.no', { name: active.character.nom.trim() })}">✗</span>`;
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
              <button class="item-toggle" data-toggle="${it.id}" aria-label="${T('item.details')}" type="button">▾</button>
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
    const charSlot = state.modalCharSlot ?? state.activeSlot;
    state.team[charSlot].items[state.modalSlot] = item;
    closeItemModal();
    renderAll();
  });

  // ===== RENDU : SLOTS (legacy — remplacé par la grille builder, conservé en no-op) =====
  function renderSlots() {
    if (!document.querySelector('[data-slot-content="0"]')) return;
    // Conditions pour l'affichage des lignes : trio-scoped + même équipement team-wide
    const slotDisplayConditions = buildItemConditions(state.activeSlot);
    for (let i = 0; i < 3; i++) {
      const el = document.querySelector(`[data-slot-content="${i}"]`);
      const item = active.items[i];

      if (!item) {
        el.className = "slot-content empty";
        el.innerHTML = T('slot.choose');
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
                <div class="slot-ligne-or-head"><span class="bullet">⚡</span>${T('slot.or.head')}</div>
                <div class="slot-ligne-or-options">${altsHTML}</div>
              </div>
            `;
          }
          const passifTxt = (l.description_passif || "");
          // Passif non chiffré de type "A - OR - B" : on affiche 2 options + séparateur
          if (passifTxt.includes(" - OR - ")) {
            const opts = passifTxt.split(" - OR - ");
            const optsHTML = opts
              .map((o, idx) => {
                const sep = idx > 0
                  ? `<div class="passive-or-sep"><span>${T('cond.or')}</span></div>`
                  : "";
                return `${sep}<div class="passive-or-opt">${o.trim().replace(/\r?\n/g, "<br>")}</div>`;
              })
              .join("");
            return `<div class="slot-ligne passive passive-or">
                      <div class="slot-ligne-or-head"><span class="bullet">⚡</span>${T('slot.or.passive')}</div>
                      <div class="passive-or-body">${optsHTML}</div>
                    </div>`;
          }
          return `<div class="slot-ligne passive"><span class="bullet">⚡</span>${passifTxt.replace(/\r?\n/g, "<br>")}</div>`;
        }
        // ── Règle 2 : "même équipement" → patch tag synthétique pour évaluation ──
        let lineToEval = l;
        if (l.condition?.mode === 'per_member' && !l.condition.tag_requis &&
            !(l.condition.tags_requis?.length)) {
          const syntheticTag = '__same_item__:' + item.id;
          lineToEval = { ...l, condition: { ...l.condition, tag_requis: syntheticTag, tags_requis: [syntheticTag] } };
        }
        const conditionRemplie = condRemplieCalc(lineToEval, slotDisplayConditions);
        const cls = l.condition ? (conditionRemplie ? "active" : "inactive") : "";
        // Pour per_member : afficher la valeur effective (base × count)
        let valeur = interpolerValeur(l, 1);
        if (conditionRemplie && lineToEval.condition?.mode === 'per_member') {
          const mult = multCondCalc(lineToEval, slotDisplayConditions);
          if (mult > 1) valeur *= mult;
        }
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
        ? `<div class="slot-item-tags">${T('slot.compatible')} ${slotTagsLine}</div>`
        : "";
      el.innerHTML = `
        <div class="slot-item-rarete">${rarityLabel(item.rarete)}</div>
        <div class="slot-item-name">${item.nom}</div>
        ${slotTagsHTML}
        <div class="slot-lignes">${slotsHTML}</div>
        <div class="slot-actions">
          <button class="btn" data-action="change" data-slot="${i}">${T('slot.change')}</button>
          <button class="btn danger" data-action="clear" data-slot="${i}">${T('slot.remove')}</button>
        </div>
      `;
    }
  }

  // (Les actions sur les slots d'items sont gérées par la délégation de la grille builder.)

  // ===== RENDU : CONDITIONS =====
  const conditionsPanel = document.getElementById("conditions-panel");
  const conditionsInputs = document.getElementById("conditions-inputs");

  function renderConditions() {
    // Team-wide : on collecte les tags requis par les items de TOUTE l'équipe.
    const tagSet = new Set();
    state.team.forEach((slot) => {
      slot.items.forEach((it) => {
        if (!it) return;
        it.lignes.forEach((l) => {
          if (!l.condition) return;
          const ts = l.condition.tags_requis && l.condition.tags_requis.length
            ? l.condition.tags_requis : [l.condition.tag_requis];
          ts.forEach((t) => t && tagSet.add(t));
        });
      });
    });
    const tags = [...tagSet];
    if (tags.length === 0) {
      conditionsPanel.classList.add("hidden");
      return;
    }
    conditionsPanel.classList.remove("hidden");
    // Compte auto sur toute l'équipe (sans overrides) pour l'affichage "auto: N"
    const autoCounts = getTeamTagCounts();

    conditionsInputs.innerHTML = tags
      .map((tag) => {
        const userVal = state.conditions[tag] ?? 0;
        const autoVal = autoCounts[tag] || 0;
        const effective = Math.max(userVal, autoVal);
        let seuils = [];
        state.team.forEach((slot) => {
          slot.items.forEach((it) => {
            if (!it) return;
            it.lignes.forEach((l) => {
              if (l.condition && l.condition.tag_requis === tag) seuils.push(l.condition.seuil);
            });
          });
        });
        const maxSeuil = seuils.length ? Math.max(...seuils) : 0;
        const ok = effective >= maxSeuil;
        return `
          <div class="cond-row">
            <div class="cond-info">
              <div class="cond-label">${T('cond.inteam', { tag })} ${ok ? "<span class='cond-ok'>✓</span>" : "<span class='cond-ko'>✗</span>"}</div>
              <div class="cond-hint">${T('cond.auto')} <strong>${autoVal}</strong> · ${T('cond.threshold')} ${maxSeuil}</div>
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
    renderTeamGrid();
    renderResults();
  });

  // ===== RENDU : RÉSULTATS =====
  const statsGrid = document.getElementById("stats-grid");
  const passifsZone = document.getElementById("passifs-zone");
  const inactiveZone = document.getElementById("inactive-zone");

    // Stats regroupées par catégorie thématique — labels recalculés selon la langue
    const DISPLAY_GROUPS = [
      {
        slug: "vie",
        titre: T('group.vie'),
        stats: [
          { cible: "force",                 label: T('stat.force') },
          { cible: "quantite_regen_force",  label: T('stat.regen') },
        ],
      },
      {
        slug: "attaque",
        titre: T('group.attaque'),
        stats: [
          { cible: "attaque_physique",      label: "Strike ATK" },
          { cible: "attaque_energie",       label: "Blast ATK" },
          { cible: "critique",              label: "Critical Rate" },
          { cible: "degats_tech_spe",       label: T('stat.tech_spe') },
          { cible: "degats_ultime",         label: T('stat.ultime') },
        ],
      },
      {
        slug: "defense",
        titre: T('group.defense'),
        stats: [
          { cible: "defense_physique",      label: "Strike DEF" },
          { cible: "defense_energie",       label: "Blast DEF" },
        ],
      },
      {
        slug: "utilitaire",
        titre: T('group.utilitaire'),
        stats: [
          { cible: "vitesse_regen_ki",      label: "Ki Recover" },
          { cible: "vanish_recover",        label: "Vanish Recover" },
        ],
      },
    ];

  // ===== ONGLETS PERSO (pilotent stats cumulées + effets non calculés) =====
  // S'assure que le perso analysé (activeSlot) pointe sur un perso occupé.
  function ensureActiveSlot() {
    if (state.team[state.activeSlot] && state.team[state.activeSlot].character) return;
    const first = state.team.findIndex((s) => s.character);
    if (first !== -1) state.activeSlot = first;
  }
  function renderResults() {
    ensureActiveSlot();
    renderZBilan();
    renderFocusPicker();
    renderGlobalBilan();
    renderZTree();
    const noItems = active.items.every((s) => !s);
    const noZ = buildTeamZItemsFor(state.activeSlot).length === 0;
    if (noItems && noZ) {
      statsGrid.innerHTML = `<p class="placeholder" style="color: var(--text-soft); font-size: 13px; margin: 0;">${T('stats.placeholder')}</p>`;
      passifsZone.innerHTML = `<p class="placeholder">${T('passif.none')}</p>`;
      inactiveZone.innerHTML = "";
      return;
    }

    // Calculs SÉPARÉS pour distinguer ce qui vient des items vs des Cap Z.
    // Conditions items : trio-scoped pour les traits/classes + team-wide pour "même équipement".
    // Les items "OR" (ex : "ATK énergie OR ATK physique") sont résolus selon le choix utilisateur.
    const zItems = buildTeamZItemsFor(state.activeSlot);
    const effCond = buildItemConditions(state.activeSlot);
    const resolvedItems = patchSameItemTags(getActiveItemsWithChoices());
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
      const fmtMult = (v) => "× " + fmtDec(v.toFixed(3));
      const fmtGain = (v) => "+" + fmtDec(v.toFixed(2)) + "%";
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
        cell("stat-cell-item-base", T('cell.items.base'), sib) +
        cell("stat-cell-z",         T('cell.capz'),       szc) +
        cell("stat-cell-z-zenkai",  T('cell.zenkai'),     szk) +
        cell("stat-cell-item-pur",  T('cell.items.pur'),  sip) +
        cell("stat-cell-total",     T('cell.total'),      s);
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
      passifsZone.innerHTML = `<p class="placeholder">${T('passifs.equipped.none')}</p>`;
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
            <div class="callout-tag">${T('inactive.tag')}</div>
            <div>
              <div class="callout-body">
                <strong>+${fmtPct(c.valeur).replace("%","")}% ${c.statLabel}</strong> — ${c.description}
              </div>
              <div class="callout-source">
                ${T('source.prefix')} ${c.itemNom} (slot ${c.slot + 1}) — ${c.valeurActuelle}/${c.seuil} « ${c.tag} »
              </div>
            </div>
          </div>
        `
        )
        .join("");
    }
  }

  // ===== GRAPHIQUE EN BARRES (profil de stats) =====
  // Plus lisible que le radar quand les écarts sont énormes : chaque stat boostée
  // a sa barre (proportionnelle au max du graphe) + sa valeur exacte affichée.
  const RADAR_COLORS = ["#ff5722", "#0ea5e9", "#22c55e", "#eab308", "#a855f7", "#ef4444"];
  // items : [{ label, value }]  (value = gain %)
  function renderBars(el, items, color) {
    if (!el) return;
    const data = (items || []).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    if (!data.length) { el.innerHTML = `<div class="radar-empty">${T('radar.nodata')}</div>`; return; }
    const max = data[0].value || 1;
    el.innerHTML = `<div class="bars">${data.map((d) => {
      const pct = Math.max((d.value / max) * 100, 1.5); // min visible pour les petites valeurs
      return `<div class="bar-row">
        <span class="bar-label" title="${d.label}">${d.label}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></span></span>
        <span class="bar-val">+${fmtDec(d.value.toFixed(1))}%</span>
      </div>`;
    }).join("")}</div>`;
  }
  const zRadarEl = document.getElementById("z-radar");
  const globalRadarEl = document.getElementById("global-radar");

  // Graphique "par perso" : barres du perso ciblé par le sélecteur partagé.
  // allChar : [{ slot, label, color, items }].
  function renderGlobalChart(allChar) {
    if (!globalRadarEl) return;
    if (!allChar.length) { renderBars(globalRadarEl, [], "#6366f1"); return; }
    const occ = allChar.map((c) => ({ idx: c.slot, character: state.team[c.slot].character }));
    const src = resolveFocusSlot(occ);
    const sel = allChar.find((c) => c.slot === src) || allChar[0];
    // Barres en bleu/indigo : même famille que le « Résumé des effets cumulés »
    // (items = bleu) et que la carte de total global, distinct de l'orange Cap Z.
    renderBars(globalRadarEl, sel.items, "#6366f1");
  }

  // ===== BILAN CAP Z =====
  const zBilanEl = document.getElementById("z-bilan");
  function renderZBilan() {
    const occupied = state.team
      .map((s, i) => ({ ...s, idx: i }))
      .filter((s) => s.character);
    if (occupied.length === 0) {
      zBilanEl.innerHTML = `<p class="placeholder">${T('team.noperso')}</p>`;
      renderBars(zRadarEl, [], "#ff5722");
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

    // Total global = somme de tous les gainPct sur tous les perso et toutes les stats
    const grandTotal = orderedTotals.reduce((sum, [, t]) => sum + t.totalGain, 0);
    const grandStatsCount = orderedTotals.length;
    const grandLinesCount = orderedTotals.reduce((sum, [, t]) => sum + t.count, 0);
    const grandTotalFmt = grandTotal.toFixed(0);

    // Carte "total global" uniquement : le détail par stat est désormais le
    // graphique en barres (#z-radar), fusionné dans le même panneau.
    const totauxSection = `
      <div class="z-grand-total">
        <div class="z-grand-total-label">${T('z.total.label')}</div>
        <div class="z-grand-total-value">+${grandTotalFmt}%</div>
        <div class="z-grand-total-detail">${T('z.total.detail', { n: grandLinesCount, m: grandStatsCount })}</div>
      </div>
    `;

    // Cellule Bilan Cap Z = carte du total global + graphique en barres (#z-radar).
    zBilanEl.innerHTML = totauxSection;

    // Barres : gain total d'équipe par stat (Cap Z) — toutes stats boostées, triées
    const teamItems = Object.values(statTotals).map((t) => ({ label: t.label, value: t.totalGain }));
    renderBars(zRadarEl, teamItems, "#ff5722");
  }

  // ===== BILAN GLOBAL (Cap Z + items, tout compris) =====
  const globalBilanEl = document.getElementById("global-bilan");

  // Stats combinées (Cap Z + items) d'un slot d'équipe donné.
  // Réutilise exactement la logique du calcul combiné de renderResults :
  // items résolus (OR + tag synthétique "même équipement") + Cap Z reçues,
  // évalués contre les conditions trio-scoped + team-wide du slot.
  function getCombinedStatsFor(slotIdx) {
    const zItems = buildTeamZItemsFor(slotIdx);
    const resolvedItems = patchSameItemTags(getItemsWithChoicesFor(slotIdx)).filter(Boolean);
    if (zItems.length === 0 && resolvedItems.length === 0) return null;
    const conds = buildItemConditions(slotIdx);
    return calculerStats({ items: [...resolvedItems, ...zItems], conditions: conds }).stats;
  }

  function renderGlobalBilan() {
    if (!globalBilanEl) return;
    const occupied = state.team
      .map((s, i) => ({ ...s, idx: i }))
      .filter((s) => s.character);
    if (occupied.length === 0) {
      globalBilanEl.innerHTML = `<p class="placeholder">${T('team.noperso')}</p>`;
      renderGlobalChart([]);
      return;
    }

    // Un seul passage : données par perso (barres) + totaux d'équipe (Cap Z + items).
    const statTotals = {};
    const allChar = occupied.map((slot, idx) => {
      const stats = getCombinedStatsFor(slot.idx) || {};
      const items = [];
      for (const cible of Object.keys(stats)) {
        const s = stats[cible];
        if (!s.hasBonus || s.gainPct <= 0) continue;
        items.push({ label: s.label, value: s.gainPct });
        if (!statTotals[cible]) statTotals[cible] = { label: s.label, totalGain: 0, count: 0, max: 0 };
        statTotals[cible].totalGain += s.gainPct;
        statTotals[cible].count++;
        if (s.gainPct > statTotals[cible].max) statTotals[cible].max = s.gainPct;
      }
      return { slot: slot.idx, label: slot.character.nom.trim(), color: RADAR_COLORS[idx % RADAR_COLORS.length], items };
    });
    // Barres du perso ciblé par le sélecteur partagé.
    renderGlobalChart(allChar);

    const orderedTotals = Object.entries(statTotals)
      .sort((a, b) => b[1].totalGain - a[1].totalGain);

    if (orderedTotals.length === 0) {
      globalBilanEl.innerHTML = `<p class="placeholder">${T('global.nobonus')}</p>`;
      return;
    }

    const grandTotal = orderedTotals.reduce((sum, [, t]) => sum + t.totalGain, 0);
    const grandStatsCount = orderedTotals.length;
    const grandLinesCount = orderedTotals.reduce((sum, [, t]) => sum + t.count, 0);
    const grandTotalFmt = grandTotal.toFixed(0);

    // Carte "total global" uniquement : le détail par stat est désormais le
    // graphique en barres (#global-radar), fusionné dans le même panneau.
    globalBilanEl.innerHTML = `
      <div class="z-grand-total is-global">
        <div class="z-grand-total-label">${T('global.total.label')}</div>
        <div class="z-grand-total-value">+${grandTotalFmt}%</div>
        <div class="z-grand-total-detail">${T('global.total.detail', { n: grandLinesCount, m: grandStatsCount })}</div>
      </div>
    `;
  }

  // ===== ARBRE DES CAP Z =====
  // Visualise la propagation : le perso sélectionné (source, en haut) envoie une
  // flèche vers chaque coéquipier (cible, en bas). La couleur indique la part des
  // lignes chiffrables de sa Cap Z qui atteignent la cible :
  //   vert = 100 % · jaune = partiel · rouge = 0 % · gris = aucune Cap Z chiffrable.
  const zTreeEl = document.getElementById("ztree");
  const ZTREE_ARROW = { full: "#22c55e", partial: "#eab308", none: "#ef4444", na: "#94a3b8" };
  const escSvg = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Couverture de la Cap Z de `sourceSlot` telle que reçue par `targetSlot`.
  function zCoverageFor(sourceSlot, targetSlot) {
    let applied = 0, total = 0;
    for (const zi of buildTeamZItemsFor(targetSlot)) {
      if (zi.sourceSlot !== sourceSlot) continue;
      total   += (zi.lignesAll || zi.lignes).filter((l) => !l.est_passif).length;
      applied += (zi.lignes || []).filter((l) => !l.est_passif).length;
    }
    let status = "na";
    if (total > 0) status = applied >= total ? "full" : applied > 0 ? "partial" : "none";
    return { applied, total, ratio: total > 0 ? applied / total : 0, status };
  }

  // Perso ciblé = perso analysé (state.activeSlot), partagé par le profil par perso,
  // l'arbre des Cap Z, le Résumé détaillé et les effets non calculés.
  // Garanti occupé par ensureActiveSlot() ; fallback défensif sur le 1er occupé.
  function resolveFocusSlot(occupied) {
    if (occupied.some((c) => c.idx === state.activeSlot)) return state.activeSlot;
    return occupied[0].idx;
  }

  // Sélecteur partagé (chips, par personnage) au-dessus des deux cellules.
  function renderFocusPicker() {
    const el = document.getElementById("focus-picker");
    if (!el) return;
    const occupied = state.team.map((s, i) => ({ ...s, idx: i })).filter((s) => s.character);
    if (occupied.length === 0) { el.innerHTML = ""; return; }
    const src = resolveFocusSlot(occupied);
    el.innerHTML = occupied.map((c, i) =>
      `<button class="radar-chip ${c.idx === src ? "is-active" : ""}" data-focus-char="${c.idx}" type="button">`
      + `<span class="radar-chip-dot" style="background:${RADAR_COLORS[i % RADAR_COLORS.length]}"></span>`
      + `${c.character.nom.trim()}</button>`
    ).join("");
  }

  // Découpe un nom en <= maxLines lignes de <= maxChars (par mots ; ellipsis si trop long).
  function wrapName(nom, maxChars, maxLines) {
    const words = String(nom).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = "", i = 0;
    for (; i < words.length; i++) {
      let w = words[i];
      if (w.length > maxChars) w = w.slice(0, maxChars - 1) + "…";
      const tentative = cur ? cur + " " + w : w;
      if (tentative.length <= maxChars) { cur = tentative; }
      else {
        lines.push(cur);
        if (lines.length === maxLines) { cur = ""; break; }
        cur = w;
      }
    }
    if (cur && lines.length < maxLines) { lines.push(cur); i++; }
    if (i < words.length && lines.length && !lines[lines.length - 1].endsWith("…")) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/\s+$/, "") + "…";
    }
    return lines.length ? lines : [String(nom)];
  }

  // Un nœud (cercle + image clippée + anneau + étoile leader + nom).
  // Source : nom sur UNE seule ligne, posé par-dessus les flèches (halo de lisibilité).
  // Cibles : nom sur 2 lignes max (les nœuds sont étroits, 5 de front).
  function zTreeNode(x, y, r, slot, isSrc) {
    const ch = state.team[slot].character;
    const clip = `ztclip_${slot}`;
    const isLeader = slot === effectiveLeaderSlot();
    const nom = ch.nom.trim();
    const img = ch.image
      ? `<image href="${escSvg(ch.image)}" x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" clip-path="url(#${clip})" preserveAspectRatio="xMidYMid slice"/>`
      : "";

    let nameSVG;
    if (isSrc) {
      const line = nom.length > 80 ? nom.slice(0, 79) + "…" : nom;
      const ny = y + r + 17;
      nameSVG = `<text x="${x}" y="${ny}" text-anchor="middle" class="ztree-name ztree-name--src"><title>${escSvg(nom)}</title>${escSvg(line)}</text>`;
    } else {
      const lineH = 14, nameY = y + r + 15;
      const tspans = wrapName(nom, 15, 2)
        .map((ln, k) => `<tspan x="${x}" dy="${k === 0 ? 0 : lineH}">${escSvg(ln)}</tspan>`)
        .join("");
      nameSVG = `<text x="${x}" y="${nameY}" text-anchor="middle" class="ztree-name"><title>${escSvg(nom)}</title>${tspans}</text>`;
    }

    return `
      <clipPath id="${clip}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>
      <circle cx="${x}" cy="${y}" r="${r}" class="ztree-node-bg"/>
      ${img}
      <circle cx="${x}" cy="${y}" r="${r}" class="ztree-ring ${isSrc ? "ztree-ring--src" : ""}"/>
      ${isLeader ? `<text x="${x}" y="${y - r - 7}" text-anchor="middle" class="ztree-star">★</text>` : ""}
      ${nameSVG}`;
  }

  // Construit le SVG complet (1 source en haut, n cibles réparties en bas).
  function buildZTreeSVG(srcSlot, others) {
    const VBW = 640, VBH = 318;
    const cx = VBW / 2, cyTop = 56, rTop = 38;
    const cyBot = 230, rBot = 30;
    const n = others.length;
    const left = 70, right = VBW - 70;
    const xOf = (i) => (n === 1 ? cx : left + i * ((right - left) / (n - 1)));

    let arrows = "", pcts = "";
    others.forEach((o, i) => {
      const bx = xOf(i), by = cyBot;
      const dx = bx - cx, dy = by - cyTop;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist, uy = dy / dist;
      const sx = cx + ux * rTop, sy = cyTop + uy * rTop;
      const ex = bx - ux * (rBot + 13), ey = by - uy * (rBot + 13);
      const cov = zCoverageFor(srcSlot, o.idx);
      const col = ZTREE_ARROW[cov.status];
      const dash = cov.status === "na" ? ` stroke-dasharray="5 5"` : "";
      arrows += `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${col}" stroke-width="3"${dash} marker-end="url(#ztarr_${cov.status})"/>`;
      const mx = sx + (ex - sx) * 0.52, my = sy + (ey - sy) * 0.52;
      const label = cov.status === "na" ? "N/A" : Math.round(cov.ratio * 100) + "%";
      pcts += `<g class="ztree-pct" data-ztree-edge data-src="${srcSlot}" data-tgt="${o.idx}"><rect x="${(mx - 19).toFixed(1)}" y="${(my - 11).toFixed(1)}" width="38" height="22" rx="11" class="ztree-pct-bg" stroke="${col}"/><text x="${mx.toFixed(1)}" y="${(my + 4).toFixed(1)}" text-anchor="middle" fill="${col}" class="ztree-pct-text">${label}</text></g>`;
    });

    const defs = `<defs>${["full", "partial", "none", "na"].map((st) =>
      `<marker id="ztarr_${st}" markerWidth="12" markerHeight="12" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5 L0,10 Z" fill="${ZTREE_ARROW[st]}"/></marker>`
    ).join("")}</defs>`;

    const nodes = zTreeNode(cx, cyTop, rTop, srcSlot, true)
      + others.map((o, i) => zTreeNode(xOf(i), cyBot, rBot, o.idx, false)).join("");

    return `<div class="ztree-canvas"><svg class="ztree-svg" viewBox="0 0 ${VBW} ${VBH}" preserveAspectRatio="xMidYMid meet" role="img">${defs}${arrows}${pcts}${nodes}</svg></div>`;
  }

  function renderZTree() {
    if (!zTreeEl) return;
    const occupied = state.team.map((s, i) => ({ ...s, idx: i })).filter((s) => s.character);
    if (occupied.length === 0) {
      zTreeEl.innerHTML = `<p class="placeholder">${T('team.noperso')}</p>`;
      return;
    }
    const srcSlot = resolveFocusSlot(occupied);
    const others = occupied.filter((c) => c.idx !== srcSlot);
    if (others.length === 0) {
      zTreeEl.innerHTML = `<div class="radar-empty">${T('ztree.alone')}</div>`;
      return;
    }

    const legend = `<div class="ztree-legend">
      <span><i style="background:${ZTREE_ARROW.full}"></i>${T('ztree.legend.full')}</span>
      <span><i style="background:${ZTREE_ARROW.partial}"></i>${T('ztree.legend.partial')}</span>
      <span><i style="background:${ZTREE_ARROW.none}"></i>${T('ztree.legend.none')}</span>
    </div>`;

    zTreeEl.innerHTML = buildZTreeSVG(srcSlot, others) + legend;
  }

  // Sélecteur partagé : un clic met à jour le profil par perso ET l'arbre.
  const focusPickerEl = document.getElementById("focus-picker");
  if (focusPickerEl) {
    focusPickerEl.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-focus-char]");
      if (!chip) return;
      state.activeSlot = +chip.dataset.focusChar;
      renderTeamGrid();   // met à jour la ligne active surlignée dans le builder
      renderResults();    // recalcule global + arbre + résumé détaillé + effets non calculés
    });
  }

  // — Détail au survol d'un badge % : quelles lignes de la Cap Z de la source
  //   s'appliquent (✓) ou non (✗) à la cible, avec leurs conditions. —
  function zCondLabel(l) {
    if (!l.condition) return null;
    const tags = l.condition.tags_requis || [];
    if (!tags.length) return null;
    const sep = ` ${l.condition.mode === "and" ? T('cond.and') : T('cond.or')} `;
    return tags.join(sep);
  }

  function zTreeEdgeDetail(sourceSlot, targetSlot) {
    const src = state.team[sourceSlot] && state.team[sourceSlot].character;
    const tgt = state.team[targetSlot] && state.team[targetSlot].character;
    if (!src || !tgt) return "";
    const targetIsLeader = targetSlot === effectiveLeaderSlot();
    const senderIsLeader = sourceSlot === effectiveLeaderSlot();
    const sameTrio = Math.floor(sourceSlot / 3) === Math.floor(targetSlot / 3);
    const leaderInvolved = targetIsLeader || (senderIsLeader && sameTrio);
    const targetConds = getEffectiveConditionsFor(tgt);

    let applied = 0, total = 0, groupsHTML = "";
    for (const zi of buildTeamZItemsFor(targetSlot)) {
      if (zi.sourceSlot !== sourceSlot) continue;
      const lines = (zi.lignesAll || zi.lignes).filter((l) => !l.est_passif);
      if (!lines.length) continue;
      const tierLab = ["I", "II", "III", "IV"][zi.tier - 1];
      const head = zi.kind === "zenkai" ? `${T('z.capz.label')} Zenkai ${tierLab}` : `${T('z.capz.label')} ${tierLab}`;
      const linesHTML = lines.map((l) => {
        const ok = leaderInvolved || !l.condition || condRemplieCalc(l, targetConds);
        total++; if (ok) applied++;
        const lab = STATS[l.stat] ? STATS[l.stat].label : l.stat;
        const cond = zCondLabel(l);
        const condHTML = cond ? `<span class="ztree-tip-cond">${escSvg(cond)}</span>` : "";
        return `<div class="ztree-tip-line ${ok ? "is-ok" : "is-ko"}"><span class="ztree-tip-mark">${ok ? "✓" : "✗"}</span><span>+${l.valeur_max.toFixed(0)}% ${escSvg(lab)}</span>${condHTML}</div>`;
      }).join("");
      groupsHTML += `<div class="ztree-tip-group"><div class="ztree-tip-grouphead">${head}</div>${linesHTML}</div>`;
    }
    const pct = total > 0 ? Math.round((applied / total) * 100) : 0;
    const cov = total > 0 ? `${applied}/${total} ${T('ztree.tip.lines')} · ${pct}%` : T('ztree.tip.noz');
    return `<div class="ztree-tip-head"><strong>${escSvg(src.nom.trim())}</strong> → <strong>${escSvg(tgt.nom.trim())}</strong></div>`
      + `<div class="ztree-tip-cov">${cov}</div>`
      + (groupsHTML || `<div class="ztree-tip-empty">${T('ztree.tip.noz')}</div>`);
  }

  let ztreeTip = null;
  function ztreeHideTip() { if (ztreeTip) { ztreeTip.hidden = true; ztreeTip._key = null; } }
  function ztreeShowTip(x, y) {
    if (!ztreeTip) return;
    ztreeTip.hidden = false;
    const pad = 14, r = ztreeTip.getBoundingClientRect();
    let left = x + pad, top = y + pad;
    if (left + r.width > window.innerWidth - 8) left = x - pad - r.width;
    if (top + r.height > window.innerHeight - 8) top = y - pad - r.height;
    ztreeTip.style.left = Math.max(8, left) + "px";
    ztreeTip.style.top = Math.max(8, top) + "px";
  }
  if (zTreeEl) {
    zTreeEl.addEventListener("mousemove", (e) => {
      const edge = e.target.closest && e.target.closest("[data-ztree-edge]");
      if (!edge) { ztreeHideTip(); return; }
      if (!ztreeTip) {
        ztreeTip = document.createElement("div");
        ztreeTip.className = "ztree-tip";
        ztreeTip.hidden = true;
        document.body.appendChild(ztreeTip);
      }
      const key = edge.dataset.src + ":" + edge.dataset.tgt;
      if (ztreeTip._key !== key) {
        ztreeTip.innerHTML = zTreeEdgeDetail(+edge.dataset.src, +edge.dataset.tgt);
        ztreeTip._key = key;
      }
      ztreeShowTip(e.clientX, e.clientY);
    });
    zTreeEl.addEventListener("mouseleave", ztreeHideTip);
  }

  // ===== RENDU GLOBAL =====
  function renderAll() {
    renderTeamGrid();   // grille builder (persos + items)
    renderConditions();
    renderResults();
  }

  // ===== BOUTON "SANS LEADER" =====
  const noLeaderBtn = document.getElementById("no-leader-btn");

  function renderNoLeaderBtn() {
    if (!noLeaderBtn) return;
    noLeaderBtn.classList.toggle("is-active", state.noLeader);

    // Styles appliqués directement en JS pour contourner les conflits de cascade CSS.
    // Le reset global `button {}` et `all: unset` se disputent la priorité selon les
    // navigateurs — l'inline style gagne toujours.
    const active_ = state.noLeader;
    noLeaderBtn.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:8px",
      "width:100%",
      "padding:12px 20px",
      "background:" + (active_ ? "var(--accent-tint-2)" : "var(--surface-2)"),
      "color:"       + (active_ ? "var(--accent)"       : "var(--text-soft)"),
      "font-family:var(--font-body)",
      "font-size:12px",
      "font-weight:600",
      "letter-spacing:.02em",
      "cursor:pointer",
      "border:none",
      "border-radius:0",
      "box-sizing:border-box",
      "user-select:none",
      "-webkit-user-select:none",
      "outline:none",
      "text-align:left",
      "transition:background 200ms,color 200ms",
    ].join(";");

    const starEl  = noLeaderBtn.querySelector(".no-leader-star");
    const textEl  = noLeaderBtn.querySelector(".no-leader-text");
    const badgeEl = noLeaderBtn.querySelector(".no-leader-badge");

    if (starEl) {
      starEl.style.cssText = "font-size:13px;flex-shrink:0;transition:color 200ms;color:" +
        (active_ ? "var(--accent)" : "var(--muted)");
    }
    if (textEl) {
      textEl.style.cssText = "flex:1";
      textEl.textContent = active_ ? T('leader.activate') : T('leader.deactivate');
    }
    if (badgeEl) {
      badgeEl.textContent = active_ ? T('leader.on') : T('leader.off');
      badgeEl.classList.toggle("is-on", active_);
      badgeEl.style.cssText = [
        "font-size:10px",
        "font-weight:700",
        "letter-spacing:.08em",
        "padding:2px 7px",
        "border-radius:999px",
        "flex-shrink:0",
        "background:" + (active_ ? "var(--accent)" : "var(--line)"),
        "color:"       + (active_ ? "#fff"          : "var(--muted)"),
        "transition:background 200ms,color 200ms",
      ].join(";");
    }
  }

  noLeaderBtn.addEventListener("click", () => {
    state.noLeader = !state.noLeader;
    renderTeamGrid();       // met à jour les étoiles + appelle renderNoLeaderBtn
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

  // ===== CHANGEMENT DE LANGUE =====
  // Re-render complet quand l'utilisateur bascule FR ↔ EN
  window.addEventListener('dbl-lang-changed', () => {
    renderTeamGrid();
    renderCharPicker();
    renderBuildState();
    renderAll();
  });

  // ===== INIT =====
  renderTeamGrid();
  renderCharPicker();
  renderCharTraits();
  renderBuildState();
  renderAll();
  motionInitScrollReveal();
})();
