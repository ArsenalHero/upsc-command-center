# Engineering Mechanics source import

This importer is restricted to the selected 142-page PDF, printed pages 15–156.
Its SHA-256 is `7e5ed55860f7f23dee3d581c0e5c6df9932d716613a54a619789a14417709fc0`.
The byte-identical reattachment may have `(2)` in its filename. No other subject
PDF is processed.

The base has 807 sequential questions and ten printed chapters. Stable IDs use
`mech-engineering-mechanics-<printed-page>-<question-number>`. It preserves full
adjacent OCR explanations, dynamic lowercase answer options including `e`, source
exam labels, page provenance, and every source word's PDF-point geometry.

## Rebuild

Run from the repository root, replacing the source/cache paths as needed:

```sh
python app/scripts/mechanical/ocr.py \
  --pdf '/workspace/scratch/bc36f365e1f9/upload/MECH AE 01 FULL 35000-15-156(2).pdf' \
  --out /workspace/scratch/bc36f365e1f9/tmp/mechanical-ocr/engineering-mechanics \
  --workers 6

python app/scripts/mechanical/parse.py \
  --ocr /workspace/scratch/bc36f365e1f9/tmp/mechanical-ocr \
  --output app/scripts/mechanical/extracted \
  --subject engineering-mechanics

python app/scripts/mechanical/figures.py \
  --questions app/scripts/mechanical/extracted/engineering-mechanics.json \
  --reviews app/scripts/mechanical/reviewed \
  --supplement app/scripts/mechanical/engineering-mechanics-201-220-figures.json \
  --output app/scripts/mechanical/extracted/engineering-mechanics-diagrams.json
```

OCR version 3 uses grayscale at scale 4, Tesseract PSM3, and rule removal only on
OCR input. TSV is parsed with quoting disabled so printed quotation marks cannot
swallow subsequent records. Long edge rules are removed without whitening
question digits. Page caches are resumable and carry source hash/version checks.

The parser records physical reconciliation for merged/misread question numbers.
Sixteen difficult printed keys were visually checked on native PDF crops. The
source has 799 single-choice keys, one `c&d` marker at Q393, and seven asterisks at
Q108, Q278, Q298, Q301, Q437, Q495, and Q580. An asterisk is preserved as source
metadata and does not become a guessed answer.

The base remains `needs-review`: extraction does not verify the physics or repair
the source's mistakes. Curated review overlays provide independent transcriptions,
corrections, and references. Some source entries contain only an answer key or a
diagram, so the raw base explicitly flags absent written explanations/options.

Only explicit source-diagram crop metadata from the reviewed overlays is attached.
The supplement restores the final 27 manually checked Q201–220 crops from the
prior successful QC pass. Re-run the figure step when more review files are added.
Running the parser again resets its figure arrays, so the figure step follows it.
Optional `--pdf` and `--contacts` arguments on `figures.py` render crop contact
sheets for visual QC. It never converts a whole question or page into a photo.
