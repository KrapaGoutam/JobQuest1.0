export const FREQUENCIES = ["daily", "weekdays", "weekly"];
const FREQUENCY_LABEL = { daily: "Daily", weekdays: "Weekdays", weekly: "Weekly" };
export function frequencyLabel(frequency) {
  return FREQUENCY_LABEL[frequency] || frequency;
}

// Weekly habits are a target-per-week, never tied to one calendar day - every
// other display concept ("today"/"not yet completed today") only applies to
// daily/weekdays habits.
export function periodNoun(frequency) {
  return frequency === "weekly" ? "this week" : "today";
}

// Progress is always exposed as text, never color-only - see
// docs/FEATURE_UPGRADE_8.md Accessibility.
export function progressLabel(habit) {
  const noun = periodNoun(habit.frequency);
  if (habit.target_count === 1)
    return habit.completed ? `Completed ${noun}` : `Not yet completed ${noun}`;
  return `${habit.period_value} of ${habit.target_count} completed ${noun}`;
}

export function streakLabel(habit) {
  if (!habit.streak) return "No current streak";
  const unit = habit.frequency === "weekly" ? "week" : "day";
  return `${habit.streak}-${unit} streak`;
}

const EMPTY_STATE = {
  today: "No habits scheduled for today.",
  all: "Create your first habit.",
  history: "No habit history yet.",
};
export function emptyStateMessage(view) {
  return EMPTY_STATE[view] || "No habits";
}
