import { buildIndex, reconcile, resolveItem, titleCase } from './engine.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const T = {
  en: {
    settings: 'Scan settings', eyebrow: 'AI × Healthcare · Medication safety',
    h1: 'Three doctors.<br><em>One safe list.</em>',
    lede: 'In Bangladesh the same medicine sells under dozens of brand names. When prescriptions from different doctors pile up, a double dose can hide behind two different names. MedMerge reads them all, merges them, and shows what needs a second look.',
    step1: '1 · Your prescriptions', scan: 'Scan a photo', addRx: '+ Add prescription', clear: 'Clear',
    hint: 'One medicine per line. Brand or generic name, strength optional. Example: <code>Tab. Napa 500 mg 1+1+1</code>',
    step2: '2 · What needs a second look', step3: '3 · Your merged list', print: 'Save / print this list',
    disclaimer: '<strong>Not medical advice.</strong> MedMerge is a decision-support prototype built for a hackathon. Never stop or change a medicine because of this page — show the list to your doctor or pharmacist. In an emergency call 999.',
    keyTitle: 'Scan settings', keyText: 'Photo scanning uses Google Gemini from your browser. Paste your own API key; it stays on this device and is sent only to Google. No key? Type the names or use a sample.',
    cancel: 'Cancel', save: 'Save', trySample: 'Try sample', doctor: 'Doctor / clinic', rx: 'Rx',
    meds: 'medicines', distinct: 'distinct ingredients', remove: 'Remove',
    verdictHigh: (n) => [`${n}`, n === 1 ? 'overlap to check before the next dose' : 'overlaps to check before the next dose', 'Some medicines on these prescriptions overlap. Show this list to your doctor or pharmacist before taking more. Do not stop anything on your own.'],
    verdictMed: (n) => [`${n}`, 'point to ask your doctor about', 'Nothing looks like a double dose, but a few combinations are worth a question at the next visit.'],
    verdictOk: () => ['✓', 'No overlaps found', 'No duplicate ingredients or known interactions were found among the medicines MedMerge recognised. This is not a guarantee of safety.'],
    verdictEmpty: ['—', 'Add at least two medicines', 'MedMerge compares medicines across prescriptions.'],
    sevSerious: 'Serious per label', sevCaution: 'Caution', checkNow: 'Check first', askDoc: 'Ask your doctor',
    SAME_GENERIC: ['Same medicine, different names', (l, g) => `${l} are all <b>${g}</b>. Taking more than one can mean a double dose.`],
    OVERLAP: ['Hidden overlap', (l, g) => `${l} all contain <b>${g}</b>. One of them is a combination that already includes it.`],
    CLASS_DUP: ['Same family, taken together', (l, g) => `${l} are all ${g}. Doctors rarely intend more than one at once.`],
    SAME_BRAND: ['Repeated across prescriptions', (l, g) => `${l} (${g}) appears on more than one prescription. Make sure it is taken only once.`],
    INTERACTION: ['Possible interaction', (a, b) => `${a} and ${b} may affect each other.`],
    DOSE: ['Daily paracetamol limit reached', (l, g, f) => `${l} add up to about <b>${f.total} mg</b> of paracetamol a day. The usual adult ceiling is ${f.limit} mg.`],
    PREGNANCY: ['Not advised in pregnancy', (l, g, f) => `${l} is rated category <b>${f.cat}</b> for pregnancy on its label summary.`],
    ELDER_NSAID: ['Use with care at 65+', (l) => `${l} is an NSAID painkiller. In older adults it raises the risk of stomach bleeding and kidney strain.`],
    ELDER_BZD: ['Use with care at 65+', (l) => `${l} is a benzodiazepine. In older adults it raises the risk of drowsiness and falls.`],
    patient: 'About the patient', age: 'Age', preg: 'Pregnant', meterT: 'Paracetamol today', meterOf: (a, b) => `${a} of ${b} mg`, assumed: 'assumed 500 mg per tablet',
    sched: 'Daily timetable', morning: 'Morning', noon: 'Noon', night: 'Night', asNeeded: 'As needed / no schedule', listen: 'Read aloud',
    and: ' and ', more: (m) => `Plus ${m} more to ask your doctor about.`,
    source: 'From the drug label summary:',
    groups: { NSAID: 'painkillers of the NSAID type', PPI: 'acid-reducing PPIs', H2: 'H2 acid reducers', STATIN: 'statins', ACEI: 'ACE inhibitors', ARB: 'ARB blood-pressure medicines', CCB: 'calcium-channel blockers', SSRI: 'SSRI antidepressants', BZD: 'benzodiazepines', OPIOID: 'opioids', SU: 'sulfonylurea diabetes medicines', ANTIHIST: 'antihistamines', FLUOROQ: 'quinolone antibiotics', MACROLIDE: 'macrolide antibiotics', TRICYC: 'tricyclic antidepressants' },
    colIngredient: 'Active ingredient', usedAs: 'Sold to you as', fix: 'Did you mean', unknownT: 'Not recognised — type the generic name or check the spelling:',
    dq: 'Questions to ask your doctor',
    q: {
      SAME_GENERIC: (l) => `Do I need all of ${l}, or only one?`,
      OVERLAP: (l) => `${l} overlap — which should I keep?`,
      CLASS_DUP: (l) => `Is it intended that I take ${l} together?`,
      DOSE: (l) => `Is my total paracetamol across ${l} safe?`,
      PREGNANCY: (l) => `Is ${l} safe while I am pregnant?`,
      ELDER_NSAID: (l) => `Is ${l} safe at my age, or is there a gentler option?`,
      ELDER_BZD: (l) => `Is ${l} still the right choice at my age?`,
      SAME_BRAND: (l) => `${l} is on two prescriptions — is one a repeat?`,
      INTERACTION: (a, b) => `Is it safe to take ${a} with ${b}?`,
    },
    scanBusy: 'Reading the prescription…', scanNoKey: 'Add your Gemini key in “Scan settings” to scan photos — or type the names / use a sample.',
    scanDone: (n) => `Read ${n} medicines from the photo. Please check them below.`, scanFail: 'Could not read that photo. Try a sharper image or type the names.',
    loading: 'Loading the Bangladeshi drug index…',
    sampleTag: 'Sample', scanned: 'Scanned prescription',
  },
  bn: {
    settings: 'স্ক্যান সেটিংস', eyebrow: 'AI × স্বাস্থ্যসেবা · ওষুধের নিরাপত্তা',
    h1: 'তিনজন ডাক্তার।<br><em>একটাই নিরাপদ তালিকা।</em>',
    lede: 'বাংলাদেশে একই ওষুধ কয়েক ডজন ব্র্যান্ড নামে বিক্রি হয়। আলাদা ডাক্তারের প্রেসক্রিপশন জমলে দুটি ভিন্ন নামের আড়ালে একই ওষুধ দুবার চলে যেতে পারে। MedMerge সব প্রেসক্রিপশন পড়ে এক তালিকায় আনে এবং কোথায় আরেকবার দেখা দরকার তা দেখায়।',
    step1: '১ · আপনার প্রেসক্রিপশন', scan: 'ছবি স্ক্যান করুন', addRx: '+ প্রেসক্রিপশন যোগ', clear: 'মুছুন',
    hint: 'প্রতি লাইনে একটি ওষুধ। ব্র্যান্ড বা জেনেরিক নাম, শক্তি না দিলেও চলবে। যেমন: <code>Tab. Napa 500 mg 1+1+1</code>',
    step2: '২ · যা আরেকবার দেখা দরকার', step3: '৩ · আপনার একত্রিত তালিকা', print: 'তালিকা সেভ / প্রিন্ট করুন',
    disclaimer: '<strong>এটি চিকিৎসা পরামর্শ নয়।</strong> MedMerge হ্যাকাথনের জন্য বানানো একটি সহায়ক প্রোটোটাইপ। এই পেজ দেখে কোনো ওষুধ বন্ধ বা বদলাবেন না — তালিকাটি ডাক্তার বা ফার্মাসিস্টকে দেখান। জরুরি অবস্থায় ৯৯৯-এ কল করুন।',
    keyTitle: 'স্ক্যান সেটিংস', keyText: 'ছবি স্ক্যানে আপনার ব্রাউজার থেকে Google Gemini ব্যবহার হয়। নিজের API key দিন; এটি শুধু এই ডিভাইসে থাকে এবং কেবল Google-এ যায়। key না থাকলে নাম টাইপ করুন বা নমুনা ব্যবহার করুন।',
    cancel: 'বাতিল', save: 'সেভ', trySample: 'নমুনা দেখুন', doctor: 'ডাক্তার / ক্লিনিক', rx: 'প্রেসক্রিপশন',
    meds: 'টি ওষুধ', distinct: 'টি আলাদা উপাদান', remove: 'সরান',
    verdictHigh: (n) => [`${n}`, 'মিল পরবর্তী ডোজের আগে দেখা দরকার', 'কিছু ওষুধ একটির সাথে আরেকটি মিলে যাচ্ছে। আরও খাওয়ার আগে তালিকাটি ডাক্তার বা ফার্মাসিস্টকে দেখান। নিজে থেকে কিছু বন্ধ করবেন না।'],
    verdictMed: (n) => [`${n}`, 'বিষয়ে ডাক্তারকে জিজ্ঞেস করুন', 'একই ওষুধ দুবার চলছে এমন কিছু পাওয়া যায়নি, তবে কয়েকটি সংমিশ্রণ নিয়ে পরের ভিজিটে প্রশ্ন করা ভালো।'],
    verdictOk: () => ['✓', 'কোনো মিল বা ঝুঁকি পাওয়া যায়নি', 'MedMerge যেসব ওষুধ চিনতে পেরেছে তাতে একই উপাদান দুবার বা পরিচিত ঝুঁকিপূর্ণ মিথস্ক্রিয়া পাওয়া যায়নি। এটি নিরাপত্তার নিশ্চয়তা নয়।'],
    verdictEmpty: ['—', 'কমপক্ষে দুটি ওষুধ দিন', 'MedMerge প্রেসক্রিপশনগুলোর ওষুধ নিজেদের মধ্যে তুলনা করে।'],
    sevSerious: 'লেবেলে গুরুতর', sevCaution: 'সতর্কতা', checkNow: 'আগে দেখুন', askDoc: 'ডাক্তারকে জিজ্ঞেস করুন',
    SAME_GENERIC: ['একই ওষুধ, ভিন্ন নাম', (l, g) => `${l} — সবই <b>${g}</b>। একাধিক খেলে দ্বিগুণ ডোজ হয়ে যেতে পারে।`],
    OVERLAP: ['লুকানো মিল', (l, g) => `${l} — সবগুলোতেই <b>${g}</b> আছে। একটি কম্বিনেশন ওষুধ, যার ভেতরে ওটি আগে থেকেই আছে।`],
    CLASS_DUP: ['একই গোত্রের ওষুধ একসাথে', (l, g) => `${l} — সবই একই গোত্রের (${g})। ডাক্তাররা সাধারণত একাধিক একসাথে চান না।`],
    SAME_BRAND: ['একাধিক প্রেসক্রিপশনে একই ওষুধ', (l, g) => `${l} (${g}) একাধিক প্রেসক্রিপশনে আছে। নিশ্চিত করুন এটি একবারই খাচ্ছেন।`],
    INTERACTION: ['সম্ভাব্য মিথস্ক্রিয়া', (a, b) => `${a} ও ${b} একে অপরের কাজে প্রভাব ফেলতে পারে।`],
    DOSE: ['প্যারাসিটামলের দৈনিক সীমা ছুঁয়েছে', (l, g, f) => `${l} মিলিয়ে দিনে প্রায় <b>${f.total} মিগ্রা</b> প্যারাসিটামল হচ্ছে। সাধারণ প্রাপ্তবয়স্কের সর্বোচ্চ সীমা ${f.limit} মিগ্রা।`],
    PREGNANCY: ['গর্ভাবস্থায় নিরাপদ নয়', (l, g, f) => `${l} ওষুধটির লেবেলে গর্ভাবস্থার ক্যাটাগরি <b>${f.cat}</b>।`],
    ELDER_NSAID: ['৬৫+ বয়সে সতর্কতা', (l) => `${l} একটি NSAID ব্যথানাশক। বয়স্কদের পাকস্থলীতে রক্তক্ষরণ ও কিডনির ঝুঁকি বাড়ায়।`],
    ELDER_BZD: ['৬৫+ বয়সে সতর্কতা', (l) => `${l} একটি বেনজোডায়াজেপিন। বয়স্কদের ঝিমুনি ও পড়ে যাওয়ার ঝুঁকি বাড়ায়।`],
    patient: 'রোগীর তথ্য', age: 'বয়স', preg: 'গর্ভবতী', meterT: 'আজকের প্যারাসিটামল', meterOf: (a, b) => `${b} এর মধ্যে ${a} মিগ্রা`, assumed: 'প্রতি ট্যাবলেট ৫০০ মিগ্রা ধরা হয়েছে',
    sched: 'দৈনিক রুটিন', morning: 'সকাল', noon: 'দুপুর', night: 'রাত', asNeeded: 'প্রয়োজনে / সময় দেওয়া নেই', listen: 'পড়ে শোনাও',
    and: ' ও ', more: (m) => `এর বাইরে আরও ${m}টি বিষয় ডাক্তারকে জিজ্ঞেস করার আছে।`,
    source: 'ওষুধের লেবেল সারসংক্ষেপ থেকে (ইংরেজিতে):',
    groups: { NSAID: 'NSAID ধরনের ব্যথানাশক', PPI: 'গ্যাস্ট্রিকের PPI', H2: 'H2 গ্যাস্ট্রিক ওষুধ', STATIN: 'স্ট্যাটিন', ACEI: 'ACE ইনহিবিটর', ARB: 'ARB রক্তচাপের ওষুধ', CCB: 'ক্যালসিয়াম-চ্যানেল ব্লকার', SSRI: 'SSRI অবসাদের ওষুধ', BZD: 'বেঞ্জোডায়াজেপিন', OPIOID: 'ওপিওয়েড', SU: 'সালফোনাইলইউরিয়া ডায়াবেটিসের ওষুধ', ANTIHIST: 'অ্যান্টিহিস্টামিন', FLUOROQ: 'কুইনোলোন অ্যান্টিবায়োটিক', MACROLIDE: 'ম্যাক্রোলাইড অ্যান্টিবায়োটিক', TRICYC: 'ট্রাইসাইক্লিক অবসাদের ওষুধ' },
    colIngredient: 'মূল উপাদান', usedAs: 'যে নামে পেয়েছেন', fix: 'আপনি কি বোঝাতে চেয়েছেন', unknownT: 'চেনা যায়নি — জেনেরিক নাম লিখুন বা বানান দেখুন:',
    dq: 'ডাক্তারকে যে প্রশ্নগুলো করবেন',
    q: {
      SAME_GENERIC: (l) => `${l} — সবগুলো কি আমার লাগবে, নাকি একটি?`,
      OVERLAP: (l) => `${l} একটির ভেতরে আরেকটি আছে — কোনটি রাখব?`,
      CLASS_DUP: (l) => `${l} একসাথে খাওয়ার কথা কি আপনি ভেবেছেন?`,
      DOSE: (l) => `${l} মিলিয়ে আমার মোট প্যারাসিটামল কি নিরাপদ?`,
      PREGNANCY: (l) => `গর্ভাবস্থায় ${l} কি নিরাপদ?`,
      ELDER_NSAID: (l) => `এই বয়সে ${l} নিরাপদ কি, নাকি নরম বিকল্প আছে?`,
      ELDER_BZD: (l) => `এই বয়সে ${l} কি এখনো সঠিক পছন্দ?`,
      SAME_BRAND: (l) => `${l} দুটি প্রেসক্রিপশনে আছে — একটি কি পুনরাবৃত্তি?`,
      INTERACTION: (a, b) => `${a} ও ${b} একসাথে খাওয়া কি নিরাপদ?`,
    },
    scanBusy: 'প্রেসক্রিপশন পড়া হচ্ছে…', scanNoKey: 'ছবি স্ক্যানে “স্ক্যান সেটিংস”-এ Gemini key দিন — অথবা নাম টাইপ করুন / নমুনা ব্যবহার করুন।',
    scanDone: (n) => `ছবি থেকে ${n}টি ওষুধ পড়া হয়েছে। নিচে মিলিয়ে দেখুন।`, scanFail: 'ছবিটি পড়া যায়নি। আরও স্পষ্ট ছবি দিন বা নাম টাইপ করুন।',
    loading: 'বাংলাদেশের ওষুধ তালিকা লোড হচ্ছে…',
    sampleTag: 'নমুনা', scanned: 'স্ক্যান করা প্রেসক্রিপশন',
  },
};

let lang = localStorage.getItem('mm-lang') || 'en';
let index = null, samples = [];
let rxs = []; // [{doctor, text}]
const t = () => T[lang];

function applyLang() {
  $('#listen').textContent = '🔊 ' + t().listen; $('#lblAge').textContent = t().age; $('#lblPreg').textContent = t().preg; $('#lblPatient').textContent = t().patient;
  document.documentElement.lang = lang;
  document.body.classList.toggle('bn', lang === 'bn');
  document.querySelectorAll('[data-i18n]').forEach((el) => { const v = t()[el.dataset.i18n]; if (typeof v === 'string') el.innerHTML = v; });
  document.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
  renderSamples(); renderLane(); update();
}

function renderSamples() {
  $('#samples').innerHTML = samples.map((s, i) => `<button class="sample" data-i="${i}"><i>${t().sampleTag}</i><b>${esc(s.title[lang])}</b><span>${esc(s.note[lang])}</span></button>`).join('');
  document.querySelectorAll('.sample').forEach((b) => b.addEventListener('click', () => {
    const s = samples[+b.dataset.i];
    rxs = s.prescriptions.map((p) => ({ doctor: `${p.doctor} · ${p.date}`, text: p.items.join('\n') }));
    renderLane(); update(); $('#bench').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

function lineChips(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.map((l) => {
    const r = resolveItem(index, l);
    if (!r.kind) return `<li><span class="tag no">?</span> <span>${esc(l)}</span></li>`;
    const cls = r.status === 'fuzzy' ? 'fz' : 'ok';
    const label = r.kind === 'brand' ? `${esc(r.display)} <span class="arrow">→</span> ${esc(r.generic)}` : esc(r.generic);
    return `<li><span class="tag ${cls}">${r.status === 'fuzzy' ? '≈' : '✓'}</span> <span>${label}</span></li>`;
  }).join('');
}

function renderLane() {
  if (!index) return;
  const lane = $('#lane');
  lane.innerHTML = rxs.map((r, i) => `
    <article class="rx" data-i="${i}">
      <button class="rm" title="${t().remove}" aria-label="${t().remove}">×</button>
      <header><input class="doc" value="${esc(r.doctor)}" placeholder="${t().doctor}" aria-label="${t().doctor}"><span class="rxn">${t().rx} ${i + 1}</span></header>
      <textarea spellcheck="false" aria-label="Medicines">${esc(r.text)}</textarea>
      <ul class="lines">${lineChips(r.text)}</ul>
    </article>`).join('');
  lane.querySelectorAll('.rx').forEach((el) => {
    const i = +el.dataset.i;
    el.querySelector('.rm').onclick = () => { rxs.splice(i, 1); renderLane(); update(); };
    el.querySelector('.doc').oninput = (e) => { rxs[i].doctor = e.target.value; update(); };
    let timer;
    el.querySelector('textarea').oninput = (e) => {
      rxs[i].text = e.target.value;
      el.querySelector('.lines').innerHTML = lineChips(rxs[i].text);
      clearTimeout(timer); timer = setTimeout(update, 250);
    };
  });
}

function update() {
  if (!index) return;
  const prescriptions = rxs.map((r) => ({ items: r.text.split('\n').map((l) => l.trim()).filter(Boolean) }));
  const total = prescriptions.reduce((n, p) => n + p.items.length, 0);
  const res = $('#result');
  if (total < 2) { res.hidden = true; return; }
  const patient = { age: +$('#age').value || 0, pregnant: $('#preg').checked };
  const out = reconcile(index, prescriptions, patient);
  res.hidden = false;
  const nHigh = out.counts.high, nMed = out.counts.medium;
  const [big, head, body] = nHigh ? t().verdictHigh(nHigh) : nMed ? t().verdictMed(nMed) : t().verdictOk();
  const more = nHigh && nMed ? ` ${t().more(nMed)}` : '';
  $('#verdict').className = 'verdict ' + out.level;
  $('#verdict').innerHTML = `<div class="big">${esc(big)}</div><div><h3>${esc(head)}</h3><p>${esc(body + more)}</p><p class="small">${out.counts.medicines} ${t().meds} · ${out.counts.distinct} ${t().distinct}</p></div>`;

  const names = (ids) => [...new Set(ids.map((i) => out.items[i].display))];
  const plain = (arr) => arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + t().and + arr[arr.length - 1];
  const bold = (arr) => plain(arr.map((x) => `<b>${esc(x)}</b>`));
  const chips = (arr) => arr.map((x) => `<span class="chip">${esc(x)}</span>`).join('');
  const sideNames = (f) => f.sides.map(names);
  $('#findings').innerHTML = out.findings.length ? out.findings.map((f, k) => {
    const [title, tpl] = t()[f.type];
    const all = names(f.items);
    const sev = f.type === 'INTERACTION' ? (f.severity === 'severe' ? t().sevSerious : t().sevCaution) : (f.level === 'high' ? t().checkNow : t().askDoc);
    const snippet = f.snippet ? `<q>${t().source} ${esc(f.snippet)}</q>` : '';
    let body;
    if (f.type === 'INTERACTION') { const [sa, sb] = sideNames(f); body = tpl(bold(sa), bold(sb)); }
    else { const g = f.type === 'CLASS_DUP' ? esc(t().groups[f.group] || f.group) : esc(f.generic || ''); body = tpl(bold(all), g, f); }
    return `<article class="f ${f.level}" style="animation-delay:${k * 40}ms"><div class="t"><span class="pill ${f.level === 'high' ? '' : 'm'}">${esc(sev)}</span><b>${esc(title)}</b></div>
      <div class="chips">${chips(all)}</div><p>${body}</p>${snippet}</article>`;
  }).join('') : '';

  $('#merged').innerHTML = out.merged.map((r) => `<div class="m-row ${r.flagged ? 'flag' : ''}"><b>${esc(r.generic)}</b><small>${r.brands.reduce((s, b) => s + b.rx.length, 0)}×</small>
    <div class="brands">${r.brands.map((b) => `<span>${esc(b.name)}${b.strength ? ' ' + esc(b.strength) : ''}</span>`).join('')}</div></div>`).join('');

  const m = out.meter;
  $('#meter').innerHTML = m ? `<div class="meter ${m.over ? 'over' : m.near ? 'near' : ''}"><div class="mh"><b>${t().meterT}</b><span>${t().meterOf(m.total, m.limit)}</span></div>
    <div class="bar"><i style="width:${m.pct}%"></i></div>
    <div class="mrows">${m.rows.map((r) => `<span>${esc(r.name)} <em>${r.perDay}×${r.unit}${r.assumed ? '*' : ''}</em></span>`).join('')}</div>${m.rows.some((r) => r.assumed) ? `<small>* ${t().assumed}</small>` : ''}</div>` : '';

  const sc = out.schedule, cols = [['☀', t().morning], ['◐', t().noon], ['☾', t().night]];
  $('#sched').innerHTML = sc.slots.some((x) => x.length) ? `<h4>${t().sched}</h4><div class="tt">${cols.map(([ic, nm], k) => `<div><div class="th"><span>${ic}</span>${nm}</div>${sc.slots[k].map((x) => `<p>${esc(x.name)}${x.n > 1 ? ' ×' + x.n : ''}</p>`).join('') || '<p class="none">—</p>'}</div>`).join('')}</div>${sc.asNeeded.length ? `<small>${t().asNeeded}: ${sc.asNeeded.map((x) => esc(x.display)).join(', ')}</small>` : ''}` : '';

  $('#unknown').innerHTML = out.unknown.length ? `<div class="unk">${t().unknownT} ${out.unknown.map((u) => `<b>${esc(u.raw)}</b>`).join(', ')}</div>` : '';

  const qs = [];
  for (const f of out.findings.slice(0, 5)) {
    const fn = t().q[f.type]; if (!fn) continue;
    const q = f.type === 'INTERACTION' ? fn(plain(names(f.sides[0])), plain(names(f.sides[1]))) : fn(plain(names(f.items)));
    qs.push(`<li>${esc(q)}</li>`);
  }
  $('#docq').innerHTML = qs.length ? `<h4>${t().dq}</h4><ul>${qs.join('')}</ul>` : '';
  $('#docq').hidden = !qs.length;
}

function readAloud() {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const txt = [$('#verdict h3')?.textContent, ...[...document.querySelectorAll('#findings article')].map((a) => a.querySelector('b')?.textContent + '. ' + a.querySelector('p')?.textContent)].filter(Boolean).join('. ');
  const u = new SpeechSynthesisUtterance(txt); u.lang = lang === 'bn' ? 'bn-BD' : 'en-GB'; speechSynthesis.speak(u);
}
$('#listen').onclick = readAloud;
$('#age').oninput = update; $('#preg').onchange = update;

// ---- photo scan (Gemini, from the browser, using the user's own key) ----
async function downscale(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}
async function scanPhoto(file) {
  const key = localStorage.getItem('mm-key');
  const st = $('#scanStatus');
  if (!key) { st.textContent = t().scanNoKey; $('#keyDlg').showModal(); return; }
  st.textContent = t().scanBusy;
  try {
    const b64 = await downscale(file);
    const prompt = 'You read handwritten or printed Bangladeshi medical prescriptions. Extract every medicine. Return JSON only: {"doctor": string, "date": string, "medicines": [{"name": string (brand or generic as written), "strength": string, "frequency": string}]}. Use "" for unknown fields. Do not invent medicines; if a word is illegible, skip it.';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const data = JSON.parse(j.candidates[0].content.parts[0].text);
    const meds = (data.medicines || []).filter((m) => m && m.name);
    if (!meds.length) throw new Error('empty');
    rxs.push({ doctor: [data.doctor, data.date].filter(Boolean).join(' · ') || t().scanned, text: meds.map((m) => [m.name, m.strength, m.frequency].filter(Boolean).join(' ')).join('\n') });
    renderLane(); update(); st.textContent = t().scanDone(meds.length);
  } catch (e) { st.textContent = t().scanFail; }
}

// ---- wiring ----
document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => { lang = b.dataset.lang; localStorage.setItem('mm-lang', lang); applyLang(); }));
$('#addRx').onclick = () => { rxs.push({ doctor: '', text: '' }); renderLane(); update(); $('#lane').lastElementChild?.querySelector('textarea').focus(); };
$('#clearAll').onclick = () => { rxs = [{ doctor: '', text: '' }, { doctor: '', text: '' }]; renderLane(); update(); };
$('#photo').onchange = (e) => { if (e.target.files[0]) scanPhoto(e.target.files[0]); e.target.value = ''; };
$('#keyBtn').onclick = () => { $('#keyInput').value = localStorage.getItem('mm-key') || ''; $('#keyDlg').showModal(); };
$('#saveKey').onclick = () => { const v = $('#keyInput').value.trim(); if (v) localStorage.setItem('mm-key', v); else localStorage.removeItem('mm-key'); };
$('#print').onclick = () => window.print();

(async function init() {
  $('#scanStatus').textContent = t().loading;
  const [data, s] = await Promise.all([fetch('data/medmerge-data.json').then((r) => r.json()), fetch('data/samples.json').then((r) => r.json())]);
  index = buildIndex(data); samples = s.samples;
  $('#credit').innerHTML = `Brand and label data: <a href="https://github.com/wsayan/medicinedb">wsayan/medicinedb</a> (MIT) · ${Object.keys(data.brands).length.toLocaleString()} brands · ${Object.keys(data.generics).length.toLocaleString()} generics. Interaction wording comes from those label summaries and has not been clinically validated.`;
  $('#scanStatus').textContent = '';
  rxs = [{ doctor: '', text: '' }, { doctor: '', text: '' }];
  applyLang();
  if (new URLSearchParams(location.search).get('demo') === '1') document.querySelector('.sample')?.click();
})();
