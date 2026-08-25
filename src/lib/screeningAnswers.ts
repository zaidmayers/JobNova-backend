import { askKimi } from "./kimi.js";
import type { CandidateProfile } from "../types/profile.js";

// Grounding is the whole point here — see PLANNING.md. This drafts answers
// to open-ended screening questions for real job applications; the risk of
// an LLM confidently overstating experience that isn't actually in the
// resume is a real integrity problem, not just a technical one. Every claim
// must trace back to the profile. If it can't answer truthfully from what's
// there, it should say so rather than invent something plausible-sounding.
const SYSTEM_PROMPT = `You are helping a real job candidate answer a screening question on a real job application, on their behalf. This will be submitted to an actual employer under the candidate's real name.

STRICT RULES:
- Only state things directly supported by the candidate profile below. Do not invent, assume, or exaggerate any experience, tool, or skill not explicitly present in it.
- If the profile doesn't contain enough to truthfully answer, say so honestly and briefly (e.g., "I haven't worked directly with X, but I have related experience with Y") — never fabricate to sound more qualified.
- Write in first person, as the candidate.
- Keep answers concise (2-4 sentences) unless the question clearly asks for more detail.
- No generic filler — every claim must trace back to something in the profile.
- If the question asks for a specific number of years in some area and "yearsOfExperience" below has a matching entry, use that exact number — it's the candidate's own stated fact, not something to re-derive from the dates in "experience". If nothing matches, don't estimate one — say the candidate doesn't have dedicated experience in that specific area (0), unless the "experience" entries clearly show otherwise.`;

export async function draftScreeningAnswer(
  question: string,
  profile: CandidateProfile
): Promise<string> {
  const profileSummary = JSON.stringify(
    {
      skills: profile.skills,
      experience: profile.experience,
      education: profile.education,
      yearsOfExperience: profile.yearsOfExperience,
      workAuthorization: profile.jobPreferences.workAuthorization,
    },
    null,
    2
  );

  const userPrompt = `CANDIDATE PROFILE:\n${profileSummary}\n\nSCREENING QUESTION: "${question}"\n\nWrite the candidate's honest answer to this question, following the rules above.`;

  return askKimi(SYSTEM_PROMPT, userPrompt);
}

// Real-time self-correction against the platform's OWN validation error —
// e.g. Indeed rejecting "1.5" with "Answer must be a valid number (no
// decimals)." This is a narrower, stricter job than drafting an answer:
// reformat the exact same true answer to satisfy a formatting rule, never
// re-derive or embellish it. Used as the fallback when the deterministic
// corrector (see correctNumberFormat in applyForm.ts) doesn't recognize the
// error pattern — most cases are handled there without an LLM call at all.
const VALIDATION_FIX_SYSTEM_PROMPT = `You are fixing the FORMAT of a real job application answer that the website's own form validation just rejected. This is not a new question — it's the same true answer, needing a different format.

STRICT RULES:
- Change ONLY what the error message says is wrong (e.g. remove decimals, shorten length, use digits instead of words). Never change the underlying fact or meaning.
- Never invent, add, or infer new information not already in the original answer.
- Return ONLY the corrected value — no explanation, no quotes, no extra words.`;

export async function correctForValidationError(
  question: string,
  attemptedAnswer: string,
  errorMessage: string
): Promise<string> {
  const userPrompt = `QUESTION: "${question}"\nORIGINAL ANSWER (rejected by the form): "${attemptedAnswer}"\nFORM'S VALIDATION ERROR: "${errorMessage}"\n\nRewrite the original answer so it satisfies this exact validation error.`;
  return askKimi(VALIDATION_FIX_SYSTEM_PROMPT, userPrompt);
}
