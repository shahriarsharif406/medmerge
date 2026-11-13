# Third-party data

`data/medmerge-data.json` is derived from **wsayan/medicinedb** (https://github.com/wsayan/medicinedb),
MIT License, Copyright (c) 2021 Wahid Sadique Ayan. That database was compiled from public Bangladeshi
drug-index information (brands, generics, strengths, manufacturers, label summaries).
`scripts/build_data.py` shows exactly which fields are kept and how generic names are normalised.

Interaction wording shown in the app is quoted from those label summaries. It has not been clinically validated.
