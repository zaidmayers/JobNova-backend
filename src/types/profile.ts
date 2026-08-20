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
      // Answers the near-universal "authorized to work without sponsorship?"
      // screening question truthfully — must be accurate, not guessed.
      authorizedWithoutSponsorship: boolean;
      requiresSponsorship: boolean;
    };
    // "immediate" or a specific date string
    availability: string;
  };
}
