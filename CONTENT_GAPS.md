# Content gaps: evidence only Anikait can supply

The site only states what the résumé, the previous site or the project images support.
The items below would make it much stronger. The case studies are now visual showcases,
so this list is the full checklist (there are no hidden TODO markers in the pages any more).

**Rule:** add only real, measured or documented facts. If something wasn't measured,
leave it out.

## Turn on the contact form (5 minutes, once)
1. Go to https://formspree.io and sign up with **anikaitkaushiksep@gmail.com**.
2. Create a new form and copy its endpoint (looks like `https://formspree.io/f/abcdwxyz`).
3. In `index.html`, search for `data-endpoint=""` and paste it between the quotes.
4. Push. Messages then arrive in your Gmail. Until then, the form opens the visitor's email app instead.

## Conferences & workshops section
- [x] TRS–DSAI workshop photo added.
- [ ] **IIT Ropar:** the site now says "Participant" everywhere. If you presented Alaknanda's mechanical subsystem there, tell me and I'll add it back.

## Found in your documents folder: please fix or confirm
- [ ] **AIR 2025 was 2–5 July 2025** (per both certificates). Your résumé PDF says June 2025; the website now says July.
- [ ] **Patent title:** the Ganga ABEx poster cites it as "On-Board Rover Solid Soil Analysis: Chemical Detection & Sensor Monitoring". The CV says "An Apparatus, System and Method for Robotic Soil Analysis and Collection". The site uses the CV title; check which is official on InPASS.
- [ ] **Tray comparison image:** the site assumes left = older (Alaknanda), right = new (Ganga).
- [ ] **"Best Mechanical Award.jpg"** is a Certificate of Merit (Top 10 projects), so the site doesn't claim a "best mechanical" award. Add it only if a separate award exists.
- [ ] **Exoskeleton:** which parts of Gen 2 / Gen 4 you designed, and who built the joint-tracking GUI.

## Please confirm (written on the site from the previous version, not from the new CV)
- [ ] **IPRoMM 2026: first author?** (index.html, projects/abex.html)
- [ ] **Team Lead, ELC Internship 2025: 10-student team** (index.html → Roles)
- [ ] **IIT Ropar, Mar 2025: you presented Alaknanda's mechanical subsystem** (index.html → Conferences)
- [ ] **Garud: your personal scope** vs. the drone sub-team (projects/garud.html)
- [ ] **Ganga: does "21/30 successful trials" refer to the whole rover or to ABEx only?**
- [ ] **Ganga: which subsystems teammates owned** (electronics, software, autonomy) (projects/ganga.html)

## Highest-value additions
1. **Failures and fixes** for Ganga, ABEx and ClimbCart: 2–3 concrete failure modes each and what you changed. Professors and recruiters weigh this heavily.
2. **Design decisions for ABEx**: why an auger, actuator choice, alignment method, and which alternatives you rejected.
3. **ClimbCart**: the surveyed stair dimensions, target payload, the sprocket material you chose instead of aluminium, and prototype test results.
4. **GitHub repositories**: any code (MATLAB gait analysis, Arduino, LoCoBot), even small. Right now the GitHub link only goes to your profile.
5. **LoCoBot**: Simscape model screenshots or a screen recording once available.
6. **Requirements for Ganga**: mass budget, envelope, task list.
7. **Videos are done:** all now come from `assets/video/` (41 MB total, compressed from about 470 MB). The old large files in `assets/img/` (`4.mp4`, `6.mp4`, `18.mp4`, `uq-qualysis.mp4` and the multi-MB PNGs) are no longer used by any page. You can delete them to speed up deploys.

## Not added on purpose
- Phone number (privacy on a public site)
- School marks (not relevant to the target audience)
- `17.png` (a person's portrait, not identified) and `air2025-group.jpg` (event not confirmed)
