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
- [x] **`CandidateProfile` schema + real profile data.**
      `src/types/profile.ts` — the shape (fullName, email, phone, location, resume
      path, education[], experience[], skills[], jobPreferences). Safe to commit —
      structure only, no real data.
      `profile.example.json` — fake filled-in example showing the shape, committed.
      `profile.json` — the **real** data, gitignored, never committed. Contains full
      real education/experience history from the resume, and answers to the
      questions only Zaid could answer (not guessable from a resume):
        - Target titles: Machine Learning Engineer, AI Engineer, GenAI Engineer,
          Computer Vision Engineer, Software Engineer, Full-Stack Engineer, Backend
          Engineer
        - Locations: "Anywhere in the US" (confirmed no conflict with the brief —
          it only requires "reasonably relevant," not geographically restricted)
        - Min salary: $70,000/yr or $27/hr (stored both — some listings ask hourly,
          not just annual; schema field renamed from a single `amount`/`period` pair
          to `{ annual, hourly }` to hold both accurately rather than picking one)
        - Work authorization: **requires sponsorship** — a real, load-bearing fact.
          Matters twice: (1) must be answered truthfully on any application that
          asks it, (2) worth factoring into job selection later, since some listings
          explicitly won't consider candidates needing sponsorship.
        - Availability: immediate
      `src/lib/profile.ts` — loader with a clear error if `profile.json` is missing
      (expected for anyone else who clones this repo — they'd only have
      `profile.example.json`), plus a minimal required-field check (not a full
      schema validator — out of scope for "small reusable module," just enough to
      fail loudly and early rather than deep into a browser run).
      Experience entries deliberately have **optional** start/end dates — the
      resume's project entries (Altabeeb, LISTO, etc.) don't list precise dates
      unlike the formal Research Assistant role, and dates weren't invented to fill
      the gap.
      Bug found + fixed: `tsc --noEmit` failed with "Cannot find name 'console'" /
      "'node:fs'" even though `@types/node` was installed — tsconfig needed an
      explicit `"types": ["node"]`; wasn't being auto-discovered otherwise. Same
      "bleeding-edge toolchain" pattern we hit on the frontend (Next.js 16, Tailwind
      v4) — new package versions in this environment need occasional adjustments
      that older tutorials/muscle memory wouldn't expect.
      Verified: rewrote `src/index.ts` (was just the scaffold smoke test) to load
      the real profile and print a summary — ran it, confirmed every field reads
      back correctly. Then confirmed `tsc --noEmit` clean too.
      **Still needed**: the actual resume PDF file on disk at
      `backend/Zaid_Mayers_Resume.pdf` (referenced by `profile.json`'s
      `resumePath`) — only exists as a chat attachment so far, not yet placed in
      the folder. Not blocking anything yet; needed once the apply-flow step
      actually uploads/attaches it.
- [~] **Login flow + session save/restore — in progress, real obstacle hit and
      being worked around.**
      Built first: `src/lib/crypto.ts` (AES-256-GCM encrypt/decrypt — authenticated
      encryption, so a tampered or wrong-key file fails loudly instead of silently
      returning garbage), `src/lib/session.ts` (wraps Playwright's
      `context.storageState()` — the actual "wristband" — through that encryption,
      reads/writes `sessions/indeed.session`, gitignored), `.env`/`.env.example` for
      the encryption key (`SESSION_ENCRYPTION_KEY`, 32-byte random hex, generated via
      Node's own `crypto.randomBytes` — `.env` itself gitignored, confirmed via
      `git check-ignore` before writing anything real into it).
      `src/login.ts` — first attempt: launch a *visible* (non-headless) Playwright
      browser, human manually clicks through "Continue with Google," script watches
      navigation events (waits for the URL to hit `accounts.google.com`, then waits
      for it to return to indeed.com not on a login path) rather than requiring a
      relayed keypress, which isn't reliably possible in this setup anyway.

      **Bug found + fixed (before the bigger obstacle)**: the original version only
      called `browser.close()` on the success path — a timeout/error left an orphaned
      browser window running. Fixed with try/finally so it always closes.

      **First real run**: timed out after 5 minutes — turned out Zaid just hadn't
      looked at the screen yet (window opened, sat on indeed.com, nobody clicked
      anything). Not a technical failure, just retried.

      **Second run — the actual obstacle**: Google outright refused the sign-in —
      "Couldn't sign you in. This browser or app may not be secure," specifically
      naming the browser as "Google Chrome for Testing" (Playwright's bundled
      Chromium identifies itself as this). Google detects automated/CDP-controlled
      browser sessions and blocks OAuth sign-in through them *regardless of whether
      a real human is doing the clicking* — the block is on the browser itself, not
      the behavior inside it.

      **This is not something to work around by evasion** (spoofing the browser
      identity, stripping automation flags, etc.) — that would be exactly the kind
      of security-mechanism bypass the brief says not to do, just aimed at Google
      instead of Indeed.

      **The actual fix — flip where the login happens:**
      1. Zaid logs into Indeed via Google in his own **normal, everyday Chrome** —
         zero automation involved, so Google has no reason to block it.
      2. Export the resulting session cookies from that real browser using a
         standard cookie-export extension (Cookie-Editor) — an ordinary, sanctioned
         mechanism (same category of access as opening DevTools), not a bypass of
         anything.
      3. Import that export into our own `storageState`-shaped format and encrypt/
         save it exactly the same way `saveSession()` already does — Playwright
         never touches the Google login step at all from here on.
      **Still to build**: the import script that converts a Cookie-Editor export
      into our session format. `src/login.ts` (the automated-browser version) is
      superseded by this approach and will likely be deleted or repurposed once the
      import path is proven — not deleted yet in case it's useful reference.
- [ ] Job search/select logic
- [ ] Job search/select logic
- [ ] Apply-flow automation
- [ ] Verification-challenge pause/resume handling
- [ ] Application status tracking (SQLite)
- [ ] README (architecture, session handling, failure handling, multi-user extension)
