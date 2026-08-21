export interface JobListing {
  jobKey: string; // Indeed's own unique id for the posting
  title: string;
  company: string;
  location: string;
  url: string;
  // true = "Easily apply" (Indeed's own quick-apply flow, uses the profile).
  // false = redirects to the company's own site — we deliberately skip
  // these, see PLANNING.md.
  easyApply: boolean;
  salaryText: string | null;
  // which of profile.jobPreferences.titles this was found under
  searchedTitle: string;
}
