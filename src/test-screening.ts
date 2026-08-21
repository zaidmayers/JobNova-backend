// Throwaway — tests draftScreeningAnswer against real questions from the
// Trece Inc screening form, offline from the browser, before wiring this
// into the actual apply flow.
import "dotenv/config";
import { loadProfile } from "./lib/profile.js";
import { draftScreeningAnswer } from "./lib/screeningAnswers.js";

const QUESTIONS = [
  "What AI platforms have you used? List all that apply.",
  "Briefly describe an AI project you've built or contributed to. This can be academically or professionally.",
  "Have you used no-code/low-code automation platforms such as Zapier or Make?",
];

async function main() {
  const profile = loadProfile();
  for (const q of QUESTIONS) {
    console.log(`\nQ: ${q}`);
    const answer = await draftScreeningAnswer(q, profile);
    console.log(`A: ${answer}`);
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
