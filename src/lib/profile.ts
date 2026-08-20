import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { CandidateProfile } from "../types/profile.js";

const PROFILE_PATH = resolve(process.cwd(), "profile.json");

export function loadProfile(): CandidateProfile {
  if (!existsSync(PROFILE_PATH)) {
    throw new Error(
      `profile.json not found at ${PROFILE_PATH}. ` +
        `This file holds real candidate data and is gitignored on purpose — ` +
        `copy profile.example.json to profile.json and fill in real values.`
    );
  }

  const raw = readFileSync(PROFILE_PATH, "utf-8");
  const profile = JSON.parse(raw) as CandidateProfile;

  // Minimal sanity check — not a full schema validator (out of scope for a
  // "small reusable module"), just enough to fail loudly and early if the
  // file is obviously broken, rather than deep into a browser automation run.
  const required: (keyof CandidateProfile)[] = [
    "fullName",
    "email",
    "phone",
    "resumePath",
    "jobPreferences",
  ];
  for (const field of required) {
    if (!profile[field]) {
      throw new Error(`profile.json is missing required field: "${field}"`);
    }
  }

  return profile;
}
