# Backend Planning Notes (private — real personal data lives here)

This file is tracked by the **private** `JobNova-backend` repo only. It's the
counterpart to the root `PLANNING.md` (public repo) — that file stays high-level on
purpose; this one can hold real specifics since only invited collaborators can see it.

## Real account details

- Indeed account created fresh for this project (not a reused/existing account —
  every other Gmail identity already had Indeed history, which would've defeated the
  point of testing verification flows against a genuinely new account).
- Gmail: `zaidjobnova@gmail.com`
- Phone: +1 206 930 0523
- Resume on file with Indeed: `Zaid_Mayers_Resume.pdf` (uploaded to the Indeed profile
  directly; also the source for our own `CandidateProfile` data — see below)

## What happened during account creation

No verification challenge (SMS/email/CAPTCHA) appeared at any point — not at Google
signup, not at Indeed signup, not when adding the phone number to the Indeed profile.
Recorded honestly here (and will be in the submission README) rather than assumed:
this is a real, observed outcome, not a guess.

Working theory: a real human clicking through a normal browser doesn't look
suspicious to begin with — the more likely trigger for Indeed's bot detection is our
own *automated* Playwright login, which behaves differently from a human (headless
or automated browser fingerprint, no mouse movement/timing entropy, etc.). That's the
point where we actually expect to see — and need to correctly handle — a challenge.

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

## Progress log

Mirrors the root `PLANNING.md` backend milestone list — this file only adds the real
specifics that can't live in the public repo. See root `PLANNING.md` for the actual
milestone list and architecture decisions (those aren't sensitive, no need to
duplicate them here).
