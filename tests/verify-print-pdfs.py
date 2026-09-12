"""Inspect real browser PDFs; no clinical data is used in these fixtures."""
from pathlib import Path
import json
import fitz

root = Path(__file__).resolve().parents[1] / 'tmp/print-layout'
problems, summary = [], []
expected = ['chromium-desktop-standard.pdf', 'chromium-mobile-standard.pdf', 'senza-esami.pdf', 'testi-lunghi.pdf']
for name in expected:
    path = root / name
    if not path.exists():
        problems.append(f'{name}: PDF missing')
        continue
    pdf = fitz.open(path)
    texts = [p.get_text() for p in pdf]
    summary.append({'file': name, 'pages': len(pdf), 'text_lengths': list(map(len, texts))})
    if name != 'testi-lunghi.pdf' and len(pdf) != 5:
        problems.append(f'{name}: expected 5 pages, got {len(pdf)}')
    for i, page in enumerate(pdf):
        page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2)).save(root / f'{path.stem}-page-{i+1}.png')
        if abs(page.rect.width - 595.28) > 1 or abs(page.rect.height - 841.89) > 1:
            problems.append(f'{name} page {i+1}: not A4')
        if len(texts[i].strip()) < 20:
            problems.append(f'{name} page {i+1}: blank or nearly empty page')
        # Named-page margins should apply on overflow pages as well.
        for x0, y0, x1, y1, text, *_ in page.get_text('blocks'):
            if x0 < 30 or x1 > page.rect.width - 30 or y0 < 24 or y1 > page.rect.height - 24:
                problems.append(f'{name} page {i+1}: text outside margins: {text[:70]!r}')
    joined = '\n'.join(texts)
    if name.endswith('standard.pdf'):
        for marker, page_index in [('CARTELLA SANITARIA E DI RISCHIO', 0), ('1. ANAMNESI LAVORATIVA', 1),
                                   ('4. PROGRAMMA DI SORVEGLIANZA SANITARIA', 2), ('5. ESAME CLINICO GENERALE', 3)]:
            if page_index >= len(texts) or marker not in texts[page_index]:
                problems.append(f'{name}: {marker} is not on page {page_index+1}')
        for label in ['PAS', 'PAD', '120', '80']:
            if len(texts) < 4 or label not in texts[3]:
                problems.append(f'{name}: vital signs split or missing: {label}')
        if not pdf[0].get_images() or not pdf[-1].get_images():
            problems.append(f'{name}: missing doctor signature on first/final page')
        for marker in ['AUDIOGRAMMA INDICATIVO', 'FVC 4.00 L', 'FIRMA']:
            if marker != 'FIRMA' and marker not in joined:
                problems.append(f'{name}: missing graph content {marker}')
    if name == 'senza-esami.pdf' and any(x in joined for x in ['AUDIOGRAMMA INDICATIVO', 'CURVA VOLUME']):
        problems.append(f'{name}: graph shown without exam data')
    if name == 'testi-lunghi.pdf':
        for i in range(1, 131):
            if f'RIGA {i:03d}:' not in joined:
                problems.append(f'{name}: line {i} truncated')
        for marker in ['ULTIMA NOTA CLINICA DI COLLAUDO', 'FINE PRESCRIZIONI DI COLLAUDO']:
            if marker not in joined:
                problems.append(f'{name}: trailing content missing: {marker}')
(root / 'pdf-report.json').write_text(json.dumps({'summary': summary, 'problems': problems}, indent=2))
print(json.dumps({'summary': summary, 'problems': problems}, indent=2))
if problems:
    raise SystemExit(1)
