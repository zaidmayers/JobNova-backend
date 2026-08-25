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
- [x] **Job search/select logic — built, two real bugs hit and fixed, verified
      working end to end against live data.**
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
      **Re-tested after the block cooled off**: confirmed manually the block had
      cleared (browser showed a completely normal Indeed page again), then re-ran.

      **The pause/resume mechanism itself worked exactly as designed**: search #1
      succeeded (32 cards), search #2 hit a Cloudflare challenge, and
      `waitIfChallenged` correctly detected it, printed the pause message, and
      stopped the automation cold — no retry, no forcing through. That part of the
      brief's requirement is proven, live, working correctly.

      **But the challenge itself could not be resolved, even by a real human**:
      Zaid clicked "Verify you are human" — the checkbox visibly loaded, then
      disappeared without ever showing success, and the page reverted to (then
      escalated past) the challenge, ending back at the no-checkbox "Return home"
      state. Confirmed by asking specifically what he observed rather than assuming
      "solve it" would work — the checkbox itself was failing its own validation.

      **This means Cloudflare is rejecting the automated browser session itself**,
      not gating on a one-time human action. Considered and explicitly rejected:
      changing the browser's fingerprint (e.g., Playwright's `channel: 'chrome'`
      to use the real installed Chrome instead of the bundled test binary, or
      stripping other automation-detectable signals) to get past this. That
      crosses from "let a human clear a normal verification step" into "make the
      automation itself look less like automation to defeat bot detection" — which
      is exactly the kind of security-mechanism bypass the brief says not to
      attempt, even though the underlying intent (apply to real jobs with a real
      profile) is completely legitimate. Chose not to do it.

      **Decision: stop here for this run, mark it a genuine
      `manual_action_required` outcome, and change strategy going forward rather
      than keep re-attempting multi-search runs that trip this.** Two adjustments,
      neither of which is evasion — both are just "make fewer automated requests
      in a row," a legitimate lever:
      1. Don't chain all 7 target titles per run — a single search already returns
         30+ real candidates, likely enough to reach the target count of 5 on its
         own without needing back-to-back searches at all.
      2. Space out live runs against Indeed generally rather than iterating rapidly
         during development — the remaining pipeline (apply-flow automation) will
         be built and tested next using the real card data already captured from
         the one clean successful search, rather than requiring a fresh live
         Cloudflare-cleared run for every development iteration.
      **Honest, real limitation for the README**: Indeed's bot protection can
      escalate to a state that doesn't clear even with genuine human interaction,
      at least not quickly. The system's correct behavior in that case — proven
      live here — is to stop completely and surface it as `manual_action_required`,
      not to try harder to get through.

      **Zaid asked the right question**: why was the search doing so much (looping
      up to 7 job-title searches hunting for exactly 5 results) when the brief only
      ever asked for "a small number of suitable jobs"? Correct catch — that scope
      was self-imposed, not required, and it's exactly what caused the repeated
      rapid requests that tripped Cloudflare in the first place. The `maxSearches=1`
      change above isn't just a safety patch, it's the properly-scoped version of
      this step.

      **Second real bug found + fixed, after re-running the (now single, safe)
      search and getting a suspicious "Found 0 suitable job(s)"** despite a
      screenshot clearly showing several "Easily apply" jobs well above the salary
      floor on that exact page. Didn't accept the 0 at face value — wrote a quick
      throwaway diagnostic (`debug-search.ts`, deleted after use) to dump the raw
      text Playwright was actually reading. Root cause: `[data-jk]` is NOT the
      full card, it's a narrow inner element (just the title link) — its own
      `innerText()` is only the job title, nothing else, which is why
      `easyApply`/salary detection always came back empty. Confirmed the fix
      (`ancestor::li[1]` is the real card boundary) by dumping both levels side by
      side for 4 real cards, then verified the parsing logic
      (`parseCompanyAndLocation` — company is reliably the line immediately before
      a "City, ST"-shaped location line, regardless of how many variable badge
      lines like "New"/"Often replies in 1 day" come before them) against all 4
      real captured examples **offline, before spending another live search** —
      3 of 4 correctly identified as meeting the salary floor, the $19-$25/hr one
      correctly excluded. Also dropped the earlier guessed `data-testid` selectors
      for company/location entirely — same root-cause bug (wrong scope), replaced
      with the text-parsing approach instead of re-guessing new selectors.

      **Confirmed working end to end**: re-ran the real (single, paced) search —
      no Cloudflare issue this time — and got 5 real, correctly-filtered suitable
      jobs, including the exact same "Manufacturing Innovation Advanced Technology
      Engineer" ($55-$63/hr) and "Machine Learning Engineer" @ KSB SE & Co. KGaA
      ($80K-$120K/yr) jobs seen firsthand in an earlier screenshot, plus a listing
      with no salary shown that correctly wasn't excluded. **Job search/select
      logic is done.**
- [~] **Apply-flow automation — in progress. Real flow mapped out
      (look-only, nothing submitted yet), LLM-drafted screening answers
      built and verified. Actual form-filling not wired up yet.**

      Picked the first real target: "Machine Learning Engineer" @ KSB SE & Co.
      KGaA ($80K-$120K/yr) — the cleanest title match of the 5 candidates found,
      genuinely strong fit (job explicitly wants Python/PyTorch/scikit-learn,
      scientific computing, neural networks — all real skills on the resume).

      **Explored the real flow first, deliberately not submitting anything**
      (`src/explore-apply.ts` — walks the wizard screen by screen, screenshots
      each one, clicks whatever the "keep going" button is, and hard-stops the
      moment it sees a button whose label contains "submit" — never clicks that
      one). Real flow shape discovered: Apply with Indeed → resume-selection
      (already correctly pre-selected as the real uploaded PDF) →
      structured-data-intro → structured-data-review (Indeed auto-parses the
      resume into Experience/Education, editable) → questions (screening
      questions, employer-specific) → ... (submit step not yet reached).

      **KSB's flow hit a real, persistent error on Indeed's own side** — a
      generic "Something went wrong, our systems are having trouble" that
      didn't clear even after "Try again" (second attempt: "still having
      trouble... you can save the job for later," Try again option gone
      entirely). Not a bot block, not us — a real backend hiccup on Indeed's
      end, confirmed by switching to a different job and getting normal
      behavior instead. This is honest `failed`-status material: added
      "Try again" handling to the explorer (Indeed itself offers this button;
      using it once or twice is reasonable, not evasion) but didn't force past
      the second failure — moved to a different job instead, same principle as
      not fighting Cloudflare.

      **Switched to "AI Solutions Engineer" @ Trece, Inc** ($75,000/yr) — flowed
      past resume-selection cleanly straight into a **screening-questions**
      step with 10 fields: 2 structured (work-authorization Yes/No, relocation
      Yes/No/Doesn't-apply), 1 short factual (sponsorship — Indeed had already
      pre-filled "Python" into an unrelated field on its own, interesting
      precedent), and **7 open-ended free-text questions** ("Briefly describe
      an AI project you've built," "What AI platforms have you used?", etc.) —
      genuinely employer-specific, not answerable from a simple field lookup.

      **Design decision, discussed directly with Zaid**: roughly half of
      Easy-Apply jobs carry custom screening questions like this — pausing on
      every one would gut most of the actual automation value the brief asks
      for. But auto-generating unreviewed prose about someone's real
      experience, submitted to a real employer under their real name, is a
      genuine integrity risk if it's wrong — not just an engineering
      annoyance. Landed on: **factual Yes/No/dropdown questions get filled
      directly from profile data (no LLM, no risk); open-ended narrative
      questions get an LLM-drafted answer, strictly grounded in the real
      profile, typed into the field — but the flow pauses before final
      submission so Zaid reviews/edits in the actual browser before anything
      goes out.** Same "pause and hand back to the human for the part that
      needs judgment" principle as the CAPTCHA handling, just triggered by a
      different kind of risk.

      **LLM choice: Kimi (Moonshot AI)**, Zaid's own key/preference — not
      Claude, which is what was originally suggested; confirmed directly with
      him rather than assuming. `src/lib/kimi.ts` — plain `fetch` client
      (OpenAI-compatible chat completions format), no SDK dependency needed
      for one endpoint.
      Two bugs hit getting it working, both fixed by checking current docs
      instead of guessing twice: wrong model name (`kimi-k2-0711-preview`
      doesn't exist — the docs had moved to `platform.kimi.ai` and the current
      flagship model is `kimi-k3`); then `kimi-k3` rejected any `temperature`
      other than `1`, so the param was dropped entirely rather than hardcoded
      to a value that happened to work.
      `src/lib/screeningAnswers.ts` — `draftScreeningAnswer(question, profile)`.
      The system prompt is the actual safety mechanism here: explicitly
      instructed to only state things directly supported by the profile, and
      to honestly say "I haven't worked with X" rather than invent experience
      to sound more qualified.
      **Verified against 3 real questions from the actual Trece Inc form**
      before wiring anything into the browser (`src/test-screening.ts`,
      offline from Playwright entirely). Results were genuinely well-grounded:
      correctly listed real tools/frameworks with correct specifics (e.g., the
      exact mAP@50 numbers from the real drone-detection research), and —
      the important case — **correctly admitted no experience with Zapier/Make**
      rather than fabricating familiarity. That honest-refusal behavior is the
      one that actually matters most; a model that always sounds confident
      would be more dangerous here than one that sometimes says "I haven't."

      **Update — wired up and working.** `src/lib/applyForm.ts` now fills
      radio groups, textareas, plain text/number inputs, and (a narrow,
      high-confidence pattern of) `<select>` dropdowns; `src/apply.ts`
      orchestrates: fill current page → scan visible button labels → hard
      stop and screenshot on anything labeled "submit" → otherwise click
      Indeed's own "Try again" (transient system errors) or
      Continue/Review details/Next/Save and continue → stop and screenshot
      if nothing recognized. `MAX_STEPS = 15` as a hang guard.

      Getting there surfaced two more real bugs, found by reading a
      screenshot rather than guessing:
      1. **Field types the first pass didn't handle at all.** The real
         `questions/2` screen used plain `<input type="text">` (years-of-
         experience questions) and a `<select>` (education level) —
         `fillQuestionsPage` only knew radio + textarea, so those required
         fields stayed empty, Indeed's own validation correctly rejected the
         page every time, and the script just bounced on the same URL for
         13 steps looking like a hang. Fixed by adding explicit handling for
         both: short inputs get LLM-drafted answers (numeric-only instruction
         + regex-extract fallback for the ones asking "how many years..."),
         selects only get touched for the one pattern confirmed safe
         (correcting Indeed's own pre-guessed education level against the
         real profile — left everything else exactly as Indeed set it rather
         than risk a wrong guess on an unfamiliar dropdown).
      2. **The LLM guessed a numeric years-of-experience answer instead of
         using a real fact.** With only unstructured resume text as context,
         it answered "2" for "how many years of AI tools experience" — the
         real answer is 4. Flagged directly by Zaid: *"the LLM needs to be
         told a little bit about this... I don't have laboratory experience
         or manufacturing experience so it can write zero there... it
         needs [not] to guess, we need to feed that somewhere."* Fixed by
         adding `yearsOfExperience: {keywords, years}[]` to
         `CandidateProfile` — explicit, self-assessed ground truth (AI/ML
         tools = 4 years, confirmed directly with Zaid between "3" and "4";
         manufacturing/laboratory/clinical/etc. = 0), checked
         **deterministically, before any LLM call**. Only falls back to the
         LLM when no fact matches, and that fallback prompt now explicitly
         says to answer "0" rather than estimate when the profile doesn't
         clearly support a number — same "honest zero over a plausible
         guess" principle as the Zapier/Make refusal case above. The same
         facts were also added to `draftScreeningAnswer`'s grounding context
         so open-ended textarea questions referencing years get the same
         treatment, not just the dedicated numeric inputs.

      **Correction caught before ever being used live.** The first pass at
      `yearsOfExperience` only had two buckets (AI/ML tools, and a generic
      "unrelated fields" zero-bucket that included `"laborator"` as a
      keyword) — wrong, because Zaid's actual resume experience *is*
      research/lab work (the Drexel co-op), not a zero. Caught when he gave
      the fuller breakdown directly: **no traditional industry/company
      employment at all (0)**; **~1-1.5 years of real research/lab/co-op
      work** — the actual "Experience" section on the resume; **~2 years of
      hands-on AI/ML tooling** from academic + independent projects (revised
      down from an initial "4," which conflated broad tool exposure with the
      more precise academic estimate — reconciled directly with him rather
      than guessed); freelance/startup client work under a year, folded into
      the industry-experience-zero bucket since "under a year" is an honest
      zero for a whole-year field. Rebuilt as five explicit, narrowly-scoped
      keyword buckets in `profile.json` rather than one blended number,
      specifically so a bare "years of experience" question and a "years of
      AI tools experience" question can't collide on the same value when
      they mean different things. This is the same class of bug the whole
      feature exists to prevent — worth keeping in the story for the video:
      the first structured-facts version was itself wrong until reviewed.

      **Turned out to be our own bug, not a real mismatch.** Ran the fixed
      flow end-to-end against the real Trece Inc application. After the
      years-of-experience and education fields were filled correctly, the
      flow landed on an `intervention` screen — not a bot challenge, an
      actual Indeed screening gate: *"It looks like you don't meet these
      employer requirements... Work authorization: Yes (Required)."*
      Initially read as a genuine mismatch (employer wants no-sponsorship
      candidates, profile said "No"), and brought to Zaid as a real decision:
      apply anyway, or switch to a different candidate job. His answer
      surfaced the actual root cause: **he's on F-1 OPT with a valid EAD
      (through 2027-02-07, STEM-extension eligible) — which legally
      authorizes him to work right now, no employer sponsorship required for
      that authorization.** He *will* need visa sponsorship (H-1B) to keep
      working once the EAD expires, but that's a separate question from
      "are you currently authorized to work."

      `profile.jobPreferences.workAuthorization.authorizedWithoutSponsorship`
      was set to `false` — wrong, and the name itself was part of the bug:
      it read like "authorized AND will never need sponsorship," which
      isn't the question Indeed's "are you legally authorized to work in
      the US?" field is actually asking. Renamed to `authorizedToWork` and
      corrected to `true`; `requiresSponsorship` stays `true` (separate,
      also true). Added `visaStatus` and `eadExpiration` as explicit
      free-text facts so open-ended "describe your work authorization"
      questions are grounded too — previously `workAuthorization` wasn't
      even included in the context passed to the LLM at all, a real gap.
      Also added sponsorship as its own radio-group pattern in
      `applyForm.ts` (previously only handled as free text), in case a
      form presents it as Yes/No buttons rather than a textarea.

      **Re-ran against the live Trece Inc application — same intervention
      screen came back**, but the run log revealed why: every single
      field said *"already answered/has a value, leaving as-is."* Indeed's
      smartapply flow persists a candidate's answers server-side across
      runs (it's the same in-progress application, not a fresh one each
      time), so the OLD wrong "No" on work authorization was still sitting
      there from the earlier run — the fill logic's own
      leave-it-alone-if-already-answered behavior (meant to avoid
      clobbering a manually-reviewed answer) was exactly what stopped the
      fixed profile from ever reaching the page.

      **Fix**: split "always enforce" from "leave alone once present."
      Deterministic, fact-based answers (work authorization, sponsorship,
      relocation, and now-known years-of-experience) are always written,
      even overwriting an existing value — there's zero ambiguity about
      what the correct answer is, so a stale one should never survive.
      Everything else (LLM-drafted textarea answers, unhandled radio
      patterns) keeps the original skip-if-already-answered behavior,
      since those genuinely might reflect a prior manual edit worth
      preserving. Re-running now should actually overwrite the bad
      work-authorization answer instead of silently leaving it.

      **Re-ran again — the facts-enforced fix worked** (work authorization
      correctly set to "Yes," sponsorship textarea correct, years-of-
      experience fields filled), **but hit a new, real bug**: it then
      looped 8 times on the same `questions/2` URL, re-filling the same two
      fields with the same values every step, never advancing, until the
      browser was closed. Zaid caught it live and sent a screenshot of the
      actual page: `"1.5"` (the manufacturing/lab years value) was typed
      into a field that only accepts whole numbers — visible red text read
      **"Answer must be a valid number (no decimals)."** Client-side
      validation was silently blocking every "Continue" click; the
      automation had no way to know why it wasn't moving.

      Zaid's framing directly shaped the fix: *"there could be edge cases
      like this all the time... the LLM or the API needs to be able to
      correct it in real time based on what error is being raised... give
      it some kind of access such that it's able to see the application in
      real time."* Built exactly that — `fillWithValidationRetry` in
      `applyForm.ts` fills a field, blurs it, then reads whatever error
      message the page itself renders nearby (`readFieldError` — checks
      `role="alert"`/`aria-live`/error-class elements near the field, same
      way a human would notice red text) and reacts: a small deterministic
      corrector (`correctNumberFormat`) handles the exact "no
      decimals/whole number" pattern by truncating — never rounding up,
      so `1.5` becomes `"1"`, never `"2"`, keeping the "never overclaim"
      rule intact — with an LLM fallback (`correctForValidationError` in
      `screeningAnswers.ts`) for anything else, under a strict prompt that
      it may only reformat the existing true answer, never change what's
      being claimed or invent new information. Retries once, then gives up
      cleanly and logs it as needing manual review rather than looping.
      Also added a loop-level safety net in `apply.ts` — if the URL doesn't
      move for 2 consecutive steps despite filling + clicking, it stops and
      screenshots (`sessions/apply-stuck.png`) instead of grinding to
      `MAX_STEPS`, as defense-in-depth for whatever the field-level fix
      doesn't catch.

      **Re-ran again — surfaced two more real, live-only bugs in the fix
      itself.**
      1. **False positive.** The error-scan matched a `"82 / 1500"`
         character-counter element on the sponsorship textarea (Indeed
         apparently styles/marks live-region counters similarly enough to
         real alerts that the original `[class*="error" i]`/`[aria-live]`
         scan couldn't tell them apart), treated it as a validation error,
         and "corrected" a complete, honest sponsorship answer down to
         just `"Yes"` — losing real content, not just reformatting.
         **Fixed** by requiring the platform's own explicit invalid signal
         before trusting anything: either the alert element itself has
         `role="alert"` (trustworthy on its own), or the field is
         literally marked `aria-invalid="true"` by the page (in which case
         a same-styled nearby message counts). A live counter is neither.
      2. **Timing.** Even correctly, the years-of-experience fields kept
         showing the *old* `"1.5"` untouched, with no correction attempted
         at all. Turned out this site's own validation only renders the
         error message after an actual failed submit attempt — not on
         blur, which is when the original fix checked. Rather than guess
         at per-site validation timing, restructured around it: `apply.ts`
         now attempts the "Continue" click, and if the URL doesn't move,
         calls a new page-wide `correctVisibleFieldErrors` (scans for
         whatever the platform has *now* marked `aria-invalid="true"`,
         corrects each one with the same deterministic-then-LLM logic, all
         gated by the same real-invalid-signal fix above) and retries the
         click once before falling through to the existing stuck-detection
         safety net. This is the more general design anyway — checking
         after a real submit attempt works regardless of whether a given
         site validates on blur or on submit.

      **Re-ran again — the timing fix worked (field correctly detected as
      invalid via `aria-invalid="true"`), but the message-text lookup
      still came back empty**: `"flagged invalid but no readable error
      message."` Zaid asked directly why the correction logic couldn't
      just read the error and fix it — worth being precise about what was
      actually happening, since it wasn't an LLM reasoning failure: the
      correction logic (the truncate-decimal rule, and the LLM fallback)
      never even ran, because the code couldn't locate the error *text* on
      the page at all — `readFieldError`'s selector list
      (`role="alert"`/`aria-live`/`class*="error"`) just didn't match
      whatever markup Indeed actually uses for this specific message, even
      though the `aria-invalid="true"` flag confirmed something was wrong.
      Two layers added: (1) `readFieldError` now also checks
      `aria-describedby` first (the standard way an input is linked to its
      own error text) and, once `aria-invalid="true"` is confirmed, falls
      back to grabbing any short non-label text sibling near the field —
      broadening the text search is safe here specifically because
      `aria-invalid` is what was already guarding against false positives,
      not the text-matching. (2) A last-resort fallback in
      `correctVisibleFieldErrors`: if a field is confirmed invalid but no
      message text can be found at all, and its value is a plain decimal
      (`\d+\.\d+`), apply the known-safe truncation fix anyway — this
      exact failure mode has now been observed live twice, so it's a
      reasonable fallback rather than a guess.

      **Re-ran once more (7th live run in this session) — got through
      `questions/2` cleanly this time** (the decimal fallback fired again,
      correctly), **and confirmed the work-authorization fix actually
      resolved the earlier "intervention" screen — it never reappeared.**
      Hit a different wall next: `structured-data-review` (Indeed's own
      resume-parsing review step) threw the same generic *"Something went
      wrong... our systems are still having some trouble"* error seen
      before with KSB — a real Indeed-side backend hiccup, not our bug,
      confirmed by the identical wording and by "Try again" disappearing
      on retry. Same principle as before: didn't fight it. Asked Zaid how
      to proceed; he chose to switch to a different candidate job rather
      than wait on Trece Inc, same call made with KSB.

      **Picked the next target deliberately, not just the next result.**
      Ran a fresh, single (paced) search — 5 results, no Cloudflare issue.
      Evaluated each against the real profile rather than taking the top
      hit: two were "Senior"-titled roles (SciTec, Targan) that don't
      honestly match ~1.5 years of real experience; one was the same
      manufacturing-titled listing from the original search (Work4ce) —
      an explicit zero-experience category per Zaid directly; one
      (Reading Bakery Systems' "Automation R&D Engineer") was ambiguous
      enough (AI-branded title, industrial-equipment company) not to be
      confident about. Recommended and picked **MLOps Platform Engineer
      (SageMaker) @ Systemart, LLC** — not senior-titled, and genuinely
      aligned with real resume experience (AWS, Flask/Elastic Beanstalk,
      Postgres/pgvector deployment work).

      **Systemart run returned "Could not find 'Apply with Indeed'"** —
      immediately followed by Zaid watching **Cloudflare's escalating
      challenge trigger live** in the browser: the checkbox behaved
      exactly like the earlier documented case (loads, disappears, never
      validates, even on genuine human clicks) — not something to push
      through, so he closed the browser rather than fight it. This also
      means the "Could not find Apply with Indeed" result is now suspect
      as a false negative: `waitIfChallenged` only recognizes a fixed list
      of known Cloudflare page-text patterns, and if this particular
      challenge rendered with different wording, the script would have
      sailed past it uncaught, then correctly-but-misleadingly reported no
      Easy Apply button on what was actually a challenge page, not the
      real job listing. Worth checking directly (not just re-running blind)
      once resumed.

      **Likely root cause of the escalation**: 7 live automated browser
      launches against the same account in one session, in a fairly tight
      window — probably read by Cloudflare as unusual repeated automated
      access, independent of anything wrong in a single run. Real,
      demo-relevant material for the README's failure-handling section:
      the correct response to this class of block is backing off and
      pacing requests, not retrying harder or spoofing anything. Paused
      here rather than immediately restarting.

      **Hardened `waitIfChallenged` before resuming**, per the concern
      above. Added more text-phrase variants, and — the more important
      change — a structural check that no longer depends on wording at
      all: looks for Cloudflare's own Turnstile widget (challenge iframe /
      `.cf-turnstile` / `#cf-wrapper`) directly, since that renders the
      same way regardless of whatever copy surrounds it. A fixed phrase
      list alone is exactly the kind of thing that quietly goes stale.

      **Retried once more after the hardening — still triggered, from the
      very first navigation this time, worse than before.** Confirmed with
      Zaid live: even genuine human clicks on the checkbox looped forever
      without validating. Explained honestly why, rather than treat it as
      unexplainable: Cloudflare's challenge is a continuous risk score
      (browser fingerprint/automation markers, IP pattern, request
      cadence), not a one-time boolean gate — a real click is only one
      input into that score, and a Playwright-controlled browser carries
      automation signals independent of who's clicking. 9 live automated
      launches in one session in a tight window is exactly the pattern
      Cloudflare's escalation is designed to catch, and by design resists
      quick retries — waiting is not a stall tactic, it's the actual
      mechanism. Zaid asked directly whether we could "reset" it — was
      explicit that the techniques that would (clearing Cloudflare cookies,
      IP rotation, fingerprint spoofing) are themselves the exact
      bypass/evasion behavior the brief prohibits, so those were ruled out
      on principle, not just risk.

      **Diagnostic, not a workaround**: rather than guess whether this was
      account-wide or automation-specific, asked Zaid to open Indeed in his
      own regular everyday Chrome (no automation involved at all) —
      **loaded completely normally, no challenge.** Confirms the block is
      narrowly scoped to the repeatedly-relaunched automated browser
      context, not the account or the network. Real, useful signal: a
      fresh session tomorrow after real elapsed time should start clean.
      Decision: stop automated runs for the rest of the day (deadline is
      in ~2 days, but bypassing the thing the brief explicitly prohibits
      isn't a real option under time pressure either) — resume with a
      single, uninterrupted clean run rather than many small ones, and use
      the remaining time on parts that don't touch the live browser at all
      (status tracking, README).

      **Resumed under real deadline pressure** (submission due the next
      day). Session had actually logged out entirely by this point —
      Indeed redirected to its own `/auth` login page mid-run. Not
      something to script through (typing credentials would be new
      automated-login territory, the same category of thing that got
      blocked by Google earlier); fixed the same proven way — Zaid was
      still logged in on his own regular browser, re-exported cookies via
      Cookie-Editor, re-imported, `verify-session.ts` confirmed it worked.

      **Traced the "Something went wrong" error to its real cause.** Zaid
      found a real Reddit thread (r/IndeedJobs, "Indeed is giving me 'our
      systems are having trouble'...") describing this exact error,
      independently, across many different users. Key finding, from user
      u/Nightman463: the structured resume data (Education/Experience)
      gets saved in a state Indeed's backend chokes on, and re-entering it
      through the UI — delete, then manually retype the same values —
      fixed it for multiple people who confirmed it worked. Built
      `resaveStructuredDataOnError` in `applyForm.ts` to do exactly that
      automatically: detect the error, dismiss it, find each entry's
      "Edit {label}" control, clear and retype every field, save. This is
      a legitimate UI-level workaround — the exact interface a human uses,
      changing nothing about what's actually being claimed — not evasion
      of anything security-related.

      Took three real iterations to get the selector right, each one
      informative rather than wasted:
      1. First attempt guessed at `aria-label*="edit"` with a `:near()`
         proximity selector — didn't match; the still-open error dialog
         was blocking the entry section.
      2. Rebuilt to dump every visible button's real `text`/`aria-label`
         when the edit control isn't found, instead of failing silently.
         That revealed the real, exact pattern: Indeed labels these
         buttons `"Edit {entry text}"` / `"Remove {entry text}"` — but an
         exact-string match still failed, because Indeed's own displayed
         label **drops the profile's parenthetical GPA suffix**
         (`"M.S. ... (3.8 GPA)"` → `"Edit M.S. ... Engineering"`, no GPA).
      3. Fixed with a `shortLabel()` helper — anchors on a short leading
         word-prefix (splits on `(` or `—`, takes the first ~4 words) and
         matches by substring instead of guessing Indeed's exact
         truncation rule, since it turned out to differ per field
         (parenthetical dropped on Education, truncated before an em-dash
         on Experience). Confirmed live: found and clicked the real edit
         controls, re-entered 4 fields on Education, 3 on Experience,
         saved successfully.

      **The workaround worked exactly as designed — and the error still
      came back anyway.** Re-ran fully: both entries found, re-entered,
      and saved for real; the retry still landed on the identical error.
      This matches a specific, sobering detail buried in the same Reddit
      thread — u/doin_better: *"Same its been a month for me... Even
      after clearing cookies and cache. Same BS on Chrome, Edge, and
      Safari."* For a real subset of users, this bug has no client-side
      fix at all — confirmed true for this account too, by actually trying
      the community's best-known fix correctly rather than assuming. This
      is a genuine, externally-documented, unresolved Indeed platform
      issue, not something in this codebase — and not something to keep
      grinding against under a hard deadline. Stopped live attempts here.

      **Still not done**: the pause-before-submit checkpoint exists (hard
      stop + screenshot on any submit-labeled button, never auto-clicked),
      but there's no structured UX beyond that screenshot + console log for
      reviewing exactly what was filled before a human approves — worth
      revisiting once we pick the job for the real final submission.
- [x] Verification-challenge pause/resume handling — the detect-and-pause mechanism
      (`waitIfChallenged`) is built and **proven live** against a real Cloudflare
      challenge (see above). Now wired into the status database too — see below.
- [x] **Application status tracking (SQLite).** Built while the Cloudflare
      cooldown ran, deliberately as work that doesn't touch the live
      browser at all. `src/lib/applicationDb.ts` — one `applications` table,
      one row per `job_url`, `status` constrained to the brief's exact five
      values (`pending`, `in_progress`, `submitted`, `failed`,
      `manual_action_required`). Wired into every real stopping point:
      - `search.ts` records every candidate found as `pending`
        (`recordCandidateIfNew` — insert-only, deliberately never
        overwrites an existing row, so re-running a search doesn't demote
        a job that's already been attempted back down to `pending`).
      - `apply.ts` sets `in_progress` the moment a real run starts, then
        one of: `manual_action_required` (reached the submit checkpoint
        awaiting human review; stuck on the same page after repeated
        fill+click attempts; hit the step cap; no recognized button) or
        `failed` (no "Apply with Indeed" button found at all; an unhandled
        exception). Every write includes a real, specific note — not just
        the bare status — since "manual_action_required, no explanation"
        isn't actually reviewable later.
      - `submitted` is deliberately NOT something the automation ever sets
        itself — consistent with apply.ts never auto-clicking the real
        submit button, `src/markSubmitted.ts` is a separate, explicit
        command a human runs after actually reviewing and submitting for
        real in the browser. The status database mirrors the same
        human-in-the-loop boundary as the browser automation itself.
      - `src/status.ts` (`npm run status`) lists every tracked application
        — read-only, no browser involved, safe to run anytime including
        mid-cooldown.
      Verified offline before ever touching a live run (same discipline as
      the DOM-selector bugs earlier): a throwaway smoke-test script
      confirmed `recordCandidateIfNew` doesn't clobber an existing row,
      status transitions and notes update correctly, and retrieval works —
      deleted after use, along with the test database, so the first real
      run starts on a clean `data/applications.db`.
- [x] **README** (`README.md`) — architecture diagram, setup, usage, session
      management (why headed-only, the two capture paths, why sessions
      sometimes need re-export), job search/selection philosophy, LLM
      grounding, a full failure-handling table covering every real class of
      failure hit live this session, application status tracking, a
      concrete multi-user extension plan, and an honest "known limitations"
      section — including that no application has reached a final
      human-confirmed submit yet, and why (Cloudflare's escalation, and a
      confirmed externally-documented Indeed platform bug — neither within
      this codebase's control).
