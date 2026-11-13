import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { buildIndex, resolveItem, reconcile, parseLine } from '../engine.js';

const data = JSON.parse(readFileSync(new URL('../data/medmerge-data.json', import.meta.url)));
const samples = JSON.parse(readFileSync(new URL('../data/samples.json', import.meta.url))).samples;
const idx = buildIndex(data);
const has = (res, type, a, b) => res.findings.some((f) => f.type === type &&
  (!a || (f.items.some((i) => res.items[i].display === a) && f.items.some((i) => res.items[i].display === b))));

// parsing
assert.equal(parseLine('Tab. Napa 500 mg 1+1+1').name, 'napa');
assert.equal(parseLine('Tab. Napa 500 mg 1+1+1').freq, '1+1+1');
assert.equal(parseLine('Cap. Seclo 20mg').strength, '20mg');

// resolution
assert.equal(resolveItem(idx, 'Napa').generic, 'Paracetamol');
assert.equal(resolveItem(idx, 'Seclo 20 mg').generic, 'Omeprazole');
assert.equal(resolveItem(idx, 'Napaa').status, 'fuzzy');          // typo / OCR slip
assert.equal(resolveItem(idx, 'warfarin').kind, 'generic');       // generic names work too
assert.equal(resolveItem(idx, 'zzzqqq').status, 'unknown');

// scenario 1: Rahima
const r1 = reconcile(idx, samples[0].prescriptions);
console.log('rahima', r1.counts, r1.findings.map((f) => `${f.type}/${f.level}: ${f.items.map((i) => r1.items[i].display).join(' + ')}`));
assert.ok(has(r1, 'SAME_GENERIC', 'Napa', 'Ace'), 'Napa vs Ace = same paracetamol');
assert.ok(has(r1, 'SAME_GENERIC', 'Seclo', 'Losectil'), 'Seclo vs Losectil = same omeprazole');
assert.ok(has(r1, 'OVERLAP', 'Napa', 'Napa Extra'), 'Napa Extra hides paracetamol');
assert.ok(has(r1, 'CLASS_DUP', 'Maxpro', 'Seclo'), 'two PPIs');
assert.equal(r1.level, 'high');

// scenario 2: Karim — two NSAIDs
const r2 = reconcile(idx, samples[1].prescriptions);
console.log('karim', r2.counts, r2.findings.map((f) => `${f.type}/${f.level}: ${f.items.map((i) => r2.items[i].display).join(' + ')}`));
assert.ok(has(r2, 'CLASS_DUP', 'Tory', 'Voltalin'), 'two NSAIDs');

// scenario 3: clean
const r3 = reconcile(idx, samples[2].prescriptions);
console.log('clean', r3.counts, r3.findings.map((f) => `${f.type}/${f.level}`));
assert.equal(r3.level, 'ok');
console.log('ALL OK');
for (const f of r1.findings.filter((f) => f.type === 'INTERACTION')) console.log(r1.items[f.items[0]].display, '+', r1.items[f.items[1]].display, f.severity, '|', f.snippet);

// --- v2: dose meter, schedule, pregnancy, age
const rr = reconcile(idx, samples[0].prescriptions, { age: 68 });
assert.ok(rr.meter && rr.meter.total >= 3500, 'paracetamol total ' + (rr.meter && rr.meter.total));
assert.equal(rr.meter.limit, 3000);
assert.ok(rr.findings.some((f) => f.type === 'DOSE'));
assert.ok(rr.findings.some((f) => f.type === 'ELDER_NSAID'), 'Flexi in a 68-year-old');
assert.equal(rr.schedule.slots.length, 3);
const pg = reconcile(idx, [{ items: ['Tab. Atova 10 mg 0+0+1', 'Tab. Napa 500 mg 1+0+1'] }], { pregnant: true });
console.log('pregnancy', pg.findings.map((f) => f.type + ' ' + (f.cat || '')));
assert.ok(pg.findings.some((f) => f.type === 'PREGNANCY'), 'atorvastatin in pregnancy');
assert.ok(!reconcile(idx, samples[2].prescriptions, { age: 29 }).findings.length, 'clean list stays clean');
console.log('V2 OK', rr.meter.total, rr.meter.rows.map((r) => r.name + ':' + r.mg));
