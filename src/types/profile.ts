// The candidate's real info, organized so the automation can read from it.
// This file (the shape) is safe to commit — no real data here, just the
// structure. The real values live in profile.json, which is gitignored.
// See profile.example.json for what a filled-in one looks like (fake values).

export interface CandidateProfile {
  fullName: string;
  email: string;
  phone: string;
  location: string; // home base, e.g. "Seattle, WA"
  resumePath: string; // local path to the resume file — never committed

  education: {
    degree: string;
    institution: string;
    location: string;
  }[];

  experience: {
    title: string;
    company: string;
    // Optional — some real entries (independent/side projects) don't have
    // precise formal dates. Don't fabricate ones that aren't real.
    startDate?: string; // "YYYY-MM"
    endDate?: string | "Present";
    description: string;
  }[];

  skills: string[];

  // Explicit, self-assessed "how many years of X experience" facts. This
  // exists because the numeric screening questions ("How many years of AI
  // tools experience do you have?") were being answered by asking the LLM
  // to guess from unstructured resume text, with no ground truth to check
  // against. Guessing isn't acceptable for a real application, so these are
  // checked first, deterministically, before any LLM fallback. First
  // matching entry wins; keywords are matched case-insensitively against
  // the question text.
  //
  // Kept deliberately granular rather than one blended "years of
  // experience" number — the real breakdown (per Zaid directly) is: no
  // traditional industry/company employment at all (0), ~1-1.5 years of
  // research/lab/co-op work (the actual "Experience" section on the
  // resume), and separately ~2 years of hands-on AI/ML tooling from
  // academic + independent projects, which is real exposure but not
  // "employer experience." Collapsing these into a single number would
  // misrepresent whichever one the question is actually asking about.
  // Categories with no real experience (e.g. manufacturing, unrelated
  // fields) belong here too, set to 0 — that's a true fact, not a guess,
  // and just as important to get right as the nonzero ones.
  yearsOfExperience: {
    keywords: string[];
    years: number;
  }[];

  jobPreferences: {
    // Search keywords — what the automation looks for on Indeed.
    titles: string[];
    // "Anywhere in the US" | "Remote" | a specific city, etc.
    locations: string[];
    remoteOk: boolean;
    // Both given — some listings ask annual, some hourly (contract roles).
    minSalary: {
      annual: number;
      hourly: number;
    };
    workAuthorization: {
      // These answer two DIFFERENT questions that commonly appear together
      // on Indeed forms as a pair — they are not opposites of each other,
      // and for an F-1 OPT candidate both are legitimately true at once:
      //
      // - authorizedToWork: "Are you legally authorized to work in the
      //   United States?" An F-1 OPT (or STEM OPT extension) EAD is itself
      //   the work authorization — it's self-granted by USCIS, not
      //   something the employer has to sponsor. So this is `true` while
      //   the EAD is valid, same as any other authorized worker, even
      //   though the underlying status is temporary. (Named plainly
      //   "authorizedToWork" rather than the earlier
      //   "authorizedWithoutSponsorship" — that name read like it meant
      //   "authorized AND will never need sponsorship," which isn't the
      //   same question and produced a real, wrong answer. See
      //   PLANNING.md.)
      // - requiresSponsorship: "Will you now or in the future require
      //   sponsorship for employment visa status (e.g. H-1B)?" `true`
      //   because continuing to work past the EAD's expiration requires
      //   the employer to sponsor a visa — OPT is time-limited.
      authorizedToWork: boolean;
      requiresSponsorship: boolean;
      // Free-text grounding for open-ended "describe your work
      // authorization / visa status" questions — real, specific facts
      // only, never a vague placeholder.
      visaStatus: string;
      eadExpiration: string; // "YYYY-MM-DD"
    };
    // "immediate" or a specific date string
    availability: string;
  };
}
