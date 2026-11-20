// Ebbers A1 Kurs — Lehrkraft-Bereich „Kursplan“ (ENTWURF, 19.11.2026; Konzept: Konzept_Lehrkraftbereich.md).
// Daten: window.LERNPLAN (data/lernplan.js) und window.LERNPLAN_LK (data/lk-lernplan.js, nur mit Lehrer-PIN entschlüsselbar).
// Der Haken „durchgeführt“ steht im Entwurf nur im Browser (localStorage); später als lernplan:<id> in der Tabelle.
(function () {
  'use strict';
  const PLAN = window.LERNPLAN || [], LK = window.LERNPLAN_LK || {};
  const TYP = { gemeinsam: 'Gemeinsam', plattform: 'Plattform', test: 'Test' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lies = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } };
  let erledigt = lies('ebb_kursplan_erledigt') || {};
  const alle = PLAN.flatMap(l => l.einheiten.map(e => Object.assign({ lektion: l }, e)));
  const naechsteGemeinsame = () => alle.find(e => e.typ === 'gemeinsam' && !erledigt[e.id]);

  // Kleines Markdown: Tabellen, **fett**, *kursiv*, Zeilenumbrüche
  function md(text) {
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
    const zeilen = String(text || '').split('\n'); let h = '', i = 0;
    while (i < zeilen.length) {
      if (/^\s*\|/.test(zeilen[i])) {
        const t = []; while (i < zeilen.length && /^\s*\|/.test(zeilen[i])) t.push(zeilen[i++]);
        const zellen = z => z.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const kopf = zellen(t[0]), rumpf = t.slice(2).map(zellen);
        h += '<div class="kp-tabwrap"><table class="kp-tab"><thead><tr>' + kopf.map(c => '<th>' + inline(c) + '</th>').join('') +
          '</tr></thead><tbody>' + rumpf.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
      } else { h += zeilen[i].trim() ? '<p>' + inline(zeilen[i]) + '</p>' : ''; i++; }
    }
    return h;
  }

  function materialHtml(m, i) {
    return `<details class="kp-mat" ${i === 0 ? 'open' : ''}><summary><span class="kp-art kp-art-${esc(m.art)}">${esc(m.art)}</span> ${esc(m.titel)}</summary>
      <div class="kp-mat-inhalt">${m.art === 'dialog' ? esc(m.inhalt).split('\n').map(z => '<p>' + z.replace(/^([^:]{1,25}):/, '<strong>$1:</strong>') + '</p>').join('') : md(m.inhalt)}</div>
      <div class="kp-mat-knoepfe"><button class="btn small secondary" data-vollbild="${i}">Vollbild (Beamer)</button>
      <button class="btn small secondary" data-druck="${i}">Drucken</button></div></details>`;
  }

  function einheitHtml(e) {
    const lk = LK[e.id] || {}, fertig = !!erledigt[e.id];
    let h = `<p class="kp-ort">Lektion ${e.lektion.lektion} · ${esc(e.lektion.titel)} · Einheit ${e.nr} · <span class="kp-typ kp-${e.typ}">${TYP[e.typ]}</span> · ${e.dauer_min || '?'} Min.</p>
      <h2 class="kp-titel">${esc(e.titel)}</h2>`;
    if (e.lernziele) h += '<h3>Lernziele</h3><ul>' + e.lernziele.map(z => '<li>' + esc(z) + '</li>').join('') + '</ul>';
    if (lk.vorbereiten) h += '<h3>Vorbereiten</h3><ul>' + lk.vorbereiten.map(z => '<li>' + esc(z) + '</li>').join('') + '</ul>';
    if (lk.ablauf) h += '<h3>Ablauf</h3><ol class="kp-ablauf">' + lk.ablauf.map(s => `<li><span class="kp-min">${s.min} Min.</span> ${esc(s.schritt)}</li>`).join('') + '</ol>';
    if (lk.material) h += '<h3>Material</h3>' + lk.material.map(materialHtml).join('');
    if (e.aufgaben) h += '<h3>Aufgaben auf der Plattform</h3><ul>' + e.aufgaben.map(a => '<li>' + esc(a.titel || ({ vokabeln: 'Vokabeln', uebung_alt: 'Übung', spiel_alt: 'Spiel', uebung: 'Übung (neu)', test: 'Test', schreiben: 'Schreibaufgabe' }[a.art] || a.art)) +
      (a.anpassung ? ' <span class="kp-leise">— ' + esc(a.anpassung) + '</span>' : '') + (a.auftrag ? '<br><span class="kp-leise">' + esc(a.auftrag) + '</span>' : '') + '</li>').join('') + '</ul>';
    if (lk.nachbereiten) h += '<h3>Nachbereiten</h3><ul>' + lk.nachbereiten.map(z => '<li>' + esc(z) + '</li>').join('') + '</ul>';
    if (e.typ === 'gemeinsam') h += `<div class="kp-fertig"><button class="btn ${fertig ? 'secondary' : 'ok'}" data-erledigt="${e.id}">${fertig ? '↺ Als nicht durchgeführt markieren' : '✓ Einheit durchgeführt — Plattformphase freischalten'}</button></div>`;
    return h;
  }

  function zeitleiste(aktivId) {
    return PLAN.map(l => `<div class="kp-lek"><div class="kp-lek-kopf"><strong>L${l.lektion}</strong> ${esc(l.titel)}</div><div class="kp-kaestchen">` +
      l.einheiten.map(e => `<button class="kp-k kp-${e.typ}${erledigt[e.id] ? ' fertig' : ''}${e.id === aktivId ? ' aktiv' : ''}" data-einheit="${e.id}" title="${esc(TYP[e.typ] + ': ' + e.titel)}">${e.nr}</button>`).join('') +
      '</div></div>').join('');
  }

  let reiter = 'kursplan', aktiv = null;
  function zeichne() {
    const naechste = naechsteGemeinsame();
    if (!aktiv) aktiv = naechste ? naechste.id : (alle[0] && alle[0].id);
    const e = alle.find(x => x.id === aktiv);
    const ziel = document.getElementById('kp');
    const nav = ['kursplan', 'kurs', 'material', 'verwaltung'].map(r => `<button class="kp-reiter${r === reiter ? ' an' : ''}" data-reiter="${r}">${{ kursplan: 'Kursplan', kurs: 'Kurs', material: 'Material', verwaltung: 'Verwaltung' }[r]}</button>`).join('');
    let inhalt = '';
    if (reiter === 'kursplan') {
      const fertigZahl = alle.filter(x => erledigt[x.id]).length;
      inhalt = `<div class="kp-spalten"><aside class="kp-links"><div class="kp-fortschritt"><div class="kp-balken"><span style="width:${Math.round(100 * fertigZahl / Math.max(1, alle.filter(x => x.typ === 'gemeinsam').length))}%"></span></div>
        <span>${fertigZahl} von ${alle.filter(x => x.typ === 'gemeinsam').length} gemeinsamen Einheiten durchgeführt</span></div>
        <div class="kp-legende"><span class="kp-k kp-gemeinsam"></span> gemeinsam <span class="kp-k kp-plattform"></span> Plattform <span class="kp-k kp-test"></span> Test</div>
        ${zeitleiste(aktiv)}</aside><main class="kp-rechts card">${naechste && naechste.id === aktiv ? '<p class="kp-als-naechstes">Als Nächstes im Unterricht</p>' : ''}${e ? einheitHtml(e) : ''}</main></div>`;
    } else if (reiter === 'material') {
      inhalt = '<div class="card"><input class="kp-suche" placeholder="Material suchen, z. B. Dativ, Uhrzeit, Formular"><div class="kp-matliste">' + materialListe('') + '</div></div>';
    } else {
      inhalt = `<div class="card"><p><strong>${reiter === 'kurs' ? 'Fortschritt der Studierenden' : 'Verwaltung'}</strong></p><p class="kp-leise">Dieser Reiter wird gebaut, sobald das neue Apps Script läuft (Ergebnisse und Studierendenliste kommen aus der Tabelle). Siehe Konzept_Lehrkraftbereich.md.</p></div>`;
    }
    ziel.innerHTML = '<nav class="kp-nav">' + nav + '</nav>' + inhalt;
  }
  function materialListe(q) {
    q = q.toLowerCase();
    return PLAN.map(l => {
      const treffer = l.einheiten.flatMap(e => ((LK[e.id] || {}).material || []).map(m => ({ e, m })))
        .filter(x => !q || (x.m.titel + ' ' + x.m.inhalt + ' ' + x.e.titel).toLowerCase().includes(q));
      return treffer.length ? `<h3>Lektion ${l.lektion} · ${esc(l.titel)}</h3><ul>` + treffer.map(x => `<li><a href="#" data-einheit="${x.e.id}">${esc(x.m.titel)}</a> <span class="kp-leise">(${esc(x.m.art)}, Einheit ${x.e.nr})</span></li>`).join('') + '</ul>' : '';
    }).join('') || '<p class="kp-leise">Nichts gefunden.</p>';
  }
  function zeigeMaterial(i, drucken) {
    const m = ((LK[aktiv] || {}).material || [])[i]; if (!m) return;
    const html = `<!doctype html><meta charset="utf-8"><title>${esc(m.titel)}</title><link rel="stylesheet" href="css/style.css">
      <body class="kp-vollbild"><h1>${esc(m.titel)}</h1>${m.art === 'dialog' ? esc(m.inhalt).split('\n').map(z => '<p>' + z + '</p>').join('') : md(m.inhalt)}</body>`;
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(html); w.document.close();
    if (drucken) w.onload = () => w.print(); else if (w.document.documentElement.requestFullscreen) w.document.documentElement.requestFullscreen().catch(() => {});
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-reiter],[data-einheit],[data-erledigt],[data-vollbild],[data-druck]'); if (!b) return;
    if (b.dataset.reiter) { reiter = b.dataset.reiter; zeichne(); }
    else if (b.dataset.einheit) { ev.preventDefault(); aktiv = b.dataset.einheit; reiter = 'kursplan'; zeichne(); window.scrollTo(0, 0); }
    else if (b.dataset.erledigt) { const id = b.dataset.erledigt; if (erledigt[id]) delete erledigt[id]; else { erledigt[id] = new Date().toISOString(); aktiv = null; }   // danach gleich die nächste gemeinsame Einheit zeigen
      schreib('ebb_kursplan_erledigt', erledigt); zeichne(); window.scrollTo(0, 0); }
    else if (b.dataset.vollbild) zeigeMaterial(+b.dataset.vollbild, false);
    else if (b.dataset.druck) zeigeMaterial(+b.dataset.druck, true);
  });
  document.addEventListener('input', ev => { if (ev.target.classList.contains('kp-suche')) document.querySelector('.kp-matliste').innerHTML = materialListe(ev.target.value); });
  zeichne();
})();
