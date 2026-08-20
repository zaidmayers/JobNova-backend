// Converts a Cookie-Editor JSON export (from a real, non-automated browser
// login — see PLANNING.md) into Playwright's storageState format, then
// encrypts and saves it exactly the way login.ts would have.
//
// Usage: tsx src/import-session.ts <path-to-cookie-editor-export.json>
import "dotenv/config";
import { readFileSync } from "node:fs";
import { saveSessionState } from "./lib/session.js";

interface CookieEditorCookie {
  domain: string;
  expirationDate?: number;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite: string | null;
  secure: boolean;
  session: boolean;
  value: string;
}

function mapSameSite(value: string | null): "Strict" | "Lax" | "None" {
  switch (value) {
    case "strict":
      return "Strict";
    case "no_restriction":
      return "None";
    case "lax":
    case null:
    default:
      // Chrome's own default when unspecified — safest fallback.
      return "Lax";
  }
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: tsx src/import-session.ts <path-to-cookie-export.json>");
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(inputPath, "utf-8")) as CookieEditorCookie[];

  const cookies = raw.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    // Playwright wants seconds-since-epoch, or -1 for a session cookie.
    expires: c.session || !c.expirationDate ? -1 : Math.floor(c.expirationDate),
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: mapSameSite(c.sameSite),
  }));

  // Cookie-Editor only exports cookies, not localStorage — Playwright's
  // storageState also supports an "origins" array for that, left empty here.
  // Noted as a known limitation if it turns out Indeed needs localStorage
  // state too (we won't know until we test against it).
  const state = { cookies, origins: [] };

  saveSessionState(state);
  console.log(`Imported ${cookies.length} cookies into sessions/indeed.session (encrypted).`);
}

main();
