// The automation never clicks the actual "Submit" button itself — every
// run stops there and hands off to a human (see apply.ts, PLANNING.md).
// This is how that human confirmation actually gets recorded as
// "submitted": run it yourself, deliberately, after you've reviewed and
// clicked submit for real in the browser. Nothing here touches Indeed —
// it's purely a status-database update.
// Usage: tsx src/markSubmitted.ts <indeed-job-url>
import { getApplication, recordApplicationStatus } from "./lib/applicationDb.js";

const JOB_URL = process.argv[2];

if (!JOB_URL) {
  console.error("Usage: tsx src/markSubmitted.ts <indeed-job-url>");
  process.exit(1);
}

const existing = getApplication(JOB_URL);
if (!existing) {
  console.error(
    `No tracked record for this URL yet — run \`npm run apply -- "${JOB_URL}"\` first so there's something to confirm.`
  );
  process.exit(1);
}

recordApplicationStatus(JOB_URL, "submitted", {
  notes: "Confirmed submitted by human review — see apply.ts, which never auto-clicks the real submit button.",
});

console.log(`Marked as submitted: ${existing.job_title ?? JOB_URL}`);
