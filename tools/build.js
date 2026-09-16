#!/usr/bin/env node
// ============================================================
// DBL Optimizer — génération des pages statiques (FR + EN)
// ============================================================
// Usage : node tools/build.js   (à relancer après chaque modification de
// index.html, i18n.js ou d'une page de tools/pages/, puis committer le tout)
//
// Ce que le script écrit :
//   • index.html      — blocs BUILD:HEAD / BUILD:HEADER / BUILD:FOOTER régénérés
//                       et textes data-i18n alignés sur le dictionnaire FR ;
//   • en/index.html   — l'outil en anglais, dérivé d'index.html (ne pas éditer) ;
//   • pages de contenu — tools/pages/<id>.<fr|en>.page → /xxx.html et /en/xxx.html ;
//   • guides.html, en/guides.html, 404.html, sitemap.xml ;
//   • i18n.js         — bloc BUILD:ROUTES (URL de chaque page dans chaque langue).
//
// Tout est calculé en mémoire, puis écrit d'un coup : une erreur n'écrit rien.
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const SITE = "https://dbl-optimizer.com";
const ADSENSE_CLIENT = "ca-pub-3800762846820919";
const FONTS = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700;800&display=swap";
const LANGS = ["fr", "en"];
// Google Search Console : jeton de la méthode « balise HTML » (laisser vide si le
// domaine est vérifié par enregistrement DNS, méthode recommandée).
const GSC_TOKEN = "";

// ── Registre des pages : identifiant commun aux deux langues ───────────────
const PAGES = [
  { id: "tool",            fr: "/",                          en: "/en/" },
  { id: "guides",          fr: "/guides.html",               en: "/en/guides.html" },
  { id: "getting-started", fr: "/guide-prise-en-main.html",  en: "/en/getting-started.html" },
  { id: "capz",            fr: "/guide-cap-z.html",          en: "/en/z-abilities-guide.html" },
  { id: "items",           fr: "/guide-items.html",          en: "/en/equipment-guide.html" },
  { id: "proud",           fr: "/guide-mode-proud.html",     en: "/en/proud-mode-guide.html" },
  { id: "glossary",        fr: "/glossaire.html",            en: "/en/stats-glossary.html" },
  { id: "faq",             fr: "/faq.html",                  en: "/en/faq.html" },
  { id: "about",           fr: "/a-propos.html",             en: "/en/about.html" },
  { id: "contact",         fr: "/contact.html",              en: "/en/contact.html" },
  { id: "legal",           fr: "/mentions-legales.html",     en: "/en/legal-notice.html" },
  { id: "privacy",         fr: "/privacy.html",              en: "/en/privacy.html" },
];
const PAGE = Object.fromEntries(PAGES.map((p) => [p.id, p]));
const GUIDES = ["getting-started", "capz", "items", "proud", "glossary", "faq"];
const FOOTER_GUIDES = ["getting-started", "capz", "items", "proud", "glossary"];
const FOOTER_SITE = ["about", "faq", "contact"];
const FOOTER_LEGAL = ["legal", "privacy"];

// ── Utilitaires ────────────────────────────────────────────────────────────
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8").split("\r\n").join("\n");
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escHtml(s).replace(/"/g, "&quot;");
const texteBrut = (html) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/\s+/g, " ").trim();
const url = (p) => SITE + p;
const dateLongue = (iso, lang) => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-US",
  { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

// Remplace les lignes situées entre deux marqueurs (commentaire HTML ou JS),
// en conservant les lignes des marqueurs eux-mêmes.
function remplacerBloc(texte, nom, contenu, js = false) {
  const debut = js ? `// BUILD:${nom}:START` : `<!-- BUILD:${nom}:START -->`;
  const fin = js ? `// BUILD:${nom}:END` : `<!-- BUILD:${nom}:END -->`;
  const a = texte.indexOf(debut), b = texte.indexOf(fin);
  if (a < 0 || b < a) throw new Error(`marqueurs BUILD:${nom} introuvables`);
  return texte.slice(0, a + debut.length) + "\n" + contenu + "\n" + texte.slice(texte.lastIndexOf("\n", b) + 1);
}

// ── Dictionnaire (i18n.js) ─────────────────────────────────────────────────
function chargerDict(src) {
  const a = src.indexOf("const DICT = {");
  const b = src.indexOf("\n  };\n", a);
  if (a < 0 || b < 0) throw new Error("DICT introuvable dans i18n.js");
  return vm.runInNewContext("(" + src.slice(a + "const DICT = ".length, b + 4) + ")");
}
let DICT = {};
// Valeurs insérées dans les pages : {{DATE_DONNEES}}, {{NB_PERSOS}}, {{NB_ITEMS}}
let JETONS = { fr: {}, en: {} };
const remplirJetons = (texte, lang) => texte.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => {
  if (!(k in JETONS[lang])) throw new Error("jeton inconnu : " + m);
  return JETONS[lang][k];
});
function T(lang, key, params) {
  const e = DICT[key];
  if (!e) throw new Error(`clé i18n manquante : ${key}`);
  let s = e[lang] ?? e.fr;
  for (const [k, v] of Object.entries(params || {})) s = s.split(`{${k}}`).join(v);
  return s;
}

// ── <head> commun ──────────────────────────────────────────────────────────
function head({ lang, id, title, description, ogType = "website", jsonld, noindex = false, version, tool = false }) {
  const p = PAGE[id];
  const canon = p ? url(p[lang]) : null;
  const og = url(lang === "fr" ? "/og-image.jpg" : "/og-image-en.jpg");
  const L = [];
  L.push(`  <meta charset="UTF-8" />`);
  L.push(`  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`);
  L.push(`  <title>${escHtml(title)}</title>`);
  L.push(`  <meta name="description" content="${escAttr(description)}" />`);
  L.push(`  <meta name="robots" content="${noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1"}" />`);
  if (canon) {
    L.push(`  <link rel="canonical" href="${canon}" />`);
    L.push(`  <link rel="alternate" hreflang="fr" href="${url(p.fr)}" />`);
    L.push(`  <link rel="alternate" hreflang="en" href="${url(p.en)}" />`);
    L.push(`  <link rel="alternate" hreflang="x-default" href="${url(p.en)}" />`);
  }
  if (GSC_TOKEN) L.push(`  <meta name="google-site-verification" content="${GSC_TOKEN}" />`);
  L.push(`  <meta name="theme-color" content="#F3F1EC" />`);
  L.push(`  <meta name="color-scheme" content="light" />`);
  if (!noindex) {
    L.push(`  <!-- Open Graph / Twitter : aperçus Discord, Reddit, X, WhatsApp… -->`);
    L.push(`  <meta property="og:type" content="${ogType}" />`);
    L.push(`  <meta property="og:site_name" content="DBL Optimizer" />`);
    L.push(`  <meta property="og:url" content="${canon}" />`);
    L.push(`  <meta property="og:title" content="${escAttr(title)}" />`);
    L.push(`  <meta property="og:description" content="${escAttr(description)}" />`);
    L.push(`  <meta property="og:image" content="${og}" />`);
    L.push(`  <meta property="og:image:type" content="image/jpeg" />`);
    L.push(`  <meta property="og:image:width" content="1200" />`);
    L.push(`  <meta property="og:image:height" content="630" />`);
    L.push(`  <meta property="og:image:alt" content="${escAttr(T(lang, "site.og.alt"))}" />`);
    L.push(`  <meta property="og:locale" content="${lang === "fr" ? "fr_FR" : "en_US"}" />`);
    L.push(`  <meta property="og:locale:alternate" content="${lang === "fr" ? "en_US" : "fr_FR"}" />`);
    L.push(`  <meta name="twitter:card" content="summary_large_image" />`);
    L.push(`  <meta name="twitter:title" content="${escAttr(title)}" />`);
    L.push(`  <meta name="twitter:description" content="${escAttr(description)}" />`);
    L.push(`  <meta name="twitter:image" content="${og}" />`);
  }
  L.push(`  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />`);
  L.push(`  <link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png" />`);
  L.push(`  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />`);
  L.push(`  <link rel="manifest" href="/site.webmanifest" />`);
  L.push(`  <link rel="preconnect" href="https://fonts.googleapis.com" />`);
  L.push(`  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`);
  if (tool) L.push(`  <link rel="dns-prefetch" href="https://fr.dblegends.net" />`);
  L.push(`  <link rel="stylesheet" href="${FONTS}" />`);
  L.push(`  <link rel="stylesheet" href="/styles.css?v=${version}" />`);
  L.push(`  <!-- Google AdSense (validation du site + annonces) ; emplacements pilotés par site.js -->`);
  L.push(`  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`);
  L.push(`  <script defer src="/site.js?v=${version}"></script>`);
  if (jsonld) {
    L.push(`  <script type="application/ld+json">`);
    L.push(JSON.stringify(jsonld, null, 2).split("\n").map((l) => "  " + l).join("\n"));
    L.push(`  </script>`);
  }
  return L.join("\n");
}

// ── En-tête : marque, navigation, langue ───────────────────────────────────
function header(lang, id, courant) {
  const autre = lang === "fr" ? "en" : "fr";
  const lien = (cible, cle) =>
    `<a href="${PAGE[cible][lang]}" data-i18n-href="route.${cible}" data-i18n="${cle}"${courant === cible ? ' aria-current="page"' : ""}>${escHtml(T(lang, cle))}</a>`;
  const vers = PAGE[id] ? PAGE[id][autre] : PAGE.tool[autre];
  return [
    `  <header class="topbar">`,
    `    <a class="brand" href="${PAGE.tool[lang]}" data-i18n-href="route.tool" aria-label="${escAttr(T(lang, "site.brand.aria"))}" data-i18n-aria-label="site.brand.aria">`,
    `      <span class="brand-glyph" aria-hidden="true">DBL</span>`,
    `      <span class="brand-text"><span class="brand-title">DBL Optimizer</span><span class="brand-sub">Team Builder &amp; Items Optimization</span></span>`,
    `    </a>`,
    `    <nav class="site-nav" aria-label="${escAttr(T(lang, "site.nav.aria"))}" data-i18n-aria-label="site.nav.aria">`,
    `      ${lien("tool", "site.nav.tool")}`,
    `      ${lien("guides", "site.nav.guides")}`,
    `      ${lien("faq", "site.nav.faq")}`,
    `    </nav>`,
    `    <a id="lang-toggle" class="lang-toggle" href="${vers}" hreflang="${autre}" data-lang-switch="${autre}" aria-label="${lang === "fr" ? "Switch to English" : "Passer en français"}">`,
    `      <span class="lang-icon" aria-hidden="true">🌐</span>`,
    `      <span class="lang-current">${lang.toUpperCase()}</span>`,
    `      <span class="lang-sep" aria-hidden="true">/</span>`,
    `      <span class="lang-next">${autre.toUpperCase()}</span>`,
    `    </a>`,
    `  </header>`,
  ].join("\n");
}

// ── Pied de page ───────────────────────────────────────────────────────────
function footer(lang) {
  const lien = (cible) =>
    `<a href="${PAGE[cible][lang]}" data-i18n-href="route.${cible}" data-i18n="page.${cible}.short">${escHtml(T(lang, `page.${cible}.short`))}</a>`;
  const colonne = (titre, ids, extra = "") => [
    `      <nav class="sf-col" aria-label="${escAttr(T(lang, titre))}" data-i18n-aria-label="${titre}">`,
    `        <p class="sf-title" data-i18n="${titre}">${escHtml(T(lang, titre))}</p>`,
    ...ids.map((i) => `        ${lien(i)}`),
    ...(extra ? [`        ${extra}`] : []),
    `      </nav>`,
  ].join("\n");
  const cookies = `<a href="${PAGE.privacy[lang]}#cookies" data-i18n-href="route.privacy.cookies" data-consent-link data-i18n="site.footer.cookies">${escHtml(T(lang, "site.footer.cookies"))}</a>`;
  return [
    `  <footer class="site-footer">`,
    `    <div class="sf-grid">`,
    `      <div class="sf-about">`,
    `        <a class="brand" href="${PAGE.tool[lang]}" data-i18n-href="route.tool"><span class="brand-glyph" aria-hidden="true">DBL</span><span class="brand-title">DBL Optimizer</span></a>`,
    `        <p data-i18n="site.footer.pitch">${escHtml(T(lang, "site.footer.pitch"))}</p>`,
    `      </div>`,
    colonne("site.footer.guides", FOOTER_GUIDES),
    colonne("site.footer.site", FOOTER_SITE),
    colonne("site.footer.legal", FOOTER_LEGAL, cookies),
    `    </div>`,
    `    <p class="sf-disclaimer" data-i18n="site.footer.disclaimer">${escHtml(T(lang, "site.footer.disclaimer"))}</p>`,
    `    <p class="site-footer__copy">© ${new Date().getUTCFullYear()} dbl-optimizer.com</p>`,
    `  </footer>`,
  ].join("\n");
}

// ── Données structurées ────────────────────────────────────────────────────
const ORG = (lang) => ({
  "@type": "Organization",
  "@id": SITE + "/#organization",
  name: "DBL Optimizer",
  url: url(PAGE.tool[lang]),
  logo: { "@type": "ImageObject", url: url("/icon-512.png"), width: 512, height: 512 },
});
function fil(lang, etapes) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: etapes.map(([nom, chemin], k) => ({
      "@type": "ListItem", position: k + 1, name: nom, ...(chemin ? { item: url(chemin) } : {}),
    })),
  };
}

// ── Traduction d'un HTML porteur d'attributs data-i18n* ────────────────────
function traduire(html, lang) {
  let out = "", i = 0, m;
  const re = /<([a-zA-Z][a-zA-Z0-9-]*)(\s[^<>]*?)?(\/?)>/g;
  const ATTRS = [["data-i18n-placeholder", "placeholder"], ["data-i18n-aria-label", "aria-label"],
    ["data-i18n-title", "title"], ["data-i18n-href", "href"]];
  while ((m = re.exec(html))) {
    const nom = m[1], attrs = m[2] || "";
    if (/^(script|style)$/i.test(nom)) {
      const fin = html.indexOf("</" + nom, re.lastIndex);
      re.lastIndex = fin;
      continue;
    }
    if (!/\sdata-i18n/.test(attrs)) continue;
    const val = (a) => { const r = attrs.match(new RegExp("\\s" + a + "=\"([^\"]*)\"")); return r && r[1]; };
    let debut = m[0];
    for (const [data, cible] of ATTRS) {
      const cle = val(data);
      if (!cle) continue;
      const v = escAttr(T(lang, cle));
      const reA = new RegExp("(\\s" + cible + "=\")[^\"]*(\")");
      debut = reA.test(debut) ? debut.replace(reA, (_, a, b) => a + v + b) : debut.replace(/\s*(\/?>)$/, ` ${cible}="${v}"$1`);
    }
    out += html.slice(i, m.index) + debut;
    i = re.lastIndex;
    const cleTexte = val("data-i18n"), cleHtml = val("data-i18n-html");
    if (cleTexte || cleHtml) {
      const fin = html.indexOf("</" + nom + ">", i);
      const dedans = html.slice(i, fin);
      if (fin < 0 || new RegExp("<" + nom + "[\\s>]", "i").test(dedans)) throw new Error("data-i18n sur un élément imbriqué : " + debut);
      if (cleTexte && /<[a-z]/i.test(dedans)) throw new Error("data-i18n sur un élément non textuel : " + debut);
      out += cleTexte ? escHtml(T(lang, cleTexte)) : T(lang, cleHtml);
      i = fin;
      re.lastIndex = fin;
    }
  }
  return out + html.slice(i);
}

// ── Pages de contenu ───────────────────────────────────────────────────────
function lirePage(id, lang) {
  const src = lire(`tools/pages/${id}.${lang}.page`);
  const m = src.match(/^\s*<!--([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`front matter manquant : ${id}.${lang}`);
  let fm;
  try { fm = JSON.parse(m[1]); } catch (e) { throw new Error(`front matter invalide (${id}.${lang}) : ${e.message}`); }
  for (const k of ["title", "description", "h1", "lead", "type", "updated"]) {
    if (!fm[k]) throw new Error(`front matter ${id}.${lang} : « ${k} » manquant`);
  }
  return { fm, corps: src.slice(m[0].length).trim() };
}

function adSlot(nom) {
  return `<aside class="ad-slot" data-ad="${nom}" hidden></aside>`;
}

function pageContenu(id, lang, version, pagesLues) {
  const brut = pagesLues[id][lang];
  const corps = remplirJetons(brut.corps, lang);
  const fm = { ...brut.fm, lead: remplirJetons(brut.fm.lead, lang) };
  const p = PAGE[id];
  const estGuide = GUIDES.includes(id);
  // Marque en suffixe, sauf si elle figure déjà dans le titre ou si le tout dépasserait ~70 caractères.
  const titreComplet = fm.title.includes("DBL Optimizer") || fm.title.length > 54 ? fm.title : `${fm.title} | DBL Optimizer`;
  const accueil = T(lang, "site.crumb.home");
  const etapes = [[accueil, PAGE.tool[lang]]];
  if (estGuide) etapes.push([T(lang, "site.nav.guides"), PAGE.guides[lang]]);
  etapes.push([fm.h1, null]);

  const mots = texteBrut(corps).split(" ").length;
  const minutes = Math.max(1, Math.round(mots / 220));
  const meta = fm.type === "article" || id === "faq"
    ? T(lang, "site.meta.updatedRead", { date: dateLongue(fm.updated, lang), n: minutes })
    : T(lang, "site.meta.updated", { date: dateLongue(fm.updated, lang) });

  // Données structurées
  const graphe = [fil(lang, etapes)];
  const page = { url: url(p[lang]), name: fm.title, description: fm.description, inLanguage: lang };
  if (fm.type === "article") {
    graphe.push({
      "@type": "Article", headline: fm.h1, description: fm.description, inLanguage: lang,
      datePublished: fm.published || fm.updated, dateModified: fm.updated,
      image: url(lang === "fr" ? "/og-image.jpg" : "/og-image-en.jpg"),
      author: ORG(lang), publisher: ORG(lang), mainEntityOfPage: url(p[lang]), wordCount: mots,
    });
  } else if (fm.type === "faq") {
    const questions = [...corps.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/g)]
      .map(([, q, r]) => ({ "@type": "Question", name: texteBrut(q), acceptedAnswer: { "@type": "Answer", text: texteBrut(r) } }))
      .filter((q) => q.acceptedAnswer.text);
    graphe.push({ "@type": "FAQPage", ...page, mainEntity: questions });
  } else if (fm.type === "about") {
    graphe.push({ "@type": "AboutPage", ...page, about: ORG(lang) });
  } else if (fm.type === "contact") {
    graphe.push({ "@type": "ContactPage", ...page });
  } else if (fm.type === "collection") {
    graphe.push({
      "@type": "CollectionPage", ...page,
      mainEntity: { "@type": "ItemList", itemListElement: GUIDES.map((g, k) => ({ "@type": "ListItem", position: k + 1, url: url(PAGE[g][lang]), name: pagesLues[g][lang].fm.h1 })) },
    });
  } else {
    graphe.push({ "@type": "WebPage", ...page });
  }

  let contenu = corps;
  if (fm.type === "collection") {
    contenu = `<ul class="guide-cards">\n` + GUIDES.map((g) => {
      const x = pagesLues[g][lang].fm;
      return `  <li class="guide-card"><a href="${PAGE[g][lang]}"><span class="guide-card-kicker">${escHtml(T(lang, `page.${g}.kicker`))}</span><span class="guide-card-title">${escHtml(x.h1)}</span><span class="guide-card-desc">${escHtml(x.description)}</span></a></li>`;
    }).join("\n") + `\n</ul>\n` + corps;
  }

  const autresGuides = estGuide
    ? `    <nav class="doc-related" aria-label="${escAttr(T(lang, "site.related"))}">\n      <p class="doc-related-title">${escHtml(T(lang, "site.related"))}</p>\n` +
      GUIDES.filter((g) => g !== id).map((g) => `      <a href="${PAGE[g][lang]}">${escHtml(T(lang, `page.${g}.short`))}</a>`).join("\n") + `\n    </nav>`
    : "";
  const cta = fm.cta ? `\n      <p><a class="doc-cta" href="${PAGE.tool[lang]}">${escHtml(fm.cta)}</a></p>` : "";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<!-- Généré par tools/build.js depuis tools/pages/${id}.${lang}.page — ne pas éditer ce fichier. -->
${head({ lang, id, title: titreComplet, description: fm.description, ogType: fm.type === "article" ? "article" : "website", jsonld: { "@context": "https://schema.org", "@graph": graphe }, version })}
</head>
<body data-page="${id}">
  <a class="skip-link" href="#contenu">${escHtml(T(lang, "site.skip"))}</a>
${header(lang, id, estGuide && id !== "faq" ? "guides" : id)}

  <main class="doc" id="contenu">
    <nav class="doc-crumbs" aria-label="${escAttr(T(lang, "site.crumb.aria"))}">
      ${etapes.map(([nom, chemin]) => chemin ? `<a href="${chemin}">${escHtml(nom)}</a>` : `<span aria-current="page">${escHtml(nom)}</span>`).join(`<span class="doc-crumbs-sep" aria-hidden="true">›</span>`)}
    </nav>
    <article class="doc-article">
      <header class="doc-hero">
        <h1>${escHtml(fm.h1)}</h1>
        <p class="doc-lead">${fm.lead}</p>
        <p class="doc-meta">${escHtml(meta)}</p>
      </header>
      ${fm.type === "article" || fm.type === "faq" || fm.type === "collection" ? adSlot("doc-top") : ""}
${contenu.split("\n").map((l) => (l ? "      " + l : l)).join("\n")}${cta}
      ${fm.type === "article" || fm.type === "faq" ? adSlot("doc-bottom") : ""}
    </article>
${autresGuides}
  </main>

${footer(lang)}
</body>
</html>
`;
}

// ── Page 404 (bilingue, non indexée) ───────────────────────────────────────
function page404(version) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<!-- Généré par tools/build.js — ne pas éditer ce fichier. -->
${head({ lang: "fr", id: null, title: "Page introuvable — DBL Optimizer", description: "Cette page n’existe pas ou a été déplacée.", noindex: true, version })}
</head>
<body data-page="404">
${header("fr", "tool", null)}
  <main class="doc doc-404" id="contenu">
    <p class="doc-404-code" aria-hidden="true">404</p>
    <h1>Page introuvable</h1>
    <p>Cette page n’existe pas ou a été déplacée.</p>
    <p lang="en">This page doesn’t exist or has moved.</p>
    <p class="doc-404-links">
      <a class="doc-cta" href="/">Ouvrir l’optimiseur</a>
      <a class="doc-cta is-ghost" href="/en/" lang="en">Open the optimizer (English)</a>
      <a class="doc-cta is-ghost" href="/guides.html">Voir les guides</a>
    </p>
  </main>
${footer("fr")}
</body>
</html>
`;
}

// ── Programme principal ────────────────────────────────────────────────────
function main() {
  const ecritures = new Map();
  const ecrire = (rel, contenu) => ecritures.set(rel, contenu);

  // 1. Routes dans i18n.js, puis dictionnaire
  let i18n = lire("i18n.js");
  const routes = PAGES.map((p) => `    'route.${p.id}': { fr: '${p.fr}', en: '${p.en}' },`)
    .concat([`    'route.privacy.cookies': { fr: '${PAGE.privacy.fr}#cookies', en: '${PAGE.privacy.en}#cookies' },`]);
  i18n = remplacerBloc(i18n, "ROUTES", `    // (généré par tools/build.js — ne pas éditer)\n${routes.join("\n")}`, true);
  ecrire("i18n.js", i18n);
  DICT = chargerDict(i18n);

  // 2. Outil : index.html (FR, source) → en/index.html
  const source = lire("index.html");
  const version = (source.match(/app\.js\?v=(\d+)/) || [])[1];
  if (!version) throw new Error("version (?v=N) introuvable dans index.html");
  const entetePersos = lire("characters.js").slice(0, 400), enteteItems = lire("items.js").slice(0, 400);
  const dateDonnees = (entetePersos.match(/généré le (\d{4}-\d{2}-\d{2})/) || [])[1];
  const nbPersos = (entetePersos.match(/(\d+) personnages/) || [])[1];
  const nbItems = (enteteItems.match(/(\d+) items/) || [])[1];
  if (!dateDonnees || !nbPersos || !nbItems) throw new Error("en-têtes de characters.js / items.js illisibles");
  for (const lang of LANGS) {
    const nombre = (n) => Number(n).toLocaleString(lang === "fr" ? "fr-FR" : "en-US");
    JETONS[lang] = { DATE_DONNEES: dateLongue(dateDonnees, lang), NB_PERSOS: nombre(nbPersos), NB_ITEMS: nombre(nbItems) };
  }

  const outil = {};
  for (const lang of LANGS) {
    const jsonld = {
      "@context": "https://schema.org",
      "@graph": [
        ORG(lang),
        { "@type": "WebSite", "@id": url(PAGE.tool[lang]) + "#website", url: url(PAGE.tool[lang]), name: "DBL Optimizer",
          description: T(lang, "meta.tool.description"), inLanguage: lang, publisher: { "@id": SITE + "/#organization" } },
        { "@type": "WebApplication", "@id": url(PAGE.tool[lang]) + "#app", url: url(PAGE.tool[lang]), name: "DBL Optimizer",
          applicationCategory: "GameApplication", applicationSubCategory: "Team builder", operatingSystem: "Web",
          browserRequirements: "Requires JavaScript", description: T(lang, "meta.tool.description"), inLanguage: lang,
          isAccessibleForFree: true, image: url(lang === "fr" ? "/og-image.jpg" : "/og-image-en.jpg"),
          ...(dateDonnees ? { dateModified: dateDonnees } : {}),
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, publisher: { "@id": SITE + "/#organization" } },
      ],
    };
    let html = lang === "fr" ? source : source.replace(/<html lang="fr">/, `<html lang="en">`);
    if (lang === "en" && !/<html lang="en">/.test(html)) throw new Error("<html lang> introuvable");
    html = remplacerBloc(html, "HEAD", head({ lang, id: "tool", title: T(lang, "meta.tool.title"), description: T(lang, "meta.tool.description"), jsonld, version, tool: true }));
    html = remplacerBloc(html, "HEADER", header(lang, "tool", "tool"));
    html = remplacerBloc(html, "FOOTER", footer(lang));
    html = traduire(html, lang);
    if (lang === "en") {
      html = html.replace("<!-- BUILD:HEAD:START -->", "<!-- Généré par tools/build.js depuis index.html — ne pas éditer ce fichier. -->\n<!-- BUILD:HEAD:START -->");
    }
    outil[lang] = html;
  }
  ecrire("index.html", outil.fr);
  ecrire("en/index.html", outil.en);

  // 3. Pages de contenu
  const lues = {};
  for (const p of PAGES) {
    if (p.id === "tool") continue;
    lues[p.id] = Object.fromEntries(LANGS.map((l) => [l, lirePage(p.id, l)]));
  }
  for (const p of PAGES) {
    if (p.id === "tool") continue;
    for (const lang of LANGS) ecrire(p[lang].replace(/^\//, ""), pageContenu(p.id, lang, version, lues));
  }
  ecrire("404.html", page404(version));

  // 4. Sitemap (avec alternatives hreflang)
  const lastmod = (p, lang) => (p.id === "tool" ? dateDonnees : lues[p.id][lang].fm.updated);
  const sitemap = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!-- Généré par tools/build.js — ne pas éditer ce fichier. -->`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...PAGES.flatMap((p) => LANGS.map((lang) => [
      `  <url>`,
      `    <loc>${url(p[lang])}</loc>`,
      ...(lastmod(p, lang) ? [`    <lastmod>${lastmod(p, lang)}</lastmod>`] : []),
      `    <xhtml:link rel="alternate" hreflang="fr" href="${url(p.fr)}" />`,
      `    <xhtml:link rel="alternate" hreflang="en" href="${url(p.en)}" />`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${url(p.en)}" />`,
      `  </url>`,
    ].join("\n"))),
    `</urlset>`,
    ``,
  ].join("\n");
  ecrire("sitemap.xml", sitemap);

  // 5. Écriture (seulement les fichiers qui changent)
  let n = 0;
  for (const [rel, contenu] of ecritures) {
    const cible = path.join(ROOT, rel);
    const avant = fs.existsSync(cible) ? fs.readFileSync(cible, "utf8").split("\r\n").join("\n") : null;
    if (avant === contenu) continue;
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.writeFileSync(cible, contenu);
    console.log("  écrit  " + rel);
    n++;
  }
  console.log(`OK — ${ecritures.size} fichiers générés, ${n} modifié(s) (version ${version}).`);
}

try {
  main();
} catch (e) {
  console.error("ÉCHEC : " + e.message);
  process.exit(1);
}
