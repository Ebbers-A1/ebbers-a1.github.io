// Ebbers A1 Kurs — Selbstkontrolle (19.11.2026, Lukas: Studierende kontrollieren sich selbst, die Lehrkraft sieht nur
// das Ergebnis, kein Abgabe-/Freigabe-Ablauf). Läuft auf der Seite der Studierenden NACH student.js und bewertung.js.
//
// Beim Abschicken einer Abgabe (abgabeSichernUndSenden) wird sie sofort so ausgewertet, wie es die Lehrkraft-Ansicht
// automatisch vorbewertet (analysiereAbgabe / berechneErgebnis aus bewertung.js, ohne Eingriffe der Lehrkraft).
// Gespeichert werden in DERSELBEN Anfrage: Abgabe, Ergebnis (review:…) und Status:
//   - keine Fehler  -> status 'endgueltig'
//   - Fehler        -> status 'wiederholung_frei' mit den falschen Aufgaben (wie nach „Korrektur ok — Wiederholung“):
//                      Die Studierenden sehen die Korrektur-Karten und verbessern nur diese Aufgaben.
// Nicht automatisch prüfbare Antworten (z. B. freie Sätze) zählen nicht als Fehler; die Musterlösung steht in der Korrektur.
(function () {
  'use strict';
  if (typeof window.abgabeSichernUndSenden !== 'function' || typeof analysiereAbgabe !== 'function') return;
  const original = window.abgabeSichernUndSenden;

  function auswerten(subKey, sub, statusAlt) {
    sub = Object.assign({}, sub, { _key: subKey });
    const A = analysiereAbgabe(sub), ov = {};
    const erg = berechneErgebnis(A, ov);
    const istAbschluss = A.art === 'abschluss';
    const falsche = A.items.filter(it => effektiv(it, ov) === false);
    const neu = falsche.length ? 'wiederholung_frei' : 'endgueltig';
    const teilTitel = id => (A.teile.find(x => x.id === id) || {}).titel || '';
    const jetzt = new Date().toISOString();
    const review = {
      v: 2, testId: sub.testId, name: sub.name, titel: anzeigeTitel(sub.testId, sub.testTitle), art: A.art, reviewedAt: jetzt,
      kommentar: '', ergebnis: falsche.length ? 'zettel' : 'erledigt', korrektur: !!falsche.length, selbstkontrolle: true,
      punkte: istAbschluss ? erg.punkte : null, max: istAbschluss ? erg.max : null, prozent: istAbschluss ? erg.prozent : null, note: erg.note || null,
      richtig: erg.teile.reduce((s, x) => s + x.richtig, 0), gesamt: erg.teile.reduce((s, x) => s + x.gesamt, 0),
      teile: erg.teile.map(x => ({ id: x.id, titel: x.titel, richtig: x.richtig, gesamt: x.gesamt, punkte: x.punkte, max: x.max, wiederholen: falsche.some(it => it.teil === x.id) })),
      fehler: falsche.filter(it => !it.satz).map(it => ({ teil: teilTitel(it.teil), frage: it.frage, antwort: it.antwort, parallel: it.parallel,
        korrektAntwort: it.korrektAntwort || '', loesung: '', hinweis: '', teilId: it.teil, num: it.num, itemIdx: it.itemIdx, key: it.key })),
      saetze: falsche.filter(it => it.satz).map(it => ({ frage: it.frage, satz: it.antwort, vorschlag: it.korrektAntwort || '', teilId: it.teil, num: it.num, parallel: it.parallel, itemIdx: it.itemIdx })),
      felder: istAbschluss ? A.items.filter(it => it.key).map(it => ({ key: it.key, korrekt: effektiv(it, ov) === true })) : [],
      ergebnisse: A.art === 'grammatik' ? Object.fromEntries(A.items.map(it => [String(it.teil).slice(1) + '-' + it.itemIdx, effektiv(it, ov)])) : undefined,
    };
    const reviewKey = 'review:' + subKey.split(':').slice(1).join(':');
    const status = Object.assign({}, statusAlt || {}, { status: neu, comment: '', reviewedAt: jetzt, reviewKey, ergebnis: review.ergebnis,
      note: review.note, selbstkontrolle: true, testVersion: (typeof TESTS !== 'undefined' && TESTS[sub.testId] && TESTS[sub.testId].testVersion) || 1 });
    if (falsche.length) {
      if (A.art === 'grammatik') {
        const g = {}; falsche.forEach(it => { const nr = Number(String(it.teil).slice(1)); (g[nr] = g[nr] || []).push(it.itemIdx); });
        status.wiederholenGrammatik = g;
      } else if (istAbschluss) status.wiederholenFelder = falsche.map(it => it.key).filter(Boolean);
      else { const v = {}; falsche.forEach(it => { (v[it.teil] = v[it.teil] || []).push(it.num); }); status.wiederholenVokabel = v; }
      status.wiederholenTeile = [...new Set(falsche.map(it => it.teil))];
    }
    return [{ key: reviewKey, value: JSON.stringify(review) }, status];
  }

  window.abgabeSichernUndSenden = function (eintraege) {
    try {
      const s = eintraege.find(e => /^submission:/.test(e.key));
      const st = eintraege.find(e => /^status:/.test(e.key));
      if (s && st) {
        const [rv, status] = auswerten(s.key, JSON.parse(s.value), JSON.parse(st.value));
        st.value = JSON.stringify(status);
        eintraege = eintraege.concat([rv]);
      } else if (!s && st && eintraege.length === 1) {
        // Arbeitsblatt „Fertig“: ohne Heft-Haken der Lehrkraft gleich erledigt (Studierende lesen ihre Texte im Unterricht vor)
        const w = JSON.parse(st.value);
        if (w && w.heft && w.status === 'offen') st.value = JSON.stringify(Object.assign(w, { status: 'endgueltig', selbstkontrolle: true }));
      }
    } catch (e) { console.warn('Selbstkontrolle: Auswertung nicht möglich, Abgabe geht ohne Ergebnis weiter.', e); }
    return original.apply(this, [eintraege].concat([].slice.call(arguments, 1)));
  };
})();
