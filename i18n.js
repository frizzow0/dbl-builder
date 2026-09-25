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
    'seo.intro.title':         { fr: 'Optimiseur d\'équipe & d\'items Dragon Ball Legends', en: 'Dragon Ball Legends Team Builder & Items Optimizer' },
    'seo.intro.text':          { fr: 'DBL Optimizer calcule en temps réel les bonus de <strong>Cap Z</strong> et d\'<strong>items</strong> de ton équipe <strong>Dragon Ball Legends</strong> : compose tes deux trios, équipe tes items, et visualise les stats cumulées, le bilan global (Cap Z + items) et la propagation des Cap Z entre coéquipiers.',
                                 en: 'DBL Optimizer computes your <strong>Dragon Ball Legends</strong> team\'s <strong>Z Ability</strong> and <strong>item</strong> bonuses in real time: build your two trios, equip items, and see cumulated stats, the global summary (Z + items) and how Z Abilities propagate across teammates.' },
    'jump.capz':               { fr: 'Voir le bilan Cap Z',   en: 'See the Z Ability summary' },
    'jump.combo':              { fr: 'Voir le bilan Cap Z + items', en: 'See the Z + items summary' },
    'panel.builder.title':     { fr: 'Équipe & Items',       en: 'Team & Items' },
    'panel.builder.hint':      { fr: 'clique sur un perso vide pour l\'ajouter · choisis ses items en face', en: 'click an empty slot to add a character · pick their items on the right' },
    'builder.items.empty':     { fr: 'Ajoute un perso pour équiper des items', en: 'Add a character to equip items' },
    'items.details':           { fr: 'Voir les détails des items', en: 'View item details' },
    'builder.summary.empty':   { fr: 'Aucun bonus chiffré', en: 'No quantified bonus' },
    'items.details.title':     { fr: 'Items — {name}', en: 'Items — {name}' },
    'results.detail.label':    { fr: 'Détail par perso :',   en: 'Per-character detail:' },
    'panel.conditions.title':  { fr: 'Composition d\'équipe', en: 'Team Composition' },
    'panel.conditions.sub':    { fr: 'Effets d’items qui dépendent des tags présents dans le trio de leur porteur.', en: 'Item effects that depend on tags in their wearer’s trio.' },
    'panel.z.title':           { fr: 'Bilan global (Cap Z)', en: 'Global summary (Z Abilities)' },
    'panel.z.sub':             { fr: 'Total des bonus de Cap Z reçus par l\'équipe. Chaque perso reçoit la sienne + celles des coéquipiers selon les conditions ; le Leader (★) sans restriction.',
                                  en: 'Total Z Ability bonuses received by the team. Each character gets their own + teammates\' based on conditions; the Leader (★) without restriction.' },
    'panel.stats.title':       { fr: 'Résumé des effets cumulés', en: 'Cumulated Effects Summary' },
    'stats.detail.hint':       { fr: 'détail par stat (items vs Cap Z)', en: 'per-stat detail (items vs Z)' },
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

    // ── Dynamique : personnages & team ───────────
    'charmodal.title':      { fr: 'Personnage — Slot {n}', en: 'Character — Slot {n}' },
    'char.notfound':        { fr: 'Aucun personnage trouvé', en: 'No character found' },
    'char.traits':          { fr: 'Tags ({n})',             en: 'Tags ({n})' },
    'char.taken':           { fr: 'Déjà dans l\'équipe',    en: 'Already in team' },
    'team.card.empty':      { fr: 'Vide',                   en: 'Empty' },
    'team.card.add':        { fr: 'Cliquer pour ajouter',   en: 'Click to add' },
    'team.leader.title':    { fr: 'Désigner comme Leader',  en: 'Designate as Leader' },
    'team.sep':             { fr: 'Trio A ↑ · Trio B ↓',   en: 'Trio A ↑ · Trio B ↓' },
    'build.title':          { fr: 'Build du Slot {n}',      en: 'Slot {n} Build' },
    'build.leader':         { fr: '★ Leader',               en: '★ Leader' },
    'trio.a':               { fr: 'Trio A',                 en: 'Trio A' },
    'trio.b':               { fr: 'Trio B',                 en: 'Trio B' },
    // Mode de jeu : en Classique l'equipe est une titulaire + un banc ;
    // en Proud les deux trios sont a egalite et un Trio C departage.
    'trio.main':            { fr: 'Principale',             en: 'Main' },
    'trio.bench':           { fr: 'Banc',                   en: 'Bench' },
    // Outil de test (masqué aux visiteurs) : équipe aléatoire complète
    'dev.auto':             { fr: 'Auto',                   en: 'Auto' },
    'dev.auto.title':       { fr: 'Équipe aléatoire avec items (Alt+A) — outil de test',
                              en: 'Random team with equipment (Alt+A) — test tool' },
    'mode.label':           { fr: 'Mode de jeu',            en: 'Game mode' },
    'mode.classic':         { fr: 'Classique',              en: 'Classic' },
    'mode.proud':           { fr: 'Proud',                  en: 'Proud' },
    'trioc.title':          { fr: 'Trio C',                 en: 'Trio C' },
    'trioc.hint':           { fr: "En cas d’égalité, un troisième match départage : choisis 2 personnages d’un trio et 1 de l’autre.",
                              en: 'On a tie, a third match decides it: pick 2 characters from one trio and 1 from the other.' },
    'trioc.empty':          { fr: "Compose d’abord tes trios : le Trio C se choisit parmi tes 6 personnages.",
                              en: 'Build your trios first: Trio C is picked from your 6 characters.' },
    'trioc.count':          { fr: '{n}/3 sélectionnés',     en: '{n}/3 selected' },
    'trioc.valid':          { fr: '✓ Complet',              en: '✓ Complete' },
    'trioc.lock.full':      { fr: "Trio C déjà complet — retire un personnage pour en changer",
                              en: 'Trio C is already full — remove one to swap' },
    'trioc.lock.same':      { fr: "Déjà 2 personnages de ce trio : le troisième doit venir de l’autre",
                              en: 'Already 2 from this trio: the third must come from the other one' },
    'trioc.clear':          { fr: 'Réinitialiser',          en: 'Reset' },
    'tca.title': { fr: 'Analyse du Trio C', en: 'Trio C analysis' },
    'tca.hint': { fr: 'Cap Z et items quand ces 3 persos combattent ensemble, comparés à leur trio d’origine.', en: 'Z Abilities and items when these 3 fight together, compared with their original trio.' },
    'tca.score': { fr: 'Bonus total', en: 'Total bonus' },
    'tca.vs': { fr: 'vs trios d’origine', en: 'vs original trios' },
    'tca.fig.total': { fr: 'Total', en: 'Total' },
    'tca.fig.total.title': { fr: 'Cap Z et items se multiplient : l’écart du total peut dépasser la somme des deux écarts.', en: 'Z Abilities and items multiply: the total gap can exceed the sum of both gaps.' },
    'tca.fig.items': { fr: 'Items', en: 'Items' },
    'tca.changes': { fr: 'Ce qui change dans le Trio C', en: 'What changes in Trio C' },
    'tca.nochange': { fr: '✓ Rien de perdu : chaque perso garde ses bonus d’items et de Cap Z.', en: '✓ Nothing lost: every character keeps its item and Z Ability bonuses.' },
    'tca.kind.item': { fr: 'Item', en: 'Item' },
    'tca.count': { fr: '« {tag} » : {a} → {b}', en: '“{tag}”: {a} → {b}' },
    'tca.z.from': { fr: '{cap} de {nom}', en: '{nom}’s {cap}' },
    'tca.z.lost': { fr: 'Leader : sans condition seulement pour ses coéquipiers de combat', en: 'Leader: unconditional only for their battle teammates' },
    'tca.z.gained': { fr: 'Leader à ses côtés : s’applique sans condition', en: 'Leader alongside: applies unconditionally' },
    'tca.status.lost': { fr: 'Perdu', en: 'Lost' },
    'tca.status.gained': { fr: 'Gagné', en: 'Gained' },
    'tca.leader.out': { fr: '★ {nom}, ton leader, ne joue pas le Trio C : sa Cap Z n’y est plus appliquée sans condition.', en: '★ {nom}, your leader, is not in Trio C: their Z Ability no longer applies unconditionally there.' },
    'tca.best': { fr: 'Meilleur Trio C selon le bonus total : <b>{noms}</b> (+{n}%)', en: 'Best Trio C by total bonus: <b>{noms}</b> (+{n}%)' },
    'tca.best.apply': { fr: 'Choisir ce Trio C', en: 'Use this Trio C' },
    'tca.best.ok': { fr: '✓ C’est le meilleur Trio C possible selon le bonus total.', en: '✓ This is the best possible Trio C by total bonus.' },
    'teamtags.title':       { fr: 'Tags de l’équipe',       en: 'Team tags' },
    'teamtags.hint':       { fr: 'qui porte quel tag · les tags partagés en premier', en: 'who carries which tag · shared tags first' },
    'teamtags.empty':       { fr: 'Ajoute des personnages pour voir leurs tags.', en: 'Add characters to see their tags.' },
    'teamtags.noshared':   { fr: 'Aucun tag partagé par au moins 2 persos.', en: 'No tag shared by 2 or more characters.' },
    'teamtags.uniques.show': { fr: 'Afficher les tags uniques ({n})', en: 'Show single tags ({n})' },
    'teamtags.uniques.hide': { fr: 'Masquer les tags uniques', en: 'Hide single tags' },
    'teamtags.col.tag':    { fr: 'Tag', en: 'Tag' },
    'teamtags.col.total':  { fr: 'Total', en: 'Total' },
    'teamtags.none':        { fr: 'Aucun tag à afficher.',  en: 'No tags to show.' },
    'teamtags.cat.0':       { fr: 'Classe',                 en: 'Class' },
    'teamtags.cat.1':       { fr: 'Épisode',                en: 'Episode' },
    'teamtags.cat.2':       { fr: 'Personnage',             en: 'Character' },
    'teamtags.cat.3':       { fr: 'Style de combat',        en: 'Combat style' },
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
    'item.equip':           { fr: 'Équiper cet item',       en: 'Equip this item' },
    'item.reserved':        { fr: 'Réservé à',              en: 'Reserved for' },
    'item.drawer.kicker':   { fr: 'Détail de l’item',       en: 'Item details' },
    'item.drawer.close':    { fr: 'Fermer le détail',       en: 'Close details' },
    'item.or.passive':      { fr: 'Effet aléatoire — un seul parmi :', en: 'Random effect — only one of:' },

    // ── Dynamique : conditions ───────────────────
    'cond.or':        { fr: 'ou',     en: 'or' },
    'cond.and':       { fr: 'et',     en: 'and' },
    'cond.allof':     { fr: 'À la fois', en: 'All of' },
    'cond.badge.on':        { fr: 'Actifs : {n}',           en: 'Active: {n}' },
    'cond.badge.off':       { fr: 'Inactifs : {n}',         en: 'Inactive: {n}' },
    'cond.need.threshold':  { fr: '{n} dans son trio',      en: '{n} in their trio' },
    // Le jeu distingue plusieurs portées : ces libellés disent laquelle s'applique.
    'cond.need.porteur':    { fr: 'le porteur doit l’avoir', en: 'the wearer must have it' },
    'cond.need.autre':      { fr: '{n} autre dans son trio', en: '{n} other in their trio' },
    'cond.need.meme':       { fr: '{n} perso réunissant les 2 tags', en: '{n} character with both tags' },
    'cond.need.meme.autre': { fr: '{n} autre perso réunissant les 2 tags', en: '{n} other character with both tags' },
    'cond.need.et':         { fr: '{n} de chaque tag dans son trio', en: '{n} of each tag in their trio' },
    'cond.need.permember':  { fr: 'par membre du trio',     en: 'per trio member' },
    'cond.status.on':       { fr: 'Actif',                  en: 'Active' },
    'cond.status.missing':  { fr: 'Manque {n}',             en: '{n} missing' },
    'cond.simulated':       { fr: '(simulé)',               en: '(simulated)' },
    'cond.simulate':        { fr: 'Simuler',                en: 'Simulate' },
    'cond.simulate.title':  { fr: 'Compte simulé pour ce tag dans chaque trio : le calcul retient le plus grand entre le réel et le simulé.',
                              en: 'Simulated count for this tag in each trio: the calculation keeps the higher of real and simulated.' },
    'source.prefix':  { fr: 'Source :',       en: 'Source:' },

    // ── Dynamique : Z Abilities ──────────────────
    'z.always':        { fr: 'Toujours actif :',    en: 'Always active:' },
    'z.leaderbadge':   { fr: '★ Leader bypass',      en: '★ Leader bypass' },
    'z.leadertitle':   { fr: 'Activé via le privilège Leader', en: 'Activated via Leader privilege' },
    'z.capz.label':    { fr: 'Cap. Z',               en: 'Z Abi.' },
    'z.zenkai.label':  { fr: 'Cap. Z Zenkai IV (max)', en: 'Zenkai Z Abi. IV (max)' },
    // Résonance de la puissance : la Cap Z propre aux ULTRA
    'z.ultra.label':       { fr: 'Résonance de la puissance', en: 'Power Resonance' },
    'z.ultra.chip.leader': { fr: '⚡ Résonance · leader',     en: '⚡ Resonance · leader' },
    'z.ultra.chip.count':  { fr: '⚡ Résonance × {n}',        en: '⚡ Resonance × {n}' },
    'z.ultra.asleader':    { fr: 'en leader : valeurs pleines', en: 'as leader: full values' },
    'z.ultra.permember':   { fr: '{n} « {tag} » sur les 6 de l’équipe', en: '{n} “{tag}” out of the 6 in the team' },
    'z.ultra.none':        { fr: 'aucun porteur du tag dans l’équipe', en: 'no character with the tag in the team' },
    'z.ultra.note':        { fr: 'Effet de combat : il n’entre pas dans les bilans ci-dessus.',
                             en: 'Battle effect: not included in the summaries above.' },
    'z.ultra.line.leader': { fr: 'En leader : {bonus}', en: 'As leader: {bonus}' },
    'z.ultra.line.permember': { fr: 'Sinon : {bonus} par combattant « {tag} » de l’équipe — les 6, quel que soit le trio',
                                en: 'Otherwise: {bonus} per “{tag}” fighter in the team — all 6, whichever trio' },
    'z.ultra.line.allies': { fr: 'Pour les alliés : {bonus} par combattant « {tag} » de l’équipe — les 6, quel que soit le trio',
                             en: 'For allies: {bonus} per “{tag}” fighter in the team — all 6, whichever trio' },
    'z.ultra.warn':        { fr: '⚠ Il est le seul « {tag} » de l’équipe : sa résonance restera au minimum. Ajoute des « {tag} », ou place-le en leader.',
                             en: '⚠ It is the only “{tag}” in the team: its resonance stays at the minimum. Add more “{tag}” characters, or make it the Leader.' },

    // ── Dynamique : bilan Cap Z ──────────────────
    'z.total.label':   { fr: 'Total global équipe',    en: 'Team grand total' },
    'z.total.detail':  { fr: '{n} applications de Z sur {m} stats', en: '{n} Z applications on {m} stats' },

    // ── Bilan global (Cap Z + items, tout compris) ──────────
    'panel.global.title': { fr: 'Bilan global (Cap Z + items)', en: 'Global summary (Z Abilities + items)' },
    'panel.zradar.title':  { fr: 'Profil des stats (Cap Z)', en: 'Stat profile (Z Abilities)' },
    'panel.zradar.sub':    { fr: 'Gain total d\'équipe par stat, en pourcentage.', en: 'Team total gain per stat, in percent.' },
    'panel.globalradar.title': { fr: 'Profil par perso (Cap Z + items)', en: 'Per-character profile (Z + items)' },
    'panel.globalradar.sub':   { fr: 'Gain par stat du personnage ciblé ci-dessus.', en: 'Gain per stat for the targeted character above.' },
    'radar.nodata':        { fr: 'Aucune stat boostée pour le moment.', en: 'No boosted stat yet.' },
    'radar.max':           { fr: 'max', en: 'max' },
    'focus.label':         { fr: 'Personnage ciblé', en: 'Targeted character' },

    // ── Arbre des Cap Z ──────────────────────────
    'panel.ztree.title':   { fr: 'Arbre des Cap Z', en: 'Z Ability Tree' },
    'panel.ztree.sub':     { fr: 'Du perso ciblé vers ses coéquipiers : vert = 100 % de sa Cap Z reçue, jaune = partiel, rouge = 0 %.',
                             en: 'From the targeted character to teammates: green = 100% of their Z Ability received, yellow = partial, red = 0%.' },
    'ztree.alone':         { fr: 'Ajoute des coéquipiers pour voir la propagation.', en: 'Add teammates to see propagation.' },
    'ztree.mode.global':   { fr: 'Vue globale', en: 'Overview' },
    'ztree.mode.targeted': { fr: 'Vue ciblée', en: 'Focused' },
    'ztree.legend.full':   { fr: '100 % reçu', en: '100% received' },
    'ztree.legend.partial':{ fr: 'Partiel', en: 'Partial' },
    'ztree.legend.none':   { fr: '0 % reçu', en: '0% received' },
    'ztree.tip.lines':     { fr: 'lignes', en: 'lines' },
    'ztree.tip.noz':       { fr: 'Aucune Cap Z chiffrable.', en: 'No quantifiable Z Ability.' },
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

    'noscript.text':       { fr: '⚠️ DBL Optimizer nécessite JavaScript pour fonctionner. Active JavaScript dans ton navigateur.', en: '⚠️ DBL Optimizer needs JavaScript to work. Please enable JavaScript in your browser.' },
    'modal.close':         { fr: 'Fermer',               en: 'Close' },
    'details.modal.title': { fr: 'Détails des items',    en: 'Item details' },
    'nav.quick.aria':      { fr: 'Navigation rapide',    en: 'Quick navigation' },

    // ── Site : métadonnées, navigation, pied de page (pages générées par tools/build.js) ──
    'meta.tool.title':        { fr: 'Team Builder Dragon Ball Legends : Cap Z & items | DBL Optimizer',
                                en: 'Dragon Ball Legends Team Builder & Equipment Optimizer | DBL Optimizer' },
    'meta.tool.description':  { fr: 'Outil gratuit pour Dragon Ball Legends : compose ton équipe, équipe tes items et calcule en temps réel tes bonus de Cap Z, ton bilan global et ton Trio C.',
                                en: 'Free Dragon Ball Legends tool: build your team, equip items and calculate Z Ability bonuses, your global stat summary and your Proud mode Trio C in real time.' },
    'site.og.alt':            { fr: 'DBL Optimizer — optimiseur d’équipe et d’items pour Dragon Ball Legends',
                                en: 'DBL Optimizer — team and equipment optimizer for Dragon Ball Legends' },
    'site.skip':              { fr: 'Aller au contenu',       en: 'Skip to content' },
    'site.brand.aria':        { fr: 'DBL Optimizer — accueil', en: 'DBL Optimizer — home' },
    'site.nav.aria':          { fr: 'Navigation principale',  en: 'Main navigation' },
    'site.nav.tool':          { fr: 'Optimiseur',             en: 'Optimizer' },
    'site.nav.guides':        { fr: 'Guides',                 en: 'Guides' },
    'site.nav.faq':           { fr: 'FAQ',                    en: 'FAQ' },
    'site.crumb.home':        { fr: 'Accueil',                en: 'Home' },
    'site.crumb.aria':        { fr: 'Fil d’Ariane',           en: 'Breadcrumb' },
    'site.meta.updated':      { fr: 'Dernière mise à jour : {date}', en: 'Last updated: {date}' },
    'site.meta.updatedRead':  { fr: 'Mis à jour le {date} · {n} min de lecture', en: 'Updated {date} · {n} min read' },
    'site.related':           { fr: 'Autres guides',          en: 'More guides' },
    'site.footer.pitch':      { fr: 'Optimiseur gratuit d’équipe, de Cap Z et d’items pour Dragon Ball Legends, en français et en anglais.',
                                en: 'Free team, Z Ability and equipment optimizer for Dragon Ball Legends, in English and French.' },
    'site.footer.guides':     { fr: 'Guides',                 en: 'Guides' },
    'site.footer.site':       { fr: 'Le site',                en: 'The site' },
    'site.footer.legal':      { fr: 'Informations légales',   en: 'Legal' },
    'site.footer.cookies':    { fr: 'Gérer les cookies',      en: 'Manage cookies' },
    'site.footer.disclaimer': { fr: 'DBL Optimizer est un site de fans non officiel, sans lien avec BANDAI NAMCO Entertainment. Dragon Ball Legends, ses personnages et ses visuels appartiennent à leurs ayants droit respectifs.',
                                en: 'DBL Optimizer is an unofficial fan site, not affiliated with BANDAI NAMCO Entertainment. Dragon Ball Legends, its characters and artwork belong to their respective owners.' },
    'page.tool.short':            { fr: 'Optimiseur',            en: 'Optimizer' },
    'page.guides.short':          { fr: 'Tous les guides',       en: 'All guides' },
    'page.getting-started.short': { fr: 'Prise en main',         en: 'Getting started' },
    'page.capz.short':            { fr: 'Guide des Cap Z',       en: 'Z Abilities guide' },
    'page.items.short':           { fr: 'Guide des items',       en: 'Equipment guide' },
    'page.proud.short':           { fr: 'Mode Proud & Trio C',   en: 'Proud mode & Trio C' },
    'page.glossary.short':        { fr: 'Glossaire des stats',   en: 'Stats glossary' },
    'page.faq.short':             { fr: 'FAQ',                   en: 'FAQ' },
    'page.about.short':           { fr: 'À propos',              en: 'About' },
    'page.contact.short':         { fr: 'Contact',               en: 'Contact' },
    'page.legal.short':           { fr: 'Mentions légales',      en: 'Legal notice' },
    'page.privacy.short':         { fr: 'Confidentialité',       en: 'Privacy' },
    'page.getting-started.kicker':{ fr: 'Débuter',               en: 'Start here' },
    'page.capz.kicker':           { fr: 'Mécanique',             en: 'Mechanics' },
    'page.items.kicker':          { fr: 'Mécanique',             en: 'Mechanics' },
    'page.proud.kicker':          { fr: 'Mode de jeu',           en: 'Game mode' },
    'page.glossary.kicker':       { fr: 'Référence',             en: 'Reference' },
    'page.faq.kicker':            { fr: 'Questions',             en: 'Questions' },

    // ── Accueil : texte éditorial sous l’outil ──
    'home.how.title':   { fr: 'Comment utiliser DBL Optimizer', en: 'How to use DBL Optimizer' },
    'home.how.lead':    { fr: 'Quatre étapes pour savoir, chiffres à l’appui, si ton équipe tient la route — et où elle perd de la puissance.',
                          en: 'Four steps to find out, with numbers, whether your team holds up — and where it loses power.' },
    'home.how.1.t':     { fr: 'Compose tes deux trios', en: 'Build your two trios' },
    'home.how.1.d':     { fr: 'Clique sur une case vide pour choisir un personnage parmi plus de 500 cartes, filtrables par rareté, couleur, nom ou tag. Désigne ton Leader avec l’étoile ★.',
                          en: 'Click an empty slot to pick a character from 500+ cards, filtered by rarity, color, name or tag. Pick your Leader with the ★ star.' },
    'home.how.2.t':     { fr: 'Règle les Cap Z et les items', en: 'Set Z Abilities and equipment' },
    'home.how.2.d':     { fr: 'Survole un personnage pour choisir son palier de Cap Z (I à IV) et ses 3 items. Les items compatibles sont proposés par défaut, avec leur détail complet.',
                          en: 'Hover a character to pick their Z Ability level (I to IV) and 3 pieces of equipment. Compatible equipment is suggested by default, with full details.' },
    'home.how.3.t':     { fr: 'Vérifie les synergies', en: 'Check synergies' },
    'home.how.3.d':     { fr: 'Le tableau des tags montre qui porte quel tag, et « Composition d’équipe » indique quels effets d’items sont actifs dans chaque trio — ou ce qu’il manque pour les activer.',
                          en: 'The tag table shows who carries which tag, and “Team composition” tells you which equipment effects are active in each trio — or what is missing to trigger them.' },
    'home.how.4.t':     { fr: 'Lis les bilans', en: 'Read the summaries' },
    'home.how.4.d':     { fr: 'Bilan des Cap Z, bilan global Cap Z + items par personnage, arbre de propagation des Cap Z et, en mode Proud, analyse du Trio C avec le meilleur trio possible.',
                          en: 'Z Ability summary, global Z + equipment summary per character, Z Ability propagation tree and, in Proud mode, a Trio C analysis with the best possible trio.' },
    'home.guides.title':{ fr: 'Guides pour aller plus loin', en: 'Guides to go further' },
    'home.guides.getting-started': { fr: 'Toutes les fonctions de l’outil, pas à pas.', en: 'Every feature of the tool, step by step.' },
    'home.guides.capz':     { fr: 'Paliers, Zenkai, conditions et privilège du Leader.', en: 'Levels, Zenkai, conditions and the Leader privilege.' },
    'home.guides.items':    { fr: 'Raretés, couches base / pur / direct et conditions.', en: 'Rarities, base / pure / direct layers and conditions.' },
    'home.guides.proud':    { fr: 'Choisir un Trio C qui ne perd pas ses bonus.', en: 'Pick a Trio C that keeps its bonuses.' },
    'home.guides.glossary': { fr: 'Chaque statistique expliquée en une phrase.', en: 'Every stat explained in one sentence.' },
    'home.guides.faq':      { fr: 'Les réponses aux questions fréquentes.', en: 'Answers to common questions.' },

    // ── Routes (URL de chaque page dans chaque langue) ──
    // BUILD:ROUTES:START
    // (généré par tools/build.js — ne pas éditer)
    'route.tool': { fr: '/', en: '/en/' },
    'route.guides': { fr: '/guides.html', en: '/en/guides.html' },
    'route.getting-started': { fr: '/guide-prise-en-main.html', en: '/en/getting-started.html' },
    'route.capz': { fr: '/guide-cap-z.html', en: '/en/z-abilities-guide.html' },
    'route.items': { fr: '/guide-items.html', en: '/en/equipment-guide.html' },
    'route.proud': { fr: '/guide-mode-proud.html', en: '/en/proud-mode-guide.html' },
    'route.glossary': { fr: '/glossaire.html', en: '/en/stats-glossary.html' },
    'route.faq': { fr: '/faq.html', en: '/en/faq.html' },
    'route.about': { fr: '/a-propos.html', en: '/en/about.html' },
    'route.contact': { fr: '/contact.html', en: '/en/contact.html' },
    'route.legal': { fr: '/mentions-legales.html', en: '/en/legal-notice.html' },
    'route.privacy': { fr: '/privacy.html', en: '/en/privacy.html' },
    'route.privacy.cookies': { fr: '/privacy.html#cookies', en: '/en/privacy.html#cookies' },
    // BUILD:ROUTES:END

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
  // La langue est celle de la PAGE : / en français, /en/ en anglais (chaque
  // langue a ses URL, indexables séparément). Sur l’outil, un choix explicite
  // mémorisé (bouton FR/EN) l’emporte : on bascule sur place et l’adresse suit.
  const PAGE_LANG = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const lirePref = () => { try { return localStorage.getItem('dbl-lang'); } catch (e) { return null; } };
  const ecrirePref = (l) => { try { localStorage.setItem('dbl-lang', l); } catch (e) { /* stockage indisponible */ } };
  let _lang = PAGE_LANG;
  if (document.body && document.body.dataset.page === 'tool') {
    const pref = lirePref();
    if (pref === 'fr' || pref === 'en') _lang = pref;
  }

  // Adresse de la même page dans l’autre langue (liens hreflang du <head>).
  function urlPourLangue(lang) {
    const alt = document.querySelector('link[rel="alternate"][hreflang="' + lang + '"]');
    if (!alt) return null;
    try { return new URL(alt.href).pathname; } catch (e) { return null; }
  }
  function synchroniserUrl() {
    const chemin = urlPourLangue(_lang);
    if (chemin && chemin !== location.pathname) {
      try { history.replaceState(history.state, '', chemin + location.search + location.hash); } catch (e) { /* file:// */ }
    }
  }

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
    ecrirePref(_lang);
    document.documentElement.lang = _lang === 'fr' ? 'fr' : 'en';
    synchroniserUrl();
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
    // href (liens de navigation : chaque langue a ses URL)
    document.querySelectorAll('[data-i18n-href]').forEach(el => {
      el.setAttribute('href', T(el.dataset.i18nHref));
    });
    // Titre de l’onglet de l’outil
    if (document.body && document.body.dataset.page === 'tool' && DICT['meta.tool.title']) {
      document.title = T('meta.tool.title');
    }
  }

  // ──────────────────────────────────────────────
  // BOUTON DE LANGUE
  // ──────────────────────────────────────────────
  function _updateLangBtn() {
    const btn = document.getElementById('lang-toggle');
    if (!btn) return;
    const autre = _lang === 'fr' ? 'en' : 'fr';
    const cur  = btn.querySelector('.lang-current');
    const next = btn.querySelector('.lang-next');
    if (cur)  cur.textContent  = _lang.toUpperCase();
    if (next) next.textContent = autre.toUpperCase();
    btn.setAttribute('aria-label', _lang === 'fr' ? 'Switch to English' : 'Passer en français');
    // C’est un vrai lien (suivi par les moteurs) ; en JS, on bascule sur place
    // pour ne pas perdre l’équipe en cours.
    const cible = urlPourLangue(autre);
    if (cible) btn.setAttribute('href', cible);
    btn.setAttribute('hreflang', autre);
    btn.dataset.langSwitch = autre;
  }

  // Initialisation du bouton (DOM déjà disponible car scripts en fin de body)
  const _btn = document.getElementById('lang-toggle');
  if (_btn) {
    _btn.addEventListener('click', (e) => {
      e.preventDefault();
      setLang(_lang === 'fr' ? 'en' : 'fr');
    });
  }

  // ──────────────────────────────────────────────
  // EXPORT
  // ──────────────────────────────────────────────
  window.DBL_I18N = { T, getLang, setLang, applyStaticTranslations };

  // Application initiale (DOM déjà parsé)
  document.documentElement.lang = _lang === 'fr' ? 'fr' : 'en';
  if (_lang !== PAGE_LANG) synchroniserUrl();
  applyStaticTranslations();
  _updateLangBtn();
})();
