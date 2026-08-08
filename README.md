# Anikait Kaushik — Portfolio

Personal portfolio for **Anikait Kaushik** — Mechatronics & Robotics Engineer / Researcher (TIET, Patiala).

Single-file static site. No build step, no dependencies, no tracking. Loads fast, works on mobile, SEO-friendly.

## Structure
```
.
├── index.html                 # the whole site (HTML + CSS + JS inline)
├── assets/
│   ├── img/                   # engineering figures (rover, ABEx CAD, gait lab, CLIMB CART)
│   └── docs/Anikait_Kaushik_Resume.pdf
├── vercel.json
└── README.md
```

## Run locally
Just open `index.html`, or serve the folder:
```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Deploy on Vercel
This is a static site — no framework config needed.

**Option A — via GitHub (recommended for auto-deploy):**
1. Push this repo to GitHub (see below).
2. On vercel.com → *Add New → Project → Import* your GitHub repo.
3. Framework preset: **Other**. Build command: *(none)*. Output directory: `.`
4. Deploy. Every push to `main` redeploys automatically.

**Option B — Vercel CLI:**
```bash
npm i -g vercel && vercel --prod
```

## Push to GitHub
```bash
git init
git add .
git commit -m "Portfolio v1"
git branch -M main
git remote add origin https://github.com/<your-username>/anikait-portfolio.git
git push -u origin main
```

## Editing content
All copy lives in `index.html`, organised by section (`#about`, `#research`, `#work`,
`#publications`, `#leadership`, `#skills`, `#contact`). Design tokens (colours, fonts)
are the CSS variables in `:root` at the top of the `<style>` block.

## Content provenance
Content is drawn from the résumé, the IPRoMM paper, the Euler–Lagrange gait manuscript,
the published patent record, and the CLIMB CART capstone. The gait manuscript is shown as
**under review** only; the patent is shown as a **published application (not granted)**.
