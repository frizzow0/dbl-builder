// ============================================================
// DBL Item Builder — Données échantillon
// ============================================================
// Tous les items et personnages sont stockés sur window.DBL_DATA
// pour rester accessibles sans système de modules.
// ------------------------------------------------------------

(function () {
  // ---- Codes de statistiques ----
  // base   = appliquée en première étape sur le stat de base
  // pur    = appliquée en seconde étape sur le stat intermédiaire
  // direct = appliquée une seule fois sur la stat (pas de distinction base/pur)
  const STATS = {
    attaque_physique_de_base:   { label: "Attaque physique de base",        cible: "attaque_physique",        type: "base"   },
    attaque_physique:           { label: "Attaque physique",                 cible: "attaque_physique",        type: "pur"    },
    defense_physique_de_base:   { label: "Défense physique de base",         cible: "defense_physique",        type: "base"   },
    defense_physique:           { label: "Défense physique",                 cible: "defense_physique",        type: "pur"    },
    attaque_energie_de_base:    { label: "Attaque d'énergie de base",        cible: "attaque_energie",         type: "base"   },
    attaque_energie:            { label: "Attaque d'énergie",                cible: "attaque_energie",         type: "pur"    },
    defense_energie_de_base:    { label: "Défense d'énergie de base",        cible: "defense_energie",         type: "base"   },
    defense_energie:            { label: "Défense d'énergie",                cible: "defense_energie",         type: "pur"    },
    vitesse_regen_ki_de_base:   { label: "Vitesse de régénération du Ki",    cible: "vitesse_regen_ki",        type: "base"   },
    critique_de_base:           { label: "Critique de base",                 cible: "critique",                type: "base"   },
    critique:                   { label: "Critique",                         cible: "critique",                type: "pur"    },
    force_de_base:              { label: "Force de base",                    cible: "force",                   type: "base"   },
    degats_infliges:            { label: "Dégâts infligés",                  cible: "degats_infliges",         type: "direct" },
    degats_energie_infliges:    { label: "Dégâts d'énergie infligés",        cible: "degats_energie_infliges", type: "direct" },
    degats_tech_spe:            { label: "Dégâts technique spéciale",        cible: "degats_tech_spe",         type: "direct" },
    degats_ultime:              { label: "Dégâts technique ultime",          cible: "degats_ultime",           type: "direct" },
    quantite_regen_force:       { label: "Quantité de régénération",         cible: "quantite_regen_force",    type: "direct" },
    garde_contre_degats:        { label: "Garde contre les dégâts",          cible: "garde_contre_degats",     type: "direct" },
    points_de_vie:              { label: "Points de vie",                    cible: "points_de_vie",           type: "direct" },
  };

  // ---- Personnages échantillon ----
  // Les stats de base sont des ordres de grandeur typiques DBL pour un perso lvl max.
  const PERSONNAGES = [
    {
      id: "goku_ultra",
      nom: "Son Goku (Ultra)",
      tags: ["Type physique", "Saiyan", "Héros"],
      stats_base: {
        attaque_physique: 240000,
        attaque_energie:  225000,
        defense_physique: 195000,
        defense_energie:  185000,
        points_de_vie: 2200000,
        vitesse_regen_ki: 100,
        force: 1500,
        degats_infliges: 100,
        degats_energie_infliges: 100,
        degats_tech_spe: 100,
        degats_ultime: 100,
        garde_contre_degats: 100,
      },
    },
    {
      id: "vegeta_sp",
      nom: "Vegeta (SP)",
      tags: ["Type physique", "Saiyan", "Vilain"],
      stats_base: {
        attaque_physique: 218000,
        attaque_energie:  205000,
        defense_physique: 210000,
        defense_energie:  198000,
        points_de_vie: 2050000,
        vitesse_regen_ki: 100,
        force: 1400,
        degats_infliges: 100,
        degats_energie_infliges: 100,
        degats_tech_spe: 100,
        degats_ultime: 100,
        garde_contre_degats: 100,
      },
    },
    {
      id: "gohan_zz",
      nom: "Son Gohan (ZZ)",
      tags: ["Type ki", "Saiyan", "Héros"],
      stats_base: {
        attaque_physique: 175000,
        attaque_energie:  220000,
        defense_physique: 180000,
        defense_energie:  195000,
        points_de_vie: 1980000,
        vitesse_regen_ki: 100,
        force: 1200,
        degats_infliges: 100,
        degats_energie_infliges: 100,
        degats_tech_spe: 100,
        degats_ultime: 100,
        garde_contre_degats: 100,
      },
    },
    {
      id: "piccolo_z",
      nom: "Piccolo (Z)",
      tags: ["Type ki", "Namek", "Héros"],
      stats_base: {
        attaque_physique: 168000,
        attaque_energie:  210000,
        defense_physique: 192000,
        defense_energie:  201000,
        points_de_vie: 2150000,
        vitesse_regen_ki: 100,
        force: 1300,
        degats_infliges: 100,
        degats_energie_infliges: 100,
        degats_tech_spe: 100,
        degats_ultime: 100,
        garde_contre_degats: 100,
      },
    },
    {
      id: "freezer_sp",
      nom: "Freezer (SP)",
      tags: ["Type ki", "Frieza Force", "Vilain"],
      stats_base: {
        attaque_physique: 230000,
        attaque_energie:  248000,
        defense_physique: 175000,
        defense_energie:  185000,
        points_de_vie: 1900000,
        vitesse_regen_ki: 100,
        force: 1450,
        degats_infliges: 100,
        degats_energie_infliges: 100,
        degats_tech_spe: 100,
        degats_ultime: 100,
        garde_contre_degats: 100,
      },
    },
  ];

  // ---- Items ----
  // Schéma d'une ligne :
  //   stat            : clé de STATS
  //   valeur_min      : pourcentage minimum (ex: 6.0)
  //   valeur_max      : pourcentage maximum (ex: 15.0). Si min === max, valeur fixe.
  //   condition       : null OU { description, seuil, tag_requis }
  //   est_passif      : true => effet narratif non chiffré, exclu du calcul
  //   description_passif : texte affiché pour le passif
  const ITEMS = [
    {
      id: "gantelets_du_combattant",
      nom: "Gantelets du Combattant",
      rarete: "ZZ",
      lignes: [
        { stat: "attaque_physique_de_base", valeur_min: 6.0,  valeur_max: 12.0, condition: null },
        { stat: "attaque_physique",         valeur_min: 3.0,  valeur_max: 8.0,  condition: null },
      ],
    },
    {
      id: "ceinture_du_guerrier",
      nom: "Ceinture du Guerrier Saiyan",
      rarete: "ZZ",
      lignes: [
        { stat: "attaque_physique_de_base", valeur_min: 8.0,  valeur_max: 15.0, condition: null },
        {
          stat: "attaque_physique",
          valeur_min: 6.0,
          valeur_max: 15.0,
          condition: {
            description: "Si au moins 3 « Saiyan » font partie de l'équipe.",
            seuil: 3,
            tag_requis: "Saiyan",
          },
        },
      ],
    },
    {
      id: "bracelet_defenseur",
      nom: "Bracelet du Défenseur",
      rarete: "ZZ",
      lignes: [
        { stat: "defense_physique_de_base", valeur_min: 8.0,  valeur_max: 14.0, condition: null },
        { stat: "defense_physique",         valeur_min: 4.0,  valeur_max: 10.0, condition: null },
      ],
    },
    {
      id: "armure_namek",
      nom: "Armure Namek",
      rarete: "ZZ",
      lignes: [
        { stat: "defense_physique_de_base", valeur_min: 10.0, valeur_max: 18.0, condition: null },
        { stat: "points_de_vie",            valeur_min: 5.0,  valeur_max: 10.0, condition: null },
        {
          stat: "defense_physique",
          valeur_min: 8.0,
          valeur_max: 16.0,
          condition: {
            description: "Si au moins 1 « Namek » fait partie de l'équipe.",
            seuil: 1,
            tag_requis: "Namek",
          },
        },
      ],
    },
    {
      id: "couronne_du_roi",
      nom: "Couronne du Roi",
      rarete: "ZZ",
      lignes: [
        { stat: "force_de_base",        valeur_min: 10.0, valeur_max: 20.0, condition: null },
        { stat: "degats_infliges",      valeur_min: 4.0,  valeur_max: 8.0,  condition: null },
      ],
    },
    {
      id: "perle_du_dragon",
      nom: "Perle du Dragon",
      rarete: "ZZ",
      lignes: [
        { stat: "points_de_vie",        valeur_min: 8.0,  valeur_max: 15.0, condition: null },
        { stat: "vitesse_regen_ki_de_base", valeur_min: 5.0, valeur_max: 12.0, condition: null },
      ],
    },
    {
      id: "potara_kaioshin",
      nom: "Potara du Kaioshin",
      rarete: "ZZ",
      lignes: [
        { stat: "attaque_physique_de_base", valeur_min: 5.0, valeur_max: 10.0, condition: null },
        { stat: "defense_physique_de_base", valeur_min: 5.0, valeur_max: 10.0, condition: null },
        {
          est_passif: true,
          description_passif: "Récupère 5 unités de Ki au début de chaque tour de l'utilisateur.",
        },
      ],
    },
    {
      id: "capsule_corp",
      nom: "Capsule Corp",
      rarete: "Z",
      lignes: [
        { stat: "vitesse_regen_ki_de_base", valeur_min: 8.0, valeur_max: 15.0, condition: null },
        { stat: "degats_energie_infliges",  valeur_min: 5.0, valeur_max: 10.0, condition: null },
      ],
    },
    {
      id: "cape_de_piccolo",
      nom: "Cape lestée de Piccolo",
      rarete: "ZZ",
      lignes: [
        { stat: "defense_physique_de_base", valeur_min: 7.0, valeur_max: 14.0, condition: null },
        { stat: "garde_contre_degats",      valeur_min: 6.0, valeur_max: 12.0, condition: null },
        {
          est_passif: true,
          description_passif: "Annule la première altération de statut subie par combat.",
        },
      ],
    },
    {
      id: "katana_du_trunks",
      nom: "Katana du Futur",
      rarete: "ZZ",
      lignes: [
        { stat: "attaque_physique_de_base", valeur_min: 7.0, valeur_max: 13.0, condition: null },
        {
          stat: "degats_infliges",
          valeur_min: 8.0,
          valeur_max: 15.0,
          condition: {
            description: "Si au moins 2 « Héros » font partie de l'équipe.",
            seuil: 2,
            tag_requis: "Héros",
          },
        },
      ],
    },
    {
      id: "scouter_freezer",
      nom: "Scouter de Freezer",
      rarete: "Z",
      lignes: [
        { stat: "attaque_physique", valeur_min: 4.0, valeur_max: 9.0, condition: null },
        {
          stat: "degats_energie_infliges",
          valeur_min: 6.0,
          valeur_max: 12.0,
          condition: {
            description: "Si au moins 2 « Frieza Force » font partie de l'équipe.",
            seuil: 2,
            tag_requis: "Frieza Force",
          },
        },
      ],
    },
    {
      id: "veste_west_city",
      nom: "Veste West City",
      rarete: "ZZ",
      lignes: [
        { stat: "points_de_vie",      valeur_min: 6.0, valeur_max: 12.0, condition: null },
        { stat: "garde_contre_degats", valeur_min: 4.0, valeur_max: 9.0,  condition: null },
        { stat: "defense_physique",   valeur_min: 3.0, valeur_max: 7.0,  condition: null },
      ],
    },
    {
      id: "kii_du_saiyan",
      nom: "Kii du Saiyan Légendaire",
      rarete: "ZZ",
      lignes: [
        { stat: "force_de_base",            valeur_min: 8.0,  valeur_max: 18.0, condition: null },
        { stat: "attaque_physique_de_base", valeur_min: 4.0,  valeur_max: 9.0,  condition: null },
        {
          stat: "attaque_physique",
          valeur_min: 10.0,
          valeur_max: 20.0,
          condition: {
            description: "Si au moins 3 « Type physique » font partie de l'équipe.",
            seuil: 3,
            tag_requis: "Type physique",
          },
        },
      ],
    },
    {
      id: "bandana_goku",
      nom: "Bandana de Goku",
      rarete: "Z",
      lignes: [
        { stat: "attaque_physique_de_base", valeur_min: 5.0, valeur_max: 10.0, condition: null },
        {
          est_passif: true,
          description_passif: "Augmente la résistance aux dégâts critiques pendant 2 tours après l'entrée en combat.",
        },
      ],
    },
    {
      id: "tenue_entrainement",
      nom: "Tenue d'Entraînement Pondéré",
      rarete: "ZZ",
      lignes: [
        { stat: "force_de_base",        valeur_min: 12.0, valeur_max: 22.0, condition: null },
        { stat: "defense_physique_de_base", valeur_min: 6.0, valeur_max: 12.0, condition: null },
      ],
    },
    {
      id: "energie_pure",
      nom: "Cristal d'Énergie Pure",
      rarete: "ZZ",
      lignes: [
        { stat: "degats_energie_infliges", valeur_min: 10.0, valeur_max: 18.0, condition: null },
        { stat: "vitesse_regen_ki_de_base", valeur_min: 4.0, valeur_max: 9.0, condition: null },
      ],
    },
    {
      id: "anneau_temps",
      nom: "Anneau du Temps",
      rarete: "ZZ",
      lignes: [
        { stat: "attaque_physique",     valeur_min: 5.0, valeur_max: 12.0, condition: null },
        { stat: "defense_physique",     valeur_min: 5.0, valeur_max: 12.0, condition: null },
        {
          est_passif: true,
          description_passif: "Permet de recouvrer 10% des PV maximum lors du premier changement de combattant.",
        },
      ],
    },
    {
      id: "senzu_seche",
      nom: "Haricot Senzu Séché",
      rarete: "ZZ",
      lignes: [
        { stat: "points_de_vie",        valeur_min: 10.0, valeur_max: 18.0, condition: null },
        {
          est_passif: true,
          description_passif: "Restaure 20% des PV lorsque les PV tombent sous 30%. Une seule activation par combat.",
        },
      ],
    },
  ];

  // Si le scraper a généré items.js, il a posé window.DBL_ITEMS_SCRAPED.
  // Sinon on retombe sur l'échantillon manuel défini plus haut.
  const ITEMS_FINAL = (window.DBL_ITEMS_SCRAPED && window.DBL_ITEMS_SCRAPED.length)
    ? window.DBL_ITEMS_SCRAPED
    : ITEMS;

  // Personnages : on privilégie les vrais perso scrapés depuis le site.
  const PERSONNAGES_FINAL = (window.DBL_CHARACTERS_SCRAPED && window.DBL_CHARACTERS_SCRAPED.length)
    ? window.DBL_CHARACTERS_SCRAPED
    : PERSONNAGES;

  // Expose tout sur window.DBL_DATA
  window.DBL_DATA = {
    STATS,
    PERSONNAGES: PERSONNAGES_FINAL,
    ITEMS: ITEMS_FINAL,
    ITEMS_SOURCE: (window.DBL_ITEMS_SCRAPED && window.DBL_ITEMS_SCRAPED.length) ? "scraped" : "echantillon",
    PERSONNAGES_SOURCE: (window.DBL_CHARACTERS_SCRAPED && window.DBL_CHARACTERS_SCRAPED.length) ? "scraped" : "echantillon",
  };
})();
