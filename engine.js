// MedMerge reconciliation engine — pure functions, no DOM. Runs in the browser and in Node (tests).
// Data comes from data/medmerge-data.json (Bangladeshi brand -> generic index, see scripts/build_data.py).

const FORM_WORDS = /\b(tab|tabs|tablet|tablets|cap|caps|capsule|capsules|syp|syrup|susp|suspension|inj|injection|drops?|cream|oint(ment)?|gel|sachet|supp(ository)?)\b\.?/gi;
const NOISE = new Set(['days', 'day', 'after', 'before', 'meal', 'meals', 'daily', 'bd', 'tds', 'od', 'qid', 'hs', 'sos', 'x', 'for', 'mg', 'ml', 'tablet', 'tab']);
const TOPICAL = /(\beye\b|\bear\b|nasal|cream|ointment|gel|lotion|shampoo|spray|inhal|drops|paint|powder for|vaginal|enema|solution)/i;

// Therapeutic-class groups used for "same class" and interaction wording
export const GROUP_ALIASES = {
  NSAID: /nsaids?|non-?steroidal/i, ANTICOAG: /anticoagulants?|coumarins?/i, ANTIPLT: /antiplatelet|anti-platelet/i,
  ACEI: /ace inhibitors?/i, ARB: /angiotensin/i, BETA: /beta[- ]blockers?/i, CCB: /calcium[- ]channel/i,
  SSRI: /ssris?|selective serotonin/i, BZD: /benzodiazepines?/i, OPIOID: /opioids?/i, CORTICO: /corticosteroids?/i,
  LOOPDIU: /diuretics?/i, THIAZ: /diuretics?/i, SU: /sulf?onylureas?|hypoglyc[a]?emics?/i, PPI: /proton pump/i,
  H2: /h2[- ]antagonists?/i, STATIN: /statins?/i, MACROLIDE: /macrolides?/i, FLUOROQ: /quinolones?/i,
  TRICYC: /tricyclic/i, ANTIHIST: /antihistamines?/i,
};
// Class wording is only trusted for these (broad words like "diuretics" or "antiplatelet" are too loose)
const CLASS_MATCH = Object.fromEntries(['NSAID', 'ANTICOAG', 'ACEI', 'ARB', 'BETA', 'CCB', 'SSRI', 'BZD', 'OPIOID', 'SU', 'STATIN', 'MACROLIDE', 'FLUOROQ', 'TRICYC'].map((k) => [k, GROUP_ALIASES[k]]));
// Classes where taking two of them together is normal care (not flagged as a duplicate class)
const CLASS_DUP_EXEMPT = new Set(['ANTIPLT', 'CORTICO', 'CEPH', 'PENICILLIN', 'BETA', 'LOOPDIU', 'THIAZ', 'ANTICOAG']);

export function lev(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export function buildIndex(data) {
  const brandKeys = Object.keys(data.brands);
  const byFirst = new Map();
  for (const k of brandKeys) {
    const c = k[0];
    if (!byFirst.has(c)) byFirst.set(c, []);
    byFirst.get(c).push(k);
  }
  const genericByName = new Map(); // lowercase generic full name / key -> [gid]
  const add = (name, gid) => {
    if (!name) return;
    if (!genericByName.has(name)) genericByName.set(name, []);
    const l = genericByName.get(name);
    if (!l.includes(gid)) l.push(gid);
  };
  for (const [gid, g] of Object.entries(data.generics)) {
    add(g.n.toLowerCase(), gid);
    if (g.k.length === 1) add(g.k[0], gid);
  }
  const drugWords = new Set();
  for (const g of Object.values(data.generics)) for (const k of g.k) { const w = k.split(' ')[0]; if (w.length >= 6) drugWords.add(w); }
  return { data, brandKeys, byFirst, genericByName, drugWords };
}

export function parseLine(input) {
  if (typeof input !== 'string') {
    return { raw: input.name || '', name: (input.name || '').trim(), strength: input.strength || '', freq: input.frequency || input.freq || '', form: input.form || '' };
  }
  let s = input.replace(/\([^)]*\)/g, ' ');
  const f = s.match(/\b\d\s*[+\-]\s*\d\s*[+\-]\s*\d(?:\s*[+\-]\s*\d)?\b/);
  const freq = f ? f[0].replace(/\s+/g, '') : '';
  if (f) s = s.replace(f[0], ' ');
  const st = s.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|gm|g|ml|iu|%)/i);
  const strength = st ? st[0].replace(/\s+/g, '').toLowerCase() : '';
  if (st) s = s.replace(st[0], ' ');
  const formM = s.match(FORM_WORDS);
  s = s.replace(FORM_WORDS, ' ');
  const toks = s.toLowerCase().replace(/[^a-z0-9\-+ ]/g, ' ').split(/\s+/)
    .filter((t) => t && !NOISE.has(t) && !/^\d+$/.test(t));
  return { raw: input.trim(), name: toks.join(' '), strength, freq, form: formM ? formM[0].toLowerCase() : '' };
}

function strengthNums(s) { return (s || '').toLowerCase().match(/\d+(?:\.\d+)?/g) || []; }

function pickEntries(entries, strength, form) {
  // prefer oral solids (what patients actually take); then narrow by strength / form if the label offers them
  const oral = entries.filter((e) => /tablet|capsule/i.test(e[1]));
  let pool = oral.length ? oral : entries;
  if (strength) {
    const want = strengthNums(strength)[0];
    const hit = pool.filter((e) => strengthNums(e[2]).includes(want));
    if (hit.length) pool = hit;
  }
  if (form) {
    const hit = pool.filter((e) => e[1].toLowerCase().includes(form.replace(/s$/, '')));
    if (hit.length) pool = hit;
  }
  return pool;
}

export function resolveItem(index, input) {
  const p = parseLine(input);
  const { data } = index;
  const base = { raw: p.raw, strength: p.strength, freq: p.freq, query: p.name };
  if (!p.name) return { ...base, status: 'unknown', display: p.raw };
  const toks = p.name.split(' ');
  // 1) exact brand, longest prefix first
  for (let n = toks.length; n >= 1; n--) {
    const key = toks.slice(0, n).join(' ');
    if (data.brands[key]) return fromBrand(index, base, key, p, 'exact');
  }
  // 2) exact generic name
  for (let n = toks.length; n >= 1; n--) {
    const key = toks.slice(0, n).join(' ');
    const g = index.genericByName.get(key);
    if (g) return fromGeneric(index, base, g, p);
  }
  // 3) fuzzy brand (OCR / typing slips), then fuzzy generic
  const key = toks.slice(0, Math.min(2, toks.length)).join(' ');
  const cand = [];
  const pool = (index.byFirst.get(key[0]) || []).concat(index.byFirst.get(toks[0][0]) || []);
  const max = key.length <= 5 ? 1 : 2;
  for (const k of new Set(pool)) {
    const d = Math.min(lev(key, k, max), lev(toks[0], k, max));
    if (d <= max) cand.push([d, k]);
  }
  cand.sort((a, b) => a[0] - b[0] || a[1].length - b[1].length);
  if (cand.length) {
    const r = fromBrand(index, base, cand[0][1], p, 'fuzzy');
    r.alternatives = cand.slice(1, 4).map((c) => c[1]);
    return r;
  }
  for (const [name, g] of index.genericByName) {
    if (lev(toks[0], name.split(' ')[0], max) <= max) return { ...fromGeneric(index, base, g, p), status: 'fuzzy' };
  }
  return { ...base, status: 'unknown', display: p.raw };
}

function fromBrand(index, base, key, p, status) {
  const { data } = index;
  const all = data.brands[key];
  const pool = pickEntries(all, p.strength, p.form);
  const gids = [...new Set(pool.map((e) => e[0]))];
  const entry = pool[0];
  const gid = entry[0];
  return {
    ...base, status, kind: 'brand', display: titleCase(key), brand: key,
    gid, gids, ambiguous: gids.length > 1,
    form: entry[1], pickedStrength: entry[2], company: entry[3],
    strengthsAvailable: [...new Set(all.map((e) => e[2]).filter(Boolean))].slice(0, 6),
    generic: shortGeneric(data.generics[gid].n), keys: data.generics[gid].k, groups: data.generics[gid].g,
    text: data.generics[gid].i, systemic: !TOPICAL.test(entry[1] + ' ' + data.generics[gid].n),
  };
}

function fromGeneric(index, base, gids, p) {
  const { data } = index;
  const gid = gids.find((id) => data.generics[id].k.length === 1) || gids[0];
  const g = data.generics[gid];
  return {
    ...base, status: 'exact', kind: 'generic', display: shortGeneric(g.n), brand: null, gid, gids, ambiguous: false,
    form: '', pickedStrength: '', company: '', strengthsAvailable: [],
    generic: shortGeneric(g.n), keys: g.k, groups: g.g, text: g.i, systemic: !TOPICAL.test(g.n),
  };
}

const SALT_TAIL = /\b(trihydrate|dihydrate|monohydrate|hemihydrate|anhydrous|bp|usp|ip|hydrochloride|hcl|magnesium|sodium|potassium|maleate|besilate|besylate|tartrate|succinate|fumarate|sulfate|sulphate|bisulfate|bisulphate|dipropionate|mesylate)\b/gi;
export function shortGeneric(n) { const r = n.replace(SALT_TAIL, ' ').replace(/\s+/g, ' ').replace(/\s*\+\s*/g, ' + ').trim(); return r || n; }
export function titleCase(s) { return s.replace(/\b[a-z]/g, (c) => c.toUpperCase()); }

const sigOf = (it) => [...it.keys].sort().join('|');

function sentenceFor(text, re) {
  // Label text keeps a separate "Potentially Fatal:" line; only a hit on that line counts as severe.
  const lines = text.split(/\n+/);
  for (const line of lines) {
    if (!re.test(line)) continue;
    const fatal = /^\s*potentially fatal/i.test(line);
    const pieces = line.replace(/^\s*potentially fatal:?\s*/i, '').split(/(?<=[.;])\s+/);
    const hit = pieces.find((p) => re.test(p)) || line;
    const clean = hit.trim();
    return { sev: fatal ? 'severe' : 'caution', snippet: clean.length > 260 ? clean.slice(0, 257) + '…' : clean };
  }
  return null;
}

function interactionBetween(index, a, b) {
  // does a's label text mention b? (by ingredient name, else by class wording)
  const t = a.text || '';
  if (!t) return null;
  for (const k of b.keys) {
    const first = k.split(' ')[0];
    if (first.length < 5) continue;
    const re = new RegExp('\\b' + first.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    const r = sentenceFor(t, re);
    if (r) return { ...r, via: 'ingredient' };
  }
  for (const g of b.groups) {
    if (a.groups.includes(g)) continue; // same-class pairs are reported as class duplicates
    const re = CLASS_MATCH[g];
    if (!re) continue;
    const r = sentenceFor(t, new RegExp(re.source, 'i'));
    if (!r) continue;
    // a class wording inside a sentence about one specific other drug ("antiplatelet effects of clopidogrel") is not about b
    const bWords = new Set(b.keys.map((k) => k.split(' ')[0]));
    const named = (r.snippet.toLowerCase().match(/[a-z]{6,}/g) || []).filter((w) => index.drugWords.has(w) && !bWords.has(w));
    if (named.length) continue;
    return { ...r, via: 'class', group: g };
  }
  return null;
}

export function reconcile(index, prescriptions) {
  const items = [];
  prescriptions.forEach((rx, ri) => {
    (rx.items || []).forEach((line) => {
      const r = resolveItem(index, line);
      items.push({ ...r, rx: ri, idx: items.length });
    });
  });
  const known = items.filter((i) => i.kind && i.systemic);
  const findings = [];
  const seen = new Set();
  const push = (f) => { const k = f.type + ':' + f.items.slice().sort().join(','); if (!seen.has(k)) { seen.add(k); findings.push({ ...f, sa: sigOf(items[f.items[0]]), sb: sigOf(items[f.items[1]]) }); } };

  for (let x = 0; x < known.length; x++) {
    for (let y = x + 1; y < known.length; y++) {
      const A = known[x], B = known[y];
      const sa = sigOf(A), sb = sigOf(B);
      if (sa === sb) {
        if (A.brand && A.brand === B.brand) {
          if (A.rx !== B.rx) push({ type: 'SAME_BRAND', level: 'medium', items: [A.idx, B.idx], generic: A.generic });
        } else {
          push({ type: 'SAME_GENERIC', level: 'high', items: [A.idx, B.idx], generic: A.generic });
        }
        continue;
      }
      const shared = A.keys.filter((k) => B.keys.includes(k));
      if (shared.length) {
        push({ type: 'OVERLAP', level: 'high', items: [A.idx, B.idx], generic: shared.join(', ') });
        continue;
      }
      const g = A.groups.find((gr) => B.groups.includes(gr) && !CLASS_DUP_EXEMPT.has(gr));
      if (g) { push({ type: 'CLASS_DUP', level: 'medium', items: [A.idx, B.idx], group: g }); continue; }
      const ab = interactionBetween(index, A, B), ba = interactionBetween(index, B, A);
      const hit = [ab, ba].filter(Boolean).sort((p, q) => (p.sev === 'severe' ? -1 : 1) - (q.sev === 'severe' ? -1 : 1))[0];
      if (hit) push({ type: 'INTERACTION', level: hit.sev === 'severe' ? 'high' : 'medium', items: [A.idx, B.idx], snippet: hit.snippet, severity: hit.sev });
    }
  }
  // one card per problem, not one per pair: Seclo + Losectil + Maxpro are listed together
  const grouped = new Map();
  for (const f of findings) {
    const sigs = [f.sa, f.sb].sort();
    const key = f.type === 'SAME_GENERIC' ? 'SG:' + f.sa : f.type === 'SAME_BRAND' ? 'SB:' + items[f.items[0]].brand
      : f.type === 'CLASS_DUP' ? 'CD:' + f.group : f.type + ':' + sigs.join('#');
    const g = grouped.get(key);
    if (!g) { grouped.set(key, { ...f, sigs, items: [...f.items] }); continue; }
    for (const i of f.items) if (!g.items.includes(i)) g.items.push(i);
    if (f.severity === 'severe' && g.severity !== 'severe') { g.severity = 'severe'; g.level = 'high'; g.snippet = f.snippet; }
  }
  findings.length = 0;
  for (const g of grouped.values()) {
    g.items.sort((x, y) => x - y);
    if (g.type === 'INTERACTION' || g.type === 'OVERLAP') {
      g.sides = [g.sigs[0], g.sigs[1]].map((sg) => g.items.filter((i) => sigOf(items[i]) === sg));
      if (g.type === 'INTERACTION') { const iA = items[g.sides[0][0]]; g.sidesGeneric = g.sides.map((sd) => items[sd[0]].generic); }
    }
    findings.push(g);
  }
  const rank = { high: 0, medium: 1, info: 2 };
  findings.sort((p, q) => rank[p.level] - rank[q.level]);

  // merged list: one row per distinct active ingredient set
  const rows = new Map();
  for (const it of items) {
    if (!it.kind) continue;
    const sig = sigOf(it);
    if (!rows.has(sig)) rows.set(sig, { sig, generic: it.generic, groups: it.groups, brands: [], flagged: false });
    const row = rows.get(sig);
    let b = row.brands.find((x) => x.name === it.display);
    if (!b) { b = { name: it.display, rx: [], strength: it.pickedStrength || it.strength, freq: it.freq }; row.brands.push(b); }
    if (!b.rx.includes(it.rx)) b.rx.push(it.rx);
  }
  const bad = new Set();
  for (const f of findings) for (const i of f.items) bad.add(sigOf(items[i]));
  for (const r of rows.values()) r.flagged = bad.has(r.sig);
  const unknown = items.filter((i) => !i.kind);
  const level = findings.some((f) => f.level === 'high') ? 'high' : findings.length ? 'medium' : 'ok';
  return {
    items, findings, merged: [...rows.values()], unknown, level,
    counts: { medicines: items.length, distinct: rows.size, high: findings.filter((f) => f.level === 'high').length, medium: findings.filter((f) => f.level === 'medium').length },
  };
}
