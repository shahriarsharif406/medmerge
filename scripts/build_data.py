#!/usr/bin/env python3
"""Build data/medmerge-data.json from the Bangladeshi medicine SQLite DB.

Source: github.com/wsayan/medicinedb (MIT, (c) 2021 Wahid Sadique Ayan), itself compiled from
public Bangladeshi drug-index data. Run:  python3 scripts/build_data.py path/to/medicine.db
"""
import json, re, sqlite3, sys

db = sqlite3.connect(sys.argv[1] if len(sys.argv) > 1 else "medicine.db")

SALTS = set("""hydrochloride hcl sodium potassium calcium magnesium trihydrate dihydrate monohydrate hemihydrate
anhydrous bp usp ip maleate besilate besylate mesylate tartrate succinate fumarate sulfate sulphate phosphate acetate
citrate bromide chloride nitrate oxalate lactate gluconate hydrobromide dipropionate propionate valerate bisulfate
bisulphate hydrogen disodium dipotassium pentahydrate sesquihydrate heptahydrate decahydrate micronized micronised
film coated enteric and of as""".split())

def keys_of(name):
    out = []
    for part in name.split("+"):
        part = re.sub(r"\(.*?\)", " ", part.lower())
        part = re.sub(r"[\d.%/]+\s*(mg|mcg|gm|g|ml|iu|%)?", " ", part)
        toks = [t for t in re.findall(r"[a-z][a-z\-]*", part) if t not in SALTS]
        if toks:
            out.append(" ".join(toks[:3]))
    return sorted(set(out))

GROUPS = [  # (group id, regex on therapeutic class name)
    ("NSAID", r"NSAID"), ("PPI", r"proton pump"), ("H2", r"H2 (receptor )?antagonist"),
    ("STATIN", r"^Statins"), ("ACEI", r"ACE\)"), ("ARB", r"Angiotensin-II receptor"),
    ("BETA", r"[Bb]eta[- ](adreno|blockers)|Beta-blockers|Beta blockers"),
    ("CCB", r"Calcium[- ]channel"), ("SSRI", r"SSRI"), ("BZD", r"Benzodiazepine (hypnotics|sedatives)"),
    ("OPIOID", r"^Opioid analgesics"), ("SU", r"Sulfonylureas"), ("ANTICOAG", r"anti-?coagulants"),
    ("ANTIPLT", r"[Aa]nti-platelet"), ("CORTICO", r"^Corticosteroid|^Glucocorticoids"),
    ("LOOPDIU", r"Loop diuretics"), ("THIAZ", r"Thiazide"), ("ANTIHIST", r"[Aa]nti-?histamine"),
    ("FLUOROQ", r"4-Quinolone"), ("MACROLIDE", r"Macrolides"), ("CEPH", r"Cephalosporins"),
    ("PENICILLIN", r"penicillin"), ("TRICYC", r"Tricyclic"),
]
cls_of = {}
for gid, cname in db.execute("select tg.generic_id, t.therapitic_name from therapitic_generic tg join therapitic t on t.therapitic_id=tg.therapitic_id"):
    for g, rx in GROUPS:
        if re.search(rx, cname, re.I):
            cls_of.setdefault(gid, set()).add(g)

preg = {pid: pname for pid, pname in db.execute("select pregnancy_id, pregnancy_name from pregnancy_category")}
generics = {}
for gid, name, inter, pc in db.execute("select generic_id, generic_name, interaction, pregnancy_category_id from generic"):
    generics[gid] = {
        "n": name.strip(),
        "k": keys_of(name),
        "g": sorted(cls_of.get(gid, [])),
        "i": (inter or "").strip(),
        "p": preg.get(pc, "") if preg.get(pc, "") != "Not Classified" else "",
    }
companies = {cid: n for cid, n, _ in db.execute("select company_id, company_name, company_order from company_name")}
brands = {}
for bid, gid, cid, bname, form, strength, price, pack in db.execute(
        "select brand_id, generic_id, company_id, brand_name, form, strength, price, packsize from brand"):
    if gid not in generics or not bname:
        continue
    key = re.sub(r"\s+", " ", bname.strip().lower())
    entry = [gid, (form or "").strip(), (strength or "").strip(), companies.get(cid, "")]
    lst = brands.setdefault(key, [])
    if entry not in lst:
        lst.append(entry)

# generics filed under "Non-opioid analgesics" that are NSAIDs
for gid, g in generics.items():
    if "ketorolac" in g["k"] and "tromethamine" in g["n"].lower() and "%" not in g["n"]:
        g["g"] = sorted(set(g["g"]) - {"OPIOID"} | {"NSAID"})

out = {"generics": generics, "brands": brands,
       "meta": {"source": "wsayan/medicinedb (MIT)", "brands": len(brands), "generics": len(generics)}}
with open("data/medmerge-data.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(out["meta"])
