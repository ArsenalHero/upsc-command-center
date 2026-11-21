"""Package only the selected Engineering Mechanics extract and its reviewed text."""
import argparse,collections,hashlib,html,json
from pathlib import Path
import fitz
from publish import encoded, hashed, prune_subject_assets, render_figures, topic_index, update_catalog

HERE=Path(__file__).resolve().parent
APP=HERE.parents[1]
SHA='7e5ed55860f7f23dee3d581c0e5c6df9932d716613a54a619789a14417709fc0'
STATUSES=('verified','corrected','disputed','needs-review')
def main():
 p=argparse.ArgumentParser();p.add_argument('--pdf',required=True);p.add_argument('--require-reviewed-coverage',action='store_true');a=p.parse_args()
 pdf=Path(a.pdf);assert hashlib.sha256(pdf.read_bytes()).hexdigest()==SHA,'The PDF differs from the reviewed source.'
 doc=fitz.open(pdf);assert len(doc)==142
 base=json.loads((HERE/'extracted/engineering-mechanics.json').read_text());questions=base['questions']
 assert len(questions)==807 and {q['number'] for q in questions}==set(range(1,808))
 assert len({q['id'] for q in questions})==807
 reviews=collections.defaultdict(list)
 for path in sorted((HERE/'reviewed').glob('engineering-mechanics*review.json')):
  d=json.loads(path.read_text());assert d['subjectId']=='engineering-mechanics'
  for r in d['reviews']:reviews[r['id']].append({**r,'reviewFile':path.name})
 figure_map_path=HERE/'engineering-mechanics-201-220-figures.json'
 figure_map={r['id']:r['figures'] for r in json.loads(figure_map_path.read_text())['reviews']} if figure_map_path.exists() else {}
 missing=[q['number'] for q in questions if q['id'] not in reviews]
 if a.require_reviewed_coverage:assert not missing,f'Missing independent reviews: {missing}'
 out=APP/'public/mechanical';figdir=out/'figures';figdir.mkdir(parents=True,exist_ok=True)
 production=[];transcribed=[];conflicts=[];manifest=[];shortened=[]
 for original in sorted(questions,key=lambda q:q['number']):
  q=json.loads(json.dumps(original));n=q['number'];items=reviews[q['id']]
  # Assigned range records supersede any earlier whole-subject spot checks.
  items.sort(key=lambda r:('-review.json' in r['reviewFile'] and r['reviewFile']!='engineering-mechanics-review.json'))
  if len({r.get('answer') for r in items})>1:conflicts.append({'question':n,'reviews':[{'file':r['reviewFile'],'status':r['status'],'answer':r.get('answer')} for r in items]})
  for r in items:
   if r.get('number') is not None:assert r['number']==n
   for key in ('question','options','explanation','sourceExplanation','sourceAnswer','answer','topic','subtopic','figures','optionsUnavailable'):
    if key in r:q[key]=r[key]
   q['review']={'status':r['status'],'note':r.get('note',''),'references':r.get('references',[])}
   q['transcriptionReviewed']=bool(r.get('transcriptionReviewed'))
  if q['id'] in figure_map:q['figures']=figure_map[q['id']]
  if q.get('transcriptionReviewed'):transcribed.append(n)
  issues=[] if q.get('transcriptionReviewed') else list(q.get('transcription',{}).get('issues',[]))+['Full visual source reconciliation is pending.']
  if not q.get('question','').strip():issues.append('The question text is unavailable.')
  opts=q.get('options',{});status=q['review']['status'];assert status in STATUSES
  missing_choices=q.get('optionsUnavailable') and not opts and status=='disputed'
  if not missing_choices and (not 2<=len(opts)<=6 or any(not str(v).strip() for v in opts.values())):issues.append('The complete supplied choices need review.')
  if status in ('verified','corrected'):
   if q.get('answer') not in opts:issues.append('A unique reviewed answer is unavailable.')
   elif sum(v.strip()==opts[q['answer']].strip() for v in opts.values())>1:issues.append('The reviewed answer is duplicated among the choices.')
  else:q['answer']=None
  if not q.get('explanation','').strip():issues.append('The complete explanation or source-omission note is unavailable.')
  if not q['review']['note'] or not q['review']['references']:issues.append('Independent review notes or primary references are unavailable.')
  if status=='corrected' and not q.get('sourceExplanation'):issues.append('The full printed original must accompany this correction.')
  if len(q.get('explanation',''))<.55*len(original.get('explanation','')) and not q.get('sourceExplanation'):shortened.append(n)
  q['figures'],entries=render_figures(doc,figdir,q,len(doc))
  manifest.extend(entries)
  q['subjectId']='engineering-mechanics';q['subject']='Engineering Mechanics'
  q['source']={**q['source'],'file':'MECH AE 01 FULL 35000-15-156.pdf','sha256':SHA}
  q.pop('transcription',None);q.pop('transcriptionReviewed',None)
  if issues:q['transcriptionIssues']=list(dict.fromkeys(issues))
  else:q.pop('transcriptionIssues',None)
  production.append(q)
 unresolved=[q['number'] for q in production if q.get('transcriptionIssues')]
 if a.require_reviewed_coverage:
  assert len(transcribed)==807,f'Incomplete visual transcription: {sorted(set(range(1,808))-set(transcribed))}'
  assert not unresolved,f'Unresolved structure: {unresolved}'
  assert not conflicts,f'Conflicting independent keys: {conflicts}'
  assert not shortened,f'Potentially shortened supplied explanations need reconciliation: {shortened}'
 counts={s:sum(q['review']['status']==s for q in production) for s in STATUSES}
 topics=topic_index(production)
 assert len(topics)==10,f'The selected extract must retain its ten printed chapters: {[t["name"] for t in topics]}'
 source={'file':'MECH AE 01 FULL 35000-15-156.pdf','aliases':[pdf.name],'sha256':SHA,'pages':142,'firstPrintedPage':15,'lastPrintedPage':156}
 payload={'subjectId':'engineering-mechanics','subject':'Engineering Mechanics','title':'Engineering Mechanics','source':source,'questions':production}
 data_url=hashed(out,'engineering-mechanics','json',encoded(payload))
 audit={'scope':'Only the selected Engineering Mechanics PDF, printed pages 15–156. Other PDFs are excluded.','source':source,'questions':807,'expectedQuestions':807,'missingNumbers':[],
  'independentlyExamined':len({q['id'] for q in questions if q['id'] in reviews}),'fullyTranscribed':len(transcribed),'missingIndependentReview':missing,'reviewCounts':counts,'transcriptionNeedsReview':unresolved,'conflictingReviewNotes':conflicts,'shortenedExplanationChecks':shortened,'diagrams':len(manifest),
  'method':'Every question and complete adjacent explanation is visually reconciled across columns/pages. Independent mechanics reasoning, numerical calculations and primary references support reviews. Confirmed source defects remain ungraded.',
  'issues':[{'question':q['number'],'id':q['id'],'printedPage':q['source']['printedPage'],'status':q['review']['status'],'printedAnswer':q.get('sourceAnswer'),'reviewedAnswer':q['answer'],'note':q['review']['note'],'references':q['review']['references']} for q in production if q['review']['status']!='verified']}
 audit_url=hashed(out,'source-review-audit','json',json.dumps(audit,ensure_ascii=False,indent=2).encode())
 rows=''.join(f'<tr><td>{q["number"]}</td><td>{html.escape(q["topic"])}</td><td>{html.escape(q["review"]["status"])}</td><td>{html.escape(q["review"]["note"])}</td><td>{q["source"]["printedPage"]}</td></tr>' for q in production)
 report=(f'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Engineering Mechanics — source and review audit</title><style>body{{font:15px/1.7 system-ui;max-width:1200px;margin:36px auto;padding:0 20px;color:#223647}}table{{border-collapse:collapse;width:100%}}td,th{{padding:11px;border-bottom:1px solid #d9e0e6;text-align:left;vertical-align:top}}th{{background:#edf2f5}}small{{color:#657887}}.scroll{{overflow:auto}}h1{{line-height:1.3}}</style>'
  f'<h1>Engineering Mechanics — source and review audit</h1><p>Only printed pages 15–156 from the selected 142-page PDF. 807 questions; {audit["independentlyExamined"]} individually examined.</p><p>{counts["verified"]} reference-reviewed · {counts["corrected"]} corrected · {counts["disputed"]} disputed · {counts["needs-review"]} pending.</p><p>Complete printed explanations are preserved. Corrections are identified, and ambiguous or incomplete answers are excluded from automatic grading.</p><p><a href="{Path(audit_url).name}">Detailed provenance and review data</a></p><div class="scroll"><table><thead><tr><th>Question</th><th>Topic</th><th>Review</th><th>Cross-check note</th><th>Printed page</th></tr></thead><tbody>{rows}</tbody></table></div><p><small>Source SHA-256: {SHA}</small></p>').encode()
 report_url=hashed(out,'source-review-audit','html',report)
 subject={'id':'engineering-mechanics','title':'Engineering Mechanics','url':data_url,
  'count':807,'reviewed':counts['verified'],'corrected':counts['corrected'],'disputed':counts['disputed'],
  'topics':topics,'auditUrl':report_url,'auditDataUrl':audit_url}
 update_catalog(out,subject,source)
 (HERE/'diagram-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 prune_subject_assets(out,('engineering-mechanics-*.json','source-review-audit-*.json','source-review-audit-*.html'),
  'mech-engineering-mechanics-',{data_url,audit_url,report_url}|{'mechanical/figures/'+f['file'] for f in manifest})
 print(json.dumps({'questions':807,'reviewedCoverage':audit['independentlyExamined'],'fullyTranscribed':len(transcribed),'counts':counts,'diagrams':len(manifest),'unresolved':unresolved,'shortened':shortened,'dataUrl':data_url,'auditUrl':report_url}))
if __name__=='__main__':main()
