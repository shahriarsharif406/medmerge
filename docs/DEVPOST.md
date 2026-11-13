# Devpost project text — MedMerge

**Project name:** MedMerge
**Tagline:** Three doctors. One safe list. Catches the double dose hiding behind two brand names.

## Inspiration
In Bangladesh the same medicine is sold under dozens of brand names. Napa and Ace are both paracetamol; Seclo and Losectil are both omeprazole. A patient who sees three doctors in a month ends up with three prescriptions and no one comparing them. A double dose can hide behind two different names.

## What it does
MedMerge reads prescriptions (typed, or a photo scanned with Gemini), turns every brand into its active ingredient, merges them into one list, and flags what needs a second look: the same medicine under two names, hidden overlap inside combination medicines (Napa Extra contains paracetamol), two drugs of the same family, and interactions quoted from the drug label summary. It then writes the questions to ask the doctor. English and Bangla.

## How we built it
A pure-JavaScript engine (parser → brand/generic resolver with fuzzy matching for typos and OCR slips → ingredient/class/label-text comparison), unit-tested in Node, and a bilingual single-page UI. Data: 12,000+ Bangladeshi brands from the MIT-licensed wsayan/medicinedb. Photo scanning calls Gemini 2.5 Flash straight from the browser with the user's own key. It runs entirely client-side on GitHub Pages — no server, no stored patient data.

## Challenges
Label text is free-form, so we only trust class-level matches that are unambiguous and show the exact label sentence instead of paraphrasing it. We also grouped findings per problem so a patient sees four clear cards, not fifteen pair warnings.

## Accomplishments
A synthetic three-doctor case surfaces 4 overlaps and 3 questions in one screen; a clean list correctly shows no alarm.

## What we learned
Safety tools must say "ask", never "stop", and must show their source.

## What's next
Clinical validation with pharmacists, dose and age checks, offline mobile app, and a Bangla handwriting benchmark on the public Bangladeshi prescription datasets.

**Built with:** JavaScript, HTML/CSS, Google Gemini 2.5 Flash, GitHub Pages, Python (data build)
**Try it:** https://shahriarsharif406.github.io/medmerge/
**Code:** https://github.com/shahriarsharif406/medmerge
**Not medical advice.** Prototype; interaction text is not clinically validated.


## Also in this version
- **Paracetamol meter**: adds up every paracetamol-containing brand across all prescriptions (1+1+1 style schedules) and shows the day's total against the 4,000 mg limit (3,000 mg at 65+).
- **Patient checks**: enter an age and a pregnancy flag to get label-based pregnancy-category (D/X) and 65+ NSAID/benzodiazepine cautions.
- **Daily timetable**: morning / noon / night grid built from the merged list.
- **Read aloud** in Bangla or English for patients who cannot read the screen easily.
