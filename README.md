# JobNova Backend — Indeed Auto-Apply Workflow

A minimal, end-to-end automation for applying to Indeed jobs on a real candidate's
behalf: session persistence without a running browser, honest LLM-assisted answers
grounded strictly in a real profile, a hard human checkpoint before anything is ever
submitted, and never bypassing a verification or security mechanism — Cloudflare,
CAPTCHA, or otherwise.

For the full build log — every bug, every design decision, every dead end — see
[`PLANNING.md`](./PLANNING.md). This README is the summary; that file is the story.

## Meets the brief's constraints

This is a small, reusable backend module, deliberately — not a production system.
Explicitly, to make each one checkable:

- **Real account, real verification.** The Indeed account was created with a real
  email address and phone number, and every verification step (Google sign-in, phone
  verification) was completed manually, by a human, not automated.
- **Real candidate profile only.** `profile.json` holds one real person's actual
  resume, contact info, work experience, education, and job preferences — nothing
  fabricated. See [Setup](#setup).
- **Applied only to roles reasonably relevant to the candidate's real background** —
  enforced as an actual judgment call during job selection, not just a keyword
  filter. See [Job search & selection](#job-search--selection).
- **Never bypasses verification, CAPTCHA, or any platform security mechanism** — the
  single hardest constraint this project holds to, tested live, repeatedly, under
  real time pressure, and never crossed. See [Failure handling](#failure-handling).

## Architecture

```
login.ts / import-session.ts  →  sessions/indeed.session (encrypted)
                                          │
verify-session.ts  ──────────────────────┤
search.ts          ──────────────────────┼──→  launchAuthenticatedContext()
apply.ts           ──────────────────────┘        (lib/browser.ts, lib/session.ts)
        │
        ├─ lib/challenge.ts    → pause/resume on Cloudflare, never bypass
        ├─ lib/applyForm.ts    → field-fill, real-time validation self-correction
        ├─ lib/screeningAnswers.ts / lib/kimi.ts → grounded LLM answers
        └─ lib/applicationDb.ts → status tracking (SQLite)
```

- **Node + TypeScript**, run directly via `tsx` (no build step for dev).
- **Playwright** drives a real, visible Chromium browser — always headed, never
  headless (see [Why headed-only](#why-headed-only-not-headless)).
- **`better-sqlite3`** for application-status tracking.
- **Kimi (Moonshot AI)** for the narrow slice of answers that genuinely need
  generation rather than a lookup — always grounded in the real profile, never free
  to invent.

## Setup

```bash
npm install
cp .env.example .env        # fill in real values — see below
cp profile.example.json profile.json   # fill in real candidate data
```

`.env` needs:
- `SESSION_ENCRYPTION_KEY` — a random 32-byte hex key (`.env.example` shows how to
  generate one). Encrypts the saved session at rest.
- `KIMI_API_KEY` — Moonshot AI API key, used only for grounded screening-answer
  generation.

`profile.json` is **real candidate data and is gitignored** — never committed. It's
the single source of truth every downstream script reads from: contact info, resume
path, education, experience, skills, explicit `yearsOfExperience` facts (see
[Grounding](#grounding-the-llm) below), job preferences, and work-authorization
status. `profile.example.json` documents the exact shape with fake values.

## Usage

```bash
npm run login           # one-time: real human login in a visible browser, session captured
npm run search           # find & record a small number of relevant candidate jobs
npm run apply -- "<job-url>"   # walk the real apply flow; stops before any submit
npm run status            # list every tracked application and its status
npm run mark-submitted -- "<job-url>"   # record a human-confirmed real submission
```

`apply.ts` **never clicks a submit button itself.** Every run stops the moment it
sees one, screenshots it (`sessions/apply-final-review.png`), and waits for a human
to review the live browser and submit manually. `mark-submitted` is how that human
confirmation gets recorded — it's a separate, deliberate command, not something the
automation ever does on its own.

## Session management

Playwright's `storageState()` (cookies + origin storage) is captured once and
persisted to `sessions/indeed.session`, **encrypted at rest with AES-256-GCM**
(`lib/crypto.ts`, `lib/session.ts`). Every other script — search, apply,
verify — loads that encrypted state into a fresh browser context rather than
re-authenticating, so there's never a browser sitting open between runs just to stay
logged in.

### Why headed-only, not headless

Headless Chromium got an immediate Cloudflare "Request Blocked" during early
testing; the identical request headed did not. Documented and accepted rather than
worked around — see PLANNING.md for the live comparison. This means `apply.ts`
needs a real, visible display to run.

### How the session actually gets captured

Two paths exist, and which one works depends on the login method:

- **`login.ts`** — opens a real, visible Playwright browser and waits for a *human*
  to click through "Continue with Google" and any verification themselves, then
  captures the resulting session automatically. Works for email/password-based
  accounts.
- **`import-session.ts <cookie-export.json>`** — converts a
  [Cookie-Editor](https://cookie-editor.com/) JSON export from the user's own,
  completely separate, non-automated browser into Playwright's `storageState`
  format, then encrypts and saves it exactly like `login.ts` would.

The second path exists because Google's OAuth flow actively rejects
Playwright-controlled browsers as "not secure," regardless of whether a script or a
human does the clicking inside them — the browser itself is fingerprinted, not just
the interaction. Rather than try to spoof that signal (which would cross into the
territory the brief explicitly prohibits), the fix is to let a real, ordinary
browser do the login, and only automate the boring part: converting its cookies into
a format Playwright can reuse. `verify-session.ts` confirms an imported/captured
session actually works before anything else touches it.

Sessions do expire — mid-project, one went stale and Indeed redirected to its own
login page. The fix each time is the same re-export step, not a new mechanism: it's
a deliberately simple, human-recoverable design rather than a fully autonomous
re-auth loop, which would need its own (much riskier) automation.

## Job search & selection

`search.ts` searches a capped, small number of titles (the brief asks for "a small
number of suitable jobs," not a bulk scrape) and filters to Easy-Apply listings that
clear the candidate's real minimum salary. Every candidate found is recorded to the
status database as `pending` — visible via `npm run status` even before any apply
attempt.

Selection isn't just "top result, whatever it is." Titles are cross-checked against
the real profile for seniority and domain fit before picking one to actually apply
to — a "Senior Staff" title isn't a reasonable match for ~1.5 years of real
experience, and a Manufacturing-titled role isn't a reasonable match for someone
with zero manufacturing experience, even if both clear the salary/keyword filter.
"Reasonably relevant to your background" (the brief's own phrase) is enforced as an
actual judgment call, not just a search-term match.

## Grounding the LLM

Every screening-question answer that isn't a hard fact (work authorization,
sponsorship, a specific years-of-experience figure) goes through
`draftScreeningAnswer()` (`lib/screeningAnswers.ts`), with a system prompt that
permits **only** claims traceable to the real profile JSON — explicitly instructed
to honestly say "I haven't worked with X" rather than invent qualifying experience.
Verified live against real screening questions before ever being wired into the
browser flow: correctly cited real, specific project details (exact benchmark
numbers from real research), and — the case that matters most — correctly admitted
no experience with a tool it hadn't actually used, rather than fabricating
familiarity to sound more qualified.

Numeric "years of experience" questions are answered from an explicit
`yearsOfExperience` fact table in the profile (deterministic, zero LLM guessing)
wherever a fact exists, and only fall back to the LLM — with an explicit instruction
to default to `0` rather than estimate — when nothing matches. This exists because
the first version *did* let the LLM guess from unstructured resume text, and got a
real number wrong; see PLANNING.md for the full correction story, including a
follow-up bug where the "fact" itself was initially wrong (a real work-authorization
misunderstanding, corrected directly with the candidate) before it ever reached a
live form.

## Failure handling

This is the part of the brief this project treats as load-bearing, not an
afterthought. Every category actually encountered live, and how it's handled:

| Failure | Handling |
|---|---|
| **Cloudflare / verification challenge** | `lib/challenge.ts` detects it (text-phrase match *and* a structural check for Cloudflare's own Turnstile widget, so it doesn't depend on guessing exact wording) and **pauses the script entirely**, polling until a human clears it or a 15-minute timeout is hit. Never retried automatically, never bypassed. When it escalates to the point where even genuine human clicks stop clearing it, the correct response — confirmed live — is backing off and waiting, not retrying harder. |
| **A rejected field value** (e.g. a decimal in a whole-numbers-only input) | `fillWithValidationRetry` / `correctVisibleFieldErrors` read the platform's *own* validation state (`aria-invalid`, the real error text) after a fill or a blocked submit, and reformat the same true answer to satisfy it — round, truncate, restyle — never changing what's actually being claimed. |
| **A known, external platform bug** (Indeed's own "Something went wrong" error on its resume-review step) | Traced to its real, independently-documented cause (not this codebase) and fixed with the same UI-level workaround real users report working: re-entering the affected structured-data fields through the actual interface. Still not fixable 100% of the time — some accounts hit a variant with no client-side fix at all, confirmed by testing the fix correctly rather than assuming it always works. |
| **Indeed's own transient system errors** | Its own "Try again" button is used once — the platform's own retry, not ours — but never hammered past a second failure. |
| **Stuck / no progress** | If a page doesn't advance despite filling and clicking, for more than a couple of steps in a row, the run stops and screenshots rather than grinding to the step cap. |
| **Session expiry** | Detected (redirect to Indeed's own login), never auto-recovered by scripting a login — that would be new automated-login surface area. Human re-exports a fresh session the same way as initial setup. |

Every one of these is a real bug or a real platform limitation hit during actual
testing against the live site — none of this is speculative. See PLANNING.md for
each one in full, including the ones that took multiple iterations to actually fix.

## Application status tracking

`lib/applicationDb.ts` — one SQLite table (`data/applications.db`, gitignored),
`status` constrained to the brief's exact five values: `pending`, `in_progress`,
`submitted`, `failed`, `manual_action_required`. One row per job URL.

- `search.ts` inserts every candidate found as `pending` (never overwrites a job
  that's already been attempted).
- `apply.ts` sets `in_progress` the moment a real run starts, then writes a specific
  note — not just a bare status — at whichever real stopping point it hits.
- `submitted` is **never set by the automation itself**, matching the same
  human-in-the-loop boundary as the browser flow never auto-clicking the real submit
  button — `mark-submitted.ts` is the explicit, separate command a human runs after
  actually reviewing and submitting for real.

## Multi-user extension

This was built for a single real candidate, deliberately — but the seams for
multiple users are already where they'd need to be:

- **`profile.json` is already the entire personalization surface.** Every script
  reads candidate facts from one typed object; nothing about a specific person is
  hardcoded into the automation logic itself (confirmed directly — the
  structured-data resave workaround anchors on `profile.education[0].degree`, not a
  literal string). Supporting N users is mostly "load the right `CandidateProfile`
  for this run" rather than a logic change.
- **Real changes needed for a genuine multi-user version:**
  1. **Per-user session files**, keyed by user ID, each independently encrypted
     (`SESSION_ENCRYPTION_KEY` would need to become per-user or a KMS-backed key
     rather than one shared `.env` value).
  2. **`applications` table gets a `user_id` column** and every query gets scoped to
     it — trivial schema change, not a redesign.
  3. **Concurrency**: right now one script owns one visible browser at a time.
     Real multi-user use needs either a queue (one job at a time, safest — matches
     the "don't hammer the platform" principle this whole project is built around)
     or isolated browser contexts per user with real rate-limiting between them,
     since the Cloudflare-escalation risk observed here was directly tied to
     *request volume in a short window*, not per-user identity — running many
     users' automation in parallel would need to respect that shared constraint,
     not just avoid colliding with each other.
  4. **Secrets**: `KIMI_API_KEY` is currently a single shared key; fine for one
     account, would need real usage-tracking/limits per user at scale.
  5. A real system would also want the `manual_action_required` state to actually
     notify the affected human (email/push), rather than requiring someone to run
     `npm run status` — the state is already captured correctly, just not routed
     anywhere yet.

## Known limitations

Written honestly, as of this submission:

- No application has reached an actual human-confirmed final submit yet. Every real
  attempt got substantially further than the last (work-authorization answered
  correctly, screening questions filled and grounded, numeric fields self-corrected
  in real time) but was ultimately stopped by either Cloudflare's escalating
  challenge or a confirmed, externally-documented Indeed platform bug — neither
  within this codebase's control, and neither something this project will script
  around.
- `resaveStructuredDataOnError`'s label-matching (`shortLabel()`) is a
  first-few-words heuristic, not a guaranteed-correct parse of however Indeed
  chooses to truncate a given field's accessible name — it worked for the two entry
  types tested live (Education, Experience) but hasn't been verified against every
  possible field shape.
- Multi-user support is designed for (see above) but not implemented — this is a
  single-candidate system today.
