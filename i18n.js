// ============================================================
// DBL Optimizer — i18n (FR / EN)
// Chargé en premier, avant tous les autres scripts.
// Expose window.DBL_I18N : { T, getLang, setLang, applyStaticTranslations }
// ============================================================

(function () {
  // ──────────────────────────────────────────────
  // DICTIONNAIRE FR / EN
  // ──────────────────────────────────────────────
  const DICT = {

    // ── HTML statique ─────────────────────────────
    'panel.team.title':        { fr: 'Équipe',              en: 'Team' },
    'panel.team.hint':         { fr: 'clique sur + pour ajouter un perso · clique sur une carte pour l\'éditer',
                                  en: 'click + to add a character · click a card to edit it' },
    'panel.build.subhead':     { fr: 'Items équipés',       en: 'Equipped items' },
    'panel.build.hint':        { fr: 'max 3',               en: 'max 3' },
    'build.empty.text':        { fr: 'Ce slot est vide.',   en: 'This slot is empty.' },
    'build.empty.btn':         { fr: 'Ajouter un personnage', en: 'Add a character' },
    'panel.builder.title':     { fr: 'Équipe & Items',       en: 'Team & Items' },
    'panel.builder.hint':      { fr: 'clique sur un perso vide pour l\'ajouter · choisis ses items en face', en: 'click an empty slot to add a character · pick their items on the right' },
    'builder.col.persos':      { fr: 'Personnages',          en: 'Characters' },
    'builder.col.items':       { fr: 'Items équipés (max 3)', en: 'Equipped items (max 3)' },
    'builder.items.empty':     { fr: 'Ajoute un perso pour équiper des items', en: 'Add a character to equip items' },
    'items.details':           { fr: 'Voir les détails des items', en: 'View item details' },
    'builder.summary.empty':   { fr: 'Aucun bonus chiffré', en: 'No quantified bonus' },
    'items.details.title':     { fr: 'Items — {name}', en: 'Items — {name}' },
    'results.detail.label':    { fr: 'Détail par perso :',   en: 'Per-character detail:' },
    'panel.conditions.title':  { fr: 'Composition d\'équipe', en: 'Team Composition' },
    'panel.conditions.sub':    { fr: 'Certains items ont des effets conditionnels. Les compositions sont détectées automatiquement à partir des traits.',
                                  en: 'Some items have conditional effects. Team compositions are auto-detected from character tags.' },
    'panel.z.title':           { fr: 'Bilan global (Cap Z)', en: 'Global summary (Z Abilities)' },
    'panel.z.sub':             { fr: 'Total des bonus de Cap Z reçus par l\'équipe. Chaque perso reçoit la sienne + celles des coéquipiers selon les conditions ; le Leader (★) sans restriction.',
                                  en: 'Total Z Ability bonuses received by the team. Each character gets their own + teammates\' based on conditions; the Leader (★) without restriction.' },
    'panel.stats.title':       { fr: 'Résumé des effets cumulés', en: 'Cumulated Effects Summary' },
    'panel.stats.sub':         { fr: 'Bleu = bonus d\'<em>items</em>. Orange = bonus <em>Cap Z</em>. Le multiplicateur équivalent montre le gain final.',
                                  en: 'Blue = <em>items</em> bonus. Orange = <em>Z Ability</em> bonus. The equivalent multiplier shows the final gain.' },
    'panel.passifs.title':     { fr: 'Effets non calculés', en: 'Uncalculated Effects' },
    'modal.item.title':        { fr: 'Choisir un item',     en: 'Choose an item' },
    'modal.item.search.ph':    { fr: 'Filtrer par nom...', en: 'Filter by name...' },
    'modal.item.search.aria':  { fr: 'Rechercher un item',  en: 'Search for an item' },
    'modal.char.title':        { fr: 'Choisir un personnage', en: 'Choose a character' },
    'modal.char.search.ph':    { fr: 'Rechercher (nom, code, trait)...', en: 'Search (name, code, tag)...' },
    'modal.char.search.aria':  { fr: 'Rechercher un personnage', en: 'Search for a character' },
    'nav.team':  { fr: 'Équipe', en: 'Team' },
    'nav.build': { fr: 'Équipe',  en: 'Team' },
    'nav.capz':  { fr: 'Cap Z',  en: 'Cap Z' },
    'nav.global':{ fr: 'Global', en: 'Global' },
    'nav.stats': { fr: 'Stats',  en: 'Stats' },

    // ── Dynamique : personnages & team ───────────
    'charmodal.title':      { fr: 'Personnage — Slot {n}', en: 'Character — Slot {n}' },
    'char.notfound':        { fr: 'Aucun personnage trouvé', en: 'No character found' },
    'char.traits':          { fr: 'Tags ({n})',             en: 'Tags ({n})' },
    'char.taken':           { fr: 'Déjà dans l\'équipe',    en: 'Already in team' },
    'char.deselect':        { fr: 'Désélectionner',         en: 'Deselect' },
    'team.card.empty':      { fr: 'Vide',                   en: 'Empty' },
    'team.card.add':        { fr: 'Cliquer pour ajouter',   en: 'Click to add' },
    'team.leader.title':    { fr: 'Désigner comme Leader',  en: 'Designate as Leader' },
    'team.sep':             { fr: 'Trio A ↑ · Trio B ↓',   en: 'Trio A ↑ · Trio B ↓' },
    'build.title':          { fr: 'Build du Slot {n}',      en: 'Slot {n} Build' },
    'build.leader':         { fr: '★ Leader',               en: '★ Leader' },
    'trio.a':               { fr: 'Trio A',                 en: 'Trio A' },
    'trio.b':               { fr: 'Trio B',                 en: 'Trio B' },
    'item.self':            { fr: 'Soi',                    en: 'Self' },
    'leader.activate':      { fr: 'Réactiver le leader',    en: 'Re-enable leader' },
    'leader.deactivate':    { fr: 'Désactiver le leader',   en: 'Disable leader' },
    'leader.on':            { fr: 'ON', en: 'ON' },
    'leader.off':           { fr: 'OFF', en: 'OFF' },
    'filter.all':           { fr: 'Tous', en: 'All' },
    'filter.compat':        { fr: '✓ Compatibles', en: '✓ Compatible' },

    // ── Éléments / Attributs ─────────────────────
    // Codes internes EN → libellés affichés selon la langue
    'elem.BLU': { fr: 'BLE', en: 'BLU' },  // Bleu
    'elem.RED': { fr: 'RGE', en: 'RED' },  // Rouge
    'elem.GRN': { fr: 'VRT', en: 'GRN' },  // Vert
    'elem.YEL': { fr: 'JAU', en: 'YEL' },  // Jaune
    'elem.PUR': { fr: 'VIO', en: 'PUR' },  // Violet
    'elem.LGT': { fr: 'LUM', en: 'LGT' },  // Lumière

    // ── Dynamique : items & slots ────────────────
    'itemmodal.title.slot': { fr: 'Choisir un item — Slot {n}', en: 'Choose an item — Slot {n}' },
    'item.notfound':        { fr: 'Aucun item trouvé',      en: 'No item found' },
    'slot.choose':          { fr: '+ Choisir un item',      en: '+ Choose an item' },
    'slot.compatible':      { fr: 'Compatible :',           en: 'Compatible:' },
    'slot.or.head':         { fr: 'Choix aléatoire — sélectionne ta ligne :', en: 'Random choice — select your stat:' },
    'slot.or.passive':      { fr: 'Effet aléatoire — l\'un des deux :', en: 'Random effect — one of the two:' },
    'slot.change':          { fr: 'Changer',                en: 'Change' },
    'slot.remove':          { fr: 'Retirer',                en: 'Remove' },
    'item.compat.yes':      { fr: 'Compatible avec {name}', en: 'Compatible with {name}' },
    'item.compat.no':       { fr: 'Incompatible avec {name}', en: 'Incompatible with {name}' },
    'item.details':         { fr: 'Voir les détails',       en: 'View details' },
    'passif.label':         { fr: 'Passif',                 en: 'Passive' },

    // ── Dynamique : conditions ───────────────────
    'cond.or':        { fr: 'ou',     en: 'or' },
    'cond.and':       { fr: 'et',     en: 'and' },
    'cond.allof':     { fr: 'À la fois', en: 'All of' },
    'cond.inteam':    { fr: '« {tag} » dans l\'équipe', en: '"The team has \'{tag}\'"' },
    'cond.auto':      { fr: 'Auto :',         en: 'Auto:' },
    'cond.threshold': { fr: 'Seuil requis :', en: 'Required threshold:' },
    'source.prefix':  { fr: 'Source :',       en: 'Source:' },

    // ── Dynamique : Z Abilities ──────────────────
    'z.always':        { fr: 'Toujours actif :',    en: 'Always active:' },
    'z.leaderbadge':   { fr: '★ Leader bypass',      en: '★ Leader bypass' },
    'z.leadertitle':   { fr: 'Activé via le privilège Leader', en: 'Activated via Leader privilege' },
    'z.capz.label':    { fr: 'Cap. Z',               en: 'Z Abi.' },
    'z.zenkai.label':  { fr: 'Cap. Z Zenkai IV (max)', en: 'Zenkai Z Abi. IV (max)' },

    // ── Dynamique : bilan Cap Z ──────────────────
    'z.total.label':   { fr: 'Total global équipe',    en: 'Team grand total' },
    'z.total.detail':  { fr: '{n} applications de Z sur {m} stats', en: '{n} Z applications on {m} stats' },

    // ── Bilan global (Cap Z + items, tout compris) ──────────
    'panel.global.title': { fr: 'Bilan global (Cap Z + items)', en: 'Global summary (Z Abilities + items)' },
    'panel.zradar.title':  { fr: 'Profil des stats (Cap Z)', en: 'Stat profile (Z Abilities)' },
    'panel.zradar.sub':    { fr: 'Gain total d\'équipe par stat, en pourcentage.', en: 'Team total gain per stat, in percent.' },
    'panel.globalradar.title': { fr: 'Profil par perso (Cap Z + items)', en: 'Per-character profile (Z + items)' },
    'panel.globalradar.sub':   { fr: 'Gain par stat — choisis un perso, ou « Tous » pour le total d\'équipe.', en: 'Gain per stat — pick a character, or "All" for the team total.' },
    'radar.nodata':        { fr: 'Aucune stat boostée pour le moment.', en: 'No boosted stat yet.' },
    'radar.max':           { fr: 'max', en: 'max' },
    'radar.all':           { fr: 'Tous', en: 'All' },
    'panel.global.sub':   { fr: 'Tout compris : pour chaque perso, on combine ses Cap Z reçues ET ses items équipés (couches base/pur/direct multipliées).',
                            en: 'Everything included: for each character, received Z Abilities AND equipped items are combined (base/pure/direct layers multiplied).' },
    'global.total.label': { fr: 'Total global (Cap Z + items)', en: 'Grand total (Z + items)' },
    'global.total.detail':{ fr: '{n} bonus cumulés sur {m} stats', en: '{n} stacked bonuses on {m} stats' },
    'global.totals.title':{ fr: 'Totaux par stat (tout compris)', en: 'Totals by stat (all included)' },
    'global.nobonus':     { fr: 'Aucun bonus chiffrable sur l\'équipe.', en: 'No quantifiable bonus on the team.' },

    // ── Dynamique : résultats & passifs ──────────
    'stats.placeholder':   { fr: 'Équipe au moins un item (ou sélectionne un perso) pour voir le résumé des effets.',
                              en: 'Equip at least one item (or select a character) to see the effects summary.' },
    'passif.none':         { fr: 'Aucun effet passif.',                    en: 'No passive effects.' },
    'passifs.equipped.none': { fr: 'Aucun effet passif sur les items équipés.', en: 'No passive effects on equipped items.' },
    'team.noperso':        { fr: 'Aucun perso dans l\'équipe.',             en: 'No character in the team.' },
    'inactive.tag':        { fr: '❓ Inactif',                              en: '❓ Inactive' },

    // ── Colonnes du tableau de stats ────────────
    'cell.items.base': { fr: 'Items (base)', en: 'Items (base)' },
    'cell.capz':       { fr: 'Cap Z',        en: 'Z Abi.' },
    'cell.zenkai':     { fr: 'Cap Z Zenkai', en: 'Zenkai Z' },
    'cell.items.pur':  { fr: 'Items (pur)',  en: 'Items (pure)' },
    'cell.total':      { fr: 'Total',        en: 'Total' },

    // ── Groupes de stats (display) ───────────────
    'group.vie':        { fr: 'Vie',       en: 'Health' },
    'group.attaque':    { fr: 'Attaque',   en: 'Attack' },
    'group.defense':    { fr: 'Défense',   en: 'Defense' },
    'group.utilitaire': { fr: 'Utilitaire', en: 'Utility' },

    // ── Labels de stats affichées ────────────────
    'stat.force':       { fr: 'Force',                    en: 'Health' },
    'stat.regen':       { fr: 'Quantité de régénération', en: 'HP Regen Amount' },
    'stat.tech_spe':    { fr: 'Dégâts technique spéciale', en: 'Special Move DMG' },
    'stat.ultime':      { fr: 'Dégâts technique ultime',  en: 'Ultimate Move DMG' },

    // ── Labels LABELS_CIBLES (calc.js) ───────────
    'labels.attaque_physique':        { fr: 'Attaque physique',          en: 'Physical ATK' },
    'labels.attaque_energie':         { fr: "Attaque d'énergie",         en: 'Energy ATK' },
    'labels.defense_physique':        { fr: 'Défense physique',          en: 'Physical DEF' },
    'labels.defense_energie':         { fr: "Défense d'énergie",         en: 'Energy DEF' },
    'labels.points_de_vie':           { fr: 'Points de vie',             en: 'Health Points' },
    'labels.vitesse_regen_ki':        { fr: 'Vitesse de régén. du Ki',   en: 'Ki Recovery Speed' },
    'labels.critique':                { fr: 'Critique',                  en: 'Critical Rate' },
    'labels.vanish_recover':          { fr: 'Vanish Recover',            en: 'Vanish Recover' },
    'labels.force':                   { fr: 'Force',                     en: 'Health' },
    'labels.degats_infliges':         { fr: 'Dégâts infligés',           en: 'Damage Inflicted' },
    'labels.degats_energie_infliges': { fr: "Dégâts d'énergie infligés", en: 'Energy Damage Inflicted' },
    'labels.degats_tech_spe':         { fr: 'Dégâts tech. spéciale',     en: 'Special Move DMG' },
    'labels.degats_ultime':           { fr: 'Dégâts tech. ultime',       en: 'Ultimate Move DMG' },
    'labels.quantite_regen_force':    { fr: 'Quantité de régénération',  en: 'HP Regen Amount' },
    'labels.garde_contre_degats':     { fr: 'Garde contre les dégâts',   en: 'Damage Guard' },

    // ── Raretés ──────────────────────────────────
    'rarity.platinum':       { fr: 'PLATINUM',        en: 'PLATINUM' },
    'rarity.awakenedunique': { fr: 'UNIQUE ÉVEILLÉ',  en: 'AWAKENED UNIQUE' },
    'rarity.unique':         { fr: 'UNIQUE',          en: 'UNIQUE' },
    'rarity.awakenedgold':   { fr: 'OR ÉVEILLÉ',      en: 'AWAKENED GOLD' },
    'rarity.gold':           { fr: 'OR',              en: 'GOLD' },
    'rarity.awakenedsilver': { fr: 'ARGENT ÉVEILLÉ',  en: 'AWAKENED SILVER' },
    'rarity.silver':         { fr: 'ARGENT',          en: 'SILVER' },
    'rarity.awakenedbronze': { fr: 'BRONZE ÉVEILLÉ',  en: 'AWAKENED BRONZE' },
    'rarity.bronze':         { fr: 'BRONZE',          en: 'BRONZE' },
    'rarity.iron':           { fr: 'FER',             en: 'IRON' },
    'rarity.event':          { fr: 'ÉVÉNEMENT',       en: 'EVENT' },
  };

  // ──────────────────────────────────────────────
  // ÉTAT
  // ──────────────────────────────────────────────
  let _lang = localStorage.getItem('dbl-lang') || 'fr';

  // ──────────────────────────────────────────────
  // FONCTIONS PUBLIQUES
  // ──────────────────────────────────────────────

  /**
   * Traduit une clé avec interpolation optionnelle.
   * T('build.title', { n: 3 }) → "Build du Slot 3"
   */
  function T(key, params) {
    const entry = DICT[key];
    if (!entry) { console.warn('[i18n] clé manquante :', key); return key; }
    let str = entry[_lang] || entry['fr'] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), v);
      }
    }
    return str;
  }

  function getLang() { return _lang; }

  function setLang(lang) {
    _lang = (lang === 'en') ? 'en' : 'fr';
    localStorage.setItem('dbl-lang', _lang);
    document.documentElement.lang = _lang === 'fr' ? 'fr' : 'en';
    applyStaticTranslations();
    _updateLangBtn();
    window.dispatchEvent(new CustomEvent('dbl-lang-changed', { detail: { lang: _lang } }));
  }

  /**
   * Applique les traductions sur les éléments HTML portant data-i18n*.
   * Appelé au chargement et lors de chaque changement de langue.
   */
  function applyStaticTranslations() {
    // textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = T(el.dataset.i18n);
    });
    // innerHTML (éléments avec <em>, etc.)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = T(el.dataset.i18nHtml);
    });
    // placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = T(el.dataset.i18nPlaceholder);
    });
    // aria-label
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      el.setAttribute('aria-label', T(el.dataset.i18nAriaLabel));
    });
    // title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.setAttribute('title', T(el.dataset.i18nTitle));
    });
  }

  // ──────────────────────────────────────────────
  // BOUTON DE LANGUE
  // ──────────────────────────────────────────────
  function _updateLangBtn() {
    const btn = document.getElementById('lang-toggle');
    if (!btn) return;
    const cur  = btn.querySelector('.lang-current');
    const next = btn.querySelector('.lang-next');
    if (cur)  cur.textContent  = _lang.toUpperCase();
    if (next) next.textContent = _lang === 'fr' ? 'EN' : 'FR';
    btn.setAttribute('aria-label', _lang === 'fr' ? 'Switch to English' : 'Passer en français');
  }

  // Initialisation du bouton (DOM déjà disponible car scripts en fin de body)
  const _btn = document.getElementById('lang-toggle');
  if (_btn) {
    _btn.addEventListener('click', () => setLang(_lang === 'fr' ? 'en' : 'fr'));
  }

  // ──────────────────────────────────────────────
  // EXPORT
  // ──────────────────────────────────────────────
  window.DBL_I18N = { T, getLang, setLang, applyStaticTranslations };

  // Application initiale (DOM déjà parsé)
  document.documentElement.lang = _lang === 'fr' ? 'fr' : 'en';
  applyStaticTranslations();
  _updateLangBtn();
})();
