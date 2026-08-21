import type { Page } from "playwright";

// This IS the "pause and resume on manual verification" behavior the brief
// requires — not a side feature. Detects a Cloudflare/verification
// challenge and stops the automation cold until a human clears it, rather
// than retrying or attempting to push through. See PLANNING.md.
const CHALLENGE_SIGNALS = [
  "Additional Verification Required",
  "Just a moment",
  "Verify you are human",
  "Request Blocked",
];

const POLL_INTERVAL = 5000;
const MAX_WAIT = 15 * 60 * 1000; // 15 min — generous, this may need real wait-out time

async function isChallenged(page: Page): Promise<boolean> {
  const text = await page.locator("body").innerText().catch(() => "");
  return CHALLENGE_SIGNALS.some((signal) => text.includes(signal));
}

// Call this after every page navigation. Resolves immediately if there's no
// challenge. If there is one, blocks (does NOT retry/bypass anything) until
// a human clears it in the visible browser window, or MAX_WAIT is hit.
export async function waitIfChallenged(page: Page): Promise<void> {
  if (!(await isChallenged(page))) return;

  console.log("");
  console.log("=================================================");
  console.log("  MANUAL VERIFICATION REQUIRED");
  console.log("  A verification/challenge page appeared.");
  console.log("  Please resolve it yourself in the browser window");
  console.log("  (solve the checkbox, wait it out, whatever it needs).");
  console.log("  This script is PAUSED and will resume automatically");
  console.log("  once the challenge clears — no action needed here.");
  console.log("=================================================");
  console.log("");

  const start = Date.now();
  while (Date.now() - start < MAX_WAIT) {
    await page.waitForTimeout(POLL_INTERVAL);
    if (!(await isChallenged(page))) {
      console.log("Challenge cleared — resuming automatically.");
      return;
    }
  }

  throw new Error(
    "Verification challenge was not resolved within 15 minutes. " +
      "Stopping rather than continuing to retry against it."
  );
}
