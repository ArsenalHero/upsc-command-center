"""Resumable source OCR for the selected scanned Engineering Mechanics PDF.

The cache retains every recognized word and its PDF-point geometry. Native
diagram pixels are never modified: rule removal is applied to OCR input only.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import time

import fitz
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SCALE = 4
_documents = {}


def union(boxes):
    return [min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes)]


def recognize_column(page, column):
    left, right = (70, 294.5) if column == "left" else (301.5, 526)
    top, bottom = 94.5, 747
    rect = fitz.Rect(left, top, right, bottom)
    pix = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), clip=rect, colorspace=fitz.csGRAY)
    gray = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width).copy()
    ink = gray < 170
    horizontal = ndi.maximum_filter1d(ndi.minimum_filter1d(ink, size=220, axis=1), size=220, axis=1)
    rows = np.flatnonzero(horizontal.sum(axis=1) > 100)
    runs = []
    for y in rows:
        if not runs or y > runs[-1][-1] + 1:
            runs.append([int(y)])
        else:
            runs[-1].append(int(y))
    rules = [round(top + sum(run) / len(run) / SCALE, 2) for run in runs]
    gray[ndi.binary_dilation(horizontal, iterations=1)] = 255
    gray[:, :8] = 255
    gray[:, -8:] = 255
    image = Image.fromarray(gray)
    encoded = io.BytesIO()
    image.save(encoded, format="PNG")
    env = dict(os.environ, OMP_THREAD_LIMIT="1")
    result = subprocess.run(["tesseract", "stdin", "stdout", "--psm", "3", "--dpi", "288", "-l", "eng", "tsv"],
                            input=encoded.getvalue(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, check=True)
    grouped = {}
    for row in csv.DictReader(io.StringIO(result.stdout.decode("utf-8")), delimiter="\t"):
        if row["level"] != "5" or not row.get("text", "").strip():
            continue
        confidence = float(row["conf"])
        if confidence < 0:
            continue
        x, y, w, h = (int(row[k]) for k in ("left", "top", "width", "height"))
        word = {"text": row["text"], "confidence": round(confidence, 2),
                "bbox": [round(left + x / SCALE, 2), round(top + y / SCALE, 2),
                         round(left + (x + w) / SCALE, 2), round(top + (y + h) / SCALE, 2)]}
        key = tuple(row[k] for k in ("block_num", "par_num", "line_num"))
        grouped.setdefault(key, []).append(word)
    lines = []
    for words in grouped.values():
        words.sort(key=lambda w: w["bbox"][0])
        box = union([w["bbox"] for w in words])
        lines.append({"text": " ".join(w["text"] for w in words), "bbox": box, "words": words,
                      "confidence": round(sum(w["confidence"] for w in words) / len(words), 2)})
    # PSM3 can emit a number-only block after a preceding answer paragraph.
    # Restore the physical reading order and reunite same-baseline fragments.
    merged = []
    for line in sorted(lines, key=lambda l: (l["bbox"][1], l["bbox"][0])):
        b = line["bbox"]
        near = next((old for old in reversed(merged[-5:])
                     if abs((old["bbox"][1] + old["bbox"][3]) / 2 - (b[1] + b[3]) / 2) <= 1.7
                     and abs((old["bbox"][3] - old["bbox"][1]) - (b[3] - b[1])) <= 4
                     and (old["bbox"][2] <= b[0] + 1 or b[2] <= old["bbox"][0] + 1)), None)
        if near:
            words = sorted(near["words"] + line["words"], key=lambda w: w["bbox"][0])
            near.update(text=" ".join(w["text"] for w in words), words=words,
                        bbox=union([w["bbox"] for w in words]),
                        confidence=round(sum(w["confidence"] for w in words) / len(words), 2))
        else:
            merged.append(line)
    merged.sort(key=lambda l: (l["bbox"][1], l["bbox"][0]))
    return {"column": column, "bbox": [left, top, right, bottom], "rules": rules, "lines": merged}


def process(job):
    pdf_path, page_number, destination, source_hash = job
    destination = Path(destination)
    if pdf_path not in _documents:
        _documents[pdf_path] = fitz.open(pdf_path)
    page = _documents[pdf_path][page_number - 1]
    started = time.time()
    data = {"page": page_number, "printedPage": page_number + 14,
            "width": page.rect.width, "height": page.rect.height, "sha256": source_hash,
            "columns": [recognize_column(page, col) for col in ("left", "right")]}
    temporary = destination.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False))
    temporary.replace(destination)
    return {"page": page_number, "printedPage": page_number + 14,
            "lines": sum(len(c["lines"]) for c in data["columns"]), "seconds": round(time.time() - started, 1)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--end-page", type=int)
    args = parser.parse_args()
    pdf = Path(args.pdf).resolve()
    output = Path(args.out).resolve()
    output.mkdir(parents=True, exist_ok=True)
    source_hash = hashlib.sha256(pdf.read_bytes()).hexdigest()
    document = fitz.open(pdf)
    assert len(document) == 142, "Only the selected 142-page Engineering Mechanics PDF is supported."
    assert source_hash == "7e5ed55860f7f23dee3d581c0e5c6df9932d716613a54a619789a14417709fc0"
    source = {"id": "engineering-mechanics", "title": "Engineering Mechanics", "file": pdf.name,
              "sha256": source_hash, "pages": len(document), "firstPrintedPage": 15, "lastPrintedPage": 156,
              "ocr": {"scale": SCALE, "psm": 3, "language": "eng", "ruleRemoval": "OCR input only", "coordinateUnits": "pdf-points"}}
    (output / "source.json").write_text(json.dumps(source, indent=2) + "\n")
    jobs = []
    for page in range(args.start_page, (args.end_page or len(document)) + 1):
        destination = output / f"{page:04d}.json"
        if destination.exists():
            try:
                cached = json.loads(destination.read_text())
                if cached.get("sha256") == source_hash and len(cached.get("columns", [])) == 2:
                    continue
            except (ValueError, OSError):
                pass
        jobs.append((str(pdf), page, str(destination), source_hash))
    print(json.dumps({"source": source, "pendingPages": len(jobs), "workers": args.workers}), flush=True)
    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        for done, future in enumerate(as_completed([executor.submit(process, job) for job in jobs]), 1):
            print(json.dumps({"completed": done, "pendingTotal": len(jobs), **future.result()}), flush=True)


if __name__ == "__main__":
    main()
