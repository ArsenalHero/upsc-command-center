"""Import a two-column CAMP paper and matching explanation PDF for trusted backend loading."""
import argparse,hashlib,json,re,uuid
from pathlib import Path
import fitz
parser=argparse.ArgumentParser();parser.add_argument('question_pdf');parser.add_argument('explanation_pdf');parser.add_argument('output');parser.add_argument('--recall-pdf');parser.add_argument('--figure-text',help='JSON mapping question numbers to the text transcribed from figures');args=parser.parse_args()
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
questions=[];figure_text=json.loads(Path(args.figure_text).read_text()) if args.figure_text else {}
for i,m in enumerate(sections):
 block=text[m.end():sections[i+1].start() if i+1<50 else len(text)].strip();opts=list(re.finditer(r'(?m)^\s*\(([a-d])\)\s*',block));assert [x[1] for x in opts]==list('abcd'),(i+1,block)
 clean=lambda s:'\n'.join(line.strip() for line in s.strip().splitlines() if line.strip())
 stem=clean(block[:opts[0].start()]);options={o[1]:clean(block[o.end():opts[j+1].start() if j+1<4 else len(block)]) for j,o in enumerate(opts)}
 e=exps[i];assert key[i+1]==e[2],i+1
 explanation=clean(exp[e.end():exps[i+1].start() if i+1<50 else len(exp)])
 assert explanation and all(options.values());assert re.search(r'Therefore, option',explanation,re.I),i+1
 if str(i+1) in figure_text:
  conclusion=explanation.rfind('Therefore, option')
  explanation=explanation[:conclusion].rstrip()+'\n\n'+figure_text[str(i+1)].strip()+'\n\n'+explanation[conclusion:]
 topic=next((title for pattern,title in [('Constituent Assembly|Cabinet Mission','Constituent Assembly'),('Preamble|Objectives Resolution','Preamble'),('citizen|citizenship','Citizenship'),('amend|368','Constitutional Amendments'),('federal|unitary','Federalism'),('Article 2|Article 3|territor|formation of.*state','Union and its Territory'),('Parliamentary|Presidential','Forms of Government')] if re.search(pattern,stem,re.I)),'Constitutional Features and Political Concepts')
 questions.append({'id':str(uuid.uuid5(uuid.NAMESPACE_URL,f'camp-2026-pt01-q{i+1}')),'number':i+1,'question':stem,'options':options,'correct':key[i+1],'explanation':explanation,'subject':'Polity','topic':topic,'difficulty':'Moderate','positive':2,'negative':2/3})
assert len({q['question'] for q in questions})==50
result={'code':'CAMP-2026-PT-01','name':'Prelims CAMP 2026 · Polity · PT-01','series':'Prelims CAMP 2026','year':2026,'paper':'GS-I','kind':'Sectional','duration':60,'positive':2,'negative':2/3,'questions':questions,'sourceHashes':{'questions':hashlib.sha256(Path(args.question_pdf).read_bytes()).hexdigest(),'explanations':hashlib.sha256(Path(args.explanation_pdf).read_bytes()).hexdigest()}}
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
 result['recall']={'kind':'recall','title':'Recall Sheet · PT-01','items':entries}
 result['sourceHashes']['recall']=hashlib.sha256(Path(args.recall_pdf).read_bytes()).hexdigest()
Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({'questions':len(questions),'answersMatched':len(key),'explanationCharacters':sum(len(q['explanation']) for q in questions),'questionPages':len(qp),'explanationPages':len(ep)}))
