import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { loadSessionState } from "./session.js";

// headless: false is deliberate, not a leftover — see PLANNING.md. Headless
// browsing got flatly blocked by Indeed's Cloudflare protection during
// session verification; a visible browser passed. Every script that uses
// the saved session inherits that same requirement until that's revisited.
export async function launchAuthenticatedContext(): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  const state = loadSessionState();
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  return { browser, context, page };
}
