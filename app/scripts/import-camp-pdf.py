"""Import a two-column CAMP paper and matching explanation PDF for trusted backend loading."""
import argparse,hashlib,json,re,uuid
from collections import Counter
from pathlib import Path
import fitz
parser=argparse.ArgumentParser();parser.add_argument('question_pdf');parser.add_argument('explanation_pdf');parser.add_argument('output');parser.add_argument('--recall-pdf');parser.add_argument('--figure-text',help='JSON mapping question numbers to the text transcribed from figures');parser.add_argument('--test-number',type=int,default=1);parser.add_argument('--review-file',help='Reviewed syllabus, tables, figures, hashes and answer discrepancies, indexed by test number');parser.add_argument('--brochure-pdf');args=parser.parse_args()
assert 1<=args.test_number<=99,'Invalid test number'
test_number=f'{args.test_number:02d}'
review=json.loads(Path(args.review_file).read_text()).get(str(args.test_number),{}) if args.review_file else {}
source_hashes={'questions':hashlib.sha256(Path(args.question_pdf).read_bytes()).hexdigest(),'explanations':hashlib.sha256(Path(args.explanation_pdf).read_bytes()).hexdigest()}
if args.recall_pdf:source_hashes['recall']=hashlib.sha256(Path(args.recall_pdf).read_bytes()).hexdigest()
if args.brochure_pdf:source_hashes['brochure']=hashlib.sha256(Path(args.brochure_pdf).read_bytes()).hexdigest()
for source,expected in review.get('sourceHashes',{}).items():assert source_hashes.get(source)==expected,f'{source} PDF differs from the reviewed version'
qp=fitz.open(args.question_pdf);ep=fitz.open(args.explanation_pdf)
question_text=[]
for page in list(qp)[1:]:
 r=page.rect
 for clip in [fitz.Rect(0,52,r.width/2,r.height-60),fitz.Rect(r.width/2,52,r.width,r.height-60)]:question_text.append(page.get_text(clip=clip,sort=True))
text='\n'.join(question_text)
sections=list(re.finditer(r'(?m)^\s*(\d{1,2})\.\s+',text));assert [int(m[1]) for m in sections]==list(range(1,51)),[m[1] for m in sections]
explanation_text=[]
for page in list(ep)[1:]:
 lines=page.get_text(clip=fitz.Rect(0,0,page.rect.width,page.rect.height-62),sort=True).splitlines()
 explanation_text.append('\n'.join(lines))
exp='\n'.join(explanation_text);exps=list(re.finditer(r'(?m)^\s*Q(\d{1,2})\.\s*\n\s*Answer:\s*([a-d])\s*\n\s*Explanation:\s*\n',exp));assert [int(m[1]) for m in exps]==list(range(1,51)),[m[1] for m in exps]
key={int(n):a for n,a in re.findall(r'(\d+)\.\s*\(([a-d])\)',ep[1].get_text())};assert len(key)==50
questions=[];figure_text=dict(review.get('figureText',{}));figure_text.update(json.loads(Path(args.figure_text).read_text()) if args.figure_text else {})
for i,m in enumerate(sections):
 block=text[m.end():sections[i+1].start() if i+1<50 else len(text)].strip();opts=list(re.finditer(r'(?m)^\s*\(([a-d])\)\s*',block));assert [x[1] for x in opts]==list('abcd'),(i+1,block)
 clean=lambda s:'\n'.join(line.strip() for line in s.strip().splitlines() if line.strip()).replace('\uf0b7','•')
 stem=clean(block[:opts[0].start()]);options={o[1]:clean(block[o.end():opts[j+1].start() if j+1<4 else len(block)]) for j,o in enumerate(opts)}
 e=exps[i];answer_review=review.get('answerReviews',{}).get(str(i+1))
 if key[i+1]!=e[2]:
  assert answer_review and answer_review.get('correct')==key[i+1] and answer_review.get('printedExplanationAnswer')==e[2] and answer_review.get('note') and answer_review.get('references'),f'Question {i+1}: unreviewed answer discrepancy'
 explanation=clean(exp[e.end():exps[i+1].start() if i+1<50 else len(exp)])
 assert explanation and all(options.values());assert re.search(r'Therefore, option',explanation,re.I),i+1
 if str(i+1) in figure_text:
  conclusion=explanation.rfind('Therefore, option')
  explanation=explanation[:conclusion].rstrip()+'\n\n'+figure_text[str(i+1)].strip()+'\n\n'+explanation[conclusion:]
 topic=next((title for pattern,title in [('Constituent Assembly|Cabinet Mission','Constituent Assembly'),('Preamble|Objectives Resolution','Preamble'),('citizen|citizenship','Citizenship'),('amend|368','Constitutional Amendments'),('federal|unitary','Federalism'),('Article 2|Article 3|territor|formation of.*state','Union and its Territory'),('Parliamentary|Presidential','Forms of Government')] if re.search(pattern,stem,re.I)),'Constitutional Features and Political Concepts')
 if answer_review:explanation=answer_review['note'].strip()+'\n\n'+explanation
 question={'id':str(uuid.uuid5(uuid.NAMESPACE_URL,f'camp-2026-pt{test_number}-q{i+1}')),'number':i+1,'question':stem,'options':options,'correct':key[i+1],'explanation':explanation,'subject':'Polity','topic':topic,'difficulty':'Moderate','positive':2,'negative':2/3}
 blocks=review.get('questionBlocks',{}).get(str(i+1))
 if blocks:
  visible=' '.join(b.get('text','')+' '+' '.join(b.get('headers',[]))+' '+' '.join(' '.join(row) for row in b.get('rows',[])) for b in blocks)
  tokens=lambda s:Counter(re.findall(r'\w+',s.casefold().replace('insufcfi ient','insufficient')))
  assert tokens(visible)==tokens(stem),f'Question {i+1}: table transcription changes the supplied words'
  question['blocks']=blocks
 if answer_review:question['answerReview']=answer_review
 questions.append(question)
assert len({q['question'] for q in questions})==50
result={'code':f'CAMP-2026-PT-{test_number}','name':f'Prelims CAMP 2026 · Polity · PT-{test_number}','series':'Prelims CAMP 2026','year':2026,'paper':'GS-I','kind':'Sectional','duration':60,'positive':2,'negative':2/3,'questions':questions,'sourceHashes':source_hashes}
if review.get('syllabus'):result['syllabus']=review['syllabus']
if args.recall_pdf:
 recall_doc=fitz.open(args.recall_pdf)
 recall_text='\n'.join(page.get_text(sort=True) for page in recall_doc)
 recall_text=re.sub(r'(?m)^\s*Vajiram & Ravi - Prelims CAMP - 2026\s*$','',recall_text)
 recall_sections=list(re.finditer(r'(?m)^\s*Q(\d{1,2})\.\s*',recall_text))
 assert [int(m[1]) for m in recall_sections]==list(range(1,51))
 entries=[]
 for i,m in enumerate(recall_sections):
  block=' '.join(recall_text[m.end():recall_sections[i+1].start() if i+1<50 else len(recall_text)].split())
  title,body=block.split(':',1);assert title.strip() and body.strip()
  entries.append({'number':int(m[1]),'title':title.strip(),'text':body.strip()})
 result['recall']={'kind':'recall','title':f'Recall Sheet · PT-{test_number}','items':entries}
 if args.test_number!=1:
  for q,item in zip(questions,entries):
   text=item['title']+' '+q['question']
   patterns={
    2:[('basic structure|Kesavananda|Minerva Mills|Golaknath','Basic Structure and Constitutional Judgments'),('duties|Swaran Singh','Fundamental Duties'),('Directive|DPSP|Article (?:38|39|40|41|42|43|44|45|46|47|48|49|50|51)(?![A-Za-z0-9])','Directive Principles of State Policy'),('writ|Article 32|constitutional remedies','Writs and Constitutional Remedies'),('religio|Article (?:25|26|27|28)(?![0-9])','Freedom of Religion'),('detention|self-incrimination|jeopardy|Article (?:20|21|22)(?![0-9])','Personal Liberty and Safeguards'),('anthem|flag|award','National Symbols and Honours')],
    3:[('Vice.President','Vice-President'),('Cabinet Committee','Cabinet Committees'),('bureaucracy|Secretariat|Civil Service|Permanent Executive','Bureaucracy and Executive Institutions'),('Governor','Governor'),('Chief Minister|State Minister|Tribal Welfare|State Council','State Council of Ministers'),('Prime Minister','Prime Minister'),('Council of Ministers|Cabinet','Union Council of Ministers'),('Union Territor|Goa|UTs','Union Territories'),('President','President')],
    4:[('State Legisl|Legislative Council|Legislative Assembly','State Legislature'),('anti.defection|Tenth Schedule','Anti-Defection'),('Committee','Parliamentary Committees'),('Speaker|Chairman|Presiding','Presiding Officers'),('grant|financial|Money Bill|budget|Vote of Credit','Financial Procedures'),('motion|Question Hour|Zero Hour|procedure|joint sitting|bill','Parliamentary Procedures'),('privilege','Parliamentary Privileges'),('election|membership|readjustment|delimitation','Membership and Representation')],
    5:[('emergency|President.s Rule|Article 356','Emergency Provisions'),('Scheduled Area|Tribal|Sixth Schedule|Fifth Schedule','Scheduled and Tribal Areas'),('Tribunal|Law Commission|Bar Council','Tribunals and Legal Institutions'),('Lok Adalat|arbitration|mediation|dispute resolution','Alternative Dispute Resolution'),('High Court','High Courts'),('Subordinate|District|Fast Track','Subordinate and Special Courts'),('Judicial Review|Judicial Activism|PIL|Doctrine','Judicial Review and Doctrines'),('Supreme Court','Supreme Court')]
   }
   q['topic']=next((title for pattern,title in patterns.get(args.test_number,[]) if re.search(pattern,text,re.I)),{2:'Fundamental Rights',3:'Union and State Executive',4:'Parliament',5:'Judiciary'}.get(args.test_number,'Polity'))
 result['sourceHashes']['recall']=hashlib.sha256(Path(args.recall_pdf).read_bytes()).hexdigest()
Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({'questions':len(questions),'answersMatched':len(key),'explanationCharacters':sum(len(q['explanation']) for q in questions),'questionPages':len(qp),'explanationPages':len(ep)}))
