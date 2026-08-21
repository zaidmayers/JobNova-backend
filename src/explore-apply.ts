// Look-only — walks through Indeed's apply wizard screen by screen,
// screenshotting each one, clicking whatever the primary "keep going" button
// is (Continue / Review details / Next / etc.). STOPS AUTOMATICALLY the
// moment it sees a button whose label suggests actual submission — never
// clicks that one. Purely for understanding the real flow before building
// the fill/submit logic against it.
import "dotenv/config";
import { launchAuthenticatedContext } from "./lib/browser.js";
import { waitIfChallenged } from "./lib/challenge.js";

const JOB_URL = "https://www.indeed.com/viewjob?jk=dd87f99d74d9f007"; // AI Solutions Engineer @ Trece, Inc
const MAX_STEPS = 10;

async function main() {
  const { browser, page } = await launchAuthenticatedContext();
  try {
    await page.goto(JOB_URL);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await waitIfChallenged(page);

    const applyButton = page.getByRole("button", { name: /apply with indeed/i }).first();
    if (!(await applyButton.isVisible().catch(() => false))) {
      console.log("Could not find the Apply with Indeed button.");
      return;
    }
    await applyButton.click();
    await page.waitForTimeout(2500);
    await waitIfChallenged(page);

    for (let step = 1; step <= MAX_STEPS; step++) {
      await page.screenshot({
        path: `sessions/flow-${String(step).padStart(2, "0")}.png`,
        fullPage: true,
      });
      console.log(`Step ${step}: ${page.url()}`);

      // Look at ALL visible buttons on the page to find the primary action —
      // more robust than guessing one exact label given screens vary.
      const buttons = page.getByRole("button");
      const buttonCount = await buttons.count();
      const labels: string[] = [];
      for (let i = 0; i < buttonCount; i++) {
        const label = await buttons.nth(i).innerText().catch(() => "");
        if (label.trim()) labels.push(label.trim());
      }
      console.log(`  Buttons on this screen: ${JSON.stringify(labels)}`);

      const submitLabel = labels.find((l) => /submit/i.test(l));
      if (submitLabel) {
        console.log(`  Found a SUBMIT-looking button ("${submitLabel}") — stopping here, not clicking it.`);
        break;
      }

      // Indeed's own transient "Something went wrong" error — not a bot
      // block, a generic system hiccup. Indeed itself offers "Try again";
      // using it is reasonable, not evasion.
      const tryAgainLabel = labels.find((l) => /^try again$/i.test(l));

      const nextLabel =
        tryAgainLabel ??
        labels.find((l) => /^(continue|review details|next|save and continue)$/i.test(l));
      if (!nextLabel) {
        console.log("  No obvious 'keep going' button found — stopping exploration here.");
        break;
      }

      await page.getByRole("button", { name: nextLabel, exact: true }).first().click();
      await page.waitForTimeout(2500);
      await waitIfChallenged(page);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Explore failed:", err);
  process.exit(1);
});
