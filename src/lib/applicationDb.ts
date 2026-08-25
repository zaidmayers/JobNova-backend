// Application status tracking (SQLite) — the record of what the automation
// actually did with each job, per the brief's required states: pending,
// in_progress, submitted, failed, manual_action_required. The DB file
// itself is gitignored (see .gitignore) since it fills up with real
// application history; this file (the schema) is the committed part.
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const DB_PATH = resolve(process.cwd(), "data", "applications.db");

export type ApplicationStatus =
  | "pending"
  | "in_progress"
  | "submitted"
  | "failed"
  | "manual_action_required";

export interface ApplicationRecord {
  id: number;
  job_url: string;
  job_title: string | null;
  company: string | null;
  status: ApplicationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_url TEXT NOT NULL UNIQUE,
      job_title TEXT,
      company TEXT,
      status TEXT NOT NULL CHECK (
        status IN ('pending', 'in_progress', 'submitted', 'failed', 'manual_action_required')
      ),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

// One row per job_url — re-applying the same job updates its existing
// record (status history isn't kept beyond "notes", intentionally simple;
// see README for how a multi-user version would extend this into a real
// event log per application instead of a single mutable row).
export function recordApplicationStatus(
  jobUrl: string,
  status: ApplicationStatus,
  fields: { jobTitle?: string; company?: string; notes?: string } = {}
): void {
  const database = getDb();
  const existing = database
    .prepare("SELECT id FROM applications WHERE job_url = ?")
    .get(jobUrl) as { id: number } | undefined;

  if (existing) {
    database
      .prepare(
        `UPDATE applications
         SET status = ?, notes = COALESCE(?, notes), job_title = COALESCE(?, job_title),
             company = COALESCE(?, company), updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(status, fields.notes ?? null, fields.jobTitle ?? null, fields.company ?? null, existing.id);
  } else {
    database
      .prepare(
        `INSERT INTO applications (job_url, job_title, company, status, notes)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(jobUrl, fields.jobTitle ?? null, fields.company ?? null, status, fields.notes ?? null);
  }
}

// Used by search.ts — records a found candidate as "pending" only if it
// isn't already tracked. Deliberately does NOT overwrite an existing row:
// re-running a search that surfaces a job already attempted (or already
// mid-flow) must never demote its real status back down to "pending".
export function recordCandidateIfNew(
  jobUrl: string,
  fields: { jobTitle?: string; company?: string } = {}
): void {
  const database = getDb();
  database
    .prepare(
      `INSERT OR IGNORE INTO applications (job_url, job_title, company, status)
       VALUES (?, ?, ?, 'pending')`
    )
    .run(jobUrl, fields.jobTitle ?? null, fields.company ?? null);
}

export function listApplications(): ApplicationRecord[] {
  return getDb()
    .prepare("SELECT * FROM applications ORDER BY updated_at DESC")
    .all() as ApplicationRecord[];
}

export function getApplication(jobUrl: string): ApplicationRecord | undefined {
  return getDb()
    .prepare("SELECT * FROM applications WHERE job_url = ?")
    .get(jobUrl) as ApplicationRecord | undefined;
}
