// One-time (or occasional, if the session ever expires) manual login capture.
// Opens a REAL, VISIBLE browser window. A human — not this script — clicks
// through "Continue with Google" and any verification Google/Indeed ask for.
// Rather than waiting for a keypress (awkward to relay reliably), this
// watches the actual browser navigation: wait for you to reach Google's
// sign-in, then wait for you to land back on Indeed logged in.
import "dotenv/config";
import { chromium } from "playwright";
import { saveSession } from "./lib/session.js";

const FIVE_MIN = 5 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

async function main() {
  console.log("Opening a browser window — this one you can see.");
  const browser = await chromium.launch({ headless: false });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://www.indeed.com");

    console.log("");
    console.log("=================================================");
    console.log("  ACTION NEEDED FROM YOU:");
    console.log("  1. In the browser window, click Sign in.");
    console.log("  2. Click 'Continue with Google'.");
    console.log("  3. Complete the Google login/verification yourself.");
    console.log("  Nothing else needed — this script is watching and will");
    console.log("  continue automatically once you're back on Indeed.");
    console.log("=================================================");
    console.log("");

    console.log("Waiting for you to reach Google's sign-in page (up to 5 min)...");
    await page.waitForURL(/accounts\.google\.com/, { timeout: FIVE_MIN });
    console.log("Google sign-in detected. Complete it in the browser window...");

    console.log("Waiting for you to land back on Indeed, logged in (up to 10 min)...");
    await page.waitForURL(
      (url) => url.hostname.includes("indeed.com") && !url.pathname.includes("login"),
      { timeout: TEN_MIN }
    );

    // Give the page a moment to finish setting all its cookies/local storage
    // after the redirect back, rather than capturing mid-transition.
    await page.waitForLoadState("networkidle").catch(() => {
      // Not fatal if this never fully settles — proceed anyway.
    });

    console.log(`Landed on: ${page.url()} — looks logged in, capturing session.`);

    await saveSession(context);
    console.log("Session saved and encrypted to sessions/indeed.session");
  } finally {
    // Always close, even on timeout/error — otherwise a failed run leaves an
    // orphaned browser window behind (which is exactly what happened on the
    // first attempt).
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Login capture failed:", err);
  process.exit(1);
});
