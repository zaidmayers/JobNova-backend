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
      **Built and proven, end to end:**
      - `saveSessionState()` added to `session.ts` — a lower-level version of
        `saveSession()` that takes a plain state object instead of a live Playwright
        context, since the import path doesn't have one.
      - `src/import-session.ts` — reads a Cookie-Editor JSON export, maps its fields
        to Playwright's `storageState` cookie shape (`expirationDate` → `expires` in
        seconds, or `-1` for session cookies; `sameSite` string values like
        `"no_restriction"` → Playwright's `"None"`/`"Lax"`/`"Strict"`), then
        encrypts and saves via `saveSessionState()`. Known limitation: Cookie-Editor
        only exports cookies, not localStorage — Indeed's auth looks to be entirely
        cookie-based (token names like `PassportAuthProxy-BearerToken`,
        `PassportAuthProxy-RefreshToken`, `PPID` all showed up), so this hasn't been
        a problem, but noted in case it ever matters.
      - The actual real cookies were handled carefully: Zaid pasted the raw
        Cookie-Editor export into chat, it was written straight to a scratch temp
        file *outside* the git repo entirely (not even relying on `.gitignore` —
        simply never placed inside a tracked folder), immediately run through the
        import script, and the plaintext scratch file was deleted right after. The
        only thing that persists on disk is the encrypted `sessions/indeed.session`.
      - `src/verify-session.ts` — proves the whole thing actually works: loads the
        saved session into a **brand new** browser context (no login flow touched at
        all) and checks whether Indeed shows a logged-in, personalized page.

      **Second obstacle hit + fixed**: first verification attempt used a headless
      browser and got a flat **"Request Blocked"** page from Cloudflare (Indeed's
      bot-protection layer) — a different block than the Google one, and this time
      not even about the cookies' validity; Cloudflare rejected the *request itself*
      based on headless-browser signals before any login check happened. Fixed by
      launching non-headless (`headless: false`) instead — same category of fix as
      the Google problem (look like a normal browser), no evasion tricks involved,
      just not presenting the obvious "I am a headless bot" signal.

      **Verified for real**: re-ran with a visible browser → logged in successfully,
      confirmed via screenshot showing genuinely personalized content (a "Related to
      your skills" job feed, a real listing with "Apply on company site" vs.
      "Easily apply" distinguished — exactly the distinction our job-selection step
      will need to filter on later). No login flow ran at all — pure proof the saved
      session is sufficient on its own.

      **Open question for later**: this run needed `headless: false` to pass
      Cloudflare's check. The actual apply-flow automation runs will need to decide
      whether to always run visibly (slower, but proven to work) or invest time
      testing whether a lighter touch (e.g. Playwright's `channel: 'chrome'` using
      the real installed Chrome instead of the bundled test binary) can pass
      headless. Not blocking — just a real tradeoff to note, not resolved yet.
- [~] **Job search/select logic — built, real problems hit and fixed, one
      still pending resolution.**
      `src/types/job.ts` (backend's own `JobListing` — distinct from the frontend's
      mock `JobDetail`, this is real scraped data), `src/lib/salary.ts`
      (`meetsMinSalary` — compares a listing's salary text against the profile's
      floor using the TOP of the listed range, not the bottom: a job whose range
      tops out at/above the floor is still worth a look even if its low end isn't;
      a listing with no salary shown is never excluded, since there's nothing to
      judge), `src/lib/jobSearch.ts` (`searchJobs` — loops the profile's target
      titles, reads Indeed's search results, filters to Easily-apply +
      salary-meets-floor, stops once it has a small `targetCount`, currently 5),
      `src/lib/browser.ts` (`launchAuthenticatedContext` — the shared helper every
      future script uses to open a browser already logged in via the saved
      session), `src/search.ts` (the runnable script).

      **Bug found + fixed (serious — was not just "slow", a real 20+ minute stall
      waiting to happen)**: the original per-card extraction did 3 separate
      "best-effort" Playwright locator lookups (company/location/salary), each
      wrapped in `.catch()` — but Playwright's DEFAULT action timeout is 30
      seconds, and a `.catch()` doesn't skip that wait, it just handles the error
      *after* the full 30s elapses. With unverified guessed selectors × 3 lookups
      × ~15-20 cards per page, a single search page could silently eat 20+ minutes
      of pure timeout-waiting looking like a hang. Fixed two ways: salary is now
      pulled via regex from text already fetched in one call (zero extra
      round-trips), and the remaining company/location lookups got an explicit
      1500ms cap. Also added live progress logging (`Searching "X"...` /
      `N card(s) read`) — the silence during the stall was itself part of the
      problem; now it's never ambiguous whether it's working or stuck.

      **Confirmed the extraction logic is reading the right thing**: Zaid asked a
      sharp question — does "Easily apply" detection actually match the button
      that says "Apply with Indeed"? Confirmed by inspecting a real screenshot:
      the small result-list card carries the literal text "Easily apply" as a
      badge (which is what the code reads), while the separate detail panel shows
      "Apply with Indeed" as the button label — same distinction, two different
      elements. Code reads the card, which is correct, but this was verified
      against a real screenshot rather than assumed.

      **Real obstacle hit — Cloudflare, a second time, different trigger**: first
      full run: search #1 ("Machine Learning Engineer") succeeded (31 cards read),
      but every search after it (#2 through #7) returned 0 cards. Screenshot
      confirmed why: an "Additional Verification Required" Cloudflare challenge —
      firing 7 automated page navigations back-to-back with zero pause is itself
      a bot-like pattern, and it tripped protection partway through. By the time
      the run's own final screenshot was captured, the block had escalated further
      (no longer even showing a solvable checkbox — just "Return home"),
      consistent with repeated hammering making it worse, not better.

      **This is the real, live version of the exact behavior the brief requires**
      — not a side problem to route around. Built properly:
      - `src/lib/challenge.ts` — `waitIfChallenged(page)`, called after every page
        navigation. Detects known challenge-page signals, and if present,
        **stops the automation completely** (no retry, no bypass attempt) and
        polls (every 5s, up to 15 min) until the page no longer shows a challenge
        — i.e., waits for a human to actually resolve it in the visible browser
        window, however they do that (solve it, wait it out, whatever it takes).
        Throws (doesn't hang forever) if 15 minutes passes unresolved.
      - Added pacing between searches (~4-7s randomized) — not stealth, just not
        repeating the exact behavior that triggered this in the first place.
      **Not yet re-tested against a live challenge** — the fix compiles and the
      logic is sound, but hasn't actually been exercised against a real,
      in-progress Cloudflare challenge yet (the run that hit it happened before
      this fix existed). Deliberately did NOT immediately re-run the script right
      after getting blocked twice in a row — didn't want to hammer the same wall
      a third time; waiting for the block to cool off first before retrying, and
      the actual pause/resume behavior will get verified once it does.
- [ ] Apply-flow automation
- [ ] Verification-challenge pause/resume handling
- [ ] Application status tracking (SQLite)
- [ ] README (architecture, session handling, failure handling, multi-user extension)
