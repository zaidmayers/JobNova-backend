import type { Page } from "playwright";
import type { JobListing } from "../types/job.js";
import type { CandidateProfile } from "../types/profile.js";
import { meetsMinSalary } from "./salary.js";
import { waitIfChallenged } from "./challenge.js";

// Random-ish pause between successive searches — not stealth, just not
// firing 7 automated navigations back to back with zero pause, which is
// itself what triggered Cloudflare's escalated block during testing (see
// PLANNING.md: search #1 succeeded, every one after failed until this fix).
function pace(): Promise<void> {
  const ms = 4000 + Math.random() * 3000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Short timeout for "best effort" per-card lookups — bug found + fixed:
// Playwright's DEFAULT action timeout is 30s. With 3 such lookups per card
// wrapped in .catch() and ~15-20 cards per page, a wrong/missing selector
// meant 3 x 30s x ~15-20 cards = 20+ minutes stuck on a SINGLE search page,
// not actually hung, just silently eating timeouts one at a time. See
// PLANNING.md.
const LOOKUP_TIMEOUT = 1500;

// Salary is pulled from the card's already-fetched text via regex instead
// of a separate selector lookup — zero extra round-trips, and it's visibly
// present in the card text anyway (confirmed against real screenshots).
function extractSalaryText(cardText: string): string | null {
  const match = cardText.match(/\$[\d,.]+(\s*-\s*\$[\d,.]+)?\s*an?\s*(hour|year)/i);
  return match ? match[0] : null;
}

async function searchJobsForTitle(page: Page, title: string): Promise<JobListing[]> {
  const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(title)}`;
  await page.goto(url);
  // Don't wait for FULL network idle (some pages never settle — chat
  // widgets, analytics) — just enough time for cards to render, capped
  // short so a page that never idles doesn't eat 30s for nothing.
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

  await waitIfChallenged(page);

  const cards = page.locator("[data-jk]");
  const count = await cards.count();
  const results: JobListing[] = [];
  const seenOnPage = new Set<string>();

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const jobKey = await card.getAttribute("data-jk").catch(() => null);
    if (!jobKey || seenOnPage.has(jobKey)) continue;
    seenOnPage.add(jobKey);

    const text = await card.innerText().catch(() => "");
    if (!text.trim()) continue; // some [data-jk] matches are non-card elements

    const easyApply = /easily apply/i.test(text);
    const titleLine = text.split("\n").find((line) => line.trim().length > 0) ?? "";
    const salaryText = extractSalaryText(text);

    const company = await card
      .locator('[data-testid="company-name"]')
      .first()
      .innerText({ timeout: LOOKUP_TIMEOUT })
      .catch(() => "");
    const location = await card
      .locator('[data-testid="text-location"]')
      .first()
      .innerText({ timeout: LOOKUP_TIMEOUT })
      .catch(() => "");

    results.push({
      jobKey,
      title: titleLine.trim(),
      company: company.trim(),
      location: location.trim(),
      url: `https://www.indeed.com/viewjob?jk=${jobKey}`,
      easyApply,
      salaryText,
      searchedTitle: title,
    });
  }

  return results;
}

// Selects a small number of suitable jobs (per the brief) across the
// candidate's target titles. Filters: Easily-apply only (see PLANNING.md —
// company-site applications are out of scope), and salary floor.
//
// maxSearches caps how many DIFFERENT title searches happen in one call,
// independent of targetCount — default 1. This is a direct response to a
// real finding (see PLANNING.md): a single search page is enough to trigger
// Cloudflare's escalated bot detection, one that even genuine human
// interaction couldn't clear afterward. A single search per run is
// deliberately conservative; run again later (separately, not looped
// in-process) for more candidates rather than chaining searches back to
// back.
export async function searchJobs(
  page: Page,
  profile: CandidateProfile,
  targetCount: number,
  maxSearches = 1
): Promise<JobListing[]> {
  const seen = new Set<string>();
  const selected: JobListing[] = [];

  const titlesToTry = profile.jobPreferences.titles.slice(0, maxSearches);

  for (const [index, title] of titlesToTry.entries()) {
    if (selected.length >= targetCount) break;

    if (index > 0) await pace();

    console.log(`Searching "${title}"...`);
    const results = await searchJobsForTitle(page, title);
    console.log(`  ${results.length} card(s) read from this page.`);

    for (const job of results) {
      if (selected.length >= targetCount) break;
      if (seen.has(job.jobKey)) continue;
      if (!job.easyApply) continue;
      if (!meetsMinSalary(job.salaryText, profile.jobPreferences.minSalary)) continue;

      seen.add(job.jobKey);
      selected.push(job);
    }
  }

  return selected;
}
