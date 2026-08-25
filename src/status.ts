// Lists every tracked application and its current status. Read-only —
// doesn't touch the browser or Indeed at all.
// Usage: tsx src/status.ts
import { listApplications } from "./lib/applicationDb.js";

const rows = listApplications();

if (rows.length === 0) {
  console.log("No tracked applications yet. Run `npm run search` or `npm run apply` first.");
  process.exit(0);
}

for (const row of rows) {
  console.log(`[${row.status}] ${row.job_title ?? "(untitled)"} ${row.company ? `@ ${row.company}` : ""}`);
  console.log(`  ${row.job_url}`);
  if (row.notes) console.log(`  note: ${row.notes}`);
  console.log(`  updated: ${row.updated_at}`);
  console.log("");
}
