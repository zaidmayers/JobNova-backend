// Proves the imported session actually works — loads it into a brand new
// browser context (no login flow at all) and checks whether Indeed
// recognizes us as logged in.
import "dotenv/config";
import { chromium } from "playwright";
import { loadSessionState } from "./lib/session.js";

async function main() {
  const state = loadSessionState();
  const browser = await chromium.launch({ headless: false });

  try {
    const context = await browser.newContext({ storageState: state });
    const page = await context.newPage();
    await page.goto("https://www.indeed.com");
    await page.waitForLoadState("networkidle").catch(() => {});

    const bodyText = await page.locator("body").innerText();
    const loggedIn = /Welcome,\s*Zaid/i.test(bodyText);

    console.log(`Current URL: ${page.url()}`);
    console.log(loggedIn ? "✓ Logged in — session works." : "✗ Does not look logged in.");

    await page.screenshot({ path: "sessions/verify-check.png" });
    console.log("Screenshot saved to sessions/verify-check.png for visual confirmation.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Session verification failed:", err);
  process.exit(1);
});
