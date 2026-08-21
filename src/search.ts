import "dotenv/config";
import { launchAuthenticatedContext } from "./lib/browser.js";
import { loadProfile } from "./lib/profile.js";
import { searchJobs } from "./lib/jobSearch.js";

const TARGET_COUNT = 5; // "a small number of suitable jobs" per the brief

async function main() {
  const profile = loadProfile();
  const { browser, page } = await launchAuthenticatedContext();

  try {
    const jobs = await searchJobs(page, profile, TARGET_COUNT);

    console.log(`Found ${jobs.length} suitable job(s):\n`);
    for (const job of jobs) {
      console.log(`- ${job.title || "(title not extracted)"} @ ${job.company || "?"} (${job.location || "?"})`);
      console.log(`  Found under search: "${job.searchedTitle}"`);
      console.log(`  ${job.salaryText ?? "salary not listed"}`);
      console.log(`  ${job.url}`);
      console.log("");
    }

    await page.screenshot({ path: "sessions/search-check.png", fullPage: true });
    console.log("Screenshot saved to sessions/search-check.png for visual confirmation.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Job search failed:", err);
  process.exit(1);
});
