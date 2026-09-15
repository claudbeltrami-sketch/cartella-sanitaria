"""Inspect generated PDFs; synthetic records only."""
from pathlib import Path
import fitz, base64, io
from PIL import Image, ImageDraw
root=Path('tmp/print-layout')
for engine in ['chromium','webkit']:
 for kind in ['cartella','certificato','consenso']:
  path=root/f'thermal-{engine}-{kind}.pdf';doc=fitz.open(path)
  assert len(doc)>=(5 if kind=='cartella' else 1), (path,len(doc))
  thumbs=[]
  for i,page in enumerate(doc):
   assert abs(page.rect.width-595.28)<1 and abs(page.rect.height-841.89)<1
   pix=page.get_pixmap(matrix=fitz.Matrix(1,1),colorspace=fitz.csGRAY)
   assert sum(v<180 for v in pix.samples)>500, (path,i,'blank page')
   img=Image.frombytes('L',(pix.width,pix.height),pix.samples)
   framed=Image.new('L',(img.width,img.height+28),255);framed.paste(img,(0,28));ImageDraw.Draw(framed).text((12,5),f'{kind.upper()} - {engine} - pagina {i+1}',fill=0);thumbs.append(framed)
  print(f'PDF_CHECK {path.name}: {len(doc)} A4 pages with visible content')
  if engine=='webkit':
   columns=min(3,len(thumbs));rows=(len(thumbs)+columns-1)//columns
   sheet=Image.new('L',(columns*thumbs[0].width,rows*thumbs[0].height),235)
   for i,img in enumerate(thumbs):sheet.paste(img,((i%columns)*img.width,(i//columns)*img.height))
   stream=io.BytesIO();sheet.save(stream,format='PNG',optimize=True)
   print('THERMAL_VISUAL:'+kind+':'+base64.b64encode(stream.getvalue()).decode())
