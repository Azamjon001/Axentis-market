#!/usr/bin/env python3
"""Inject embedded fonts into deck.html and render to PDF via headless Chrome."""
import subprocess, pathlib, sys, os

HERE = pathlib.Path(__file__).parent
CHROME = os.environ.get("CHROME_BIN", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")

# Latin-subset Inter + Space Grotesk, base64-embedded so the PDF is fully self-contained.
fonts = (HERE / "fonts.css").read_text()
html = (HERE / "deck.html").read_text()
html = html.replace("/*FONTS*/", fonts, 1)

final = HERE / "Axentis-Market-Investor-Presentation.html"
final.write_text(html)
print(f"Built self-contained HTML: {final} ({len(html)//1024} KB)")

pdf = HERE / "Axentis-Market-Investor-Presentation.pdf"
cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
       "--no-pdf-header-footer", "--disable-pdf-tagging",
       "--force-color-profile=srgb", "--hide-scrollbars",
       f"--print-to-pdf={pdf}", "--virtual-time-budget=8000",
       final.as_uri()]
r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
sys.stderr.write(r.stderr[-1500:])
print("\nExit:", r.returncode, "| PDF:", pdf, pdf.stat().st_size//1024 if pdf.exists() else "MISSING", "KB")
