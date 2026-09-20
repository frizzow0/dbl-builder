// ============================================================
// DBL Optimizer — script commun à toutes les pages (chargé en defer)
// ============================================================
// 1. Publicités : les emplacements <aside class="ad-slot" data-ad="…"> restent
//    masqués (aucune place réservée, aucun décalage de mise en page) tant que
//    ADS.actif vaut false. Une fois le site validé par AdSense : passer actif à
//    true et renseigner l'identifiant de chaque bloc (AdSense › Annonces › Par
//    bloc d'annonces › Display responsive). Un emplacement sans identifiant
//    reste masqué ; les annonces automatiques se règlent dans AdSense.
// 2. « Gérer les cookies » : rouvre le message de consentement de Google
//    (AdSense › Confidentialité et messages). À défaut, mène à la politique.
// 3. Liens de langue : mémorisent le choix FR / EN pour l'outil.
// ============================================================
(function () {
  "use strict";

  const ADS = {
    client: "ca-pub-3800762846820919",
    actif: false,
    blocs: {
      "tool-bottom": "",   // accueil, sous les résultats
      "doc-top": "",       // guides, après l'introduction
      "doc-bottom": "",    // guides, en fin d'article
    },
  };

  const lang = document.documentElement.lang === "en" ? "en" : "fr";

  // ── 1. Emplacements publicitaires ──────────────────────────────────────────
  if (ADS.actif) {
    document.querySelectorAll(".ad-slot[data-ad]").forEach((slot) => {
      const bloc = ADS.blocs[slot.dataset.ad];
      if (!bloc) return;
      slot.hidden = false;
      slot.classList.add("is-on");
      slot.setAttribute("aria-label", lang === "en" ? "Advertisement" : "Publicité");
      slot.innerHTML =
        `<span class="ad-slot__label" aria-hidden="true">${lang === "en" ? "Advertisement" : "Publicité"}</span>` +
        `<ins class="adsbygoogle" style="display:block" data-ad-client="${ADS.client}" data-ad-slot="${bloc}"` +
        ` data-ad-format="auto" data-full-width-responsive="true"></ins>`;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* bloqueur de publicité */ }
    });
  }

  // ── 2. Gérer les cookies ───────────────────────────────────────────────────
  document.addEventListener("click", (e) => {
    const lien = e.target.closest("[data-consent-link]");
    if (!lien) return;
    e.preventDefault();
    const repli = lien.getAttribute("href");
    window.googlefc = window.googlefc || {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
    window.googlefc.callbackQueue.push({
      CONSENT_DATA_READY: () => {
        if (typeof window.googlefc.showRevocationMessage === "function") window.googlefc.showRevocationMessage();
      },
    });
    // La fenêtre de Google ne s'ouvre pas toujours : message pas encore publié,
    // visiteur hors d'Europe, bloqueur de publicité… On vérifie qu'elle est bien
    // apparue ; sinon on emmène vers la section « cookies » de la politique de
    // confidentialité, pour que le lien fasse toujours quelque chose.
    const affichee = () => !!document.querySelector(".fc-consent-root, .fc-dialog, .fc-dialog-overlay, [class*='fc-dialog']");
    let essais = 0;
    const verifier = setInterval(() => {
      if (affichee()) { clearInterval(verifier); return; }
      if (++essais >= 8) {   // ~2 s
        clearInterval(verifier);
        if (repli) location.href = repli;
      }
    }, 250);
  });

  // ── 3. Préférence de langue ────────────────────────────────────────────────
  document.addEventListener("click", (e) => {
    const lien = e.target.closest("a[data-lang-switch]");
    // Sur l’outil, i18n.js bascule sur place et mémorise lui-même le choix.
    if (!lien || e.defaultPrevented) return;
    try { localStorage.setItem("dbl-lang", lien.dataset.langSwitch); } catch (err) { /* stockage indisponible */ }
  });
})();
