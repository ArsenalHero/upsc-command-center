"""Build the 2012–2020 native-text archive from preserved, audited sources.

Question wording is transcribed from the recorded reprints. Answer letters always
come from the matching booklet of UPSC's final key, including historical rules.
"""
import copy
import gzip
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'scripts/data'
RAW = json.load(gzip.open(DATA / 'cse-older-import.checkpoint.json.gz', 'rt'))
KEYS = json.loads((DATA / 'cse-older-audited-keys.json').read_text())
FIGURES = json.loads((ROOT / 'public/paper-figures/older-figures.json').read_text())
SOURCES = {s['file']: s for s in RAW['sources']}
KEY_ARCHIVE = 'https://www.upsc.gov.in/examinations/answer-key/archives'
PAPER_ARCHIVE = 'https://www.upsc.gov.in/examinations/previous-question-papers/archives'

def clean(s):
    s = re.split(r'\s+Sol\s*\d+\.', str(s))[0]
    return re.sub(r'\s+', ' ', s).strip().replace('Select the correct Solution:', 'Select the correct answer:')

def qget(kind, year, n):
    q = RAW[kind][str(year)][n - 1]
    assert q['number'] == n
    return q

def stem(year, n, text, kind='csat'):
    qget(kind, year, n)['question'] = text

def options(year, n, values, kind='csat'):
    qget(kind, year, n)['options'] = dict(zip('abcd', values))

def replace(year, n, old, new, kind='csat'):
    q = qget(kind, year, n)
    q['question'] = q['question'].replace(old, new)

def passage(year, ns, text):
    for n in ns:
        qget('csat', year, n)['blocks'] = [{'type': 'passage', 'text': clean(text)}]

def premise(year, ns, text):
    for n in ns:
        qget('csat', year, n).setdefault('context', []).append(text)

def table(year, ns, headers, rows):
    for n in ns:
        qget('csat', year, n).setdefault('contextBlocks', []).append({'type':'table','headers':headers,'rows':[[str(v) for v in r] for r in rows]})

# Repair reprint extraction where embedded (a)/(b)/(c) clauses were treated as
# ordinary answer labels. Keep those clauses as separate, selectable choices.
for year, ns in {2012:[20,25,28,36,72,95],2014:[66],2017:[41]}.items():
    for n in ns:
        q = qget('gs', year, n)
        parts = re.split(r'\(([abc])\)\s*', q['question'])
        if len(parts) > 1:
            choices = {parts[i]: clean(parts[i+1]) for i in range(1, len(parts)-1, 2)}
            choices.setdefault('c', q['options']['a'])
            choices['d'] = 'Both (a) and (b) are correct in this context.' if (year,n) in [(2012,72),(2014,66),(2017,41)] else 'None of statements (a), (b) and (c) is correct.'
            q['question'], q['options'] = parts[0], {k:choices[k] for k in 'abcd'}
options(2012,20,['The Earth’s magnetic field diverts charged particles towards its poles.','The ozone layer reflects the charged particles towards the poles.','Moisture in the atmosphere prevents charged particles from reaching the Earth.','None of the statements (a), (b) and (c) is correct.'],'gs')
replace(2014,48,'Mapping and investigating 3.','Mapping and investigating Mercury 3.','gs')
replace(2014,18,'mnixture','mixture','gs')
options(2014,90,['Biosphere Reserves','Botanical Gardens','National Parks','Wildlife Sanctuaries'],'gs')
qget('gs',2018,14)['options']['d']='World Justice Project'
replace(2018,53,'Constitution of a particular State','Constitution of India in respect of a particular State','gs')
replace(2018,70,'Ramanujan','Ramanujam','gs')
replace(2018,74,'Maityera','Maitreya','gs')

# Assign passages to their actual related items, clearing stale carried-over
# passages on mathematical and reasoning questions.
groups = {
2012:[[1,2,3],[4,5,6],list(range(16,19)),list(range(19,25)),list(range(25,31)),list(range(31,36)),[36,37,38],[39,40,41],[66,67,68],[69,70,71],[72,73]],
2013:[[1,2],list(range(10,15)),[15,16],[31,32],[33,34],[35,36],[37,38],[54,55,56,57],[62,63]],
2014:[[1,2,3,4],[5,6,7,8],[27,28,29],[30,31],[50,51,52],[53,54,55,56],[68,69],[70,71,72,73]],
2015:[[1],[2],[3],[4],[5],[6],[7,8],[21],[22],[23],[24],[25],[26,27,28],[41],[42],[43],[44,45,46,47],[61],[62],[63],[64],[65,66],[67]],
2016:[[1,2,3,4],[5,6],[21,22,23,24],[25],[41],[42],[43],[44],[45],[46],[47],[48],[64],[65],[66],[67],[68,69,70,71]],
2017:[[1],[2],[3],[4],[5],[6],[7,8],[21],[22],[23],[24],[25],[26],[27],[41],[42],[43],[44],[45],[46],[47],[61],[62],[63],[64],[65],[66],[67],[68]],
2018:[[7],[8],[9],[10],[17,18,19,20],[27,28,29],[30,31],[32],[33],[49],[50],[51],[52],[53],[54],[55],[56],[78],[79,80]],
2019:[[14,15],[16,17],[18],[19],[20],[34,35],[36],[37],[38],[39],[40],[53,54],[55],[56],[57],[58],[59],[60],[73],[74,75],[76,77],[78],[79],[80]],
2020:[[1],[2],[3],[4,5],[6,7],[11],[12],[13],[14],[15,16],[41],[42,43],[44],[45],[46],[51],[52],[53],[54],[55,56]],
}
for year, gs in groups.items():
    original = copy.deepcopy(RAW['csat'][str(year)])
    for q in RAW['csat'][str(year)]: q['blocks'] = []
    for ns in gs:
        text = next((b['text'] for n in ns for b in original[n-1].get('blocks',[]) if b['type']=='passage'), '')
        assert text, (year,ns,'missing passage')
        passage(year,ns,text)

text13 = (DATA / 'older-source-text/csat-2013.txt').read_text()
for idx, ns, first in [(1,[67,68],67),(2,[69,70,71],69),(3,[72,73,74],72)]:
    text = text13.split(f'English Passage - {idx}',1)[1].split(f'{first}. ',1)[0]
    text = re.sub(r'UPSC CSAT 2013\s*www\.iasbaba\.com','',text)
    passage(2013,ns,text)
for ns,start,marker in [([39,40],39,'The author’s children'),([41,42,43,44],41,'Cynthia was afraid')]:
    q=qget('csat',2014,start)
    text=q['question'].split(marker,1)[0].split('Passage – ',1)[1][1:].strip()
    passage(2014,ns,text.replace('on the state','on the stage'))
for n, marker in [(39,'The author’s children'),(40,'The expression'),(41,'Cynthia was afraid'),(42,'Cynthia’s classmates'),(43,'Cynthia’s knees'),(44,'The transformation')]:
    q=qget('csat',2014,n)
    if marker in q['question']: q['question']=marker+q['question'].split(marker,1)[1]
q=qget('csat',2014,62);text,tail=q['question'].split('In the context of political development,',1)
passage(2014,[62],text.strip(' "'))
q['question']='In the context of political development,'+tail
for n in range(1,5):
    b=qget('csat',2016,n)['blocks'][0]
    b['text']=b['text'].replace('of the civil services at large through the electron process.','of the civil services to the political leaders of the day who in turn are expected to be externally accountable to the society at large through the election process.')
options(2016,1,['1 only','2 and 3 only','1 and 4 only','2, 3 and 4 only'])
q=qget('csat',2016,2)
if 'With reference' in q['question']:q['question']='With reference'+q['question'].split('With reference',1)[1]

premise(2012,range(7,12),'Five guest lectures on Economics, History, Statistics, English and Mathematics are to be delivered, one on each day from Monday to Friday. Economics cannot be delivered on Tuesday. History can be delivered only on Tuesday. Mathematics is delivered immediately after Economics. English is delivered immediately before Economics.')
premise(2013,[18,19],'Each row contains four Problem Figures forming a sequence. Choose the Answer Figure that should appear fifth in that sequence.')
premise(2013,range(41,45),'There are five places P, Q, R, S and T. P and Q are connected by boat and rail. S and R are connected by bus and boat. Q and T are connected by air only. P and R are connected by boat only. T and R are connected by rail and bus. All these connections allow travel in both directions.')
premise(2013,range(45,48),'A tennis team of four must include at least two men. Available men are A, B and C, and women are W, X, Y and Z. B will not play with W; C will not play with Z; W will not play with Y.')
premise(2013,range(50,53),'Out of four friends A, B, C and D: A and B play football and cricket; B and C play cricket and hockey; A and D play basketball and football; C and D play hockey and basketball.')
premise(2014,range(47,50),'A family of six persons has two married couples. Their professions are engineer, stenographer, doctor, draughtsman, lawyer and judge. A, the engineer, is married to the lady stenographer. The judge is married to the lawyer. F, the draughtsman, is the son of B and brother of E. C, the lawyer, is the daughter-in-law of D. E is the unmarried doctor. D is the grandmother of F.')
premise(2015,[52,53],'Six cousins A, B, C, D, E and F have different ages, from 17 to 22 years, and celebrate their birthdays on the same date. E is the oldest. F is older than B but younger than D. A is older than B, and C is older than D. A is one year older than C.')
premise(2016,range(15,20),'Five persons P, Q, R, S and T include a doctor, a lawyer and an artist. P and S are unmarried students. T is a man married to one of the members of the group. Q is the brother of P and is neither the doctor nor the artist. R is not the doctor.')
premise(2016,range(34,37),'Six boxes A, B, C, D, E and F are arranged in a row from left to right. Each contains one different ball: golf, tennis, cricket, volleyball, hockey or football; and has a different colour: violet, indigo, blue, green, yellow or orange. The violet box contains a golf ball and is not D. A is orange, contains the tennis ball and is at the extreme right. The hockey ball is in neither D nor E, and its box is neither blue nor yellow. C contains the cricket ball, is green, is fifth from the right and is next to B. B contains the volleyball. The hockey box lies between the golf and volleyball boxes.')
premise(2016,range(54,57),'Three persons A, B and C have the surnames Ribeiro, Kumar and Singh, not necessarily in that order. One wears a jacket, one a sweater and one a tie. The garments are blue, white and black, not necessarily in that order. Neither B nor Ribeiro wears the white sweater. C wears a tie. Singh’s garment is not white. Kumar does not wear a jacket. Ribeiro does not wear black.')
premise(2017,range(29,32),'Seven lecturers A, B, C, D, E, F and G belong to Hyderabad, Delhi, Shillong, Kanpur, Chennai, Mumbai and Srinagar, and teach Economics, Commerce, History, Sociology, Geography, Mathematics and Statistics, one each. The lecturer from Kanpur teaches Geography. D belongs to Shillong. C belongs to Delhi and teaches Sociology. B teaches neither History nor Mathematics. A teaches Economics and does not belong to Hyderabad. F teaches Commerce and belongs to Srinagar. G teaches Statistics and belongs to Chennai.')
premise(2017,range(36,39),'Between places A, B, C, D, E, F, G and H, one-way routes are C→A, E→G, B→F, D→H, G→C, E→C and H→G. Two-way routes are A↔E, G↔B, F↔D and E↔D. Travel must follow these routes.')
premise(2017,[69,70],'No supporters of party X who knew Z and supported his campaign strategy agreed to an alliance with party Y, but some of them had friends in party Y.')
premise(2018,[25,26],'Six offices A, B, C, D, E and F are arranged along a corridor. B and C are on the right when entering; A is on the left. E and F are on opposite sides but do not face each other. C and D face each other. E is not at a corner. F is farther along the corridor than A and on the same side.')
premise(2018,range(43,49),'Students A, B, C and D belong to cities P, Q, R and S, attend Science, Arts, Commerce and Engineering colleges, and come from Gujarat, Rajasthan, Assam and Kerala, one each. D comes from Assam. The Arts college is in city S and its student comes from Rajasthan. A attends Commerce. B belongs to city Q. The Science student comes from Kerala.')
premise(2019,range(9,12),'Six students A, B, C, D, E and F have different marks. Either C or F has the highest marks. If C has the highest marks, E has the lowest. If F has the highest marks, B has the lowest. D has more marks than A, and they occupy consecutive positions. A has more marks than B. C has more marks than A.')
premise(2019,[12,13],'For the age comparison, statement 1 says twice Sohan’s age is less than Mohan’s age and less than Rohan’s age. Statement 2 says twice Rohan’s age is greater than Mohan’s age and greater than Sohan’s age. Assess each statement separately and then together.')

stem(2016,7,'A ate grapes and pineapple; B ate grapes and oranges; C ate oranges, pineapple and apple; D ate grapes, apple and pineapple. After taking fruits, B and C fell sick. In the light of this information, which fruit is most likely to have caused the sickness?')
replace(2016,73,'5.5','5.5')
q=qget('csat',2016,73);q['question']=re.sub(r'5\.5\s*m?\s*[×x]\s*6\s*m?', '5.5 m × 4 m × 6 m',q['question'])
for n in [62]:
    q=qget('csat',2016,n);q['question']=q['question'].replace('R2','R²').replace('S2','S²');q['options']={k:v.replace('R2','R²').replace('S2','S²') for k,v in q['options'].items()}
options(2014,33,['3','4','5','6'])
options(2015,80,['Kamala','Priti','Swati','Usha'])
replace(2017,47,'battles it history','battles in history')
replace(2017,47,'essential fin anyone','essential for anyone')
stem(2017,51,'A watch loses 2 minutes in every 24 hours while another watch gains 2 minutes in 24 hours. At a particular instant, the two watches showed an identical time. Which of the following statements is correct if a 24-hour clock is used?')
stem(2018,4,'How many diagonals can be drawn by joining the vertices of an octagon?')
replace(2018,23,'X2 – Y2','X² − Y²');replace(2018,23,'X2 - Y2','X² − Y²')
replace(2018,60,'welve','Twelve');replace(2018,60,'areg','area')
q=qget('csat',2019,6);q['question']=q['question'].split('6. ',1)[-1]
stem(2019,22,'A wall clock moves 10 minutes fast in every 24 hours. The clock was set right to show the correct time at 8:00 a.m. on Monday. When the clock shows the time 6:00 p.m. on Wednesday, what is the correct time?')
options(2019,22,['5:36 p.m.','5:30 p.m.','5:24 p.m.','5:18 p.m.'])
q=qget('csat',2019,17);q['question']=q['question'].replace('Which of the above assumptions is/are valid? Which of the above assumptions is/are valid?','Which of the above assumptions is/are valid?')
qget('csat',2019,72)['options']['d']='40.3'
q=qget('csat',2019,75);q['options']['a']=re.sub(r'^7\s+','',q['options']['a'])
qget('csat',2019,78)['options']['b']='3 only'
q=qget('csat',2020,2);q['question']=re.sub(r'^2\.\s*','',q['question'])
q=qget('csat',2020,3)
if '3. Which' in q['question']:
    text,tail=q['question'].split('3. Which',1);text=re.split(r'Passage\s*[–-]\s*3',text)[-1];passage(2020,[3],text);q['question']='With reference'+tail.split('references',1)[1] if 'references' in tail else 'Which'+tail
for n in [15,16]:
    b=qget('csat',2020,n)['blocks'][0];b['text']=b['text'].replace('cannot be generation of GM crops','cannot be confined to the current generation of GM crops')
replace(2020,48,'liquid Q','liquid A');replace(2020,48,'its and replace','it and replaced')
replace(2020,52,'Authorities should ensure the vaccination should ensure the vaccination as prescribed.','Authorities should ensure the vaccination as prescribed.')
stem(2020,60,'Which one of the following values is the greatest?')
options(2020,60,['(1/2)⁻⁶','(1/4)⁻³','(1/3)⁻⁴','(1/6)⁻²'])
stem(2020,71,'What is the greatest length that can be used to measure exactly the lengths 3½ m and 8¾ m?')
options(2020,71,['1½ m','1⅓ m','1¼ m','1¾ m'])
stem(2020,75,'In a population, 40% of men and 30% of women are married. All marriages are monogamous and there are no widows or widowers. What percentage of the total population is married?')
options(2020,75,['33 1/7%','34%','34 2/7%','35%'])
stem(2020,77,'An amount of ₹2,500 is divided among three persons in the ratio 1/2 : 3/4 : 5/6. What is the difference between the largest and the smallest shares?')
replace(2020,78,'(10n + 1)','(10ⁿ + 1)');replace(2020,78,'(10n+1)','(10ⁿ+1)')
stem(2020,31,'In the sum ⊗ + 1⊗ + 5⊗ + ⊗⊗ + ⊗1 = 1⊗⊗, for which digit does the symbol ⊗ stand?')
table(2018,[74,75],['State','Per capita income ($)','GDP growth rate (%)','Tele-density'],[[1,704,9.52,70.27],[2,419,5.31,35.88],[3,254,10.83,50.07],[4,545,9.78,5.94],[5,891,10.8,76.12],[6,1077,11.69,77.5],[7,900,8.88,104.86],[8,395,5.92,6],[9,720,7.76,82.25],[10,893,9.55,96.7],[11,363,4.7,57.7],[12,966,7.85,63.8],[13,495,9.37,52.3],[14,864,5.46,97.9],[15,497,7.48,62.3],[16,777,7.03,93.8],[17,335,5.8,49.9],[18,599,7.49,47.84]])
stem(2020,38,'The table shows average marks in English and Hindi for girls, boys and all students. What is the value of x?')
table(2020,[38],['Group','English','Hindi'],[['Girls',9,8],['Boys',8,7],['Overall',8.8,'x']])
stem(2020,72,'The table gives the birth rate and death rate per thousand persons for successive periods. During which period was the natural growth rate highest?')
table(2020,[72],['Period','Birth rate','Death rate'],[['1911–1921',48.1,35.5],['1921–1931',46.4,36.3],['1931–1941',45.2,31.2],['1941–1951',39.9,27.4],['1951–1961',41.7,22.8],['1961–1971',41.1,18.9],['1971–1981',37.1,14.8]])

def notes(kind, year):
    out={}
    for line in (DATA/f'cse-{kind}-{year}-editorial-notes.txt').read_text().splitlines():
        if not line.strip():continue
        if kind=='gs':
            item,subject,topic,text=line.split('|',3); n=int(item.split('-')[-1]);out[n]=(subject,topic,text)
        else:
            n,text=line.split('|',1);out[int(n)]=text
    if kind=='csat':assert sorted(out)==list(range(1,81)),year
    return out

def write_json(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

papers=[p for p in json.loads((ROOT/'src/data/cse-paper-archive.json').read_text()) if p['year']>=2021]
old_bank=json.loads((ROOT/'src/data/cse-text-papers-bank.json').read_text())
bank={p['id']:old_bank[p['id']] for p in papers}
for year in range(2020,2011,-1):
    for kind in ['gs','csat']:
        key=KEYS[f'{kind}-{year}'];answers=key['answers']; booklet=key['booklet'];count=100 if kind=='gs' else 80
        assert len(answers)==count
        excluded=[i+1 for i,a in enumerate(answers) if a=='E'];dropped=[i+1 for i,a in enumerate(answers) if a=='X']
        no_penalty=list(range(74,81)) if kind=='csat' and year==2012 else list(range(75,81)) if kind=='csat' and year==2013 else []
        maximum=185 if kind=='csat' and year==2014 else 200;marks=maximum/(count-len(excluded)-len(dropped))
        source=next(SOURCES[f'{kind}-{year}-{suffix}'] for suffix in (['reference.pdf'] if kind=='gs' else ['text.pdf','reference.pdf','web.html','original.pdf']) if f'{kind}-{year}-{suffix}' in SOURCES)
        ks=SOURCES[f'{kind}-{year}-key-mirror.pdf'];pid=f'upsc-cse-{year}-{kind}-{booklet.lower()}'
        title='General Studies Paper I' if kind=='gs' else 'General Studies Paper II (CSAT)'
        paper={'id':pid,'year':year,'paper':kind,'title':title,'booklet':booklet,'questionCount':count,'maximumMarks':maximum,'minutes':120,'paperUrl':source['url'],'officialPaperUrl':PAPER_ARCHIVE,'keyUrl':ks['url'],'officialKeyArchiveUrl':KEY_ARCHIVE,'keyMirror':'ForumIAS','keyPage':key['page']+1,'keyPublisher':'Union Public Service Commission','keySha256':ks['sha256'],'verifiedOn':'2026-10-07','answers':answers,'droppedQuestions':dropped,'excludedQuestions':excluded,'noPenaltyQuestions':no_penalty}
        papers.append(paper);bank[pid]=[];editorial=notes(kind,year)
        for raw in RAW[kind][str(year)]:
            n=raw['number'];a=answers[n-1];text=clean(raw['question']);opts={k:clean(raw['options'][k]) or f'Figure {k.upper()}' for k in 'abcd'}
            assert len(text)>15 and all(opts.values()),(kind,year,n,text,opts)
            blocks=copy.deepcopy(raw.get('blocks',[]))+[{'type':'paragraph','text':clean(s)} for s in raw.get('context',[])]+copy.deepcopy(raw.get('contextBlocks',[]))
            for b in blocks:
                if 'text' in b:b['text']=clean(b['text'])
            blocks.append({'type':'paragraph','text':re.sub(r' (?=[1-9]\. [A-Za-z“‘])','\n',text)})
            if kind=='csat':
                for idx,name in enumerate(FIGURES.get(f'{year}-{n}',[])):
                    alt=f'Question {n} · original figure'+(f' {idx+1}' if len(FIGURES[f'{year}-{n}'])>1 else '')
                    if year==2015 and n in [31,34]:alt=f'Question {n} · original pattern' if idx==0 else f'Question {n} · Option {"ABCD"[idx-1]}'
                    blocks.append({'type':'image','src':'paper-figures/'+name,'alt':alt})
                subject='CSAT';topic='Reading comprehension' if any(b['type']=='passage' for b in blocks) else 'Decision making' if n in no_penalty else 'Quantitative aptitude' if re.search(r'number|percent|ratio|profit|clock|time|distance|age|sum|rate|length|digit|average',text,re.I) else 'Logical reasoning'
                exp={'justification':editorial[n],'concept':topic,'references':[]}
            elif n in editorial:
                subject,topic,note=editorial[n];exp={'justification':note,'concept':topic,'references':[]}
            else:
                assert raw.get('candidateCompatible') and a==raw.get('officialAnswer'),(year,n,'unreviewed GS explanation')
                subject=raw['candidateSubject'];topic=raw['candidateTopic'];exp=copy.deepcopy(raw['candidateExplanation'])
            if a=='E':exp['justification']='Excluded from evaluation: UPSC did not score this English-language comprehension item in the 2014 examination. The pedagogical explanation below is provided for study and does not assign an official answer. '+exp['justification']
            if a=='X':exp['justification']='UPSC dropped this question in the final key. It contributes neither marks nor a penalty. '+exp['justification']
            exp.setdefault('references',[]).extend([{'title':f'UPSC CSE {year} {title} · question text reprint','url':source['url'],'section':f'Series {booklet}, question {n}'},{'title':f'UPSC final answer key · archived copy on ForumIAS','url':ks['url'],'section':f'Page {key["page"]+1}, Series {booklet}, question {n}'}])
            bank[pid].append({'id':f'{pid}-q-{n:03}','year':year,'stage':'Prelims' if kind=='gs' else 'CSAT','paper':'Prelims GS-I' if kind=='gs' else 'Prelims GS-II (CSAT)','number':n,'booklet':booklet,'questionType':'MCQ','subject':subject,'topic':topic,'question':text,'options':opts,'answer':None if a in ['E','X'] else a.lower(),'keyStatus':'excluded' if a=='E' else 'dropped' if a=='X' else 'official','marks':0 if a in ['E','X'] else marks,'negativeMarks':0 if a in ['E','X'] or n in no_penalty else marks/3,'wordLimit':0,'sourceUrl':source['url'],'keyUrl':ks['url'],'page':0,'sourceSha256':source['sha256'],'sourceTitle':f'UPSC CSE {year} {title} · Series {booklet}','sourceNotes':'Text reprint; scoring checked against the matching UPSC final-key booklet. Explanations are editorial study notes, not UPSC explanations.','blocks':blocks,'explanation':exp})

assert len(papers)==26 and sum(map(len,bank.values()))==2340
expected=[40,31,33,30,27,30,26,30,25]
for year,num in zip(range(2012,2021),expected):
    qs=bank[next(p['id'] for p in papers if p['year']==year and p['paper']=='csat')]
    actual=sum(any(b['type']=='passage' for b in q['blocks']) for q in qs)
    assert actual==num,(year,actual,num)
write_json(ROOT/'src/data/cse-paper-archive.json',papers)
write_json(ROOT/'src/data/cse-text-papers-bank.json',bank)
figures=[{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((ROOT/'public/paper-figures').glob('*.jpg'))]
write_json(DATA/'cse-older-import-manifest.json',{'verifiedOn':'2026-10-07','addedPapers':18,'addedQuestions':1620,'archivePapers':26,'archiveQuestions':2340,'sourceFiles':RAW['sources'],'figures':figures,'keyPublisher':'Union Public Service Commission','keyHosting':'UPSC-issued final-key PDFs preserved on ForumIAS; the direct UPSC archive was unavailable during retrieval.','officialKeyArchiveUrl':KEY_ARCHIVE,'explanations':'Editorial study explanations and previously supplied compatible explanations. UPSC publishes answer keys, not these explanations.','historicalScoring':{'csat2012':'Questions 74–80 carry no negative marking.','csat2013':'Questions 75–80 carry no negative marking.','csat2014':'English-comprehension questions 39–44 excluded; 74 scored questions, maximum 185.','csatQualifying':'33% qualifying threshold applies from 2015; 2012–2014 CSAT was included in merit.','practiceNormalization':'Maximum marks divided by the number of scored questions; X and E items excluded.'}})
print('Imported 18 papers / 1,620 questions; archive now 26 papers / 2,340 questions.')
