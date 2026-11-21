"""Publish the complete uploaded Thermodynamics bank as reviewed text and diagrams."""

import argparse
from collections import Counter
import hashlib
import html
import json
from pathlib import Path
import re

import fitz

from publish import encoded, hashed, prune_subject_assets, render_figures, topic_index, update_catalog


DIRECTORY = Path(__file__).resolve().parent
OUTPUT = DIRECTORY.parents[1] / "public" / "mechanical"
SUBJECT = "thermodynamics"
TITLE = "Thermodynamics"
QUESTION_COUNT = 940
LAST_SOURCE_PAGE = 151
TOPICS = (
    (1, "Basic Concepts & Zeroth Law of Thermodynamics"),
    (303, "First Law of Thermodynamics"),
    (434, "Second Law of Thermodynamics"),
    (596, "Entropy"),
    (683, "Availability and Irreversibility"),
    (732, "Properties of Pure Substances, Gases and Gas Mixture"),
    (893, "Thermodynamic Relations"),
)
HTML_SOURCE = {
    "file": "Mechanical_Thermodynamics_940_Questions_FINAL_With_Explanations(1).html",
    "sha256": "184a26c92eb62efdcf6da1f8f049eab68e350d67b4a7e18d28236feb5016a11a",
    "questions": QUESTION_COUNT,
}
SOURCE = {
    "file": "MECH AE 02 FULL 35000-15-165.pdf",
    "sha256": "b7734b9ee9efc82e6b2fa960e8ebf0400f892fa6f19ecbed8bbe8a5ad8093c21",
    "pages": 151,
    "firstPrintedPage": 15,
    "lastPrintedPage": 165,
    "firstQuestion": 1,
    "lastQuestion": QUESTION_COUNT,
    "importedFrom": HTML_SOURCE,
}


def uploaded_questions(path):
    """Read the BANK JSON literal without executing any uploaded HTML or JavaScript."""
    content = path.read_bytes()
    assert hashlib.sha256(content).hexdigest() == HTML_SOURCE["sha256"], "Unexpected uploaded HTML."
    text = content.decode("utf-8-sig")
    marker = "const BANK = "
    start = text.index(marker) + len(marker)
    bank, _ = json.JSONDecoder().raw_decode(text[start:])
    assert [q["n"] for q in bank] == list(range(1, QUESTION_COUNT + 1)), "Incomplete uploaded bank."
    assert all(q["stem"].strip() and (q["explain"].strip() or q.get("aimg")) for q in bank), (
        "Missing uploaded source text and solution scan."
    )
    return bank


def reviewed_questions():
    reviews = []
    for path in sorted((DIRECTORY / "reviewed").glob("thermodynamics-*-review.json")):
        document = json.loads(path.read_text())
        assert document["subjectId"] == SUBJECT, f"Wrong subject in {path.name}"
        reviews.extend(document["reviews"])
    questions = sorted(reviews, key=lambda question: question["number"])
    assert [q["number"] for q in questions] == list(range(1, QUESTION_COUNT + 1)), (
        f"Expected all {QUESTION_COUNT} questions in order, including their complete source explanations."
    )
    return questions


def question_record(review):
    number = review["number"]
    status = review["status"]
    options = review["options"]
    answer = review["answer"]
    printed_marker = review["sourceAnswer"]
    match = re.fullmatch(r"\(?([a-f])\)?", (printed_marker or "").strip(), re.IGNORECASE)
    source_answer = match[1].lower() if match else printed_marker
    provenance = review["source"]
    first_page, last_page = provenance["page"], provenance["pageEnd"]
    assert 1 <= first_page <= last_page <= LAST_SOURCE_PAGE, f"Invalid source pages: Q{number}"
    assert review["transcriptionReviewed"] is True, f"Unreconciled source text: Q{number}"
    assert review["topic"] == next(title for first, title in reversed(TOPICS) if number >= first), (
        f"Use the printed section boundary: Q{number}"
    )
    for field in ("question", "explanation", "topic", "subtopic", "note"):
        assert review[field].strip(), f"Missing {field}: Q{number}"
    assert status in ("verified", "corrected", "disputed"), f"Unknown review status: Q{number}"
    assert review["references"] and all(
        ref["title"].strip() and ref["url"].startswith("https://") for ref in review["references"]
    ), f"Missing primary references: Q{number}"
    if review.get("optionsUnavailable"):
        assert not options and status == "disputed", f"Unresolved or incomplete choices: Q{number}"
    else:
        assert 2 <= len(options) <= 6 and list(sorted(options)) == list("abcdef"[:len(options)]), (
            f"Reconcile the supplied choices: Q{number}"
        )
        assert all(text.strip() for text in options.values()), f"Blank choice: Q{number}"
    if status == "disputed":
        assert answer is None, f"Disputed questions must be ungraded: Q{number}"
    else:
        assert answer in options, f"No reviewed choice: Q{number}"
        assert sum(value.strip() == options[answer].strip() for value in options.values()) == 1, (
            f"Duplicate correct choice: Q{number}"
        )
        if status == "verified":
            assert answer == source_answer, f"Mark a changed answer as corrected: Q{number}"
    if status != "verified":
        assert review["sourceExplanation"].strip(), f"Preserve the full printed explanation: Q{number}"

    question = {
        **{key: review[key] for key in ("number", "topic", "subtopic", "question", "answer", "explanation")},
        "id": f"mech-{SUBJECT}-{first_page + 14}-{number}",
        "subjectId": SUBJECT,
        "subject": TITLE,
        "options": dict(sorted(options.items())),
        "sourceAnswer": source_answer,
        "source": {
            **provenance, "file": SOURCE["file"], "sha256": SOURCE["sha256"],
            "printedPage": first_page + 14, "printedPageEnd": last_page + 14,
        },
        "review": {"status": status, "note": review["note"], "references": review["references"]},
        "figures": review["figures"],
    }
    for key in ("sourceExplanation", "sourceAnswerMarker", "optionsUnavailable"):
        if key in review:
            question[key] = review[key]
    if printed_marker != source_answer:
        question.setdefault("sourceAnswerMarker", printed_marker)
    return question


def write_audit(questions, counts, figures, uploaded):
    scope = "All 940 uploaded Thermodynamics questions, reconciled with printed pages 15–165 of the source scans."
    audit = {
        "scope": scope, "source": SOURCE, "questions": len(questions), "expectedQuestions": QUESTION_COUNT,
        "independentlyExamined": len(questions), "fullyTranscribed": len(questions),
        "reviewCounts": dict(counts), "diagrams": len(figures),
        "uploadReconciliation": {
            "source": HTML_SOURCE,
            "questionNumbers": [q["n"] for q in uploaded],
            "explanationsReconstructedFromScan": [q["n"] for q in uploaded if not q["explain"].strip()],
            "fullQuestionPhotosPublished": 0,
            "fullExplanationPhotosPublished": 0,
        },
        "issues": [
            {
                "question": q["number"], "id": q["id"], "printedPage": q["source"]["printedPage"],
                "status": q["review"]["status"], "printedAnswer": q["sourceAnswer"], "reviewedAnswer": q["answer"],
                "note": q["review"]["note"], "references": q["review"]["references"],
            }
            for q in questions if q["review"]["status"] != "verified"
        ],
    }
    data_url = hashed(
        OUTPUT, f"{SUBJECT}-review-audit", "json",
        json.dumps(audit, ensure_ascii=False, indent=2).encode(),
    )
    rows = "\n".join(
        f'<tr><td>{q["number"]}</td><td>{html.escape(q["subtopic"])}</td>'
        f'<td>{html.escape(q["review"]["status"])}</td><td>{html.escape(q["review"]["note"])}</td>'
        f'<td>{q["source"]["printedPage"]}</td></tr>'
        for q in questions
    )
    report = f"""<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thermodynamics source and review audit</title>
<style>
body {{ font: 1rem/1.65 system-ui, sans-serif; max-width: 74rem; margin: 2rem auto; padding: 0 1rem; color: #223647; }}
table {{ border-collapse: collapse; width: 100%; }}
td, th {{ padding: .65rem; border-bottom: 1px solid #d9e0e6; text-align: left; vertical-align: top; }}
th {{ background: #edf2f5; }} .table-wrap {{ overflow: auto; }}
</style>
<h1>Thermodynamics source and review audit</h1>
<p>{scope}</p>
<p>{counts["verified"]} reference-reviewed · {counts["corrected"]} corrected · {counts["disputed"]} disputed.</p>
<p>Disputed answers stay out of automatic scoring. Questions with corrections include their complete printed explanations.</p>
<p><a href="{Path(data_url).name}">Detailed review data and references</a></p>
<div class="table-wrap"><table>
<thead><tr><th>Question</th><th>Subtopic</th><th>Review</th><th>Review note</th><th>Printed page</th></tr></thead>
<tbody>{rows}</tbody>
</table></div>
</html>
"""
    report_url = hashed(OUTPUT, f"{SUBJECT}-review-audit", "html", report.encode())
    return report_url, data_url


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--html", required=True, type=Path)
    arguments = parser.parse_args()
    pdf = arguments.pdf
    assert hashlib.sha256(pdf.read_bytes()).hexdigest() == SOURCE["sha256"], "Unexpected Thermodynamics PDF."
    uploaded = uploaded_questions(arguments.html)

    questions = [question_record(review) for review in reviewed_questions()]
    assert questions[0]["source"]["page"] == 1
    assert questions[-1]["source"]["page"] == LAST_SOURCE_PAGE
    assert questions[-1]["source"]["pageEnd"] == LAST_SOURCE_PAGE
    directory = OUTPUT / "figures"
    directory.mkdir(parents=True, exist_ok=True)
    manifest = []
    with fitz.open(pdf) as document:
        assert len(document) == SOURCE["pages"]
        for question in questions:
            assert all(
                question["source"]["page"] <= figure["page"] <= question["source"]["pageEnd"]
                for figure in question["figures"]
            ), f'Diagram is outside Q{question["number"]} provenance'
            question["figures"], figures = render_figures(document, directory, question, LAST_SOURCE_PAGE)
            manifest.extend(figures)

    counts = Counter(q["review"]["status"] for q in questions)
    subject_url = hashed(OUTPUT, SUBJECT, "json", encoded({
        "subjectId": SUBJECT, "subject": TITLE, "title": TITLE, "source": SOURCE, "questions": questions,
    }))
    report_url, audit_url = write_audit(questions, counts, manifest, uploaded)
    update_catalog(OUTPUT, {
        "id": SUBJECT, "title": TITLE, "url": subject_url, "count": len(questions),
        "reviewed": counts["verified"], "corrected": counts["corrected"], "disputed": counts["disputed"],
        "topics": topic_index(questions), "auditUrl": report_url, "auditDataUrl": audit_url,
    }, SOURCE)
    prune_subject_assets(
        OUTPUT, (f"{SUBJECT}-*.json", f"{SUBJECT}-review-audit-*.html"), f"mech-{SUBJECT}-",
        {subject_url, report_url, audit_url} | {f"mechanical/figures/{f['file']}" for f in manifest},
    )
    print(json.dumps({"questions": len(questions), "reviewCounts": dict(counts), "diagrams": len(manifest), "url": subject_url}))


if __name__ == "__main__":
    main()
