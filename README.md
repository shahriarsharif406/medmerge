# MedMerge — one safe medicine list from every prescription

**Hackathon:** DSH Hacks V2 · **Theme:** AI × Healthcare · **Live demo:** https://shahriarsharif406.github.io/medmerge/

In Bangladesh one medicine is sold under dozens of brand names. Napa and Ace are both paracetamol; Seclo and
Losectil are both omeprazole. When a patient collects prescriptions from several doctors, a double dose can hide
behind two different names. MedMerge reads the prescriptions, resolves every brand to its active ingredient,
merges them into one list, and shows what needs a second look — in English and Bangla.

## What it flags
| Finding | Example |
|---|---|
| Same medicine, different brand names | Napa + Ace (both paracetamol) |
| Hidden overlap inside a combination | Napa Extra (paracetamol + caffeine) next to Napa |
| Two of the same drug family | Seclo + Maxpro + Losectil (all acid-reducing PPIs) |
| Possible interaction, quoted from the drug label summary | Plavix + Maxpro |

It also writes a short "questions to ask your doctor" list and a printable merged list.

## Try it
Open the live demo and click a sample ("Rahima Begum"), or type medicine names, one per line
(`Tab. Napa 500 mg 1+1+1`). **Scan a photo** reads a prescription image with Google Gemini directly from your
browser using *your own* API key (stored only on your device) — no server, nothing uploaded to us.

## How it works
1. `parseLine` splits a line into name / strength / frequency (Bangladeshi `1+0+1` style supported).
2. `resolveItem` matches the name against 12,000+ Bangladeshi brands, then generics, then fuzzy-matches typos and OCR slips.
3. `reconcile` compares active ingredients across all prescriptions: duplicates, overlaps, same-class pairs, and label-text interactions.
4. `app.js` renders the findings, the merged list and the bilingual UI.

Everything runs in the browser (`engine.js` is pure JavaScript and is unit-tested in Node).

```
node tests/engine.test.mjs        # engine tests
python3 -m http.server            # then open http://localhost:8000
python3 scripts/build_data.py medicine.db   # rebuild data/medmerge-data.json
```

## Honest limits
- **Not medical advice.** It never tells anyone to stop a medicine; it tells them what to ask.
- Interaction text comes from label summaries in a 2021 community database and is **not clinically validated**.
  Class-level matching is deliberately conservative; drug–condition, dose and age checks are not implemented.
- Handwriting accuracy depends on Gemini and the photo; every scanned line is shown for the user to confirm.
- Sample patients are synthetic.

## Credits
Brand/label data: [wsayan/medicinedb](https://github.com/wsayan/medicinedb) (MIT). See `NOTICE.md`.
Code: MIT, see `LICENSE`. Built by Shahariar / Anvia Labs.


## Also in this version
- **Paracetamol meter**: adds up every paracetamol-containing brand across all prescriptions (1+1+1 style schedules) and shows the day's total against the 4,000 mg limit (3,000 mg at 65+).
- **Patient checks**: enter an age and a pregnancy flag to get label-based pregnancy-category (D/X) and 65+ NSAID/benzodiazepine cautions.
- **Daily timetable**: morning / noon / night grid built from the merged list.
- **Read aloud** in Bangla or English for patients who cannot read the screen easily.
