// A rate is always shown with its numerator/denominator, never a bare
// percentage - a 2/7 (28.6%) response rate and a 200/700 (28.6%) response
// rate carry very different confidence, and hiding the sample size would be
// misleading. See docs/FEATURE_UPGRADE_10_FINAL.md "Analytics Data Quality".
export function rateLabel(numerator, denominator) {
  if (!denominator) return "No data";
  const percent = Math.round((numerator / denominator) * 1000) / 10;
  return `${numerator}/${denominator} (${percent}%)`;
}

// Sums a set of {applications, responses, interviews, offers} rows (e.g. the
// per-source breakdown) into one overall total, so an "Overview" summary can
// reuse the exact same underlying counts as the detailed breakdown below it,
// rather than a second, potentially-inconsistent backend query.
export function summarizeRates(rows) {
  return rows.reduce(
    (totals, row) => ({
      applications: totals.applications + (row.applications || 0),
      responses: totals.responses + (row.responses || 0),
      interviews: totals.interviews + (row.interviews || 0),
      offers: totals.offers + (row.offers || 0),
    }),
    { applications: 0, responses: 0, interviews: 0, offers: 0 },
  );
}
