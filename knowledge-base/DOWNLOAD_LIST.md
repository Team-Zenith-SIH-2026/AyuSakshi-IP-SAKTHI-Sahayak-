# Bucket B download list

India Code and CDSCO block automated access, so these have to be downloaded by hand.
Everything in Bucket A (international treaties) is already done and lives in
`knowledge-base/corpus/international.json`.

## Where to put them

Save every file into `knowledge-base/source/` using this naming pattern:

```
knowledge-base/source/<short-name>_<year>_<as-on-date>.pdf

e.g.  patents-act_1970_as-on-2025-10-01.pdf
      biological-diversity-act_2002_bare.pdf
      biological-diversity-amendment-act_2023.pdf
```

That directory is already mounted into the ai-service container at
`/app/knowledge-base`, so I can read the files as soon as they are there.

## Before you click download, two rules

1. **Prefer the version with an explicit "as on" date on its title page.** India Code
   often hosts several copies of the same act. The one dated most recently is the
   consolidated text. A copy without a date is usually the bare act as originally
   enacted, missing every amendment since.
2. **Note the "as on" date in the filename.** It becomes the `version_tag` in the
   corpus and is what makes the version-tracking claim real.

## Priority 1 — these unblock questions that currently fail

| Act | Why first | Link |
|---|---|---|
| Drugs and Magic Remedies (Objectionable Advertisements) Act, 1954 | Completely absent from the corpus. Brief question 6 ("Can I advertise my product as a cure for diabetes?") abstains today purely because of this. Need Section 3 and the Schedule | [195421.pdf](https://www.indiacode.nic.in/bitstream/123456789/1412/1/195421.pdf) |
| Drugs and Cosmetics Act, 1940 | The classification backbone. Need Chapter IVA, the ASU drug definition, and above all the **First Schedule** list of authoritative texts, which the brief calls the entry point to the whole classification tree | [a1940-23.pdf](https://www.indiacode.nic.in/bitstream/123456789/2409/1/a1940-23.pdf) or [the_drugs_and_cosmetics_act,_1940.pdf](https://www.indiacode.nic.in/bitstream/123456789/18562/1/the_drugs_and_cosmetics_act,_1940.pdf) — compare the two and take the one with the later "as on" date |
| Biological Diversity Act, 2002 | The ABS pillar. Need Sections 3, 4, 6, 7, 19 to 21 | [the_biological_diversity_act,_2002.pdf](https://www.indiacode.nic.in/bitstream/123456789/21545/1/the_biological_diversity_act,_2002.pdf) |
| Biological Diversity (Amendment) Act, 2023 | **Separate document.** The 2023 exemptions for codified traditional knowledge and registered AYUSH practitioners are the single most valuable thing in the corpus and are not in the 2002 act | Search India Code for "Biological Diversity (Amendment) Act, 2023" |
| Patents Act, 1970 | Sections 3(d), 3(e), 3(p), 2(1)(j), 10, 25, 64 | [A1970-39.pdf](https://www.indiacode.nic.in/bitstream/123456789/1392/1/A1970-39.pdf) — title page says "As on the 1st Oct, 2025" |

## Priority 2

| Act | Why | Link |
|---|---|---|
| Geographical Indications of Goods Act, 1999 | Brief question 9 abstains today. Need the GI definition, prohibited grounds, and who may be an authorised user | [a199948.pdf](https://www.indiacode.nic.in/bitstream/123456789/1981/1/a199948.pdf) |
| New Drugs and Clinical Trials Rules, 2019 | `eval_005` fails today because the phytopharmaceutical definition and its data package are not in the corpus. **CDSCO, not India Code** | cdsco.gov.in, Acts & Rules section |
| Trade Marks Act, 1999 | Section 9 absolute grounds for refusal. The brief flags descriptive and generic marks as a common failure for Sanskrit ingredient names | [a199947.pdf](https://www.indiacode.nic.in/bitstream/123456789/1993/1/a199947.pdf) — title page says "As on the 1st June, 2026" |
| FSSAI (Ayurveda Aahara) Regulations, 2022 | Definition, labelling and claim restrictions. **FSSAI, not India Code** | fssai.gov.in, Regulations section |

## Priority 3 — completeness, only if time allows

| Act | Why |
|---|---|
| Copyright Act, 1957 | Absent. Brief section 3.9. Explains what copyright can and cannot protect here |
| Designs Act, 2000 | Absent. Brief section 3.10. Packaging and container protection |
| Protection of Plant Varieties and Farmers' Rights Act, 2001 | Currently one paraphrased chunk |
| Biological Diversity Rules, 2024 | The operative rules replacing the 2004 rules |
| Drugs and Cosmetics Rules, 1945 | Rule 158-B licensing evidence requirements, Schedule T GMP |

## What happens once the files land

1. I check each PDF for a real text layer. Modern India Code PDFs are digitally
   generated, so extraction should be exact. If any turns out to be a scan I will
   say so rather than feed OCR noise into the corpus.
2. I extract verbatim text and chunk it along section boundaries, one section per
   chunk, never splitting mid-section.
3. I write it into `knowledge-base/corpus/india.json` in the same shape as
   `international.json`, replacing the paraphrased seed text.
4. I generate `knowledge-base/VERIFICATION_SHEET.md`: every chunk's recorded
   section number beside the opening line of its text, so the section numbering can
   be spot-checked in one pass instead of reading the whole corpus.

## Step 4 is not optional

The brief's corpus rule 4 says a human must confirm that each chunk's recorded
section number matches the text in that chunk. I can transcribe faithfully, but a
mislabelled section produces a confidently wrong citation, which is the worst
failure this system can have. The verification sheet exists to make that check
cheap, not to skip it.
