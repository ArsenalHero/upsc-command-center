"""Build fingerprinted Mechanical study assets and update one subject in the catalog."""

import base64
from collections import Counter
import hashlib
import html
import io
import json

import fitz
from PIL import Image


def encoded(data):
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode()


def hashed(output, stem, suffix, content):
    name = f"{stem}-{hashlib.sha256(content).hexdigest()[:12]}.{suffix}"
    (output / name).write_bytes(content)
    return f"mechanical/{name}"


def topic_index(questions):
    topic_counts = {}
    for question in questions:
        subtopics = topic_counts.setdefault(question["topic"], Counter())
        subtopics[question["subtopic"]] += 1
    return [
        {
            "name": topic,
            "count": sum(subtopics.values()),
            "subtopics": [{"name": name, "count": count} for name, count in sorted(subtopics.items())],
        }
        for topic, subtopics in topic_counts.items()
    ]


def render_figures(document, directory, question, last_page):
    """Crop only reviewed figures. Coordinates are in the original PDF's points."""
    figures = []
    manifest = []
    number = question["number"]
    for index, figure in enumerate(question.get("figures", []), 1):
        page_number = figure["page"]
        assert 1 <= page_number <= last_page, f"Figure is outside the selected pages: Q{number}"
        page = document[page_number - 1]
        rectangle = fitz.Rect(figure["bbox"])
        placement = figure["placement"]
        assert placement in ("question", "explanation"), f"Invalid placement: Q{number}"
        assert (
            rectangle.width > 2 and rectangle.height > 2 and rectangle in page.rect
        ), f"Invalid diagram crop: Q{number}, {rectangle}"
        assert rectangle.get_area() < page.rect.get_area() * 0.4, f"Expected a diagram-only crop: Q{number}"
        alt = figure["alt"].strip()
        assert alt, f"Missing diagram description: Q{number}"
        pixels = page.get_pixmap(matrix=fitz.Matrix(4, 4), clip=rectangle, colorspace=fitz.csRGB)
        cropped = Image.frombytes("RGB", (pixels.width, pixels.height), pixels.samples)
        buffer = io.BytesIO()
        cropped.save(buffer, "WEBP", quality=93, method=6)
        data = base64.b64encode(buffer.getvalue()).decode()
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{pixels.width}" height="{pixels.height}"'
            f' viewBox="0 0 {pixels.width} {pixels.height}"><title>{html.escape(alt)}</title>'
            f'<image width="{pixels.width}" height="{pixels.height}" href="data:image/webp;base64,{data}"/></svg>'
        ).encode()
        fingerprint = hashlib.sha256(svg).hexdigest()[:10]
        filename = f'{question["id"]}-{placement}-{index}-{fingerprint}.svg'
        (directory / filename).write_bytes(svg)
        figures.append({
            "page": page_number, "bbox": list(rectangle), "placement": placement,
            "alt": alt, "url": f"mechanical/figures/{filename}",
        })
        manifest.append({
            "question": number, "id": question["id"], "page": page_number,
            "printedPage": page_number + 14, "bbox": list(rectangle), "placement": placement,
            "file": filename, "width": pixels.width, "height": pixels.height,
        })
    return figures, manifest


def update_catalog(output, subject, source):
    path = output / "catalog.json"
    previous = json.loads(path.read_text()) if path.exists() else {}
    subjects = {entry["id"]: entry for entry in previous.get("subjects", [])}
    # The original single-subject catalog stored its audit and source at the top level.
    engineering = subjects.get("engineering-mechanics")
    if engineering and "source" not in engineering:
        engineering["source"] = previous["sources"][0]
        for key in ("auditUrl", "auditDataUrl"):
            if key in previous:
                engineering[key] = previous[key]
    subjects[subject["id"]] = {**subject, "source": source}
    entries = list(subjects.values())
    catalog = {
        "version": hashlib.sha256(encoded(entries)).hexdigest()[:12],
        "total": sum(entry["count"] for entry in entries),
        **{key: sum(entry[key] for entry in entries) for key in ("reviewed", "corrected", "disputed")},
        "subjects": entries,
        "sources": [entry["source"] for entry in entries],
    }
    if engineering := subjects.get("engineering-mechanics"):
        for key in ("auditUrl", "auditDataUrl"):
            catalog[key] = engineering[key]
    path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")


def prune_subject_assets(output, data_patterns, figure_prefix, retained):
    """Remove stale versions of this subject; other Mechanical subjects share the directory."""
    for pattern in data_patterns:
        for old in output.glob(pattern):
            if f"mechanical/{old.name}" not in retained:
                old.unlink()
    for old in (output / "figures").glob(f"{figure_prefix}*.svg"):
        if f"mechanical/figures/{old.name}" not in retained:
            old.unlink()
