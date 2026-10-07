import gzip,json,pathlib,urllib.request,hashlib,concurrent.futures,subprocess,fitz
root=pathlib.Path(__file__).resolve().parents[1]
p=json.loads(gzip.decompress((root/'scripts/data/cse-older-import.checkpoint.json.gz').read_bytes()))
folder=root/'scripts/data/older-key-audit'; folder.mkdir(parents=True,exist_ok=True)
def get(s):
    path=folder/s['file']
    for i in range(3):
        try:
            b=urllib.request.urlopen(urllib.request.Request(s['url'],headers={'User-Agent':'Mozilla/5.0'}),timeout=50).read()
            assert hashlib.sha256(b).hexdigest()==s['sha256'],s['file']
            path.write_bytes(b); return
        except Exception:
            if i==2: raise
sources=[s for s in p['sources'] if 'key-mirror' in s['file']]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as e: list(e.map(get,sources))
out=[]
for name,key in p['keys'].items():
    doc=fitz.open(folder/(name+'-key-mirror.pdf'))
    pix=doc[key['page']].get_pixmap(matrix=fitz.Matrix(3,3))
    img=folder/(name+'.png'); img.write_bytes(pix.tobytes('png'))
    r=subprocess.run(['tesseract',str(img),'stdout','--psm','6'],capture_output=True,text=True,check=True)
    (folder/(name+'.txt')).write_text(r.stdout)
    out.append(name+' SERIES '+key['booklet']+'\n'+r.stdout)
    doc.close()
(folder/'all-keys.txt').write_text('\n\n'.join(out))
print('\n\n'.join(out))
for path in folder.glob('*.pdf'): path.unlink()
