import gzip,json,pathlib,urllib.request,hashlib,concurrent.futures,re,io,subprocess,fitz
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]
p=json.loads(gzip.decompress((root/'scripts/data/cse-older-import.checkpoint.json.gz').read_bytes()))
cache=root/'scripts/data/older-source-text'; cache.mkdir(parents=True,exist_ok=True)
out=root/'public/paper-figures'; out.mkdir(parents=True,exist_ok=True)
manifest={}
def download(url):
    for i in range(3):
        try: return urllib.request.urlopen(urllib.request.Request(url.replace('http://','https://'),headers={'User-Agent':'Mozilla/5.0'}),timeout=60).read()
        except Exception:
            if i==2: raise
def combine(parts,path):
    imgs=[Image.open(io.BytesIO(x)).convert('RGB') for x in parts]
    image=Image.new('RGB',(max(x.width for x in imgs),sum(x.height for x in imgs)), 'white')
    y=0
    for im in imgs: image.paste(im,(0,y)); y+=im.height
    image.save(path,format='JPEG',quality=88)
def lines(page):
    return [{'text':' '.join(s['text'] for s in l['spans']),'bbox':l['bbox']} for b in page.get_text('dict')['blocks'] if 'lines' in b for l in b['lines']]
maps={2012:{48:31,49:31,50:32,51:33,52:33,53:34},2013:{17:7,18:8,19:8,20:9,21:10,23:12,24:12,30:15},2014:{13:6,14:7,15:8,16:8,17:9,18:10,19:10,20:11}}
for y in [2012,2013,2014,2016]:
    suffix={2012:'2012-UPSC-CSAT-PAper-2-Solved-English1.pdf',2013:'2013-UPSC-CSAT-Paper-2-Solved-English1.pdf',2014:'2014-UPSC-CSAT-Paper-2-Solved-English1.pdf',2016:None}[y]
    url='https://iasbaba.com/wp-content/uploads/2015/05/'+suffix if suffix else 'https://www.ungist.com/uploads/pdfs/UPSC_CSAT_2016_Question_Paper_with_Answer_Key.pdf'
    pdfpath=cache/f'csat-{y}.pdf'
    if not pdfpath.exists(): pdfpath.write_bytes(download(url))
    doc=fitz.open(pdfpath)
    texts=[]
    for pg in doc:
        if y==2016:
            text=pg.get_text(clip=fitz.Rect(0,0,pg.rect.width/2,pg.rect.height))+pg.get_text(clip=fitz.Rect(pg.rect.width/2,0,pg.rect.width,pg.rect.height))
        else: text=pg.get_text()
        texts.append(text)
    (cache/f'csat-{y}.txt').write_text('\n'.join(texts))
    for n,idx in maps.get(y,{}).items():
        page=doc[idx]; candidates=[l for l in lines(page) if re.match(r'^'+str(n)+r'\.(?:\s|$)',l['text'].strip())]
        if not candidates:
            for j in range(max(0,idx-1),min(len(doc),idx+2)):
                candidates=[l for l in lines(doc[j]) if re.match(r'^'+str(n)+r'\.(?:\s|$)',l['text'].strip())]
                if candidates: idx=j;page=doc[j];break
        assert candidates,(y,n,idx)
        top=candidates[0]['bbox'][1]-3
        if y==2012 and n==51: top=60
        pieces=[]
        for j in range(idx,min(idx+3,len(doc))):
            page=doc[j]; start=top if j==idx else 65
            stops=[l['bbox'][1]-3 for l in lines(page) if l['bbox'][1]>start+3 and (re.match(r'^Solution\s*:',l['text'].strip(),re.I) or re.match(r'^'+str(n+1)+r'\.(?:\s|$)',l['text'].strip()))]
            bottom=min(stops) if stops else page.rect.height-55
            pix=page.get_pixmap(matrix=fitz.Matrix(2,2),clip=fitz.Rect(65,start,page.rect.width-55,bottom))
            pieces.append(pix.tobytes('png'))
            if stops: break
        name=f'csat-{y}-q{n}.jpg'; combine(pieces,out/name);manifest[f'{y}-{n}']=[name]
    shared={2013:[('professors',13,(73.5,551.7,293.5,760)),('professors',14,(73.5,72,240.5,202.2))],2014:[('profits',5,(73.5,189.2,270,382))]}.get(y,[])
    sharedparts={}
    for label,idx,rect in shared:
        sharedparts.setdefault(label,[]).append(doc[idx].get_pixmap(matrix=fitz.Matrix(2,2),clip=fitz.Rect(rect)).tobytes('png'))
    for label,parts in sharedparts.items():
        name=f'csat-{y}-{label}.jpg';combine(parts,out/name)
        for n in (range(25,30) if y==2013 else range(9,13)):manifest[f'{y}-{n}']=[name]
    doc.close()
def webasset(item):
    y,q=item
    if y==2015 and q['number']==80:return
    names=[]
    for i,url in enumerate(q.get('images',[])):
        try:
            b=download(url); im=Image.open(io.BytesIO(b)).convert('RGB')
            name=f'csat-{y}-q{q["number"]}-{i+1}.jpg';im.save(out/name,format='JPEG',quality=90);names.append(name)
        except Exception as exc: print('NEEDS_FALLBACK',y,q['number'],i,url,str(exc),flush=True)
    manifest[f'{y}-{q["number"]}']=names
items=[(y,q) for y in [2015,2018] for q in p['csat'][str(y)] if q.get('images')]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as e:list(e.map(webasset,items))
# Smaller audit images are readable through GitHub's base64 file API.
keysdir=root/'scripts/data/older-key-audit'
for path in keysdir.glob('*.png'):
    im=Image.open(path).convert('RGB');im.thumbnail((1800,2300));im.save(path.with_suffix('.jpg'),quality=92)
# Record images before adding original-paper fallbacks.
(out/'older-figures.json').write_text(json.dumps(manifest,indent=2))
print('FIGURES',json.dumps(manifest))
print('SOURCE_TEXT',json.dumps({str(y):len((cache/f'csat-{y}.txt').read_text()) for y in [2012,2013,2014,2016]}))
