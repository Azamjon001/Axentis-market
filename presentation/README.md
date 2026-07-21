# Axentis Market — Investor Presentation

A premium, dark-luxury investor deck for **Axentis Market**, the full-stack
commerce ecosystem (marketplace + seller operating system + control tower).

**Deliverable:** [`Axentis-Market-Investor-Presentation.pdf`](Axentis-Market-Investor-Presentation.pdf)
— 22 pages, 16:9 (1280×720), built for investors, enterprise clients and
government / institutional audiences.

## Contents

| Page | Section |
|-----:|---------|
| 01 | Cover |
| 02 | Executive Summary |
| 03 | Market Opportunity |
| 04 | The Problem |
| 05 | The Solution |
| 06 | Ecosystem Overview (12 products) |
| 07 | Platform Architecture |
| 08 | Mobile Application |
| 09 | Company Dashboard |
| 10 | Marketplace Admin Panel |
| 11 | Analytics · Performance |
| 12 | Analytics · Business KPIs |
| 13 | Business Model |
| 14 | Unit Economics & Projections |
| 15 | Technology Stack |
| 16 | Security & Compliance |
| 17 | Scalability |
| 18 | Competitive Advantages |
| 19 | Traction & Momentum |
| 20 | Go-to-Market & Expansion |
| 21 | Future Roadmap |
| 22 | Vision / Conclusion |

## Design

- Luxury dark theme; purple + blue accents, green for success states.
- Inter (body) and Space Grotesk (display) — latin subsets embedded as base64
  so the PDF and standalone HTML render identically everywhere, offline.
- All diagrams, charts, mockups and icons are hand-built inline SVG/CSS —
  no external assets, no image dependencies.

> Financial figures (TAM/SAM/SOM, projections, KPIs) are **illustrative**
> scenario numbers for planning, not audited results.

## Rebuilding

The deck is authored in [`deck.html`](deck.html) (with a `/*FONTS*/` token).
The build script injects the embedded fonts and renders the PDF via headless
Chromium:

```bash
python3 build.py
```

Outputs:
- `Axentis-Market-Investor-Presentation.html` — self-contained single file
- `Axentis-Market-Investor-Presentation.pdf` — the shareable deck

Override the browser with `CHROME_BIN=/path/to/chrome python3 build.py`.
