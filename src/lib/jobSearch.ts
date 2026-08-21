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

// Salary is pulled from the card's text via regex — no separate lookup,
// visibly present in the card text (confirmed against real cards).
function extractSalaryText(cardText: string): string | null {
  const match = cardText.match(/\$[\d,.]+(\s*-\s*\$[\d,.]+)?\s*an?\s*(hour|year)/i);
  return match ? match[0] : null;
}

// Bug found + fixed (see PLANNING.md): earlier version guessed at
// data-testid selectors for company/location, scoped to the WRONG element
// (see below) — always came back empty. Real card text (confirmed against
// 4 live examples) always has company immediately followed by a
// "City, ST"-shaped location line, regardless of how many badge lines
// ("Easily apply", "New", "Often replies in 1 day", etc.) come before them.
// That pattern is more reliable than a guessed selector.
function parseCompanyAndLocation(text: string): { company: string; location: string } {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const locationIndex = lines.findIndex(
    (line) => /,\s*[A-Z]{2}\b/.test(line) || /\bRemote\b/i.test(line)
  );
  if (locationIndex > 0) {
    return { location: lines[locationIndex], company: lines[locationIndex - 1] };
  }
  return { company: "", location: "" };
}

async function searchJobsForTitle(page: Page, title: string): Promise<JobListing[]> {
  const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(title)}`;
  await page.goto(url);
  // Don't wait for FULL network idle (some pages never settle — chat
  // widgets, analytics) — just enough time for cards to render, capped
  // short so a page that never idles doesn't eat 30s for nothing.
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

  await waitIfChallenged(page);

  // Bug found + fixed (see PLANNING.md): [data-jk] is NOT the full card —
  // it's a narrow inner element (just the title link). Its own innerText is
  // only the title, nothing else, which is why easyApply/salary detection
  // always came back empty/false before. The actual card — badge, company,
  // location, salary — is the nearest enclosing <li>, confirmed by dumping
  // real innerText from both levels side by side.
  const jobLinks = page.locator("[data-jk]");
  const count = await jobLinks.count();
  const results: JobListing[] = [];
  const seenOnPage = new Set<string>();

  for (let i = 0; i < count; i++) {
    const link = jobLinks.nth(i);
    const jobKey = await link.getAttribute("data-jk").catch(() => null);
    if (!jobKey || seenOnPage.has(jobKey)) continue;
    seenOnPage.add(jobKey);

    const card = link.locator("xpath=ancestor::li[1]");
    const text = await card.innerText().catch(() => "");
    if (!text.trim()) continue; // some [data-jk] matches have no <li> ancestor

    const easyApply = /easily apply/i.test(text);
    const titleLine = text.split("\n").find((line) => line.trim().length > 0) ?? "";
    const salaryText = extractSalaryText(text);
    const { company, location } = parseCompanyAndLocation(text);

    results.push({
      jobKey,
      title: titleLine.trim(),
      company,
      location,
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
