// Walks the real Indeed apply flow end to end, filling recognized fields as
// it goes — but NEVER clicks anything whose label suggests final
// submission. Stops there, screenshots, and leaves it for human review.
// Every stopping point records its outcome to the application-status
// database (see lib/applicationDb.ts) using the brief's required states.
// Usage: tsx src/apply.ts <indeed-job-url>
import "dotenv/config";
import type { Page } from "playwright";
import { launchAuthenticatedContext } from "./lib/browser.js";
import { waitIfChallenged } from "./lib/challenge.js";
import { loadProfile } from "./lib/profile.js";
import { fillQuestionsPage, correctVisibleFieldErrors, resaveStructuredDataOnError } from "./lib/applyForm.js";
import { recordApplicationStatus, type ApplicationStatus } from "./lib/applicationDb.js";
import type { CandidateProfile } from "./types/profile.js";

const JOB_URL = process.argv[2];
const MAX_STEPS = 15;

type NextButtonOutcome =
  | { result: "submit"; label: string }
  | { result: "clicked"; label: string }
  | { result: "none" };

type StepOutcome =
  | { kind: "continue" }
  | { kind: "stop"; status: ApplicationStatus; notes: string };

// Scans the visible buttons and clicks whichever one means "keep going" —
// pulled out into its own function so the main loop can retry it once,
// in-place, after a validation-error correction pass, without duplicating
// the button-scanning logic.
async function tryClickNext(page: Page): Promise<NextButtonOutcome> {
  const buttons = page.getByRole("button");
  const buttonCount = await buttons.count();
  const labels: string[] = [];
  for (let i = 0; i < buttonCount; i++) {
    const label = await buttons.nth(i).innerText().catch(() => "");
    if (label.trim()) labels.push(label.trim());
  }

  const submitLabel = labels.find((l) => /submit/i.test(l));
  if (submitLabel) return { result: "submit", label: submitLabel };

  // Indeed's own transient error retry — see PLANNING.md.
  const tryAgainLabel = labels.find((l) => /^try again$/i.test(l));
  const nextLabel =
    tryAgainLabel ?? labels.find((l) => /^(continue|review details|next|save and continue)$/i.test(l));

  if (!nextLabel) return { result: "none" };

  await page.getByRole("button", { name: nextLabel, exact: true }).first().click();
  return { result: "clicked", label: nextLabel };
}

async function stopAtSubmit(page: Page, label: string): Promise<StepOutcome> {
  console.log(`\n>>> Reached a SUBMIT step ("${label}") — stopping, NOT submitting.`);
  console.log(">>> Review sessions/apply-final-review.png and the live browser before deciding to submit manually.");
  await page.screenshot({ path: "sessions/apply-final-review.png", fullPage: true });
  return {
    kind: "stop",
    status: "manual_action_required",
    notes: `Reached the final submit step ("${label}") — awaiting human review before actually submitting. Never auto-clicked.`,
  };
}

async function runStep(page: Page, profile: CandidateProfile): Promise<StepOutcome> {
  await fillQuestionsPage(page, profile).catch((err) => {
    console.log(`  (fill step raised an error, continuing anyway: ${err.message})`);
  });

  const beforeUrl = page.url();
  const attempt = await tryClickNext(page);

  if (attempt.result === "submit") return stopAtSubmit(page, attempt.label);
  if (attempt.result === "none") {
    console.log("  No 'keep going' button found — stopping here. Check the screenshot.");
    await page.screenshot({ path: "sessions/apply-stopped.png", fullPage: true });
    return {
      kind: "stop",
      status: "manual_action_required",
      notes: "No recognized 'keep going' button found on this step — needs manual review.",
    };
  }

  await page.waitForTimeout(2500);
  await waitIfChallenged(page);

  // Found live (see PLANNING.md): this site's own validation only renders
  // an error message once a submit is actually attempted, not on blur —
  // so a rejected value can pass the field-level check in applyForm.ts and
  // only surface here, as a click that didn't actually go anywhere. Scan
  // for whatever's now marked invalid, try to fix it, and retry the click
  // once before letting the stuck-detection in main() take over.
  if (page.url() === beforeUrl) {
    console.log("  Page didn't advance after clicking — checking for now-visible validation errors...");
    const fixedField = await correctVisibleFieldErrors(page, profile).catch((err) => {
      console.log(`  (error-correction pass raised an error: ${err.message})`);
      return false;
    });
    // Distinct failure mode from a field-validation error — Indeed's own
    // "Something went wrong" system error on structured-data-review,
    // confirmed via real user reports as a known Indeed bug with a known
    // UI-level workaround. See PLANNING.md.
    const fixedResave = await resaveStructuredDataOnError(page, profile).catch((err) => {
      console.log(`  (structured-data resave raised an error: ${err.message})`);
      return false;
    });
    const fixedAny = fixedField || fixedResave;

    if (fixedAny) {
      const retry = await tryClickNext(page);
      if (retry.result === "submit") return stopAtSubmit(page, retry.label);
      if (retry.result === "clicked") {
        await page.waitForTimeout(2500);
        await waitIfChallenged(page);
      }
    }
  }

  return { kind: "continue" };
}

async function main() {
  if (!JOB_URL) {
    console.error("Usage: tsx src/apply.ts <indeed-job-url>");
    process.exit(1);
  }

  const profile = loadProfile();
  const { browser, page } = await launchAuthenticatedContext();

  try {
    await page.goto(JOB_URL);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await waitIfChallenged(page);

    const jobTitle = await page.title().catch(() => undefined);
    recordApplicationStatus(JOB_URL, "in_progress", { jobTitle });

    const applyButton = page.getByRole("button", { name: /apply with indeed/i }).first();
    if (!(await applyButton.isVisible().catch(() => false))) {
      // Found live (see PLANNING.md): this branch never screenshotted, so
      // there was no way to tell "already applied," "external apply," and
      // "an unrecognized challenge variant slipped past waitIfChallenged"
      // apart after the fact — all three look identical from the log
      // alone. Screenshot before giving up so it's actually diagnosable.
      console.log(
        "Could not find 'Apply with Indeed' — job may already be applied to, uses external apply, or an unrecognized page is showing. Check the screenshot."
      );
      await page.screenshot({ path: "sessions/apply-no-button.png", fullPage: true });
      recordApplicationStatus(JOB_URL, "failed", {
        notes: "No 'Apply with Indeed' button found — already applied, external apply, or an unrecognized page.",
      });
      return;
    }
    await applyButton.click();
    await page.waitForTimeout(2500);
    await waitIfChallenged(page);

    let lastUrl: string | null = null;
    let stuckCount = 0;

    for (let step = 1; step <= MAX_STEPS; step++) {
      const currentUrl = page.url();
      console.log(`\n--- Step ${step}: ${currentUrl} ---`);

      // Safety net for anything the in-step correction-and-retry above
      // doesn't resolve: if the URL still isn't moving across loop
      // iterations, don't grind through all MAX_STEPS — stop and flag it.
      if (currentUrl === lastUrl) {
        stuckCount++;
        if (stuckCount >= 2) {
          console.log(
            `\n>>> Same URL for ${stuckCount + 1} steps despite filling + clicking — likely a validation issue the automation couldn't resolve. Stopping for manual review.`
          );
          await page.screenshot({ path: "sessions/apply-stuck.png", fullPage: true });
          recordApplicationStatus(JOB_URL, "manual_action_required", {
            notes: `Stuck on the same page for ${stuckCount + 1} steps despite filling + clicking — a validation issue the automation couldn't resolve.`,
          });
          return;
        }
      } else {
        stuckCount = 0;
      }
      lastUrl = currentUrl;

      const outcome = await runStep(page, profile);
      if (outcome.kind === "stop") {
        recordApplicationStatus(JOB_URL, outcome.status, { notes: outcome.notes });
        return;
      }
    }

    console.log(`Hit the ${MAX_STEPS}-step cap without reaching submit — check the screenshot.`);
    await page.screenshot({ path: "sessions/apply-max-steps.png", fullPage: true });
    recordApplicationStatus(JOB_URL, "manual_action_required", {
      notes: `Hit the ${MAX_STEPS}-step cap without reaching a submit step — needs manual review.`,
    });
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Apply flow failed:", err);
  if (JOB_URL) {
    recordApplicationStatus(JOB_URL, "failed", { notes: `Unhandled error: ${err.message}` });
  }
  process.exit(1);
});
