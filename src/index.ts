// Scaffold smoke test — proves the toolchain works before we build anything
// real on top of it. No Indeed/profile logic here yet.
import { chromium } from "playwright";
import Database from "better-sqlite3";

async function main() {
  console.log("Backend scaffold check starting...");

  // 1. Can we drive a real browser?
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("about:blank");
  console.log("✓ Playwright can launch and drive a browser");
  await browser.close();

  // 2. Can we read/write a local database file?
  const db = new Database(":memory:");
  db.exec("CREATE TABLE check_table (id INTEGER PRIMARY KEY, note TEXT)");
  db.prepare("INSERT INTO check_table (note) VALUES (?)").run("it works");
  const row = db.prepare("SELECT note FROM check_table WHERE id = 1").get() as {
    note: string;
  };
  console.log(`✓ SQLite read/write works (got back: "${row.note}")`);
  db.close();

  console.log("Backend scaffold check complete — all tools working.");
}

main().catch((err) => {
  console.error("Scaffold check failed:", err);
  process.exit(1);
});
