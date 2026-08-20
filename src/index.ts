// Step check — confirms the real profile loads correctly and looks right.
// Replaces the earlier scaffold smoke test.
import { loadProfile } from "./lib/profile.js";

const profile = loadProfile();

console.log("Profile loaded successfully.");
console.log(`Name: ${profile.fullName}`);
console.log(`Location: ${profile.location}`);
console.log(`Resume: ${profile.resumePath}`);
console.log(`Education entries: ${profile.education.length}`);
console.log(`Experience entries: ${profile.experience.length}`);
console.log(`Skills: ${profile.skills.length}`);
console.log(`Target titles: ${profile.jobPreferences.titles.join(", ")}`);
console.log(`Locations: ${profile.jobPreferences.locations.join(", ")}`);
console.log(
  `Min salary: $${profile.jobPreferences.minSalary.annual}/yr or ` +
    `$${profile.jobPreferences.minSalary.hourly}/hr`
);
console.log(
  `Work authorization: ${
    profile.jobPreferences.workAuthorization.authorizedWithoutSponsorship
      ? "authorized, no sponsorship needed"
      : "requires sponsorship"
  }`
);
console.log(`Availability: ${profile.jobPreferences.availability}`);
