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
- No generic filler — every claim must trace back to something in the profile.`;

export async function draftScreeningAnswer(
  question: string,
  profile: CandidateProfile
): Promise<string> {
  const profileSummary = JSON.stringify(
    {
      skills: profile.skills,
      experience: profile.experience,
      education: profile.education,
    },
    null,
    2
  );

  const userPrompt = `CANDIDATE PROFILE:\n${profileSummary}\n\nSCREENING QUESTION: "${question}"\n\nWrite the candidate's honest answer to this question, following the rules above.`;

  return askKimi(SYSTEM_PROMPT, userPrompt);
}
