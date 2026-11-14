"""Prepare genuine source-diagram crops from source-checked review overlays.

The native PDF is byte-identical to the reviewed source, so its PDF-point crop
coordinates remain valid. This stage never turns text-only questions into photos
and never attaches an unreviewed automatic line-art proposal.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
import math
from pathlib import Path

import fitz
from PIL import Image, ImageDraw


def attach(data, review_files):
    by_id = {q["id"]: q for q in data["questions"]}
    assert len(by_id) == 807
    selected, provenance, issues = {}, {}, []
    for file in review_files:
        reviewed = json.loads(file.read_text())
        for item in reviewed.get("reviews", []):
            identifier = item.get("id")
            if "figures" not in item:
                continue
            if identifier not in by_id:
                issues.append({"file": str(file), "id": identifier, "issue": "diagram-owner-not-in-selected-base"})
                continue
            selected[identifier] = item["figures"]
            provenance[identifier] = str(file)
    output = []
    for q in data["questions"]:
        figures = []
        for index, raw in enumerate(selected.get(q["id"], []), 1):
            figure = dict(raw)
            page, box = figure.get("page"), figure.get("bbox")
            valid = (isinstance(page, int) and 1 <= page <= 142 and isinstance(box, list) and len(box) == 4
                     and all(isinstance(x, (int, float)) and math.isfinite(x) for x in box)
                     and 65 <= box[0] < box[2] <= 530 and 85 <= box[1] < box[3] <= 748
                     and figure.get("placement") in ("question", "explanation"))
            if not valid:
                issues.append({"file": provenance.get(q["id"]), "id": q["id"], "figure": index,
                               "issue": "invalid-native-source-crop", "sourceFigure": raw})
                continue
            figure["units"] = "pdf-points"
            figure.setdefault("column", "left" if box[0] < 300 else "right")
            figure.setdefault("alt", f"Engineering Mechanics question {q['number']} · original {figure['placement']} diagram")
            figures.append(figure)
            output.append({**figure, "questionId": q["id"], "questionNumber": q["number"], "printedPage": page + 14,
                           "reviewSource": provenance[q["id"]]})
        q["figures"] = figures
    audit = {"status": "source-checked-overlay-crops", "figures": len(output),
             "questionsWithDiagrams": sum(bool(q["figures"]) for q in data["questions"]),
             "questionsWithExplicitFigureReview": len(selected),
             "placements": dict(Counter(f["placement"] for f in output)),
             "reviewFiles": [str(p) for p in review_files], "issues": issues,
             "note": "Only explicit manual source-diagram crops are attached. Diagram owners retain responsibility for complete source coverage."}
    data["audit"]["diagrams"] = audit
    return data, {"source": data["source"], "figures": output, "audit": audit}


def render_contacts(metadata, pdf_file, directory):
    document = fitz.open(pdf_file)
    assert len(document) == 142
    directory.mkdir(parents=True, exist_ok=True)
    tiles = []
    for f in metadata["figures"]:
        pix = document[f["page"] - 1].get_pixmap(matrix=fitz.Matrix(3, 3), clip=fitz.Rect(f["bbox"]))
        image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        image.thumbnail((370, 225))
        tile = Image.new("RGB", (390, 265), "white")
        tile.paste(image, ((390 - image.width) // 2, 32))
        ImageDraw.Draw(tile).text((7, 7), f"Q{f['questionNumber']} p{f['printedPage']} {f['placement']}", fill="black")
        tiles.append(tile)
    for start in range(0, len(tiles), 24):
        batch = tiles[start:start + 24]
        sheet = Image.new("RGB", (1560, 265 * math.ceil(len(batch) / 4)), "#cbd5e1")
        for i, tile in enumerate(batch):
            sheet.paste(tile, ((i % 4) * 390, (i // 4) * 265))
        sheet.save(directory / f"contact-{start // 24 + 1:02d}.jpg", quality=92)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--questions", required=True)
    parser.add_argument("--reviews", required=True)
    parser.add_argument("--supplement", action="append", default=[])
    parser.add_argument("--output", required=True)
    parser.add_argument("--pdf")
    parser.add_argument("--contacts")
    args = parser.parse_args()
    files = sorted(Path(args.reviews).glob("*.json")) + [Path(p) for p in args.supplement]
    data = json.loads(Path(args.questions).read_text())
    content = [{k: v for k, v in q.items() if k != "figures"} for q in data["questions"]]
    data, metadata = attach(data, files)
    assert content == [{k: v for k, v in q.items() if k != "figures"} for q in data["questions"]]
    for path, value in ((Path(args.questions), data), (Path(args.output), metadata)):
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
        temporary.replace(path)
    if args.pdf and args.contacts:
        render_contacts(metadata, args.pdf, Path(args.contacts))
    print(json.dumps(metadata["audit"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
