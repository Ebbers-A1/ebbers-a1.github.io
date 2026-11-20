// Ebbers A1 Kurs — Tresor im Browser (19.11.2026). Gegenstück zu ebbers_tresor.js: Die Inhalte in data/*.enc werden erst
// nach Eingabe des Zugangscodes (Studierende) bzw. des Lehrer-PINs (Lehrkraft) entschlüsselt und geladen.
// Der Code bleibt auf dem Gerät (localStorage ebb_code, derselbe Eintrag, den die Anmeldung beim Apps Script nutzt);
// der Lehrer-PIN nur für die Sitzung (sessionStorage).
(function () {
  'use strict';
  const LEHRKRAFT = !!window.TRESOR_LEHRKRAFT;
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  let K = null, K2 = null, T = null;

  async function ableiten(geheim, salz) {
    const roh = await crypto.subtle.importKey('raw', new TextEncoder().encode(geheim), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(salz), iterations: T.runden, hash: 'SHA-256' },
      roh, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }
  async function entschluesseln(schluessel, text) {
    const d = b64(text);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: d.slice(0, 12) }, schluessel, d.slice(12)));
  }
  const alsSchluessel = roh => crypto.subtle.importKey('raw', roh, 'AES-GCM', false, ['decrypt']);

  async function oeffnen(geheim) {
    const s = await ableiten(geheim, LEHRKRAFT ? T.salzPin : T.salzCode);
    K = await alsSchluessel(await entschluesseln(s, LEHRKRAFT ? T.inhaltPin : T.inhaltCode));   // wirft bei falschem Code
    if (LEHRKRAFT) K2 = await alsSchluessel(await entschluesseln(s, T.lehrkraftPin));
  }

  function skriptAusText(text) {
    return new Promise((ok, fehler) => {
      const s = document.createElement('script');
      s.src = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
      s.onload = () => { URL.revokeObjectURL(s.src); ok(); }; s.onerror = fehler;
      document.head.appendChild(s);
    });
  }
  function skriptLaden(src) {
    return new Promise((ok, fehler) => {
      const s = document.createElement('script');
      s.src = src + '?v=' + (typeof APP_V !== 'undefined' ? APP_V : ''); s.onload = ok; s.onerror = fehler;
      document.head.appendChild(s);
    });
  }
  const geladen = {};
  // Für nachgeladene Dateien (Bilder je Lektion, Korrektur-Karten): data/x.js -> data/x.enc entschlüsseln.
  window.ladeGeschuetzt = function (pfad) {
    pfad = String(pfad).split('?')[0];
    if (geladen[pfad]) return geladen[pfad];
    const enc = pfad.replace(/\.js$/, '.enc'), lk = /\/lk-[^/]*$/.test(pfad);
    return (geladen[pfad] = fetch(enc + '?v=' + (typeof APP_V !== 'undefined' ? APP_V : ''))
      .then(r => { if (!r.ok) throw new Error(enc + ': ' + r.status); return r.text(); })
      .then(t => entschluesseln(lk ? K2 : K, t.trim()))
      .then(roh => skriptAusText(new TextDecoder().decode(roh)))
      .catch(e => { console.warn('Tresor:', e); }));
  };

  function formular(meldung) {
    return new Promise(fertig => {
      const box = document.createElement('div');
      box.className = 'tresor-box';
      // Deckt die (noch leere) Seite ganz ab, bis der Code stimmt
      box.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg,#F4F6FA);overflow:auto';
      box.innerHTML = '<header class="top">' +
        '<div class="wrap"><p class="eyebrow">Ebbers A1 Kurs</p><h1>' + (LEHRKRAFT ? 'Bereich für Lehrkräfte' : 'Willkommen') + '</h1>' +
        '<p class="sub">' + (LEHRKRAFT ? 'Kursplan, Material und Fortschritt' : 'Deutsch A1 · Übungsplattform') + '</p></div></header>' +
        '<div class="wrap"><section class="card"><form><label style="display:block;font-weight:600;margin-bottom:8px">' +
        (LEHRKRAFT ? 'Bitte geben Sie Ihren Lehrkraft-PIN ein.' : 'Bitte geben Sie den Zugangscode Ihres Kurses ein. Sie erhalten ihn von Ihrer Lehrkraft.') +
        '</label><input type="password" autocomplete="off" style="width:100%;font-size:17px;padding:12px 14px;border:2px solid var(--line);border-radius:10px">' +
        '<p class="tresor-meldung" style="color:var(--bad);min-height:1.4em;margin:10px 0">' + (meldung || '') + '</p>' +
        '<button class="btn" type="submit">Weiter</button></form></section></div>';
      document.body.prepend(box);
      const f = box.querySelector('form'), i = box.querySelector('input');
      i.focus();
      f.addEventListener('submit', async e => {
        e.preventDefault();
        const wert = i.value.trim(); if (!wert) return;
        box.querySelector('.tresor-meldung').textContent = 'Wird geprüft …';
        try { await oeffnen(wert); box.remove(); fertig(wert); }
        catch (x) { box.querySelector('.tresor-meldung').textContent = 'Der Code ist nicht richtig. Bitte versuchen Sie es erneut.'; }
      });
    });
  }

  window.TRESOR_START = async function (dateien) {
    T = await fetch('data/tresor.json?v=' + (typeof APP_V !== 'undefined' ? APP_V : '')).then(r => r.json());
    const ablage = LEHRKRAFT ? sessionStorage : localStorage, schl = LEHRKRAFT ? 'ebb_lk_tresor' : 'ebb_code';
    let geheim = null;
    try { geheim = ablage.getItem(schl); } catch (e) { /* kein Speicher */ }
    if (geheim) { try { await oeffnen(geheim); } catch (e) { geheim = null; } }
    if (!geheim) geheim = await formular('');
    try { ablage.setItem(schl, geheim); } catch (e) { /* egal */ }
    for (const src of dateien) {
      if (/^data\//.test(src)) await window.ladeGeschuetzt(src); else await skriptLaden(src);
    }
  };
})();
