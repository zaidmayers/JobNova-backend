# Backend Planning Notes

Living doc — same idea as the frontend's `PLANNING.md` (root repo): a running record
of every step, decision, and bug for backend work, kept up to date as we go, meant to
be the reference for the submission video.

**Why this is a separate file from the root one:** this repo (`JobNova-backend`) is
private; the root repo is public. The root `PLANNING.md` has the backend's
architecture decisions and milestone list (not sensitive — just engineering
reasoning), but the real account/profile details and detailed progress log live here
instead, since they reference real personal data that shouldn't be in a public repo.
This file is the full, undredacted version — check here for backend video prep, the
same way the root file is the one for frontend.

## Milestone list (mirrors root `PLANNING.md`)

1. User creates Indeed account + manual verification (outside code)
2. `CandidateProfile` schema from real resume/contact/experience/education/preferences
3. Playwright + Node/TS login flow → `storageState()` export → encrypt → store
4. SQLite + encrypted local file for session + application state
5. Separate "resume session" script: decrypt → relaunch with storageState → confirm
   still logged in
6. Job search/filter/select logic (small N, relevance-filtered to real background)
7. Apply-flow automation using the real profile
8. Challenge detector: CAPTCHA/SMS/email-verification → write `manual_action_required`
   checkpoint → exit cleanly, no bypass attempt
9. Resume-from-checkpoint runner
10. `applications` table + status transitions (pending/in progress/submitted/failed/
    manual_action_required)
11. README: architecture, session store/restore, failure handling, multi-user
    extension notes

### Constraints to keep re-checking against (from the PDF's "Important" section)
- Only use real personal information — never fabricated profile data.
- Apply only to roles reasonably relevant to actual background.
- Never bypass verification, CAPTCHA, or any platform security mechanism — pause and
  hand back to the human instead.

## Real account details

- Indeed account created fresh for this project (not a reused/existing account —
  every other Gmail identity already had Indeed history, which would've defeated the
  point of testing verification flows against a genuinely new account).
- Gmail: `zaidjobnova@gmail.com`
- Phone: +1 206 930 0523
- Resume on file with Indeed: `Zaid_Mayers_Resume.pdf` (uploaded to the Indeed profile
  directly; also the source for our own `CandidateProfile` data later)

## Real background (from the resume) — for "reasonably relevant roles" later

- Name: Zaid Mayers
- Location: Seattle, WA
- M.S. Machine Learning Engineering (Drexel University), B.Tech Computer Science
- Current: Research Assistant (Drexel Co-op) — long-range drone detection, published
  to ICRA 2026 and AVSS 2026
- Other project work: RAG-based clinical summary systems (FastAPI + Ollama), full-stack
  platforms (booking, ERP), churn prediction (XGBoost/Flask/AWS), a mitotic-event
  classifier
- Core skills: Python, PyTorch/TensorFlow, LangChain/RAG/LLM inference, FastAPI/Flask,
  PostgreSQL, AWS/GCP, computer vision (YOLO, ResNet)

**Implication for job selection**: "reasonably relevant" roles are things like Machine
Learning Engineer, AI/ML Engineer, Computer Vision Engineer, Applied Research Engineer,
or Backend/Full-Stack Software Engineer roles with an ML/AI component. Not, e.g.,
unrelated fields with no engineering/ML overlap.

## Progress

- [x] **Step 1 — real Indeed account created.** Fresh Gmail (`zaidjobnova@gmail.com`)
      → fresh Indeed account, real phone (+1 206 930 0523) added, resume uploaded,
      basic profile filled in (Seattle, WA).
      **No verification challenge appeared at any point** — not at Google signup, not
      at Indeed signup, not when adding the phone number. Recorded honestly rather
      than assumed: this is a real, observed outcome.
      Working theory: a real human clicking through a normal browser doesn't look
      suspicious to begin with — the more likely trigger for Indeed's bot detection
      is our own *automated* Playwright login later (different browser fingerprint,
      no human mouse/timing entropy, etc.). That's the point we actually expect to
      see, and need to correctly handle, a challenge. Not a blocker — the pause/
      resume logic gets built defensively either way, and the submission README will
      note honestly whether a challenge was ever actually observed live by the time
      we're done, rather than claiming it was tested if it wasn't.
- [x] **Project scaffold** (`backend/`, this repo): Node + TypeScript (`tsx` for
      running `.ts` directly, no separate build step needed for dev), Playwright
      (Chromium installed), `better-sqlite3`, `dotenv`.
      `backend/.gitignore` set up FIRST, before any real code — blocks `.env`,
      `profile.json`, the actual `.db` file, and any `sessions/`/`*.session*` files
      from ever being committed, even though this repo is private (defense in depth,
      not relying on privacy alone).
      Verified via a smoke-test `src/index.ts` (temporary — will be replaced by real
      logic once we start building the actual login flow): confirmed Playwright can
      actually launch/drive a browser and `better-sqlite3` can read/write, before
      building anything real on top.
- [ ] `CandidateProfile` schema (real resume/contact/experience/education/preferences)
- [ ] Login flow + session save/restore
- [ ] Job search/select logic
- [ ] Apply-flow automation
- [ ] Verification-challenge pause/resume handling
- [ ] Application status tracking (SQLite)
- [ ] README (architecture, session handling, failure handling, multi-user extension)
