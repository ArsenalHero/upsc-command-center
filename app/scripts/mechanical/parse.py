"""Recover the full Engineering Mechanics question/explanation stream.

Source OCR and all physical lines remain auditable. No answer is semantically
verified here; independent review overlays reconcile scan mathematics and keys.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import re
from pathlib import Path
from statistics import median

ANSWER = re.compile(r"^[\s|\[\]{}]*(?:Ans(?:wer)?|ANS|Answer)[\s.,:;]*\(\s*([^\s()]{1,6})\s*\)[\s:;.,-]*")
PARTIAL_ANSWER = re.compile(r"^[\s|\[\]{}]*(?:ns|ms|s)[\s.,:;]*[.,:;][\s.,:;]*\(\s*([^\s()]{1,6})\s*\)[\s:;.,-]*", re.I)
OPTION = re.compile(r"(?<![A-Za-z])\(([a-e])\)\s*")  # Lowercase only: Assertion (A) is not an option.
PREFIX = re.compile(r"^\s*([0-9OIlLS|]{1,4})(?:[.,):;]\s*|\s+)(.*)$")
DIGITS = str.maketrans({"O": "0", "I": "1", "l": "1", "L": "1", "|": "1", "S": "5"})
EXAM = re.compile(r"\b(?:UPSC|UPPSC|UKPSC|BPSC|MPSC|APPSC|CGPSC|MPPSC|OPSC|RPSC|TNPSC|GPSC|HPSC|JKPSC|JPSC|KPSC|WBPSC|HPPSC|PPSC|JWM|RRB|SSC|ISRO|DRDO|BHEL|SAIL|ONGC|UPPCL|UPRVUNL|DDA|DMRC|NLC|NPCIL|PTCUL|CSE|EIL|NTPC|NHPC|GATE|ESE|IES|[A-Za-z]+\s+PSC|Oil\s+India|Vizag\s+Steel|TSPSC|UPSSSC|APSC|DSSSB|CIL)\b", re.I)

TOPICS = [
    (15, "left", "Forces and Force Systems", r"forces?\s+(?:and|&)\s+force"),
    (46, "left", "Moments and Couples", r"moments?\s+(?:and|&)\s+couples?"),
    (49, "right", "Friction", r"friction"),
    (67, "right", "Centroid, Centre of Gravity & Moment of Inertia", r"centroid|centre\s+of\s+gravity"),
    (81, "right", "Trusses and Beams", r"trusses|truss.*beams"),
    (95, "left", "Kinematics and Kinetics of Particles & Rigid Body", r"kinematics|kinetics\s+of"),
    (117, "left", "Work, Power and Energy", r"work.*power|power.*energy"),
    (127, "right", "Principle of Virtual Work & Simple Machines", r"virtual\s+work|simple\s+machines"),
    (131, "right", "Impulse, Momentum and Collision", r"impulse|momentum.*(?:impact|collision)"),
    (145, "left", "Simple Harmonic Motion and Projectile Motion", r"simple\s+harmonic|projectile\s+motion"),
]

# Native source-key crops were visually checked on the SHA-identified PDF. The
# asterisk is an explicit non-choice source marker, not an OCR-invented answer.
SOURCE_KEYS = {
    32: ("b", 6, "right", 98.5), 106: ("c", 19, "right", 642),
    108: ("*", 20, "right", 98.5), 158: ("c", 30, "right", 278.75),
    249: ("d", 46, "left", 339), 278: ("*", 52, "left", 531.25),
    293: ("c", 54, "right", 331), 298: ("*", 55, "left", 509),
    301: ("*", 56, "left", 98), 352: ("b", 64, "right", 614),
    393: ("c&d", 71, "right", 518.75), 405: ("c", 75, "right", 280),
    437: ("*", 82, "left", 165), 495: ("*", 91, "left", 672.75),
    580: ("*", 106, "left", 488), 785: ("c", 138, "left", 479),
}


def heading_windows(column, spec=None):
    """Locate printed title bars using title words and their rule pair."""
    specs = [spec] if spec else TOPICS
    results = []
    for item in specs:
        title, pattern = item[2:]
        candidates = []
        for line in column["lines"]:
            if not re.search(pattern, line["text"], re.I):
                continue
            hs = [w["bbox"][3] - w["bbox"][1] for w in line["words"] if re.search(r"[A-Za-z]{3}", w["text"])]
            if hs and median(hs) >= 9.4:
                candidates.append(line)
        if not candidates:
            continue
        # A box serial can be one erroneous tall OCR word spanning the first
        # question number. Use the actual title words, not that merged line box.
        words = [w for line in candidates for w in line["words"]
                 if re.search(r"[A-Za-z]{3}", w["text"]) and w["confidence"] >= 60
                 and 9.4 <= w["bbox"][3] - w["bbox"][1] <= 17]
        if not words:
            continue
        y0, y1 = min(w["bbox"][1] for w in words), max(w["bbox"][3] for w in words)
        rules = column.get("rules", [])
        before = [y for y in rules if y <= y0 + 2 and y >= y0 - 25]
        after = [y for y in rules if y >= y1 - 2 and y <= y1 + 40]
        start = min(before[-2:] or [y0 - 2])
        end = min(after or [y1 + 2])
        results.append((round(start, 2), round(max(end, y1 + 1), 2), title))
    return results


def load_lines(directory):
    source = json.loads((directory / "source.json").read_text())
    lines, headings, pages = [], [], []
    current_topic = TOPICS[0][2]
    for file in sorted(directory.glob("[0-9][0-9][0-9][0-9].json")):
        page = json.loads(file.read_text())
        if page.get("ocrVersion") != 3:
            continue
        pages.append(page["page"])
        for column in page["columns"]:
            spec = next((s for s in TOPICS if s[0] == page["printedPage"] and s[1] == column["column"]), None)
            windows = heading_windows(column, spec) if spec else []
            if spec and not windows:
                # The source boundary is known even if an ornate heading is unreadable.
                windows = [(94.5, 94.5, spec[2])]
            for a, b, title in windows:
                headings.append({"page": page["page"], "printedPage": page["printedPage"],
                                 "column": column["column"], "bbox": [column["bbox"][0], a, column["bbox"][2], b], "title": title})
            pending = list(sorted(windows))
            for raw in sorted(column["lines"], key=lambda l: (l["bbox"][1], l["bbox"][0])):
                y = raw["bbox"][1]
                while pending and y >= pending[0][0]:
                    current_topic = pending.pop(0)[2]
                if page["page"] == 1 and y < 167:
                    continue
                if y >= 747 or any(a - .5 <= (y + raw["bbox"][3]) / 2 <= b + .5 for a, b, title in windows):
                    continue
                lines.append({**raw, "page": page["page"], "printedPage": page["printedPage"],
                              "column": column["column"], "topic": current_topic})
    return source, lines, headings, pages


def possible_anchor(line):
    # These source numbers are merged into ornate heading/border glyphs or
    # misrecognized as letters. Their physical locations and printed sequence
    # were reconciled against the identical original PDF and reviewed records.
    reconciled = [(72, "right", 405.5, 318, "blank"), (81, "right", 686.0, 370, "verbatim"),
                  (114, "left", 240.25, 541, "blank"), (139, "right", 438.0, 711, "verbatim")]
    for page, column, y, number, mode in reconciled:
        if line["printedPage"] == page and line["column"] == column and abs(line["bbox"][1] - y) < .7:
            body = line["text"]
            if mode == "blank":
                body = re.sub(r"^\S+\s+\S+\s*", "________ ", body, count=1)
            return {"number": number, "text": body,
                    "reconciled": f"Source question {number} reconciled against printed p{page} {column} and adjacent reviewed sequence."}
    left = 70 if line["column"] == "left" else 301.5
    first_word = min(line["words"], key=lambda w: w["bbox"][0])
    if line["bbox"][0] > left + 7 or first_word["bbox"][3] - first_word["bbox"][1] > 11.5:
        return None
    if line["printedPage"] == 16 and line["column"] == "left" and 607 <= line["bbox"][1] <= 613:
        match = PREFIX.match(line["text"])
        body = match[2] if match else re.sub(r"^\S+\s*", "", line["text"], count=1)
        return {"number": 7, "text": body, "reconciled": "Source number 7 visually reconciled at printed p16 left."}
    if line["printedPage"] == 66 and line["column"] == "left" and 330 <= line["bbox"][1] <= 335:
        body = re.sub(r"^\S+\s*", "", line["text"], count=1)
        body = re.sub(r"^\S*\s*(?=provides)", "________ ", body, flags=re.I)
        return {"number": 277, "text": body, "reconciled": "Source number 277 visually reconciled at printed p66 left."}
    match = PREFIX.match(line["text"])
    if not match:
        return None
    number = int(match[1].translate(DIGITS))
    if not 1 <= number <= 807:
        return None
    return {"number": number, "text": match[2], "printedPrefix": match[1]}


def span_quality(lines):
    before = []
    found = False
    for line in lines:
        if ANSWER.match(line["text"]):
            found = True
            break
        before.append(line["text"])
    options = set(OPTION.findall("\n".join(before)))
    return 1.5 * min(4, len(options)) + 3 * found + min(1, len(" ".join(before)) / 90)


def select_anchors(lines):
    candidates = []
    for i, line in enumerate(lines):
        anchor = possible_anchor(line)
        if anchor:
            candidates.append({**anchor, "index": i, "line": line})
    scores, previous = [], []
    qualities = {}
    for i, item in enumerate(candidates):
        n = item["number"]
        best = 3.0 - 6 * (n - 1) if n <= 4 else -1e9
        parent = None
        for j in range(max(0, i - 35), i):
            old = candidates[j]
            gap = n - old["number"]
            if not 1 <= gap <= 10:
                continue
            key = (j, i)
            quality = qualities.setdefault(key, span_quality(lines[old["index"]:item["index"]]))
            value = scores[j] + quality + 2 - 5 * (gap - 1)
            if value > best:
                best, parent = value, j
        scores.append(best)
        previous.append(parent)
    if not candidates:
        return [], candidates
    last = max(range(len(candidates)), key=lambda i: (candidates[i]["number"], scores[i]) if scores[i] > -1e8 else (-1, -1e9))
    chosen = []
    while last is not None:
        chosen.append(candidates[last])
        last = previous[last]
    return list(reversed(chosen)), candidates


def subtopic(topic, text):
    text = text.lower()
    rules = {
        TOPICS[0][2]: [(r"lami", "Lami’s Theorem"), (r"varignon", "Varignon’s Theorem"), (r"transmissib", "Principle of Transmissibility"),
                        (r"coplanar|concurrent|collinear", "Types of Force Systems"), (r"resol|component", "Resolution of Forces"),
                        (r"resultant|parallelogram|triangle law|polygon", "Composition and Resultants"), (r"equilibri", "Equilibrium of Forces"),
                        (r"free.body", "Free-body Diagrams"), (r"dimension|unit", "Force and Moment Dimensions")],
        TOPICS[1][2]: [(r"couple", "Couples and Couple Moments"), (r"equilibri", "Moment Equilibrium"), (r"varignon", "Varignon’s Theorem"),
                        (r"moment|torque", "Moments of Forces")],
        TOPICS[2][2]: [(r"repose", "Angle of Repose"), (r"ladder", "Ladder Friction"), (r"rolling|steel wheel|rolling resistance", "Rolling Resistance"),
                        (r"rope|belt|shaft|capstan|wrapped", "Belt and Rope Friction"), (r"inclined|incline|slope", "Inclined-plane Friction"),
                        (r"time graph|force.time|increasing linearly", "Friction under Variable Loading"), (r"position vector|in xy|moment.*origin", "Force Resolution and Moments"),
                        (r"block|box", "Block Friction"), (r"limiting|kinetic|dynamic|static", "Static and Kinetic Friction")],
        TOPICS[3][2]: [(r"parallel.axis", "Parallel-axis Theorem"), (r"perpendicular.axis", "Perpendicular-axis Theorem"),
                        (r"gyration", "Radius of Gyration"), (r"composite|combined|built.up", "Composite Sections"),
                        (r"moment of inertia|second moment|polar", "Area and Mass Moments of Inertia"), (r"gravity|c.g.|centre of mass", "Centre of Gravity"),
                        (r"centroid|triangle|semicircle|quadrant|rectangle", "Centroids of Plane Figures")],
        TOPICS[4][2]: [(r"zero.force|zero force", "Zero-force Members"), (r"determin|stable|stability|redundant", "Determinacy and Stability"),
                        (r"joint", "Method of Joints"), (r"section", "Method of Sections"), (r"reaction|support", "Support Reactions"),
                        (r"beam|frame", "Frames and Beams"), (r"member|truss", "Forces in Truss Members")],
        TOPICS[5][2]: [(r"alembert|inertia force", "D’Alembert’s Principle"), (r"pulley|connected|two masses", "Connected Bodies and Pulleys"),
                        (r"brak|stopp", "Braking and Stopping"), (r"velocity.time|acceleration.time|displacement.time|time graph", "Motion Graphs"),
                        (r"relative", "Relative Motion"), (r"circular|centripetal|centrifugal|angular|rotat", "Circular and Rotational Motion"),
                        (r"newton|force.*mass|lift|elevator", "Newton’s Laws of Motion"), (r"accelerat|velocity|distance|speed", "Rectilinear Motion")],
        TOPICS[6][2]: [(r"spring|elastic", "Spring Potential Energy"), (r"lift|elevat|crane", "Work against Gravity"),
                        (r"efficien|power|kilowatt|horsepower", "Power and Efficiency"), (r"rolling|rolls|disc|disk|flywheel", "Rolling and Rotational Energy"),
                        (r"conserv|potential|kinetic", "Conservation of Mechanical Energy"), (r"work.energy|work done|work required", "Work and the Work–Energy Theorem")],
        TOPICS[7][2]: [(r"virtual", "Principle of Virtual Work"), (r"revers|self.lock", "Reversibility and Self-locking"),
                        (r"law of|p =|effort.*load", "Law of a Machine"), (r"efficien", "Efficiency of Simple Machines"),
                        (r"mechanical advantage|velocity ratio|machine", "Mechanical Advantage and Velocity Ratio")],
        TOPICS[8][2]: [(r"recoil|bullet|gun", "Recoil and Momentum Conservation"), (r"rocket|propul", "Variable-mass Motion"),
                        (r"restitution|coefficient.*e", "Coefficient of Restitution"), (r"oblique|inclined.*impact", "Oblique Impact"),
                        (r"collision|impact|collide", "Direct Impact and Collisions"), (r"impulse", "Impulse–Momentum Principle"),
                        (r"momentum", "Conservation of Linear Momentum")],
        TOPICS[9][2]: [(r"pendulum", "Pendulums"), (r"projectile|projection|projected|trajectory", "Projectile Motion"),
                        (r"range|maximum height|horizontal.*velocity", "Projectile Range, Height and Velocity"), (r"circular|circle|rotat", "Circular Motion and SHM"),
                        (r"energy|kinetic|potential", "Energy in Simple Harmonic Motion"), (r"harmonic|s.h.m|shm|oscillat|time period|frequency", "Simple Harmonic Motion")],
    }
    for pattern, label in rules.get(topic, []):
        if re.search(pattern, text):
            return label
    return {TOPICS[0][2]: "Composition and Equilibrium of Forces", TOPICS[1][2]: "Moments and Couples",
            TOPICS[2][2]: "Dry Friction", TOPICS[3][2]: "Centroids and Moments of Inertia", TOPICS[4][2]: "Truss and Beam Analysis",
            TOPICS[5][2]: "Particle and Rigid-body Dynamics", TOPICS[6][2]: "Work and Energy", TOPICS[7][2]: "Simple Machines",
            TOPICS[8][2]: "Impulse and Momentum", TOPICS[9][2]: "Simple Harmonic and Projectile Motion"}[topic]


def extract_question(anchor, block, source):
    content = [{**line} for line in block]
    content[0]["text"] = anchor["text"]
    answer_index = next((i for i, line in enumerate(content) if ANSWER.match(line["text"])), None)
    answer_match = ANSWER.match(content[answer_index]["text"]) if answer_index is not None else None
    recovered_boundary = None
    if answer_index is None:
        answer_index = next((i for i, line in enumerate(content) if PARTIAL_ANSWER.match(line["text"])), None)
        if answer_index is not None:
            answer_match = PARTIAL_ANSWER.match(content[answer_index]["text"])
            recovered_boundary = "partial-answer-label"
    if answer_index is None:
        option_lines = [i for i, line in enumerate(content) if OPTION.search(line["text"])]
        after = min(option_lines) if option_lines else 1
        exams = [i for i, line in enumerate(content) if i > after and EXAM.search(line["text"])]
        if exams:
            first_exam = exams[0]
            last_exam = first_exam
            while last_exam + 1 < len(content) and EXAM.search(content[last_exam + 1]["text"]):
                last_exam += 1
            if last_exam + 1 < len(content):
                answer_index = last_exam + 1
                recovered_boundary = "explanation-after-source-exam-labels"
        if answer_index is None:
            last_option = max(option_lines) if option_lines else 2
            for i, line in enumerate(content):
                left = 70 if line["column"] == "left" else 301.5
                if i > last_option and line["bbox"][0] <= left + 8 and re.search(r"[A-Za-z]{4}", line["text"]):
                    answer_index = i
                    recovered_boundary = "left-aligned-explanation-paragraph"
                    break
    answer_raw = answer_match[1].lower() if answer_match else None
    source_key_reconciliation = None
    if anchor["number"] in SOURCE_KEYS:
        answer_raw, key_page, key_column, key_y = SOURCE_KEYS[anchor["number"]]
        source_key_reconciliation = {"method": "native-pdf-visual-check", "page": key_page,
                                     "printedPage": key_page + 14, "column": key_column, "y": key_y,
                                     "printedMarker": answer_raw}
    answer = answer_raw if answer_raw in tuple("abcde") else None
    pre = content[:answer_index] if answer_index is not None else content
    explanation_lines = content[answer_index:] if answer_index is not None else []
    exam_labels, pre_text, pre_lines = [], [], []
    for line in pre:
        text = line["text"]
        exam = EXAM.search(text)
        if exam and (line["bbox"][0] >= (70 if line["column"] == "left" else 301.5) + 25 or not OPTION.search(text)):
            if pre_text and any(OPTION.search(t) for t in pre_text):
                tail = text[exam.start():].strip()
                exam_labels.append(tail)
                text = text[:exam.start()].strip()
        if text:
            pre_text.append(text)
            pre_lines.append({**line, "text": text})
    joined = "\n".join(pre_text).strip()
    markers = list(OPTION.finditer(joined))
    question = joined[:markers[0].start()].strip() if markers else joined
    options = {}
    for i, marker in enumerate(markers):
        end = markers[i + 1].start() if i + 1 < len(markers) else len(joined)
        value = joined[marker.end():end].strip()
        key = marker[1]
        if key in options:
            options[key] += "\n(" + key + ") " + value
        else:
            options[key] = value
    if explanation_lines:
        explanation_lines = [{**line} for line in explanation_lines]
        if answer_match:
            explanation_lines[0]["text"] = explanation_lines[0]["text"][answer_match.end():]
    explanation = "\n".join(line["text"].strip(" |") for line in explanation_lines if line["text"].strip(" |")).strip()
    issues = []
    if len(options) < 4:
        issues.append("fewer-than-four-recognized-options")
    if any(not value.strip() for value in options.values()):
        issues.append("empty-option-text-or-diagram-only-option")
    if answer is None:
        issues.append("source-answer-asterisk" if answer_raw == "*" else
                      "source-multiple-answer-marker" if answer_raw and "&" in answer_raw else "answer-marker-unreadable")
    elif answer not in options:
        issues.append("answer-option-not-recognized")
    if not explanation:
        issues.append("explanation-unreadable-or-diagram-only")
    if recovered_boundary:
        issues.append("answer-boundary-recovered-needs-source-review")
    confidence = sum(line["confidence"] for line in content) / max(1, len(content))
    if confidence < 80:
        issues.append("low-ocr-confidence")
    if re.search(r"[=√∑∫]|\b(?:sin|cos|tan)\b", question + " " + explanation):
        issues.append("mathematical-transcription-needs-review")
    first, last = content[0], content[-1]
    number = anchor["number"]
    identifier = f"mech-engineering-mechanics-{first['printedPage']}-{number}"
    source_lines = []
    for i, line in enumerate(content):
        source_lines.append({k: line[k] for k in ("page", "column", "bbox", "confidence", "text", "words")})
        source_lines[-1]["placement"] = "explanation" if answer_index is not None and i >= answer_index else "question"
    return {
        "id": identifier, "number": number, "question": question, "options": options,
        "sourceAnswer": answer_raw if answer_raw and re.fullmatch(r"[a-e](?:&[a-e])*", answer_raw) else None,
        "answer": answer, "explanation": explanation,
        "topic": first["topic"], "subtopic": subtopic(first["topic"], question + " " + explanation[:150]),
        "source": {"file": source["file"], "page": first["page"], "pageEnd": last["page"], "printedPage": first["printedPage"],
                   "printedPageEnd": last["printedPage"], "sha256": source["sha256"], "examLabels": exam_labels},
        "review": {"status": "needs-review", "note": "OCR extraction retains the full adjacent source explanation. Scan mathematics, diagrams and answer keys require independent source review.", "references": []},
        "figures": [],
        "transcription": {"issues": issues, "meanConfidence": round(confidence, 2), "sourceAnswerMarker": answer_raw,
                          "explanationBoundaryRecovery": recovered_boundary,
                          "sourceKeyReconciliation": source_key_reconciliation,
                          "numberReconciliation": anchor.get("reconciled"), "sourceLines": source_lines},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ocr", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--subject", default="engineering-mechanics", choices=["engineering-mechanics"])
    args = parser.parse_args()
    root = Path(args.ocr)
    directory = root / args.subject if (root / args.subject).exists() else root
    source, lines, headings, pages = load_lines(directory)
    anchors, candidates = select_anchors(lines)
    questions = []
    for i, anchor in enumerate(anchors):
        end = anchors[i + 1]["index"] if i + 1 < len(anchors) else len(lines)
        questions.append(extract_question(anchor, lines[anchor["index"]:end], source))
    numbers = {q["number"] for q in questions}
    missing = [n for n in range(1, 808) if n not in numbers]
    data = {"subjectId": "engineering-mechanics", "subject": "Engineering Mechanics", "title": "Engineering Mechanics", "source": source,
            "questions": questions, "audit": {"total": len(questions), "expectedLastQuestion": 807, "pagesProcessed": len(pages),
            "expectedPages": 142, "completeSourceCoverage": len(pages) == 142 and not missing, "missingNumbers": missing,
            "headings": headings, "issues": [{"id": q["id"], "number": q["number"], "issues": q["transcription"]["issues"]}
                                            for q in questions if q["transcription"]["issues"]]}}
    data["audit"]["sourceKeys"] = {"singleChoice": sum(q["sourceAnswer"] in tuple("abcde") for q in questions),
                                  "multipleChoiceMarkers": [q["number"] for q in questions if "&" in (q["sourceAnswer"] or "")],
                                  "asteriskMarkers": [q["number"] for q in questions if q["transcription"]["sourceAnswerMarker"] == "*"],
                                  "unreadableMarkers": [q["number"] for q in questions if q["transcription"]["sourceAnswerMarker"] is None]}
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    destination = output / "engineering-mechanics.json"
    temporary = destination.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(destination)
    debug = output / "engineering-mechanics-anchor-audit.json"
    debug.write_text(json.dumps({"anchors": [{k: v for k, v in a.items() if k != "line"} for a in anchors],
                                 "candidates": [{k: v for k, v in a.items() if k != "line"} for a in candidates]}, ensure_ascii=False, indent=2))
    print(json.dumps({"questions": len(questions), "pages": len(pages), "headings": len(headings), "missingNumbers": missing,
                      "output": str(destination)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
