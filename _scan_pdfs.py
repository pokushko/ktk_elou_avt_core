import glob
import os
from pypdf import PdfReader

pdf_files = sorted(glob.glob('C:/Users/pokus/.gemini/antigravity-ide/brain/5b6a2a5c-867b-4dc6-b9cd-5bf2183a1e8d/*.pdf'))

print(f"Total PDFs found: {len(pdf_files)}")

for p in pdf_files:
    fname = os.path.basename(p)
    try:
        reader = PdfReader(p)
        text = ""
        for i, page in enumerate(reader.pages):
            try:
                t = page.extract_text()
                if t:
                    text += f"\n--- Page {i+1} ---\n" + t
            except Exception:
                pass
        
        preview = text.strip()[:300].replace('\n', ' ')
        print(f"\n==========================================")
        print(f"FILE: {fname} (Pages: {len(reader.pages)})")
        print(f"PREVIEW: {preview[:200]}")
        
        # Check if this PDF contains presentation or competition format guidelines
        keywords = ['презентаци', 'конкурс', 'формат', 'структура', 'требован', 'критери', 'положение', 'этап', 'слайд']
        found = [k for k in keywords if k in text.lower()]
        if found:
            print(f"➡️ MATCHED KEYWORDS: {found}")
            # Print matching pages
            for i, page in enumerate(reader.pages):
                try:
                    ptxt = page.extract_text() or ""
                    if any(k in ptxt.lower() for k in keywords):
                        print(f"   [Page {i+1}]: {ptxt[:300].strip()}...")
                except Exception:
                    pass
    except Exception as e:
        print(f"Error opening {fname}: {e}")
