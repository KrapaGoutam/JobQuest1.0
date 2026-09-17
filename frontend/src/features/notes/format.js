export const NOTE_TYPES = [
  "general",
  "daily_journal",
  "interview",
  "company_research",
  "reflection",
];
const TYPE_LABEL = {
  general: "General",
  daily_journal: "Daily Journal",
  interview: "Interview",
  company_research: "Company Research",
  reflection: "Reflection",
};
export function typeLabel(type) {
  return TYPE_LABEL[type] || type;
}

// A note's title is optional (see docs/FEATURE_UPGRADE_9.md Note Title) - this is
// the one, single place the empty-title fallback is decided, so every list/detail
// view stays consistent without storing a synthetic title.
export function displayTitle(note) {
  if (note.title) return note.title;
  if (note.entry_date) return note.entry_date;
  return "Untitled note";
}

const EMPTY_STATE = {
  all: "No notes yet.",
  daily_journal: "No journal entries yet.",
  application: "No linked notes for this application.",
};
export function emptyStateMessage(key) {
  return EMPTY_STATE[key] || "No notes match your filters.";
}
