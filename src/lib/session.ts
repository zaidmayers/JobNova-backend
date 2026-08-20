import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { BrowserContext } from "playwright";
import { encrypt, decrypt } from "./crypto.js";

const SESSION_PATH = resolve(process.cwd(), "sessions/indeed.session");

// Saves the browser's current login state (cookies + localStorage) to an
// encrypted file. This is the "wristband" — capturing it means we never need
// to repeat the login flow (and never need to fight Google's bot detection
// again) until the session actually expires.
export async function saveSession(context: BrowserContext): Promise<void> {
  const state = await context.storageState();
  saveSessionState(state);
}

// Lower-level version — used when the state comes from somewhere other than
// a live Playwright context (e.g. imported from a browser cookie export).
export function saveSessionState(state: unknown): void {
  const encrypted = encrypt(JSON.stringify(state));
  mkdirSync(dirname(SESSION_PATH), { recursive: true });
  writeFileSync(SESSION_PATH, encrypted, "utf-8");
}

export function hasSavedSession(): boolean {
  return existsSync(SESSION_PATH);
}

// Reads back the saved state so a new browser context can be launched
// already logged in, via `browser.newContext({ storageState: ... })`.
export function loadSessionState() {
  if (!hasSavedSession()) {
    throw new Error(
      `No saved session found at ${SESSION_PATH}. Run the login script first.`
    );
  }
  const encrypted = readFileSync(SESSION_PATH, "utf-8");
  const json = decrypt(encrypted);
  return JSON.parse(json);
}
