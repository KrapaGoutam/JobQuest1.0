// Round 6: pure formatting helpers for the Bulk Import workflow, kept
// separate from the DOM-building code in app.js so the actual formatting
// rules (what a result toast mentions, what a preview row's message says)
// are unit-testable without a browser.

// The result toast previously only ever mentioned created/updated/skipped -
// a rejected/all-or-nothing batch (or one with invalid rows even in
// valid_rows_only mode) said nothing about why the count looked low.
export function summarizeImportResult(result) {
  const parts = [
    `${result.created_rows} created`,
    `${result.updated_rows} updated`,
    `${result.skipped_rows} skipped`,
  ];
  if (result.rejected_rows) parts.push(`${result.rejected_rows} invalid`);
  return parts.join(" · ");
}

// One preview row's status message: its validation errors, or a duplicate
// pointer, or "Ready" - matches the exact three states previewImport()
// already returns (errors / duplicate / neither), just formatted for display.
export function previewRowMessage(row) {
  if (row.errors?.length) return row.errors.join("; ");
  if (row.duplicate) return `Matches #${row.duplicate_id}`;
  return "Ready";
}
