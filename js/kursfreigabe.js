// Ebbers A1 Kurs — Freischaltung nach dem Kursplan (Lukas 22.11.2026: Plattform-Einheiten erst freischalten, wenn die
// Lehrkraft die gemeinsame Einheit davor als „durchgeführt“ markiert hat; die Studierenden sehen den Lernplan nicht).
// Läuft auf der Seite der Studierenden. refreshProgress() (student.js) ruft window.EBB_KURSFREIGABE(isDone) auf und ersetzt
// die alte Lernfeld-Reihenfolge durch diese Menge. Rückgabe null = keine Angabe möglich (dann gilt die alte Reihenfolge).
//   offen = alles schon Erledigte
//         + Aufgaben aller Plattform-/Test-Einheiten, deren letzte gemeinsame Einheit davor „durchgeführt“ ist
//           (zu einem Test „a1_lfN_schrittM“ gehört das Arbeitsblatt „a1_lfN_blattM“)
//         + Inhalte, die im Lernplan gar nicht vorkommen (z. B. die Einstufung)
(function () {
  'use strict';
  let cache = null, cacheZeit = 0;
  async function erledigtLesen() {
    if (cache && Date.now() - cacheZeit < 60000) return cache;
    try { cache = JSON.parse((await window.storage.get('kursplan:erledigt')).value || '{}') || {}; }
    catch (e) { if (!(e && e.message === 'not_found')) return null; cache = {}; }   // noch nichts durchgeführt
    cacheZeit = Date.now(); return cache;
  }
  // Arbeitsblatt zu einem Test: steht im Lernpfad direkt vor dem Test (Nummern können abweichen, z. B. blatt6 → schritt7)
  const partner = id => {
    for (const lf of (typeof CURRICULUM !== 'undefined' ? CURRICULUM : [])) {
      const i = lf.items.indexOf(id);
      if (i > 0 && /_blatt\d+$/.test(lf.items[i - 1])) return lf.items[i - 1];
    }
    return null;
  };

  window.EBB_KURSFREIGABE = async function (istErledigt) {
    const PLAN = window.LERNPLAN;
    if (!Array.isArray(PLAN) || typeof CURRICULUM === 'undefined' || !window.storage) return null;
    const erledigt = await erledigtLesen();
    if (!erledigt) return null;
    const offen = new Set(), imPlan = new Set();
    let letzteGemeinsame = null;
    PLAN.forEach(l => l.einheiten.forEach(e => {
      const ids = (e.aufgaben || []).map(a => a.id).filter(Boolean);
      ids.forEach(id => { imPlan.add(id); const p = partner(id); if (p) imPlan.add(p); });
      if (e.typ === 'gemeinsam') { letzteGemeinsame = e; return; }
      if (letzteGemeinsame && !erledigt[letzteGemeinsame.id]) return;
      ids.forEach(id => { offen.add(id); const p = partner(id); if (p) offen.add(p); });
    }));
    CURRICULUM.forEach(lf => lf.items.forEach(id => {
      const art = typeof curriculumItemInfo === 'function' ? curriculumItemInfo(id).kind : undefined;
      if (!imPlan.has(id) || istErledigt(id, art)) offen.add(id);
    }));
    return offen;
  };
})();
