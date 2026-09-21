"""Independent PDF checks and visual QA renders. Requires PyMuPDF.
Run after node scripts/generate-pdf-fixtures.cjs.
"""
from pathlib import Path
import pymupdf
import json

ROOT=Path(__file__).resolve().parents[1]
PT=72/25.4
files=list((ROOT/'output/pdf').glob('*.pdf'))+list((ROOT/'tmp/pdfs').glob('*.pdf'))
assert files
for file in files:
    doc=pymupdf.open(file)
    for page in doc:
        assert abs(page.rect.width/PT-210)<0.0001, file
        assert abs(page.rect.height/PT-297)<0.0001, file
        assert not page.get_images(), f'{file}: raster image instead of vector/text'
        fonts=page.get_fonts(full=True)
        assert fonts
        for font in fonts:
            assert doc.extract_font(font[0])[3], f'{file}: font not embedded'
    page=doc[0]
    if file.name in ('calibration-5point.pdf','labels-v3240.pdf','font-test.pdf','circle.pdf','proof-v3240.pdf'):
        page.get_pixmap(matrix=pymupdf.Matrix(1.4,1.4)).save(ROOT/'tmp/pdfs'/f'{file.stem}.png')

proof=pymupdf.open(ROOT/'output/pdf/proof-v3240.pdf')
rects=[d['rect'] for d in proof[0].get_drawings()]
assert len(rects)==16
for i,r in enumerate(rects):
    expected=(5.1+(i%2)*101.55,13.8+(i//2)*33.85,99.05,33.85)
    actual=(r.x0/PT,r.y0/PT,r.width/PT,r.height/PT)
    assert max(abs(a-b) for a,b in zip(actual,expected))<0.0001,(i,actual,expected)

corrected=pymupdf.open(ROOT/'tmp/pdfs/corrected-proof.pdf')
# Test transformed vertices independently of the implementation's PDF matrix.
paths=corrected[0].get_drawings()
first=paths[0]
vertices=[]
for item in first['items']:
    if item[0]=='l':vertices.extend([item[1],item[2]])
expected=[(.99*x+.002*y+1.1,-.001*x+1.005*y-.8) for x,y in [(5.1,13.8),(104.15,13.8),(5.1,47.65),(104.15,47.65)]]
for x,y in expected:
    assert any(abs(v.x/PT-x)<0.0001 and abs(v.y/PT-y)<0.0001 for v in vertices),(x,y,vertices)

labels=pymupdf.open(ROOT/'output/pdf/labels-v3240.pdf')
text=labels[0].get_text()
assert text.count('차곡차곡, 나의 기록')==16,repr(text)
fonts=pymupdf.open(ROOT/'tmp/pdfs/font-test.pdf')
assert len({font[0] for font in fonts[0].get_fonts()})==6
assert fonts[0].get_text().count('한글 글꼴 검증')==6
# Text extraction alone misses corrupt subset glyph outlines. Every Korean
# glyph in the six-font sample must also leave visible ink in the raster.
page=fonts[0]
for block in page.get_text('rawdict')['blocks']:
    for line in block.get('lines',[]):
        for span in line['spans']:
            for char in span['chars']:
                if '\uac00' <= char['c'] <= '\ud7a3':
                    pix=page.get_pixmap(matrix=pymupdf.Matrix(3,3),clip=pymupdf.Rect(char['bbox']),colorspace=pymupdf.csGRAY)
                    assert sum(v<220 for v in pix.samples)>15, f"Missing glyph ink: {char['c']}"
verification=pymupdf.open(ROOT/'tmp/pdfs/verification.pdf')
assert len(verification)==10
assert '10 of 10' in verification[9].get_text()
calibration=pymupdf.open(ROOT/'output/pdf/calibration-5point.pdf')
assert '보정 계산용' in calibration[0].get_text()
for token in ['A (20, 20)','B (190, 20)','C (105, 148.5)','D (20, 277)','E (190, 277)']:
    assert token in calibration[0].get_text(),token
print('PASS: A4 MediaBox, embedded six Korean font faces, vector output, 16 exact rectangles, affine transformed vertices, Korean text extraction, and 10 verification pages.')
