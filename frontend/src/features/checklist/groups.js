// Round 4: purely presentational grouping of checklist items into the
// lifecycle stages they conceptually belong to.
//
// This does NOT change what gets created or when — the 11 default items are
// still generated once, at application creation (see
// backend/src/service.js's createApplication), the same flat list for every
// application regardless of its stage. Making *generation* stage-aware would
// need either fragile label-matching or a schema change to track it
// reliably, with real risk of duplicate-generation bugs if it every re-ran —
// see docs/FEATURE_UPGRADE_4.md's Known Debt for why that was deferred.
// Grouping the *display* of the existing flat list carries none of that risk
// (it's just a read-time transform) while still giving real scanability value.
//
// Only the 11 known default labels are grouped; anything else (a custom item,
// or a default item the user has renamed) falls into "Your items" so nothing
// is ever silently hidden.

const GROUPS = Object.freeze([
  {
    id: "preparing",
    label: "Preparing to apply",
    labels: ["Resume tailored", "Correct resume selected", "Cover letter included"],
  },
  {
    id: "applying",
    label: "Applying",
    labels: ["Application submitted"],
  },
  {
    id: "after-applying",
    label: "After you apply",
    labels: ["Recruiter identified", "Recruiter contacted", "Follow-up sent"],
  },
  {
    id: "interview",
    label: "Interview",
    labels: ["Assessment completed", "Interview prepared"],
  },
  {
    id: "wrap-up",
    label: "Wrap-up",
    labels: ["Thank-you note sent", "References prepared"],
  },
]);

const GROUP_ID_BY_LABEL = new Map(
  GROUPS.flatMap((group) => group.labels.map((label) => [label, group.id])),
);

// Groups already-position-ordered items, preserving relative order within
// each group. Empty groups are dropped. Un-matched items (custom items, or a
// renamed default) land in a trailing "Your items" group instead of vanishing.
export function groupChecklistItems(items) {
  const byGroup = new Map(GROUPS.map((group) => [group.id, []]));
  const unmatched = [];
  for (const item of items) {
    const groupId = GROUP_ID_BY_LABEL.get(item.label);
    if (groupId) byGroup.get(groupId).push(item);
    else unmatched.push(item);
  }
  const groups = GROUPS.map((group) => ({ ...group, items: byGroup.get(group.id) })).filter(
    (group) => group.items.length > 0,
  );
  if (unmatched.length) groups.push({ id: "custom", label: "Your items", items: unmatched });
  return groups;
}

export function checklistProgress(items) {
  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
}
