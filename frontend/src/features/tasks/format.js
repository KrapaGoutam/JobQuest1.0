export const TASK_VIEWS = ["today", "upcoming", "backlog", "completed"];
export const TASK_PRIORITIES = ["Low", "Medium", "High"];
export const TASK_RECURRENCES = ["daily", "weekdays", "weekly", "monthly"];
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

export function priorityRank(priority) {
  return PRIORITY_RANK[priority] ?? 3;
}

// Completion state (open/completed) is a real column; overdue is not - it is
// always derived from due_date vs "today" so it can never drift out of sync.
export function isOverdue(task, today) {
  return task.status === "open" && Boolean(task.due_date) && task.due_date < today;
}

export function dueDateLabel(task, today) {
  if (!task.due_date) return "No due date";
  if (task.status === "completed") return `Was due ${task.due_date}`;
  if (task.due_date < today) return `Overdue — was due ${task.due_date}`;
  if (task.due_date === today) return "Due today";
  return `Due ${task.due_date}`;
}

const EMPTY_STATE = {
  today: "Nothing due today.",
  upcoming: "No upcoming tasks scheduled.",
  backlog: "Your backlog is empty.",
  completed: "No completed tasks yet.",
};
export function emptyStateMessage(view) {
  return EMPTY_STATE[view] || "No tasks";
}

const RECURRENCE_LABEL = {
  daily: "Repeats daily",
  weekdays: "Repeats on weekdays",
  weekly: "Repeats weekly",
  monthly: "Repeats monthly",
};
export function recurrenceLabel(recurrence) {
  return RECURRENCE_LABEL[recurrence] || "";
}
