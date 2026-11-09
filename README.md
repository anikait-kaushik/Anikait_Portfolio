<div align="center">

# Anikait Kaushik · Portfolio

**Robotics & Mechatronics Engineer** · Medical Robotics Intern, TIET-UQ Centre of Excellence

[**anikaitkaushik.vercel.app**](https://anikaitkaushik.vercel.app) · [Research](https://anikaitkaushik.vercel.app/research) · [Résumé](https://anikaitkaushik.vercel.app/assets/docs/Anikait_Kaushik_Resume.pdf) · [LinkedIn](https://www.linkedin.com/in/anikait-kaushik-9435b1289)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-000000?logo=threedotjs&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel&logoColor=white)

</div>

---

## About

Personal portfolio covering field robotics, human gait research and a lower-limb exoskeleton. It is a hand-written static site with no framework and no build step, plus one serverless function for the contact form.

## Highlights

- **Interactive engineering demos:** a 3D pick-and-place arm with closed-form inverse kinematics, a bipedal gait model, and a hero background where a rover plans with A* and maps with a simulated LiDAR.
- **Case studies** for each major project: Mars rovers Ganga and Alaknanda, the R3 exoskeleton, ClimbCart, Garud, LoCoBot Sim2Real and MARVIN.
- **Research page** with publications, a patent application and conference work.
- **Contact form** that emails messages through a Vercel function, with input validation and rate limiting.
- **Fast and private:** cookieless Vercel Web Analytics only, lazy-loaded 3D, optimised WebP and JPEG images, long-lived asset caching.
- **Accessible and responsive:** works on mobile and degrades gracefully without JavaScript.

## Pages

| Page | Path |
|---|---|
| Home | [`/`](https://anikaitkaushik.vercel.app) |
| Research & publications | [`/research`](https://anikaitkaushik.vercel.app/research) |
| MARS Annual Magazine 2025–26 | [`/magazine`](https://anikaitkaushik.vercel.app/magazine) |
| Ganga: Mars rover, IRC 2026 champion | [`/projects/ganga`](https://anikaitkaushik.vercel.app/projects/ganga) |
| Alaknanda: Mars rover, Gen 3 | [`/projects/alaknanda`](https://anikaitkaushik.vercel.app/projects/alaknanda) |
| R3 exoskeleton research | [`/projects/exoskeleton`](https://anikaitkaushik.vercel.app/projects/exoskeleton) |
| ClimbCart: stair-climbing robot | [`/projects/climbcart`](https://anikaitkaushik.vercel.app/projects/climbcart) |
| Garud: competition drone | [`/projects/garud`](https://anikaitkaushik.vercel.app/projects/garud) |
| LoCoBot Sim2Real with MathWorks | [`/projects/locobot`](https://anikaitkaushik.vercel.app/projects/locobot) |
| MARVIN: autonomous cleaning robot | [`/projects/marvin`](https://anikaitkaushik.vercel.app/projects/marvin) |

## Project structure

```text
.
├── index.html            Home page
├── research.html         Research and publications
├── magazine.html         MARS magazine flipbook
├── projects/             One page per engineering case study
├── api/
│   └── contact.js        Vercel function: contact form → Gmail
├── assets/
│   ├── css/site.css      Shared design system
│   ├── js/
│   │   ├── site.js       Navigation, scroll-spy, lightbox, filters
│   │   ├── hero-fx.js    Rover path-planning background
│   │   ├── arm3d.js      3D pick-and-place arm (Three.js)
│   │   └── leg3d.js      Bipedal gait model (Three.js)
│   ├── img/web/          Optimised images used by the site
│   ├── video/            Project clips and poster frames
│   ├── magazine/         Magazine page images
│   └── docs/             Résumé and magazine PDFs
├── sitemap.xml
├── robots.txt
├── vercel.json           Clean URLs, redirects, cache headers
└── package.json          Function dependency (nodemailer)
```

## Running locally

No install is needed for the site itself. Serve the folder with any static server:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. The contact form needs the Vercel function, so locally it falls back to opening your email app.

To run the function as well, use the Vercel CLI:

```bash
npm install
npx vercel dev
```

## Deployment

The site deploys to **Vercel** on every push to `main`. Pull requests get preview deployments.

The contact form needs these environment variables in Vercel (*Project → Settings → Environment Variables*):

| Variable | Purpose |
|---|---|
| `GMAIL_USER` | Gmail address that sends the messages |
| `GMAIL_APP_PASSWORD` | Google App Password for that account (never commit it) |
| `CONTACT_TO` | *Optional.* Inbox that receives messages; defaults to `GMAIL_USER` |

## Content and copyright

All text, photographs, videos and project material are © Anikait Kaushik and teammates, and may not be reused without permission. Publications are listed as their real status: the gait manuscript as *under review* and the patent as a *published application*.

## Contact

**Anikait Kaushik** · [anikaitkaushiksep@gmail.com](mailto:anikaitkaushiksep@gmail.com) · [LinkedIn](https://www.linkedin.com/in/anikait-kaushik-9435b1289)
