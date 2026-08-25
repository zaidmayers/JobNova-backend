import type { Locator, Page } from "playwright";
import type { CandidateProfile } from "../types/profile.js";
import { draftScreeningAnswer, correctForValidationError } from "./screeningAnswers.js";

// Deterministic, factual answers for known question patterns — no LLM
// needed, zero risk of misrepresentation. Matched by keyword since exact
// wording varies per employer (confirmed against real forms — see
// PLANNING.md).
function factualTextAnswer(question: string, profile: CandidateProfile): string | null {
  const q = question.toLowerCase();
  if (q.includes("sponsorship")) {
    return profile.jobPreferences.workAuthorization.requiresSponsorship
      ? "Yes, I will require sponsorship for employment authorization now or in the future."
      : "No, I do not require sponsorship for employment authorization.";
  }
  return null;
}

// Deterministic lookup for "how many years of X experience" questions —
// checked before any LLM call. See PLANNING.md: the LLM was guessing these
// from unstructured resume text and got AI-tools experience wrong (said 2,
// real answer is 4). First matching entry in profile.yearsOfExperience
// wins; returns null (not 0) on no match so the caller knows to fall back
// rather than silently answering zero for a category we just don't have
// data on.
function knownYearsOfExperience(question: string, profile: CandidateProfile): number | null {
  const q = question.toLowerCase();
  const match = profile.yearsOfExperience.find((entry) =>
    entry.keywords.some((kw) => q.includes(kw.toLowerCase()))
  );
  return match ? match.years : null;
}

// Real-time validation-error handling. Found live (see PLANNING.md): typed
// "1.5" into a years-of-experience field, Indeed's own client-side
// validation rejected it ("Answer must be a valid number (no decimals)."),
// and the automation had no way to notice — it just kept re-filling the
// same rejected value and clicking Continue, which silently re-rendered
// the same page over and over instead of advancing. Rather than hand-fix
// each specific case as it's found, this reads the platform's own error
// message right off the page after every fill and reacts to it directly —
// the same way a human filling the form would notice the red text and
// adjust. The correction is always a reformat of the same true answer
// (round, truncate, restyle) — it must never change what's actually being
// claimed. That boundary is enforced in both the deterministic corrector
// below and the LLM fallback's system prompt.
// False-positive found live (see PLANNING.md): a "82 / 1500" character
// counter shares the same aria-live/error-ish styling as a real error on
// Indeed's forms, and got mistaken for one — which then got "corrected"
// away, shortening a perfectly valid, complete answer down to "Yes". Fixed
// by requiring the platform's own explicit invalid signal (role="alert",
// or the field itself marked aria-invalid="true") rather than trusting any
// nearby element that merely looks error-styled.
async function readFieldError(locator: Locator): Promise<string | null> {
  return locator
    .evaluate((el) => {
      const isCounter = (t: string) => /^\d+\s*\/\s*\d+\b/.test(t) || /characters?\s+(remaining|left)/i.test(t);
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      const explicitlyInvalid = input.getAttribute("aria-invalid") === "true";

      // Most direct lookup: the standard way an input is linked to its own
      // error message. Checked first because it doesn't depend on guessing
      // any particular class name or ARIA role pattern.
      const describedBy = input.getAttribute("aria-describedby");
      if (describedBy) {
        for (const id of describedBy.split(/\s+/).filter(Boolean)) {
          const text = document.getElementById(id)?.textContent?.trim();
          if (text && !isCounter(text)) return text;
        }
      }

      let node = input.parentElement;
      for (let hops = 0; hops < 5 && node; hops++) {
        const candidates = Array.from(
          node.querySelectorAll('[role="alert"], [aria-live="assertive"], [aria-live="polite"], [class*="error" i]')
        );
        for (const c of candidates) {
          const text = c.textContent?.trim();
          if (!text || isCounter(text)) continue;
          // role="alert" is a strong enough signal on its own; anything
          // looser (aria-live, an "error"-named class) only counts once
          // the field itself is explicitly marked invalid.
          if (c.getAttribute("role") === "alert" || explicitlyInvalid) return text;
        }
        node = node.parentElement;
      }

      // Last resort, only once the platform has already confirmed this
      // field is genuinely invalid (found live — see PLANNING.md: neither
      // aria-describedby nor any of the patterns above matched Indeed's
      // actual markup for this message, even though aria-invalid="true"
      // was present). Safe to broaden here specifically because
      // explicitlyInvalid is the thing guarding against false positives,
      // not the text-matching — grab any short, non-label text sibling
      // near the input.
      if (explicitlyInvalid) {
        node = input.parentElement;
        for (let hops = 0; hops < 3 && node; hops++) {
          for (const child of Array.from(node.children)) {
            if (child === input || child.contains(input) || child.tagName === "LABEL") continue;
            const text = child.textContent?.trim();
            if (text && text.length > 0 && text.length < 200 && !isCounter(text)) return text;
          }
          node = node.parentElement;
        }
      }

      return null;
    })
    .catch(() => null);
}

// Handles the specific, now-confirmed-real failure pattern (a decimal
// rejected as "no decimals"/"whole number"/"valid number") without an LLM
// call — fast, and zero ambiguity about what the fix should be. Truncates
// rather than rounds, so the corrected number never overstates the
// original (1.5 -> "1", never "2") — same "never overclaim" principle as
// the rest of this module. Returns null for error patterns it doesn't
// recognize, so the caller falls back to the LLM corrector.
function correctNumberFormat(value: string, errorMessage: string): string | null {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return null;
  const e = errorMessage.toLowerCase();
  if (/no decimals?|whole number|integer|valid number/.test(e)) {
    return String(Math.trunc(n));
  }
  return null;
}

// Fills a field, then checks the platform's own validation for a rejection
// and retries once with a corrected value if needed. Used for both plain
// text/number inputs and textareas — anywhere free-form format constraints
// (decimals, length, character set) can bite. Not used for radios/selects,
// where the "error" would mean something different (a wrong choice, not a
// format problem) and is handled separately.
async function fillWithValidationRetry(
  locator: Locator,
  question: string,
  initialAnswer: string
): Promise<string> {
  await locator.fill(initialAnswer);
  await locator.blur().catch(() => {});
  await locator.page().waitForTimeout(400);

  const error = await readFieldError(locator);
  if (!error) return initialAnswer;

  console.log(`    ! form rejected "${initialAnswer}": "${error}" — attempting a real-time correction`);
  const corrected =
    correctNumberFormat(initialAnswer, error) ??
    (await correctForValidationError(question, initialAnswer, error).catch(() => null));

  if (!corrected || corrected === initialAnswer) {
    console.log(`    ! could not determine a correction — leaving as-is, needs manual review`);
    return initialAnswer;
  }

  await locator.fill(corrected);
  await locator.blur().catch(() => {});
  await locator.page().waitForTimeout(400);

  const stillError = await readFieldError(locator);
  if (stillError) {
    console.log(`    ! still invalid after correction ("${corrected}"): "${stillError}" — needs manual review`);
  } else {
    console.log(`    -> corrected to "${corrected}", now valid`);
  }
  return corrected;
}

// Second-tier correction pass, called from apply.ts after a "Continue"
// click fails to advance the page. Found live (see PLANNING.md): this
// site's own validation only renders the error message once a submit is
// actually attempted — not on blur — so fillWithValidationRetry's
// immediate post-fill check above legitimately finds nothing yet. This
// re-scans the whole page for whatever the platform has now marked
// aria-invalid="true" (a strong, low-false-positive signal, unlike
// scanning for error-styled text alone) and runs the same
// deterministic-then-LLM correction against each one. Returns whether it
// fixed anything, so the caller knows whether retrying "Continue" is worth
// it versus stopping for manual review.
export async function correctVisibleFieldErrors(page: Page, profile: CandidateProfile): Promise<boolean> {
  const invalidFields = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[aria-invalid="true"]')) as (
      | HTMLInputElement
      | HTMLTextAreaElement
    )[];
    return els
      .map((el) => {
        const label =
          el.closest("label")?.innerText ??
          (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : null) ??
          el.getAttribute("aria-label") ??
          "";
        return {
          id: el.id,
          name: el.name,
          tag: el.tagName.toLowerCase(),
          label: label.trim(),
          value: el.value,
        };
      })
      .filter((f) => f.label && (f.id || f.name));
  });

  if (invalidFields.length === 0) return false;

  let fixedAny = false;
  for (const field of invalidFields) {
    const selector =
      field.tag === "textarea"
        ? field.name
          ? `textarea[name="${field.name}"]`
          : `#${field.id}`
        : field.id
          ? `#${field.id}`
          : `input[name="${field.name}"]`;
    const locator = page.locator(selector).first();

    const error = await readFieldError(locator);
    if (!error) {
      // Confirmed invalid by the platform, but neither aria-describedby
      // nor any nearby text yielded a readable message — whatever markup
      // Indeed uses here isn't one readFieldError recognizes. Rather than
      // give up outright, fall back to the one failure mode already
      // confirmed live (see PLANNING.md): a plain decimal in a
      // whole-numbers-only field. Truncates, never rounds up, same as the
      // deterministic corrector above.
      const isPlainDecimal = /^\d+\.\d+$/.test(field.value.trim());
      if (isPlainDecimal) {
        const fallback = String(Math.trunc(parseFloat(field.value)));
        await locator.fill(fallback);
        console.log(
          `  [fix] "${field.label}" -> flagged invalid, no readable message; applying known decimal-truncation fallback: "${field.value}" -> "${fallback}"`
        );
        fixedAny = true;
      } else {
        console.log(`  [fix] "${field.label}" -> flagged invalid but no readable error message — needs manual review`);
      }
      continue;
    }

    console.log(`  [fix] "${field.label}" -> flagged invalid: "${error}" — attempting a real-time correction`);
    const corrected =
      correctNumberFormat(field.value, error) ??
      (await correctForValidationError(field.label, field.value, error).catch(() => null));

    if (!corrected || corrected === field.value) {
      console.log(`  [fix] "${field.label}" -> could not determine a correction — needs manual review`);
      continue;
    }

    await locator.fill(corrected);
    console.log(`  [fix] "${field.label}" -> corrected "${field.value}" -> "${corrected}"`);
    fixedAny = true;
  }

  return fixedAny;
}

// Workaround for the "Something went wrong / our systems are still having
// some trouble" error on the resume-module/structured-data-review step —
// hit live, reproducibly, across three different jobs (see PLANNING.md).
// Confirmed via a real user report (r/IndeedJobs) as a known, widely-hit
// Indeed bug, not specific to this account: the auto-parsed structured
// resume data (Education/Experience) gets saved in a state their backend
// chokes on, and re-entering it through the UI — same fields, same
// values, just re-committed — fixes it for real users. This is a UI
// workaround using the exact interface a human uses, not evasion of
// anything security-related; it never changes what's actually being
// claimed, only re-saves the same true data. Best-effort and generously
// logged: if a selector doesn't match, that's still useful signal for
// next time, not a silent failure.
// Indeed truncates/cleans these accessible labels inconsistently — drops a
// parenthetical GPA suffix on one field, truncates before an em-dash on
// another (confirmed live — see PLANNING.md). Rather than guess the exact
// truncation rule per field, anchor on a short leading word-prefix that
// survives either kind of truncation, and match by substring.
function shortLabel(text: string): string {
  return text
    .split(/[(—]/)[0]
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(" ");
}

// Re-enters every visible text field in whatever edit form is open: clears
// it, then types the exact same value back in. Same true data, just
// re-committed — mirrors the real-user fix exactly (delete, then manually
// re-enter). Returns whether it found + saved anything.
async function reenterOpenEntryForm(page: Page): Promise<boolean> {
  const textInputs = page.locator('input[type="text"]:visible, textarea:visible');
  const count = await textInputs.count();
  let touched = 0;
  for (let i = 0; i < count; i++) {
    const input = textInputs.nth(i);
    const value = await input.inputValue().catch(() => null);
    if (value === null || !value.trim()) continue;
    await input.fill("").catch(() => {});
    await input.fill(value).catch(() => {});
    touched++;
  }
  console.log(`  [resave] Re-entered ${touched} field(s).`);

  const saveButton = page.getByRole("button", { name: /^(save|update|done)$/i }).first();
  if (!(await saveButton.isVisible().catch(() => false))) {
    console.log("  [resave] Could not find a Save/Update button on the edit form.");
    return false;
  }
  await saveButton.click();
  await page.waitForTimeout(1000);
  return touched > 0;
}

// Finds and re-saves one structured-data entry (an Education or Experience
// card) by its "Edit {label}" accessible name. Returns whether it found
// and successfully re-saved the entry.
async function resaveEntry(page: Page, label: string): Promise<boolean> {
  const button = page.getByRole("button", { name: `Edit ${shortLabel(label)}`, exact: false }).first();
  if (!(await button.isVisible().catch(() => false))) return false;

  console.log(`  [resave] Found edit control for "${label}" — re-entering its fields...`);
  await button.click();
  await page.waitForTimeout(800);
  return reenterOpenEntryForm(page);
}

export async function resaveStructuredDataOnError(page: Page, profile: CandidateProfile): Promise<boolean> {
  const errorHeading = page.getByText("Something went wrong", { exact: false }).first();
  if (!(await errorHeading.isVisible().catch(() => false))) return false;

  console.log("  [resave] 'Something went wrong' error detected — attempting the known re-entry workaround...");

  // Dismiss the error dialog without abandoning the application (NOT
  // "Save job and exit" — that gives up on it entirely).
  const closeButton = page
    .locator('[aria-label*="close" i], [aria-label*="dismiss" i]')
    .first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click().catch(() => {});
  } else {
    await page.keyboard.press("Escape").catch(() => {});
  }
  await page.waitForTimeout(500);

  // Re-save both Education and Experience — the error is about the
  // structured resume data as a whole, not just one section, and
  // re-saving Education alone (first attempt, live) wasn't enough. Only
  // the first entry of each, matching what's actually visible on this
  // screen.
  let fixedAny = false;
  const degreeText = profile.education[0]?.degree;
  if (degreeText) fixedAny = (await resaveEntry(page, degreeText)) || fixedAny;
  const experienceTitle = profile.experience[0]?.title;
  if (experienceTitle) fixedAny = (await resaveEntry(page, experienceTitle)) || fixedAny;

  if (!fixedAny) {
    // Didn't find anything to fix — dump every visible button's
    // text/aria-label so whatever run comes next has real selectors to
    // work with instead of another blind guess.
    const allButtons = page.locator("button:visible");
    const n = await allButtons.count().catch(() => 0);
    console.log(`  [resave] Could not find any Education/Experience edit control. ${n} visible buttons on the page:`);
    for (let i = 0; i < n; i++) {
      const info = await allButtons
        .nth(i)
        .evaluate((el) => ({ text: el.textContent?.trim().slice(0, 40), ariaLabel: el.getAttribute("aria-label") }))
        .catch(() => null);
      if (info) console.log(`    [${i}] ${JSON.stringify(info)}`);
    }
    return false;
  }

  console.log("  [resave] Workaround applied — retrying.");
  return true;
}

interface RadioOption {
  value: string;
  id: string;
  label: string;
}
interface RadioGroup {
  legend: string;
  name: string;
  options: RadioOption[];
}
interface TextField {
  name: string;
  label: string;
}
interface ShortInputField {
  id: string;
  name: string;
  label: string;
  value: string;
}
interface SelectField {
  id: string;
  name: string;
  label: string;
  currentValue: string;
  options: { value: string; text: string }[];
}

// Fills whatever recognized fields are on the current screen. Safe to call
// on any screen — no-ops if there's nothing to fill (e.g. the resume-review
// step). Never touches g-recaptcha-response — that's the platform's own
// security mechanism, not a real question (see PLANNING.md).
export async function fillQuestionsPage(page: Page, profile: CandidateProfile): Promise<void> {
  const radioGroups: RadioGroup[] = await page.evaluate(() => {
    const fieldsets = Array.from(document.querySelectorAll("fieldset"));
    return fieldsets
      .map((fs) => {
        const legend = fs.querySelector("legend")?.textContent?.trim() ?? "";
        const inputs = Array.from(
          fs.querySelectorAll('input[type="radio"]')
        ) as HTMLInputElement[];
        return {
          legend,
          name: inputs[0]?.name ?? "",
          options: inputs.map((i) => ({
            value: i.value,
            id: i.id,
            label: i.closest("label")?.textContent?.trim() ?? "",
          })),
        };
      })
      .filter((g) => g.name);
  });

  for (const group of radioGroups) {
    const q = group.legend.toLowerCase();
    let chosen: RadioOption | undefined;
    // Deterministic patterns are always enforced, even over an existing
    // answer — see PLANNING.md. Found live: Indeed's smartapply flow
    // persists answers server-side across runs, so a stale wrong fact
    // (the "authorized to work" bug) silently survived a fresh run
    // because the old skip-if-already-answered check treated any existing
    // value as final. Known facts should never be allowed to go stale;
    // only genuinely unhandled patterns and LLM-drafted content get the
    // "don't touch what's already there" treatment.
    let deterministic = false;

    if (q.includes("sponsorship")) {
      // Checked before the broader "authorized to work" pattern below —
      // some forms phrase this as its own radio question rather than free
      // text (factualTextAnswer covers the textarea/short-input version).
      deterministic = true;
      chosen = profile.jobPreferences.workAuthorization.requiresSponsorship
        ? group.options.find((o) => /^yes/i.test(o.label))
        : group.options.find((o) => /^no/i.test(o.label));
    } else if (q.includes("authorized to work")) {
      // Answers "are you legally authorized to work in the US?" — true
      // for an F-1 OPT/STEM OPT candidate with a valid EAD, independent of
      // whether they'll need visa sponsorship down the line (that's the
      // separate "sponsorship" question above). Got this wrong in an
      // earlier version — see PLANNING.md.
      deterministic = true;
      chosen = profile.jobPreferences.workAuthorization.authorizedToWork
        ? group.options.find((o) => /^yes/i.test(o.label))
        : group.options.find((o) => /^no/i.test(o.label));
    } else if (q.includes("relocate")) {
      deterministic = true;
      const anywhere = profile.jobPreferences.locations.some((l) => /anywhere/i.test(l));
      chosen = anywhere
        ? group.options.find((o) => /^yes/i.test(o.label))
        : group.options.find((o) => /doesn.?t apply/i.test(o.label));
    }

    if (!deterministic) {
      const alreadyChecked = await page
        .locator(`input[name="${group.name}"]:checked`)
        .count()
        .catch(() => 0);
      if (alreadyChecked > 0) {
        console.log(`  [radio] "${group.legend}" -> already answered, leaving as-is`);
        continue;
      }
    }

    if (chosen) {
      const alreadyCorrect = await page.locator(`#${chosen.id}`).isChecked().catch(() => false);
      if (alreadyCorrect) {
        console.log(`  [radio] "${group.legend}" -> already correctly set to ${chosen.label}`);
      } else {
        await page.locator(`#${chosen.id}`).check();
        console.log(
          `  [radio] "${group.legend}" -> ${chosen.label}${deterministic ? " (fact, enforced)" : ""}`
        );
      }
    } else {
      console.log(`  [radio] "${group.legend}" -> UNHANDLED pattern, left blank (needs manual review)`);
    }
  }

  const textFields: TextField[] = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("textarea"))
      .map((node) => {
        const t = node as HTMLTextAreaElement;
        const label =
          t.closest("label")?.innerText ??
          (t.id ? document.querySelector(`label[for="${t.id}"]`)?.textContent : null) ??
          t.getAttribute("aria-label") ??
          "";
        return { name: t.name, label: label.trim() };
      })
      .filter((f) => f.name && f.name !== "g-recaptcha-response");
  });

  for (const field of textFields) {
    if (!field.label) continue;

    const factual = factualTextAnswer(field.label, profile);

    // Same "facts are always enforced, LLM/unhandled content is left
    // alone once present" split as the radio groups above — see
    // PLANNING.md.
    if (!factual) {
      const existing = await page
        .locator(`textarea[name="${field.name}"]`)
        .inputValue()
        .catch(() => "");
      if (existing.trim()) {
        console.log(`  [text] "${field.label}" -> already has a value, leaving as-is`);
        continue;
      }
    }

    const drafted = factual ?? (await draftScreeningAnswer(field.label, profile));
    const answer = await fillWithValidationRetry(
      page.locator(`textarea[name="${field.name}"]`),
      field.label,
      drafted
    );
    console.log(
      `  [text] "${field.label}" -> filled (${answer.length} chars, ${factual ? "fact, enforced" : "LLM-drafted"})`
    );
  }

  // Plain short inputs — e.g. "How many years of X experience do you have?"
  // Bug found + fixed (see PLANNING.md): the earlier version only handled
  // radio/textarea, so screens using plain text/number inputs got nothing
  // filled, Indeed's own validation correctly rejected the empty required
  // fields, and the loop just kept bouncing off the same screen looking like
  // a hang.
  const shortInputs: ShortInputField[] = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input[type="text"], input[type="number"]'))
      .map((node) => {
        const el = node as HTMLInputElement;
        const label =
          el.closest("label")?.innerText ??
          (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : null) ??
          el.getAttribute("aria-label") ??
          "";
        return { id: el.id, name: el.name, label: label.trim(), value: el.value };
      })
      .filter((f) => f.name && f.label);
  });

  for (const field of shortInputs) {
    const isNumeric = /how many years|number of years/i.test(field.label);
    const known = isNumeric ? knownYearsOfExperience(field.label, profile) : null;

    // Facts always get enforced, even over a stale existing value — see
    // PLANNING.md. Everything else keeps the leave-as-is behavior.
    if (known === null && field.value.trim()) {
      console.log(`  [input] "${field.label}" -> already has a value, leaving as-is`);
      continue;
    }

    let answer: string;
    let source: string;

    if (known !== null) {
      // Deterministic — no LLM call, no risk of a wrong guess.
      answer = String(known);
      source = "profile fact, enforced";
    } else if (isNumeric) {
      // No explicit fact for this category. Told to default to 0 rather
      // than estimate — see PLANNING.md, this is exactly the failure mode
      // that was flagged (the LLM guessed a number for AI-tools experience
      // out of unstructured resume text, with nothing to check it against;
      // that specific question now has a real profile fact and never
      // reaches this fallback at all).
      const prompt = `${field.label} Respond with ONLY a number (e.g. "0"), nothing else — no words, no sentence. If the candidate profile does not clearly support a specific number of years for this, respond "0" rather than estimating.`;
      const raw = await draftScreeningAnswer(prompt, profile);
      answer = raw.match(/\d+/)?.[0] ?? "0";
      source = "LLM fallback, no profile fact matched";
    } else {
      answer = await draftScreeningAnswer(field.label, profile);
      source = "LLM";
    }

    const finalAnswer = await fillWithValidationRetry(
      page.locator(`#${field.id}`),
      field.label,
      answer
    );
    console.log(`  [input] "${field.label}" -> filled ("${finalAnswer}", ${source})`);
  }

  // Dropdowns — Indeed sometimes pre-guesses these from the resume, and
  // sometimes gets it wrong (confirmed live: it picked "Bachelor's" for
  // education despite the real profile also having a Master's). Only
  // overrides recognized, high-confidence patterns; leaves anything else
  // exactly as Indeed set it rather than risk guessing wrong ourselves.
  const selects: SelectField[] = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("select")).map((node) => {
      const el = node as HTMLSelectElement;
      const label =
        el.closest("label")?.innerText ??
        (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : null) ??
        el.getAttribute("aria-label") ??
        "";
      return {
        id: el.id,
        name: el.name,
        label: label.trim(),
        currentValue: el.value,
        options: Array.from(el.options).map((o) => ({
          value: o.value,
          text: o.textContent?.trim() ?? "",
        })),
      };
    });
  });

  for (const sel of selects) {
    const q = sel.label.toLowerCase();
    if (!q.includes("education")) continue; // only handling a known-confident pattern for now

    const hasGraduateDegree = profile.education.some((e) =>
      /m\.?s\.?|master|ph\.?d|doctorate/i.test(e.degree)
    );
    const target = hasGraduateDegree
      ? sel.options.find((o) => /master/i.test(o.text))
      : sel.options.find((o) => /bachelor/i.test(o.text));

    if (target && target.value !== sel.currentValue) {
      await page.selectOption(`#${sel.id}`, target.value);
      console.log(
        `  [select] "${sel.label}" -> corrected to "${target.text}" (Indeed had guessed differently)`
      );
    } else {
      console.log(`  [select] "${sel.label}" -> already correct, leaving as-is`);
    }
  }
}
