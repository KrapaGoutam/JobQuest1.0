import {
  STAGES,
  STAGE_CLASS,
  moveWidget,
  applyTheme,
  monthCells,
  agingBand,
  selectAllWidgets,
  deselectAllWidgets,
  widgetSelectionState,
  groupKanbanItems,
} from "./ui-utils.js";
import { createApplicationTable } from "./application-table.js";
import { createApplicationPreview } from "./application-preview.js";
import {
  DASHBOARD_WIDGETS,
  WIDGET_NAMES,
  widgetDefinition,
} from "./dashboard-config.js";
import { icon } from "./icons.js";

const state = {
  user: null,
  csrf: null,
  page: "dashboard",
  editing: null,
  applications: [],
  preview: null,
  layoutDraft: null,
  calendarView: "month",
  calendarDate: new Date(),
  managerUserId: "",
  relatedAppId: "",
  dashboardDays: 30,
  applicationView: "table",
  navigationCounts: {},
  expandedKanbanGroups: new Set(),
  selectedApplications: new Set(),
};
const app = document.querySelector("#app");
const esc = (value = "") =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ],
  );
const date = () => new Date().toISOString().slice(0, 10);
const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];
const pretty = (value) =>
  String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(state.csrf ? { "X-CSRF-Token": state.csrf } : {}),
      ...options.headers,
    },
  });
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) return response;
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || data.errors?.join(", ") || "Request failed");
  return data;
}
function toast(message) {
  const element = qs("#toast");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 2600);
}
function errorBox(error) {
  return `<p class="error">${esc(error.message || error)}</p>`;
}
function field(name, label, type = "text", value = "", extra = "") {
  return `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function select(name, label, values, value = "", extra = "") {
  return `<label>${esc(label)}<select name="${name}" ${extra}>${values
    .map((item) => {
      const option =
        typeof item === "string" ? { value: item, label: item } : item;
      return `<option value="${esc(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>${esc(option.label)}</option>`;
    })
    .join("")}</select></label>`;
}
function badge(stage) {
  return `<span class="badge stage-badge ${STAGE_CLASS[stage] || ""}">${esc(stage)}</span>`;
}
const PRIORITY_TONE = { High: "destructive", Medium: "warning", Low: "muted" };
function priorityBadge(priority) {
  return `<span class="badge priority-badge tone-${PRIORITY_TONE[priority] || "muted"}">${esc(priority || "—")}</span>`;
}
function toneFor(text = "") {
  const value = String(text).toLowerCase();
  if (/(overdue|risk|action needed|stale|rejected|ghosted)/.test(value))
    return "destructive";
  if (/(waiting|follow.?up|due|pending)/.test(value)) return "warning";
  if (/(interview|offer|accepted)/.test(value)) return "info";
  if (/(on track|healthy|new|response)/.test(value)) return "success";
  return "muted";
}
function radialProgress(pct, label = "") {
  const value = Math.min(100, Math.max(0, Math.round(pct || 0))),
    radius = 52,
    circumference = 2 * Math.PI * radius,
    offset = circumference - (value / 100) * circumference;
  return `<svg viewBox="0 0 128 128" class="goal-radial" role="img" aria-label="${value}% ${esc(label)}"><circle cx="64" cy="64" r="${radius}" fill="none" stroke="var(--secondary)" stroke-width="12"/><circle cx="64" cy="64" r="${radius}" fill="none" stroke="var(--primary)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" transform="rotate(-90 64 64)"/></svg><span class="goal-radial-value num">${value}%</span>`;
}
function areaLineChart(points, valueOf) {
  const values = points.map(valueOf),
    max = Math.max(1, ...values),
    w = 100,
    h = 40,
    pad = 2,
    stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = values.map((value, index) => [
    pad + index * stepX,
    h - pad - (value / max) * (h - pad * 2),
  ]);
  const line = coords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = coords.length
    ? `${line} L${coords.at(-1)[0].toFixed(2)},${(h - pad).toFixed(2)} L${coords[0][0].toFixed(2)},${(h - pad).toFixed(2)} Z`
    : "";
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="chart-svg" role="img" aria-label="Application activity trend"><defs><linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--chart-1)" stop-opacity="0.4"/><stop offset="100%" stop-color="var(--chart-1)" stop-opacity="0.02"/></linearGradient></defs>${area ? `<path d="${area}" fill="url(#activity-fill)" stroke="none"></path>` : ""}<path d="${line}" fill="none" stroke="var(--chart-1)" stroke-width="2" vector-effect="non-scaling-stroke"></path></svg>`;
}
function pageHead(title, subtitle, action = "") {
  return `<header class="page-head"><div><div class="eyebrow">JobQuest Workspace</div><h1>${esc(title)}</h1><p class="muted">${esc(subtitle)}</p></div>${action}</header>`;
}
function empty(message) {
  return `<div class="empty">${esc(message)}</div>`;
}
function table(headers, body, emptyMessage = "No records yet") {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}">${empty(emptyMessage)}</td></tr>`}</tbody></table></div>`;
}

const nav = [
  ["dashboard", "Dashboard", "layout-dashboard"],
  ["applications", "Applications", "briefcase"],
  ["add", "Add Application", "plus-circle"],
  ["bulk", "Bulk Import", "upload"],
  ["calendar", "Calendar", "calendar-days"],
  ["reminders", "Reminder Center", "bell-ring"],
  ["interviews", "Interviews", "users"],
  ["rejections", "Rejections", "x-circle"],
  ["follow_ups", "Follow-Ups", "send"],
  ["networking_contacts", "Networking", "network"],
  ["resumes", "Resumes", "file-text"],
  ["goal-history", "Goal History", "target"],
  ["aging", "Aging Report", "timer"],
  ["stage-analytics", "Stage Analytics", "bar-chart-3"],
  ["exports", "Exports", "download"],
  ["settings", "Settings", "settings"],
];
const navButton = ([id, label, iconName]) =>
  `<button data-page="${id}" class="${state.page === id ? "active" : ""}">${icon(iconName)}<span class="nav-label">${label}</span></button>`;
function shell(content) {
  const manager =
    state.user.role === "MANAGER"
      ? `<div class="nav-section-static"><p class="nav-group">Manager</p>${[
          ["manager", "Manager Dashboard", "shield-check"],
          ["users", "User Management", "user-cog"],
          ["imports", "Import History", "history"],
          ["audit", "Audit History", "scroll-text"],
        ]
          .map(navButton)
          .join("")}</div>`
      : "";
  app.innerHTML = `<div class="shell"><aside><header class="sidebar-head"><div class="logo"><span class="logo-mark" aria-hidden="true">JQ</span><span class="logo-word">JobQuest</span></div><button class="icon-button sidebar-close" id="sidebar-close" aria-label="Close navigation">${icon("x")}</button></header><nav>${nav.map(navButton).join("")}${manager}</nav><div class="user-card"><span class="user-avatar" aria-hidden="true">${esc((state.user.full_name || "?").slice(0, 1))}</span><div class="user-identity"><strong>${esc(state.user.full_name)}</strong><span>${esc(state.user.username)} · ${state.user.role}</span></div><div class="actions"><button class="btn small secondary" id="theme-cycle" aria-label="Change color theme">Theme: ${esc(state.user.theme || "system")}</button><button class="btn small secondary" id="logout">Sign out</button></div></div></aside><div class="workspace"><header class="topbar"><div class="topbar-leading"><button class="icon-button mobile-menu" id="mobile-menu" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar">${icon("menu")}</button><button class="icon-button desktop-collapse" id="desktop-collapse" aria-label="Collapse navigation" aria-pressed="false">${icon("chevron-left")}</button><span class="topbar-title">${esc(pretty(state.page.split(":")[0]))}</span></div><div class="topbar-actions"><button class="btn small" data-page="quick-add">${icon("plus")}Quick Add</button></div></header><main id="content" tabindex="-1">${content}</main></div></div>`;
  const sidebar = qs(".shell aside");
  sidebar.id = "sidebar";
  sidebar.setAttribute("aria-label", "Primary navigation");
  qs(".workspace").insertAdjacentHTML(
    "beforebegin",
    '<div class="sidebar-backdrop" id="sidebar-backdrop"></div>',
  );
  qsa("[data-page]").forEach(
    (button) => (button.onclick = () => go(button.dataset.page)),
  );
  const navRoot = qs("aside nav");
  const groupedNavigation = [
    ["Primary", ["dashboard", "applications", "add"]],
    [
      "Activity",
      [
        "calendar",
        "reminders",
        "interviews",
        "rejections",
        "follow_ups",
        "networking_contacts",
      ],
    ],
    ["Career Assets", ["resumes", "bulk"]],
    [
      "Insights",
      ["goal-history", "aging", "stage-analytics", "exports"],
    ],
    ["Settings", ["settings"]],
  ];
  groupedNavigation.forEach(([label, ids], index) => {
    const details = document.createElement("details");
    details.className = "nav-section";
    details.open =
      index === 0 || localStorage.getItem(`nav-${label}`) !== "closed";
    details.innerHTML = `<summary>${label}</summary>`;
    ids.forEach((id) => {
      const button = navRoot.querySelector(`[data-page="${id}"]`);
      if (button) details.append(button);
    });
    details.ontoggle = () =>
      localStorage.setItem(`nav-${label}`, details.open ? "open" : "closed");
    navRoot.insertBefore(
      details,
      navRoot.querySelector(".nav-section-static"),
    );
  });
  qs("#logout").onclick = logout;
  qs("#theme-cycle").onclick = cycleTheme;
  let navigationTrigger = null;
  const toggleNavigation = (open) => {
    if (open) navigationTrigger = document.activeElement;
    sidebar.classList.toggle("open", open);
    qs("#sidebar-backdrop").classList.toggle("open", open);
    qs("#mobile-menu").setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("nav-open", open);
    if (open) qs("#sidebar-close").focus();
    else navigationTrigger?.focus?.();
  };
  qs("#mobile-menu").onclick = () =>
    toggleNavigation(!sidebar.classList.contains("open"));
  qs("#sidebar-backdrop").onclick = () => toggleNavigation(false);
  qs("#sidebar-close").onclick = () => toggleNavigation(false);
  qs("#desktop-collapse").onclick = async (event) => {
    const collapsed = !qs(".shell").classList.contains("navigation-collapsed");
    qs(".shell").classList.toggle("navigation-collapsed", collapsed);
    event.currentTarget.setAttribute("aria-pressed", String(collapsed));
    event.currentTarget.setAttribute(
      "aria-label",
      collapsed ? "Expand navigation" : "Collapse navigation",
    );
    await api("/api/navigation/preferences", {
      method: "PUT",
      body: JSON.stringify({ collapsed, groups: {} }),
    });
  };
  let shortcutPrefix = "";
  document.onkeydown = (event) => {
    if (event.key === "Escape") {
      toggleNavigation(false);
      document.querySelector("dialog[open]")?.close();
    }
    if (
      event.key === "Tab" &&
      sidebar.classList.contains("open") &&
      matchMedia("(max-width: 780px)").matches
    ) {
      const focusable = [
        ...sidebar.querySelectorAll("button,[href],input,select"),
      ].filter((node) => !node.disabled && node.offsetParent !== null);
      const first = focusable[0],
        last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.matches("input,select,textarea,[contenteditable=true]")) return;
    if (event.key === "/" && state.page === "applications") {
      event.preventDefault();
      qs('#app-filters input[name="search"]')?.focus();
    } else if (event.key.toLowerCase() === "q") {
      go("quick-add");
    } else if (shortcutPrefix === "g") {
      const routes = { d: "dashboard", a: "applications", c: "calendar" };
      if (routes[event.key.toLowerCase()]) go(routes[event.key.toLowerCase()]);
      shortcutPrefix = "";
    } else if (event.key.toLowerCase() === "g") {
      shortcutPrefix = "g";
      setTimeout(() => (shortcutPrefix = ""), 1200);
    }
  };
  api("/api/navigation/preferences")
    .then((preference) => {
      qs(".shell").classList.toggle(
        "navigation-collapsed",
        preference.collapsed,
      );
      qs("#desktop-collapse").setAttribute(
        "aria-pressed",
        String(preference.collapsed),
      );
    })
    .catch(() => {});
  api("/api/navigation/counts")
    .then((counts) => {
      state.navigationCounts = counts;
      const mapping = {
        interviews: counts.upcoming_interviews,
        follow_ups: counts.overdue_follow_ups,
        reminders: counts.due_reminders,
      };
      Object.entries(mapping).forEach(([id, count]) => {
        const button = qs(`[data-page="${id}"]`),
          old = button?.querySelector(".nav-badge");
        old?.remove();
        if (button && Number(count))
          button.insertAdjacentHTML(
            "beforeend",
            `<span class="nav-badge" aria-label="${Number(count)} pending">${Number(count)}</span>`,
          );
      });
    })
    .catch(() => {});
}
async function cycleTheme() {
  const themes = ["light", "dark", "system"],
    next =
      themes[
        (themes.indexOf(state.user.theme || "system") + 1) % themes.length
      ];
  await saveTheme(next);
}
async function saveTheme(theme) {
  applyTheme(theme);
  localStorage.setItem("jobquest-theme", theme);
  state.user.theme = theme;
  await api("/api/settings", {
    method: "PATCH",
    body: JSON.stringify({ theme }),
  });
  toast(`Theme: ${theme}`);
  go(state.page);
}

function authView(register = false, error = "", transition = false) {
  const pinField = field(
    "pin",
    "Four-digit PIN",
    "password",
    "",
    "required inputmode='numeric' pattern='[0-9]{4}' minlength='4' maxlength='4' autocomplete='current-password'",
  );
  app.innerHTML = `<div class="auth-shell"><section class="auth-brand"><div class="eyebrow">Own your search</div><h1>JobQuest</h1><p>Applications, momentum, reminders, and evidence—organized in one private workspace.</p></section><section class="auth-panel"><form id="auth-form"><h2>${transition ? "Set up your PIN" : register ? "Create your account" : "Welcome back"}</h2>${error ? errorBox(error) : ""}${register ? field("full_name", "Full name", "text", "", "required autocomplete='name'") + field("email", "Email", "email", "", "autocomplete='email'") + field("phone", "Phone", "tel") : ""}${field("username", "Username", "text", "", "required autocomplete='username'")}${transition ? field("current_password", "Current password", "password", "", "required autocomplete='current-password'") : ""}${pinField}${register || transition ? field("confirm_pin", "Confirm PIN", "password", "", "required inputmode='numeric' pattern='[0-9]{4}' minlength='4' maxlength='4' autocomplete='new-password'") : ""}<div class="actions"><button class="btn">${transition ? "Set PIN and sign in" : register ? "Register" : "Sign in"}</button><button class="btn secondary" id="toggle-auth" type="button">${register || transition ? "Back to sign in" : "Create account"}</button>${!register && !transition ? '<button class="btn secondary" id="legacy-auth" type="button">Existing password account</button>' : ""}</div></form></section></div>`;
  qs("#toggle-auth").onclick = () =>
    authView(register || transition ? false : true);
  if (!register && !transition)
    qs("#legacy-auth").onclick = () => authView(false, "", true);
  qs("#auth-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await api(
        `/api/auth/${transition ? "transition-pin" : register ? "register" : "login"}`,
        {
          method: "POST",
          body: JSON.stringify(
            Object.fromEntries(new FormData(event.currentTarget)),
          ),
        },
      );
      state.user = result.user;
      state.csrf = result.csrf_token;
      applyTheme(state.user.theme || "system");
      go("dashboard");
    } catch (error) {
      authView(register, error, transition);
    }
  };
  qsa("input[name=pin], input[name=confirm_pin]").forEach(
    (input) =>
      (input.oninput = (event) => {
        event.target.value = event.target.value.replace(/\D/g, "").slice(0, 4);
        if (!register && !transition && event.target.value.length === 4)
          event.currentTarget.form.requestSubmit();
      }),
  );
}
async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {}
  state.user = null;
  state.csrf = null;
  authView();
}
async function go(page) {
  state.page = page;
  try {
    if (page.startsWith("detail:"))
      return renderDetail(Number(page.split(":")[1]));
    const routes = {
      dashboard: renderDashboard,
      applications: renderApplications,
      add: renderAdd,
      "quick-add": renderQuickAdd,
      bulk: renderBulk,
      calendar: renderCalendar,
      reminders: renderReminders,
      resumes: renderResumes,
      goals: renderGoals,
      "goal-history": renderGoalHistory,
      aging: renderAging,
      "stage-analytics": renderCompleteStageAnalytics,
      exports: renderExports,
      profile: renderProfile,
      settings: renderSettings,
      manager: renderManager,
      users: renderUsers,
      imports: renderImports,
      audit: renderAudit,
      interviews: () => renderTracker("interviews"),
      rejections: () => renderTracker("rejections"),
      follow_ups: () => renderTracker("follow_ups"),
      networking_contacts: () => renderTracker("networking_contacts"),
    };
    if (!routes[page]) throw new Error("Page not found");
    await routes[page]();
  } catch (error) {
    shell(
      pageHead("Unable to load page", "Review the error and try again") +
        errorBox(error),
    );
  }
}

const DASHBOARD_DRILL = {
  "applications-today": { date_from: date(), date_to: date() },
  "active-applications": { archived: "false" },
  "follow-ups-due": { page: "follow_ups" },
  "overdue-follow-ups": { page: "follow_ups" },
  "upcoming-interviews": { page: "interviews" },
  rejections: { stage: "Rejected" },
  ghosted: { stage: "Ghosted" },
  offers: { stage: "Offer" },
  acceptances: { stage: "Accepted" },
  "reminder-center": { page: "reminders" },
  "calendar-preview": { page: "calendar" },
};
async function dashboardData(manager = false) {
  const scope =
      manager && state.managerUserId ? `user_id=${state.managerUserId}` : "",
    suffix = scope ? `?${scope}` : "",
    layout = await api(
      `/api/dashboard/layout?type=${manager ? "manager" : "user"}`,
    ),
    activitySettings =
      layout.widgets.find((item) => item.widget_id === "activity-chart")
        ?.settings || {},
    range = `date_from=${addClientDays(date(), -state.dashboardDays)}&date_to=${date()}${scope ? `&${scope}` : ""}`;
  const [
    base,
    aging,
    stages,
    source,
    resumes,
    reminders,
    calendar,
    goals,
    activity,
    goalSeries,
  ] = await Promise.all([
    api(manager ? `/api/manager/dashboard${suffix}` : "/api/dashboard"),
    api(`/api/analytics/aging${suffix}`),
    api(`/api/analytics/stage-duration?${range}`),
    api(`/api/analytics/source?${range}`),
    api(`/api/resumes/analytics${suffix}`),
    api(`/api/reminders${suffix}`),
    api(
      `/api/calendar?date_from=${date()}&date_to=${addClientDays(date(), 14)}${scope ? `&${scope}` : ""}`,
    ),
    api(`/api/goals/comparison?${range}`),
    api(
      `/api/analytics/activity?${range}&group=${activitySettings.group || "day"}`,
    ),
    api(`/api/goals/progress-series?${range}&metric=applications`),
  ]);
  return {
    base,
    layout,
    aging,
    stages,
    source,
    resumes,
    reminders,
    calendar,
    goals,
    activity,
    goalSeries,
  };
}
function widgetContent(id, data, manager) {
  const perf = data.base.performance || {},
    apps = data.base.applications || {},
    users = data.base.users || {};
  const metrics = {
    "applications-today": data.base.today?.applications ?? apps.today ?? 0,
    "applications-week": perf.this_week ?? 0,
    "applications-month": perf.this_month ?? apps.month ?? 0,
    "active-applications": perf.active ?? apps.total ?? 0,
    "follow-ups-due": data.base.today?.follow_ups_due ?? 0,
    "overdue-follow-ups": data.base.today?.overdue_follow_ups ?? 0,
    "upcoming-interviews": data.calendar.events.filter(
      (e) => e.type === "interview",
    ).length,
    responses: perf.responses ?? 0,
    rejections: perf.rejected ?? 0,
    ghosted: perf.ghosted ?? 0,
    offers: perf.offers ?? apps.offers ?? 0,
    acceptances: perf.accepted ?? apps.acceptances ?? 0,
  };
  if (id in metrics)
    return `<div class="metric num">${metrics[id]}</div><p class="muted">${WIDGET_NAMES[id]}</p>`;
  if (id === "job-funnel") {
    const values = STAGES.slice(0, 8).map(
      (stage) => data.base.pipeline?.[stage] || 0,
    );
    const top = values[0] || 1;
    return `<ul class="funnel-list">${STAGES.slice(0, 8)
      .map((stage, index) => {
        const value = values[index],
          pct = Math.round((value / top) * 100),
          previous = values[index - 1],
          conversion = previous ? Math.round((value / previous) * 100) : 100;
        return `<li><div class="funnel-row-head"><span>${esc(stage)}</span><span class="muted num">${value} · ${conversion}% from previous</span></div><div class="funnel-bar" role="img" aria-label="${esc(stage)}: ${value} applications, ${pct}% of top of funnel"><div style="width:${pct}%"></div></div></li>`;
      })
      .join("")}</ul>`;
  }
  if (id === "applications-stage")
    return `<div class="mini-bars">${STAGES.slice(0, 13)
      .map(
        (stage) =>
          `<div><span>${esc(stage)}</span><i style="--value:${data.base.pipeline?.[stage] || 0}"></i><strong class="num">${data.base.pipeline?.[stage] || 0}</strong></div>`,
      )
      .join("")}</div>`;
  if (id === "applications-source")
    return (
      data.source
        .slice(0, 6)
        .map(
          (item) =>
            `<p><strong>${esc(item.source)}</strong> ${item.applications} · ${item.interview_rate}% interviews</p>`,
        )
        .join("") || empty("No source data")
    );
  if (id === "resume-performance")
    return (
      data.resumes
        .slice(0, 5)
        .map(
          (item) =>
            `<p><strong>${esc(item.version_name)}</strong> ${item.sample_size} applications · ${item.response_rate}% response</p>`,
        )
        .join("") || empty("Add a resume to compare performance")
    );
  if (id === "daily-goal-chart")
    return `<div class="goal-chart" role="img" aria-label="Daily application goal target versus actual">${data.goalSeries.items.map((item) => `<div class="goal-day ${item.achieved ? "achieved" : "missed"}" title="${esc(item.period_start)}: ${item.actual} of ${item.target}"><i style="height:${Math.min(100, item.target ? (item.actual / item.target) * 100 : 0)}%"></i><span>${esc(item.period_start.slice(5))}</span><strong class="num">${item.actual}/${item.target}</strong></div>`).join("") || empty("Configure a daily applications goal to see progress")}</div><p class="muted num">${data.goalSeries.summary.actual} today · ${data.goalSeries.summary.remaining} remaining · ${data.goalSeries.summary.achieved_days} achieved days</p>`;
  if (id === "weekly-goals" || id === "daily-goals")
    return `<div class="goal-radial-wrap">${radialProgress(data.goals.summary.achievement_percentage, WIDGET_NAMES[id])}<div><p class="num goal-radial-count">${data.goals.summary.achieved} <span class="muted">achieved</span></p><p class="muted">${data.goals.summary.missed} missed this period</p></div></div>`;
  if (id.includes("goal"))
    return `<div class="metric num">${data.goals.summary.achievement_percentage}%</div><p class="muted">${data.goals.summary.achieved} achieved · ${data.goals.summary.missed} missed</p>`;
  if (id === "reminder-center")
    return (
      `<ul class="next-actions-list">${data.reminders
        .slice(0, 4)
        .map((item) => {
          const tone = toneFor(item.calculated_status);
          return `<li><span class="tone-chip tone-${tone}">${esc(pretty(item.calculated_status || ""))}</span><span class="next-action-label">${esc(item.title)}</span></li>`;
        })
        .join("")}</ul>` || empty("No reminders")
    );
  if (id === "aging-applications")
    return `<ul class="kv-list">${Object.entries(data.aging.summary)
      .map(
        ([band, count]) =>
          `<li><span class="tone-dot tone-${toneFor(band)}"></span><span class="muted">${esc(band)}</span><strong class="num">${count}</strong></li>`,
      )
      .join("")}</ul>`;
  if (id === "stage-duration")
    return (
      `<ul class="kv-list">${data.stages.stages
        .filter((item) => item.sample_size)
        .slice(0, 5)
        .map(
          (item) =>
            `<li><span class="muted">${esc(item.stage)}</span><strong class="num">${item.average}d</strong><span class="muted num">n=${item.sample_size}</span></li>`,
        )
        .join("")}</ul>` || empty("More stage history is needed")
    );
  if (id === "recent-activity")
    return (
      `<ol class="timeline-feed">${(data.base.recent_activity || [])
        .slice(0, 5)
        .map((item) => {
          const time = item.created_at || item.event_date || "";
          return `<li><span class="timeline-feed-marker tone-${toneFor(item.activity_type)}" aria-hidden="true"></span><div><p>${esc(item.note || pretty(item.activity_type || "Update"))}</p>${time ? `<p class="muted num">${esc(String(time).slice(0, 10))}</p>` : ""}</div></li>`;
        })
        .join("")}</ol>` || empty("No recent activity")
    );
  if (id === "pinned-applications")
    return `<button class="link-button" data-page="applications">Open pinned applications</button>`;
  if (id === "health-summary")
    return (
      `<dl class="kv-list">${Object.entries(
        data.aging.items.reduce((result, item) => {
          result[item.health] = (result[item.health] || 0) + 1;
          return result;
        }, {}),
      )
        .map(
          ([health, count]) =>
            `<div class="kv-row"><span class="tone-dot tone-${toneFor(health)}"></span><dt class="muted">${esc(health)}</dt><dd class="num">${count}</dd></div>`,
        )
        .join("")}</dl>` || empty("No applications")
    );
  if (id === "calendar-preview")
    return (
      data.calendar.events
        .slice(0, 5)
        .map(
          (item) =>
            `<p><strong class="num">${esc(item.date.slice(0, 10))}</strong> ${esc(item.title)}</p>`,
        )
        .join("") || empty("Nothing scheduled")
    );
  if (id === "activity-chart") {
    const settings =
        data.layout.widgets.find((item) => item.widget_id === id)?.settings ||
        {},
      metrics = settings.metrics || [
        "events",
        "interviews",
        "follow_ups",
        "rejections",
      ];
    const isBar = settings.chart_type === "bar";
    const chart = isBar
      ? `<div class="activity-chart bar" aria-label="Application activity summary">${data.activity
          .map((item) => {
            const value = metrics.reduce(
              (sum, metric) => sum + Number(item[metric] || 0),
              0,
            );
            return `<i title="${esc(item.period)}: ${value} selected events" style="height:${Math.max(5, Math.min(100, value * 15))}%"></i>`;
          })
          .join("")}</div>`
      : `<div class="chart-svg-wrap">${areaLineChart(data.activity, (item) =>
          metrics.reduce((sum, metric) => sum + Number(item[metric] || 0), 0),
        )}</div>`;
    const labelSet = data.activity.length
      ? [
          data.activity[0]?.period,
          data.activity[Math.floor((data.activity.length - 1) / 2)]?.period,
          data.activity.at(-1)?.period,
        ]
      : [];
    return `<div class="toolbar"><select data-activity-setting="chart_type"><option ${settings.chart_type !== "bar" ? "selected" : ""}>line</option><option ${settings.chart_type === "bar" ? "selected" : ""}>bar</option></select><select data-activity-setting="group"><option>day</option><option ${settings.group === "week" ? "selected" : ""}>week</option><option ${settings.group === "month" ? "selected" : ""}>month</option></select><select multiple data-activity-setting="metrics" aria-label="Activity metrics">${["events", "interviews", "follow_ups", "rejections"].map((metric) => `<option ${metrics.includes(metric) ? "selected" : ""}>${metric}</option>`).join("")}</select></div>${chart}${labelSet.length ? `<div class="chart-labels muted num">${labelSet.map((label) => `<span>${esc(label || "")}</span>`).join("")}</div>` : ""}`;
  }
  if (id === "applications-work-arrangement")
    return `<p>Review work arrangement distribution in Applications filters.</p>`;
  return manager
    ? `<div class="metric num">${users.total ?? 0}</div><p>Users in manager scope</p>`
    : empty("No data in the selected range");
}
async function renderDashboard(manager = false) {
  shell(
    pageHead(
      manager ? "Manager dashboard" : "Dashboard",
      "A configurable view of momentum, health, goals, and next actions",
    ) + `<div class="loading">Loading widgets…</div>`,
  );
  const [data, users] = await Promise.all([
      dashboardData(manager),
      manager ? api("/api/manager/users") : Promise.resolve([]),
    ]),
    widgets = data.layout.widgets
      .filter((item) => item.enabled)
      .sort((a, b) => a.position - b.position);
  const scopeSelect = manager
    ? select(
        "manager-user-scope",
        "User scope",
        [
          { value: "", label: "All users" },
          ...users.map((user) => ({ value: user.id, label: user.full_name })),
        ],
        state.managerUserId,
      )
    : "";
  shell(
    `<section class="dashboard-hero"><div><p class="eyebrow">JobQuest Workspace</p><h1>${manager ? "Team search overview" : `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${esc(state.user.full_name.split(" ")[0])}`}</h1><p class="muted">${manager ? "See team momentum, pipeline health, and where support is needed." : "Here’s what’s moving in your job search and what needs attention next."}</p></div><div class="dashboard-controls"><div class="view-switcher" role="group" aria-label="Dashboard type"><button class="btn small ${manager ? "secondary" : ""}" data-dashboard-mode="user" aria-pressed="${!manager}">User</button>${state.user.role === "MANAGER" ? `<button class="btn small ${manager ? "" : "secondary"}" data-dashboard-mode="manager" aria-pressed="${manager}">Manager</button>` : ""}</div>${scopeSelect}<select id="dashboard-range" aria-label="Dashboard date range"><option value="7" ${state.dashboardDays === 7 ? "selected" : ""}>Last 7 days</option><option value="30" ${state.dashboardDays === 30 ? "selected" : ""}>Last 30 days</option><option value="90" ${state.dashboardDays === 90 ? "selected" : ""}>Last 90 days</option></select><button class="btn secondary" id="dashboard-settings">${icon("sliders-horizontal")}<span class="hide-narrow">Customize Dashboard</span><span class="show-narrow">Customize</span></button></div></section>` +
      `<div class="widget-grid">${widgets.map((item) => `<section class="widget size-${item.width} widget-${widgetDefinition(item.widget_id)?.kind || "insight"}" data-widget="${item.widget_id}"><header class="widget-header"><div><span class="widget-kicker">${esc(widgetDefinition(item.widget_id)?.kind || "overview")}</span><h2>${esc(WIDGET_NAMES[item.widget_id])}</h2></div>${DASHBOARD_DRILL[item.widget_id] ? `<button class="widget-drill" data-widget-drill="${item.widget_id}" aria-label="Open details for ${esc(WIDGET_NAMES[item.widget_id])}">View</button>` : ""}</header>${widgetContent(item.widget_id, data, manager)}</section>`).join("")}</div>`,
  );
  qs(".dashboard-controls")?.insertAdjacentHTML(
    "beforeend",
    `<button class="btn" data-page="quick-add">${icon("plus")}Quick Add</button>`,
  );
  qs('.dashboard-controls [data-page="quick-add"]').onclick = () =>
    go("quick-add");
  qsa("[data-dashboard-mode]").forEach((button) => {
    button.onclick = () => {
      const nextManager = button.dataset.dashboardMode === "manager";
      state.page = nextManager ? "manager" : "dashboard";
      renderDashboard(nextManager);
    };
  });
  if (manager)
    qs("select[name=manager-user-scope]").onchange = (event) => {
      state.managerUserId = event.target.value;
      renderDashboard(true);
    };
  qs("#dashboard-range").onchange = (event) => {
    state.dashboardDays = Number(event.target.value);
    renderDashboard(manager);
  };
  qsa("[data-activity-setting]").forEach(
    (control) =>
      (control.onchange = async () => {
        const item = data.layout.widgets.find(
            (widget) => widget.widget_id === "activity-chart",
          ),
          value = control.multiple
            ? [...control.selectedOptions].map((option) => option.value)
            : control.value;
        item.settings = {
          ...(item.settings || {}),
          [control.dataset.activitySetting]: value,
        };
        await api(
          `/api/dashboard/layout?type=${manager ? "manager" : "user"}`,
          {
            method: "PUT",
            body: JSON.stringify({ widgets: data.layout.widgets }),
          },
        );
        renderDashboard(manager);
      }),
  );
  qs("#dashboard-settings").onclick = () =>
    renderDashboardSettings(data.layout, manager);
  qsa("[data-widget-drill]").forEach(
    (button) =>
      (button.onclick = () => {
        const target = DASHBOARD_DRILL[button.dataset.widgetDrill];
        if (target.page) return go(target.page);
        state.page = "applications";
        renderApplications(new URLSearchParams(target));
      }),
  );
  qsa("[data-page]").forEach(
    (button) => (button.onclick = () => go(button.dataset.page)),
  );
}
function renderDashboardSettings(layout, manager) {
  state.layoutDraft = layout.widgets.map((item) => ({ ...item }));
  const defaults = (layout.defaults || layout.widgets).map((item) => ({
    ...item,
    settings: { ...(item.settings || {}) },
  }));
  const draw = () => {
    shell(
      pageHead(
        "Dashboard Settings",
        "Enable, size, and reorder widgets with drag, keyboard, or mobile controls",
        `<div class="actions"><label class="select-all-control"><input type="checkbox" id="layout-select-all"> Select All</label><button class="btn secondary" id="layout-deselect-all">Deselect All</button><button class="btn secondary" id="layout-reset">Restore Defaults</button><button class="btn" id="layout-save">Save Layout</button><button class="btn secondary" id="layout-cancel">Cancel</button></div>`,
      ) +
        `<section class="card full customize-toolbar"><label>Search widgets<input id="widget-search" type="search" placeholder="Search name or type ID"></label><p aria-live="polite"><strong>${state.layoutDraft.filter((item) => item.enabled).length}</strong> of ${DASHBOARD_WIDGETS.length} widgets enabled</p></section><div id="layout-list" class="layout-editor">${state.layoutDraft
          .map(
            (item, index) =>
              `<article draggable="true" tabindex="0" data-index="${index}" class="layout-row"><span class="drag-handle" aria-hidden="true">☰</span><label><input type="checkbox" data-enable="${index}" ${item.enabled ? "checked" : ""}> <span><strong>${esc(WIDGET_NAMES[item.widget_id])}</strong><code>${esc(item.widget_id)}</code></span></label>${select(
                `size-${index}`,
                "Size",
                [
                  { value: 1, label: "Small" },
                  { value: 2, label: "Medium" },
                  { value: 3, label: "Large" },
                ],
                item.width,
              )}<div class="actions"><button class="btn small secondary" data-move="-1" data-index="${index}" aria-label="Move ${esc(WIDGET_NAMES[item.widget_id])} up">↑</button><button class="btn small secondary" data-move="1" data-index="${index}" aria-label="Move ${esc(WIDGET_NAMES[item.widget_id])} down">↓</button></div></article>`,
          )
          .join("")}</div>`,
    );
    bind();
  };
  const bind = () => {
    qs("#widget-search").oninput = (event) => {
      const value = event.target.value.trim().toLowerCase();
      qsa(".layout-row").forEach((row) => {
        row.hidden = !row.textContent.toLowerCase().includes(value);
      });
    };
    const selectAll = qs("#layout-select-all"),
      selection = widgetSelectionState(state.layoutDraft);
    selectAll.checked = selection.checked;
    selectAll.indeterminate = selection.indeterminate;
    selectAll.setAttribute(
      "aria-checked",
      selection.indeterminate ? "mixed" : String(selection.checked),
    );
    selectAll.onchange = () => {
      state.layoutDraft = selectAll.checked
        ? selectAllWidgets(state.layoutDraft, defaults)
        : deselectAllWidgets(state.layoutDraft);
      draw();
    };
    qsa("[data-enable]").forEach(
      (input) =>
        (input.onchange = () => {
          state.layoutDraft[Number(input.dataset.enable)].enabled =
            input.checked;
          draw();
        }),
    );
    qsa("select[name^='size-']").forEach(
      (input) =>
        (input.onchange = () =>
          (state.layoutDraft[Number(input.name.split("-")[1])].width = Number(
            input.value,
          ))),
    );
    qsa("[data-move]").forEach(
      (button) =>
        (button.onclick = () => {
          state.layoutDraft = moveWidget(
            state.layoutDraft,
            Number(button.dataset.index),
            Number(button.dataset.move),
          );
          draw();
        }),
    );
    qsa(".layout-row").forEach((row) => {
      row.ondragstart = (e) =>
        e.dataTransfer.setData("text/plain", row.dataset.index);
      row.ondragover = (e) => {
        e.preventDefault();
        row.classList.add("drop-target");
      };
      row.ondragleave = () => row.classList.remove("drop-target");
      row.ondrop = (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/plain")),
          to = Number(row.dataset.index),
          item = state.layoutDraft.splice(from, 1)[0];
        state.layoutDraft.splice(to, 0, item);
        state.layoutDraft = state.layoutDraft.map((value, position) => ({
          ...value,
          position,
        }));
        draw();
      };
      row.onkeydown = (e) => {
        if (e.altKey && ["ArrowUp", "ArrowDown"].includes(e.key)) {
          e.preventDefault();
          state.layoutDraft = moveWidget(
            state.layoutDraft,
            Number(row.dataset.index),
            e.key === "ArrowUp" ? -1 : 1,
          );
          draw();
        }
      };
    });
    qs("#layout-save").onclick = async () => {
      await api(`/api/dashboard/layout?type=${manager ? "manager" : "user"}`, {
        method: "PUT",
        body: JSON.stringify({ widgets: state.layoutDraft }),
      });
      toast("Dashboard layout saved");
      renderDashboard(manager);
    };
    qs("#layout-deselect-all").onclick = () => {
      state.layoutDraft = deselectAllWidgets(state.layoutDraft);
      draw();
    };
    qs("#layout-reset").onclick = () => {
      state.layoutDraft = defaults.map((item) => ({
        ...item,
        settings: { ...(item.settings || {}) },
      }));
      draw();
    };
    qs("#layout-cancel").onclick = () => renderDashboard(manager);
  };
  draw();
}

async function managerOwner() {
  if (state.user.role !== "MANAGER") return "";
  const users = await api("/api/manager/users");
  return select(
    "target_user_id",
    "Record owner",
    users
      .filter((user) => user.is_active)
      .map((user) => ({
        value: user.id,
        label: `${user.full_name} (@${user.username})`,
      })),
    state.user.id,
  );
}
async function applicationForm(item = {}, quick = false) {
  const owner = !item.id ? await managerOwner() : "";
  const resumeVersion = field(
    "resume_version",
    "Resume Version",
    "text",
    item.resume_version,
    'maxlength="100" pattern="[A-Za-z0-9 ._()\\-]*" placeholder="Example: QA36, Test 35, Manual QA v7"',
  );
  const basics = `${field("company", "Company", "text", item.company, "required")}${field("job_title", "Job title", "text", item.job_title, "required")}${field("date_applied", "Date applied", "date", item.date_applied || date(), "required")}${field("job_url", "Job URL", "url", item.job_url)}${field("source", "Source", "text", item.source)}${select("stage", "Stage", STAGES, item.stage || "Applied")}${select("priority", "Priority", ["Low", "Medium", "High"], item.priority || "Medium")}${resumeVersion}`;
  if (quick) return `${owner}${basics}`;
  return `${owner}<fieldset><legend>Job Information</legend><div class="form-grid">${basics}${field("location", "Location", "text", item.location)}${select("work_arrangement", "Work arrangement", ["", "Remote", "Hybrid", "Onsite"], item.work_arrangement)}${select("employment_type", "Employment type", ["", "Full-time", "Part-time", "Contract", "Internship", "Temporary", "Other"], item.employment_type)}${field("salary_min", "Salary minimum", "number", item.salary_min, "min='0'")}${field("salary_max", "Salary maximum", "number", item.salary_max, "min='0'")}${field("salary_currency", "Currency", "text", item.salary_currency || "USD")}</div></fieldset><fieldset><legend>Application Information</legend><div class="form-grid">${field("cover_letter_version", "Cover letter version", "text", item.cover_letter_version)}${field("tags", "Tags, comma separated", "text", item.tags?.map?.((tag) => tag.name).join(", ") || item.tags || "")}${field("external_job_id", "External job ID", "text", item.external_job_id)}</div></fieldset><fieldset><legend>Recruiter Information</legend><div class="form-grid">${field("recruiter_name", "Recruiter name", "text", item.recruiter_name)}${field("recruiter_email", "Recruiter email", "email", item.recruiter_email)}${field("recruiter_phone", "Recruiter phone", "tel", item.recruiter_phone)}</div></fieldset><fieldset><legend>Action and Follow-Up</legend><div class="form-grid">${field("next_action", "Next action", "text", item.next_action)}${field("next_action_date", "Next-action date", "date", item.next_action_date)}${field("last_response_date", "Last-response date", "date", item.last_response_date)}</div></fieldset><fieldset><legend>Description and Notes</legend><div class="form-grid"><label class="full">Job description<textarea name="job_description">${esc(item.job_description)}</textarea></label><label class="full">Notes<textarea name="notes">${esc(item.notes)}</textarea></label><label class="check"><input type="checkbox" name="pinned" value="true" ${item.pinned ? "checked" : ""}> Pinned</label><label class="check"><input type="checkbox" name="important" value="true" ${item.important ? "checked" : ""}> Important</label><label class="check"><input type="checkbox" name="favorite" value="true" ${item.favorite ? "checked" : ""}> Favorite</label></div></fieldset>`;
}
async function renderAdd() {
  const form = await applicationForm(state.editing || {});
  const item = state.editing || {};
  shell(
    pageHead(
      item.id ? "Edit Application" : "Add Application",
      "Capture complete application details",
    ) +
      `<section class="card full"><form id="application-form">${form}<div id="form-error"></div><div class="actions"><button class="btn">Save Application</button><button type="button" class="btn secondary" data-page="applications">Cancel</button></div></form></section>`,
  );
  bindApplicationForm(item);
}
async function renderQuickAdd() {
  const form = await applicationForm({}, true);
  shell(
    pageHead(
      "Quick Add",
      "Enter the essentials and return immediately to your pipeline",
    ) +
      `<section class="card"><form id="application-form" class="form-grid">${form}<button class="btn full">Quick Add</button><div id="form-error" class="full"></div></form></section>`,
  );
  bindApplicationForm({});
}
function bindApplicationForm(item) {
  qs("#application-form").onsubmit = async (event) => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    input.tags = input.tags
      ?.split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    for (const flag of ["pinned", "important", "favorite"])
      input[flag] = event.currentTarget.elements[flag]?.checked || false;
    try {
      const result = await api(
        item.id ? `/api/applications/${item.id}` : "/api/applications",
        { method: item.id ? "PATCH" : "POST", body: JSON.stringify(input) },
      );
      state.editing = null;
      toast("Application saved");
      go(`detail:${result.id}`);
    } catch (error) {
      qs("#form-error").innerHTML = errorBox(error);
    }
  };
}

const VIEWS_UI = ["table", "kanban"];
const CONSEQUENTIAL_STAGES = [
  "Accepted",
  "Rejected",
  "Withdrawn",
  "Ghosted",
  "Position Closed",
];
async function renderApplications(params = new URLSearchParams()) {
  const requested = params.get("view"),
    preference = await api("/api/application-view-preferences"),
    view = VIEWS_UI.includes(requested) ? requested : preference.preferred_view;
  params.set("view", view);
  state.applicationView = view;
  const [data, savedViews, overview] = await Promise.all([
    api(
      view === "kanban"
        ? `/api/applications/kanban?${params}`
        : `/api/applications/query?${params}`,
    ),
    api("/api/saved-views"),
    api("/api/dashboard"),
  ]);
  const items =
    view === "kanban"
      ? data.columns.flatMap((column) => column.items)
      : data.items;
  state.applications = items;
  const requestFilter = (column, label) => {
    const existing = (() => {
      try {
        return JSON.parse(params.get("column_filters") || "[]");
      } catch {
        return [];
      }
    })();
    const dialog = document.createElement("dialog");
    dialog.className = "filter-dialog";
    const form = document.createElement("form");
    form.method = "dialog";
    const title = document.createElement("h2");
    title.textContent = `Filter ${label}`;
    form.append(title);
    const dateColumn = [
      "date_applied",
      "next_action_date",
      "updated_at",
    ].includes(column);
    const choices = {
      stage: STAGES,
      priority: ["High", "Medium", "Low"],
      work_arrangement: ["Remote", "Hybrid", "Onsite"],
    }[column];
    let operator = null,
      value = null,
      valueTo = null;
    if (choices) {
      value = document.createElement("select");
      value.multiple = true;
      value.setAttribute("aria-label", `${label} values`);
      for (const choice of choices) {
        const option = document.createElement("option");
        option.value = option.textContent = choice;
        value.append(option);
      }
      form.append(value);
    } else {
      operator = document.createElement("select");
      operator.setAttribute("aria-label", `${label} operator`);
      const operators = dateColumn
        ? ["equals", "before", "after", "between", "empty", "not_empty"]
        : [
            "contains",
            "not_contains",
            "equals",
            "not_equal",
            "starts_with",
            "ends_with",
            "empty",
            "not_empty",
          ];
      for (const name of operators) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = pretty(name);
        operator.append(option);
      }
      value = document.createElement("input");
      value.type = dateColumn ? "date" : "text";
      value.setAttribute("aria-label", `${label} value`);
      valueTo = document.createElement("input");
      valueTo.type = "date";
      valueTo.hidden = true;
      valueTo.setAttribute("aria-label", `${label} end date`);
      operator.onchange = () => {
        value.hidden = ["empty", "not_empty"].includes(operator.value);
        valueTo.hidden = operator.value !== "between";
      };
      form.append(operator, value, valueTo);
    }
    const actions = document.createElement("div");
    actions.className = "actions";
    const apply = document.createElement("button");
    apply.className = "btn";
    apply.value = "apply";
    apply.textContent = "Apply filter";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn secondary";
    cancel.textContent = "Cancel";
    cancel.onclick = () => dialog.close();
    actions.append(apply, cancel);
    form.append(actions);
    dialog.append(form);
    document.body.append(dialog);
    dialog.onclose = () => {
      if (dialog.returnValue === "apply") {
        const filter = choices
          ? {
              field: column,
              operator: "in",
              value: [...value.selectedOptions].map((item) => item.value),
            }
          : {
              field: column,
              operator: operator.value,
              value: value.value,
              value_to: valueTo.value,
            };
        params.set(
          "column_filters",
          JSON.stringify([
            ...existing.filter((item) => item.field !== column),
            filter,
          ]),
        );
        renderApplications(params);
      }
      dialog.remove();
    };
    dialog.showModal();
    (operator || value).focus();
  };
  const preview = async (item) => {
    const trigger = document.activeElement;
    try {
      const data = await api(`/api/applications/${item.id}/detail`);
      const drawer = createApplicationPreview(document, data, {
        onOpen: (application) => go(`detail:${application.id}`),
        onEdit: (application) => {
          state.editing = application;
          go("add");
        },
      });
      document.body.append(drawer);
      drawer.addEventListener("close", () => {
        drawer.remove();
        trigger?.focus?.();
      });
      drawer.showModal();
      drawer.querySelector("button")?.focus();
    } catch (error) {
      toast(error.message);
    }
  };
  const move = async (id, stage) => {
    const item = items.find((value) => value.id === Number(id));
    if (
      CONSEQUENTIAL_STAGES.includes(stage) &&
      !confirm(`Move ${item.company} to ${stage}?`)
    )
      return;
    try {
      await api(`/api/applications/${id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      });
      toast(`Moved to ${stage}`);
      renderApplications(params);
    } catch (error) {
      toast(error.message);
      renderApplications(params);
    }
  };
  const requestMove = (item) => {
    const dialog = document.createElement("dialog");
    dialog.className = "stage-dialog";
    const form = document.createElement("form");
    form.method = "dialog";
    const title = document.createElement("h2");
    title.textContent = `Move ${item.company}`;
    const label = document.createElement("label");
    label.textContent = "Destination stage";
    const select = document.createElement("select");
    select.name = "stage";
    for (const stage of STAGES) {
      const option = document.createElement("option");
      option.value = option.textContent = stage;
      option.selected = stage === item.stage;
      select.append(option);
    }
    label.append(select);
    const help = document.createElement("p");
    help.className = "muted";
    help.textContent =
      "This updates stage history, timeline, and audit history.";
    const actions = document.createElement("div");
    actions.className = "actions";
    const submit = document.createElement("button");
    submit.className = "btn";
    submit.value = "move";
    submit.textContent = "Move application";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn secondary";
    cancel.textContent = "Cancel";
    cancel.onclick = () => dialog.close();
    actions.append(submit, cancel);
    form.append(title, label, help, actions);
    dialog.append(form);
    document.body.append(dialog);
    dialog.onclose = async () => {
      const stage = select.value;
      const accepted = dialog.returnValue === "move";
      dialog.remove();
      if (accepted && stage !== item.stage) await move(item.id, stage);
    };
    dialog.showModal();
    select.focus();
  };
  const card = (item) =>
    `<article class="kanban-card" draggable="true" tabindex="0" data-card="${item.id}"><strong>${esc(item.company)}</strong><h3>${esc(item.job_title)}</h3>${item.resume_version ? `<p><strong>Resume Version:</strong> ${esc(item.resume_version)}</p>` : ""}<p>${badge(item.priority)} ${esc(item.date_applied)}</p><p>${esc(item.next_action || "No next action")} ${esc(item.next_action_date || "")}</p><div class="actions"><button class="btn small secondary" data-preview-card="${item.id}">Preview</button><button class="btn small secondary" data-open-card="${item.id}">Open</button><button class="btn small secondary" data-move="${item.id}">Move to stage</button></div></article>`;
  const grouping = preference.kanban_grouping || "date_applied_day";
  const collapsedGroups = new Set(
    preference.collapsed_groups?.[grouping] || [],
  );
  const perGroup = preference.cards_per_group || 15;
  const groupMarkup = (column) =>
    groupKanbanItems(column.items, grouping)
      .map((group) => {
        const groupId = `${column.stage}:${group.key}`,
          collapsed = collapsedGroups.has(groupId),
          expanded = state.expandedKanbanGroups.has(`${grouping}:${groupId}`),
          visible = expanded ? group.items : group.items.slice(0, perGroup);
        return `<section class="kanban-group ${collapsed ? "collapsed" : ""}" data-group-section="${esc(groupId)}"><button class="kanban-group-toggle" data-group-collapse="${esc(groupId)}" aria-expanded="${!collapsed}"><span>${esc(group.label)}</span><strong>${group.items.length}</strong></button><div class="kanban-cards" data-drop-stage="${esc(column.stage)}">${visible.map(card).join("") || empty("No applications")}${!collapsed && !expanded && group.items.length > perGroup ? `<button class="btn small secondary show-more" data-show-group="${esc(groupId)}">Show ${group.items.length - perGroup} more</button>` : ""}</div></section>`;
      })
      .join("");
  const board =
    view === "kanban"
      ? `<div class="kanban-toolbar"><label>Group cards<select id="kanban-grouping"><option value="date_applied_day">Date Applied · Day</option><option value="date_applied_week">Date Applied · Week</option><option value="date_applied_month">Date Applied · Month</option><option value="last_updated_day">Last Updated · Day</option><option value="next_action_day">Next Action Date · Day</option><option value="none">No grouping</option></select></label></div><div class="kanban" aria-label="Application Kanban board">${data.columns.map((column) => `<section class="kanban-column ${preference.collapsed_columns.includes(column.stage) ? "collapsed" : ""}"><header><button class="column-toggle" data-collapse="${esc(column.stage)}" aria-expanded="${!preference.collapsed_columns.includes(column.stage)}">${badge(column.stage)} <strong>${column.total}</strong></button></header><div class="kanban-column-groups">${groupMarkup(column) || empty("No applications")}</div></section>`).join("")}</div>`
      : "";
  const activeFilters = [...params.entries()].filter(
    ([key, value]) =>
      value && !["view", "page", "page_size", "sort", "direction"].includes(key),
  );
  const filterChips = activeFilters
    .map(
      ([key, value]) =>
        `<button class="filter-chip" type="button" data-remove-filter="${esc(key)}" aria-label="Remove ${esc(pretty(key))} filter">${esc(pretty(key))}: ${esc(value)} <span aria-hidden="true">×</span></button>`,
    )
    .join("");
  const performance = overview.performance || {};
  const applicationSummary = [
    ["Total Applications", data.total],
    ["Active Pipeline", performance.active || 0],
    [
      "Interviews",
      Number(overview.pipeline?.Interview || 0) +
        Number(overview.pipeline?.["Final Interview"] || 0),
    ],
    ["Response Rate", `${performance.response_rate || 0}%`],
  ];
  shell(
    pageHead(
      "Applications",
      `${data.total} applications`,
      `<div class="actions"><div class="view-switcher" role="group" aria-label="Applications view"><button class="btn small ${view === "table" ? "" : "secondary"}" data-view="table" aria-pressed="${view === "table"}">Table</button><button class="btn small ${view === "kanban" ? "" : "secondary"}" data-view="kanban" aria-pressed="${view === "kanban"}">Kanban</button></div><button class="btn" data-page="quick-add">Quick Add</button><button class="btn secondary" id="open-export">Export</button></div>`,
    ) +
      `<section class="card full application-workspace"><div class="toolbar applications-meta"><select id="saved-view"><option value="">Saved views</option>${savedViews.map((saved) => `<option value="${saved.id}">${esc(saved.name)}</option>`).join("")}</select><span class="result-count" role="status">${data.total} result${data.total === 1 ? "" : "s"}</span><select id="application-sort" aria-label="Sort applications"><option value="updated_at:desc">Recently updated</option><option value="company:asc">Company A–Z</option><option value="company:desc">Company Z–A</option><option value="job_title:asc">Job title A–Z</option><option value="job_title:desc">Job title Z–A</option><option value="date_applied:desc">Application date: newest</option><option value="date_applied:asc">Application date: oldest</option><option value="salary_min:desc">Salary: highest</option><option value="salary_min:asc">Salary: lowest</option></select></div><form id="app-filters" class="toolbar advanced-filter-bar"><input name="search" type="search" placeholder="Search company, title, location, recruiter, notes, tags..." value="${esc(params.get("search") || "")}"><select name="stage"><option value="">All stages</option>${STAGES.map((stage) => `<option ${params.get("stage") === stage ? "selected" : ""}>${stage}</option>`).join("")}</select><select name="priority"><option value="">All priorities</option>${["High", "Medium", "Low"].map((priority) => `<option ${params.get("priority") === priority ? "selected" : ""}>${priority}</option>`).join("")}</select><button class="btn small">Apply</button><button type="button" class="btn small secondary" id="more-filters">More Filters</button><button type="button" class="btn small secondary" id="clear-filters">Clear All</button><button type="button" class="btn small secondary" id="save-view">Save View</button></form><div class="active-filters" aria-label="Active filters">${filterChips}${activeFilters.length ? `<button class="link-button" type="button" id="clear-filter-chips">Clear all filters</button>` : ""}</div><div id="advanced-filters" hidden class="filter-panel"><div class="form-grid">${select("work_arrangement", "Work arrangement", ["", "Remote", "Hybrid", "Onsite"], params.get("work_arrangement") || "")}${select("employment_type", "Employment type", ["", "Full-time", "Part-time", "Contract", "Internship", "Temporary", "Other"], params.get("employment_type") || "")}${field("date_from", "Applied from", "date", params.get("date_from") || "")}${field("date_to", "Applied to", "date", params.get("date_to") || "")}</div></div>${view === "table" ? '<div id="applications-table-root"></div>' : board}<div class="pagination"><button class="btn secondary" id="prev-page" ${data.page <= 1 ? "disabled" : ""}>Previous</button><span>Page ${data.page} of ${Math.max(1, data.pages)}</span><button class="btn secondary" id="next-page" ${data.page >= data.pages ? "disabled" : ""}>Next</button></div></section><dialog id="export-dialog"><form method="dialog" class="form-grid"><h2 class="full">Export applications</h2>${select(
        "format",
        "Format",
        [
          { value: "xlsx", label: "Excel (.xlsx)" },
          { value: "csv", label: "CSV" },
          { value: "json", label: "JSON" },
        ],
        "xlsx",
      )}${select(
        "date_field",
        "Date field",
        [
          { value: "date_applied", label: "Date Applied" },
          { value: "created_at", label: "Created Date" },
          { value: "updated_at", label: "Last Updated" },
        ],
        "date_applied",
      )}${field("date_from", "Start date", "date", params.get("date_from") || "")}${field("date_to", "End date", "date", params.get("date_to") || "")}<div class="actions full"><button class="btn" value="export">Export</button><button class="btn secondary" value="cancel">Cancel</button></div></form></dialog>`,
  );
  qs(".application-workspace").insertAdjacentHTML(
    "beforebegin",
    `<section class="application-summary" aria-label="Application pipeline summary">${applicationSummary.map(([label, value]) => `<article><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`).join("")}</section>`,
  );
  qs('#app-filters input[name="search"]').setAttribute(
    "aria-label",
    "Search applications",
  );
  qs('#app-filters select[name="stage"]').setAttribute(
    "aria-label",
    "Filter by stage",
  );
  qs('#app-filters select[name="priority"]').setAttribute(
    "aria-label",
    "Filter by priority",
  );
  if (view === "table") {
    qs("#applications-table-root").append(
      createApplicationTable(document, {
        items,
        sort: params.get("sort") || "updated_at",
        direction: params.get("direction") || "desc",
        onSort: (sort, direction) => {
          params.set("sort", sort);
          params.set("direction", direction);
          renderApplications(params);
        },
        onFilter: requestFilter,
        onOpen: (item) => go(`detail:${item.id}`),
        onMove: requestMove,
        onPreview: preview,
        selected: state.selectedApplications,
        onSelect: (item, selected) => {
          selected
            ? state.selectedApplications.add(item.id)
            : state.selectedApplications.delete(item.id);
        },
        onSelectAll: (visibleItems, selected) => {
          for (const item of visibleItems)
            selected
              ? state.selectedApplications.add(item.id)
              : state.selectedApplications.delete(item.id);
          renderApplications(params);
        },
      }),
    );
  }
  qs("#saved-view").setAttribute("aria-label", "Saved application views");
  qs('#app-filters input[name="search"]').setAttribute(
    "aria-label",
    "Search applications",
  );
  qs('#app-filters select[name="stage"]').setAttribute(
    "aria-label",
    "Filter by stage",
  );
  qs('#app-filters select[name="priority"]').setAttribute(
    "aria-label",
    "Filter by priority",
  );
  qs("#application-sort").value = `${params.get("sort") || "updated_at"}:${params.get("direction") || "desc"}`;
  qs("#application-sort").onchange = (event) => {
    const [sort, direction] = event.target.value.split(":");
    params.set("sort", sort);
    params.set("direction", direction);
    params.set("page", "1");
    renderApplications(params);
  };
  let searchTimer;
  qs('#app-filters input[name="search"]').oninput = (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const value = event.target.value.trim().replace(/\s+/g, " ");
      value ? params.set("search", value) : params.delete("search");
      params.set("page", "1");
      renderApplications(params);
    }, 300);
  };
  qs("#app-filters").onsubmit = (event) => {
    event.preventDefault();
    const next = new URLSearchParams(new FormData(event.currentTarget));
    qsa("#advanced-filters input, #advanced-filters select").forEach((control) => {
      if (control.name && control.value) next.set(control.name, control.value);
    });
    next.set("view", view);
    next.set("sort", params.get("sort") || "updated_at");
    next.set("direction", params.get("direction") || "desc");
    next.set("page", "1");
    renderApplications(next);
  };
  qsa("[data-remove-filter]").forEach((button) => {
    button.onclick = () => {
      params.delete(button.dataset.removeFilter);
      params.set("page", "1");
      renderApplications(params);
    };
  });
  if (qs("#clear-filter-chips"))
    qs("#clear-filter-chips").onclick = () =>
      renderApplications(new URLSearchParams({ view }));
  qs("#prev-page").onclick = () => {
    params.set("page", String(Math.max(1, data.page - 1)));
    renderApplications(params);
  };
  qs("#next-page").onclick = () => {
    params.set("page", String(Math.min(data.pages, data.page + 1)));
    renderApplications(params);
  };
  qsa("[data-view]").forEach(
    (button) =>
      (button.onclick = async () => {
        params.set("view", button.dataset.view);
        await api("/api/application-view-preferences", {
          method: "PUT",
          body: JSON.stringify({ preferred_view: button.dataset.view }),
        });
        renderApplications(params);
      }),
  );
  qs("#more-filters").onclick = () =>
    (qs("#advanced-filters").hidden = !qs("#advanced-filters").hidden);
  qs("#clear-filters").onclick = () =>
    renderApplications(new URLSearchParams({ view }));
  qs("#save-view").onclick = async () => {
    const name = prompt("Saved view name");
    if (name) {
      await api("/api/saved-views", {
        method: "POST",
        body: JSON.stringify({
          name,
          filters: Object.fromEntries(params),
          view_type: view,
        }),
      });
      toast("View saved");
    }
  };
  qs("#saved-view").onchange = (event) => {
    const saved = savedViews.find(
      (item) => item.id === Number(event.target.value),
    );
    if (saved)
      renderApplications(new URLSearchParams(JSON.parse(saved.filters_json)));
  };
  qsa("[data-open]").forEach((row) => {
    row.onclick = (event) => {
      if (!event.target.closest("button,a")) go(`detail:${row.dataset.open}`);
    };
    row.onkeydown = (event) => {
      if (event.key === "Enter") go(`detail:${row.dataset.open}`);
    };
  });
  qsa("[data-open-card]").forEach(
    (button) =>
      (button.onclick = () => go(`detail:${button.dataset.openCard}`)),
  );
  qsa("[data-preview-card]").forEach(
    (button) =>
      (button.onclick = () => {
        const item = items.find(
          (value) => value.id === Number(button.dataset.previewCard),
        );
        if (item) preview(item);
      }),
  );
  qsa("[data-move]").forEach(
    (button) =>
      (button.onclick = () => {
        const item = items.find(
          (value) => value.id === Number(button.dataset.move),
        );
        if (item) requestMove(item);
      }),
  );
  qsa("[data-card]").forEach(
    (element) =>
      (element.ondragstart = (event) =>
        event.dataTransfer.setData("text/plain", element.dataset.card)),
  );
  qsa("[data-drop-stage]").forEach((column) => {
    column.ondragover = (event) => event.preventDefault();
    column.ondrop = (event) =>
      move(event.dataTransfer.getData("text/plain"), column.dataset.dropStage);
  });
  qsa("[data-collapse]").forEach(
    (button) =>
      (button.onclick = async () => {
        const collapsed = new Set(preference.collapsed_columns);
        collapsed.has(button.dataset.collapse)
          ? collapsed.delete(button.dataset.collapse)
          : collapsed.add(button.dataset.collapse);
        await api("/api/application-view-preferences", {
          method: "PUT",
          body: JSON.stringify({ collapsed_columns: [...collapsed] }),
        });
        renderApplications(params);
      }),
  );
  if (view === "kanban") {
    qs("#kanban-grouping").value = grouping;
    qs("#kanban-grouping").onchange = async (event) => {
      await api("/api/application-view-preferences", {
        method: "PUT",
        body: JSON.stringify({ kanban_grouping: event.target.value }),
      });
      state.expandedKanbanGroups.clear();
      renderApplications(params);
    };
  }
  qsa("[data-group-collapse]").forEach(
    (button) =>
      (button.onclick = async () => {
        const next = new Set(collapsedGroups);
        next.has(button.dataset.groupCollapse)
          ? next.delete(button.dataset.groupCollapse)
          : next.add(button.dataset.groupCollapse);
        await api("/api/application-view-preferences", {
          method: "PUT",
          body: JSON.stringify({
            collapsed_groups: {
              ...(preference.collapsed_groups || {}),
              [grouping]: [...next],
            },
          }),
        });
        renderApplications(params);
      }),
  );
  qsa("[data-show-group]").forEach(
    (button) =>
      (button.onclick = () => {
        state.expandedKanbanGroups.add(
          `${grouping}:${button.dataset.showGroup}`,
        );
        renderApplications(params);
      }),
  );
  const dialog = qs("#export-dialog");
  qs("#open-export").onclick = () => dialog.showModal();
  dialog.onclose = () => {
    if (dialog.returnValue !== "export") return;
    const values = Object.fromEntries(
        new FormData(dialog.querySelector("form")),
      ),
      next = new URLSearchParams(params);
    if (
      values.date_from &&
      values.date_to &&
      values.date_from > values.date_to
    ) {
      toast("Start date cannot be after end date");
      return;
    }
    if (values.date_from) next.set("date_from", values.date_from);
    if (values.date_to) next.set("date_to", values.date_to);
    if (values.date_field) next.set("date_field", values.date_field);
    location.href =
      values.format === "xlsx"
        ? `/api/exports/applications.xlsx?${next}`
        : `/api/exports/${values.format === "json" ? "json" : "applications"}?${next}`;
  };
}

async function legacyRenderApplications(params = new URLSearchParams()) {
  const [data, savedViews] = await Promise.all([
    api(`/api/applications?${params}`),
    api("/api/saved-views"),
  ]);
  state.applications = data.items;
  const rowsHtml = data.items
    .map(
      (item) =>
        `<tr class="clickable-row" data-open="${item.id}" tabindex="0"><td>${item.pinned ? "📌 " : ""}${esc(item.date_applied)}</td><td><strong>${esc(item.company)}</strong></td><td>${esc(item.job_title)}</td><td>${badge(item.stage)}</td><td>${esc(item.priority)}</td><td>${esc(item.source || "—")}</td><td>${esc(item.tags || "—")}</td><td>${item.days_inactive}d · ${esc(agingBand(item.days_inactive))}</td><td><div class="actions"><button class="btn small secondary" data-edit="${item.id}">Edit</button><button class="btn small secondary" data-pin="${item.id}" data-value="${item.pinned ? 0 : 1}">${item.pinned ? "Unpin" : "Pin"}</button><button class="btn small danger" data-archive="${item.id}">${item.archived_at ? "Restore" : "Archive"}</button></div></td></tr>`,
    )
    .join("");
  shell(
    pageHead(
      "Applications",
      `${data.total} records · page ${data.page} of ${Math.max(1, data.pages)}`,
      `<div class="actions"><button class="btn" data-page="quick-add">Quick Add</button><a class="btn secondary" href="/api/exports/applications">CSV Export</a></div>`,
    ) +
      `<section class="card full"><div class="toolbar"><select id="saved-view"><option value="">Saved views</option>${savedViews.map((view) => `<option value="${view.id}">${esc(view.name)}</option>`).join("")}</select><button class="btn small secondary" id="delete-view" disabled>Delete View</button></div><form id="app-filters" class="toolbar"><input name="search" placeholder="Search company, title, location" value="${esc(params.get("search") || "")}"><select name="stage"><option value="">All stages</option>${STAGES.map((stage) => `<option ${params.get("stage") === stage ? "selected" : ""}>${stage}</option>`).join("")}</select><select name="priority"><option value="">All priorities</option><option>High</option><option>Medium</option><option>Low</option></select><select name="archived"><option value="">Active</option><option value="true">Archived</option><option value="all">All</option></select><label class="inline"><input type="checkbox" name="pinned" value="true"> Pinned</label><button class="btn small">Apply</button><button type="button" class="btn small secondary" id="save-view">Save View</button></form>${table(["Applied", "Company", "Job title", "Stage", "Priority", "Source", "Tags", "Aging", "Actions"], rowsHtml, "No applications match these filters")}</section><div class="pagination"><button class="btn secondary" id="prev-page" ${data.page <= 1 ? "disabled" : ""}>Previous</button><button class="btn secondary" id="next-page" ${data.page >= data.pages ? "disabled" : ""}>Next</button></div>`,
  );
  qs("#app-filters").onsubmit = (e) => {
    e.preventDefault();
    renderApplications(new URLSearchParams(new FormData(e.currentTarget)));
  };
  qs("#save-view").onclick = async () => {
    const name = prompt("Saved view name");
    if (name) {
      await api("/api/saved-views", {
        method: "POST",
        body: JSON.stringify({
          name,
          filters: Object.fromEntries(new FormData(qs("#app-filters"))),
        }),
      });
      toast("View saved");
    }
  };
  qs("#saved-view").onchange = (event) => {
    const view = savedViews.find(
      (item) => item.id === Number(event.target.value),
    );
    qs("#delete-view").disabled = !view;
    if (view)
      renderApplications(new URLSearchParams(JSON.parse(view.filters_json)));
  };
  qs("#delete-view").onclick = async () => {
    const id = qs("#saved-view").value;
    if (id && confirm("Delete this saved view?")) {
      await api(`/api/saved-views/${id}`, { method: "DELETE" });
      renderApplications(params);
    }
  };
  qsa("[data-open]").forEach((row) => {
    row.onclick = (e) => {
      if (!e.target.closest("button,a")) go(`detail:${row.dataset.open}`);
    };
    row.onkeydown = (e) => {
      if (e.key === "Enter") go(`detail:${row.dataset.open}`);
    };
  });
  qsa("[data-edit]").forEach(
    (button) =>
      (button.onclick = () => {
        state.editing = state.applications.find(
          (item) => item.id === Number(button.dataset.edit),
        );
        go("add");
      }),
  );
  qsa("[data-pin]").forEach(
    (button) =>
      (button.onclick = async () => {
        await api(`/api/applications/${button.dataset.pin}/pin`, {
          method: "POST",
          body: JSON.stringify({ pinned: Number(button.dataset.value) }),
        });
        renderApplications(params);
      }),
  );
  qsa("[data-archive]").forEach(
    (button) =>
      (button.onclick = async () => {
        const item = state.applications.find(
          (value) => value.id === Number(button.dataset.archive),
        );
        await api(
          `/api/applications/${item.id}/${item.archived_at ? "restore" : "archive"}`,
          { method: "POST", body: "{}" },
        );
        renderApplications(params);
      }),
  );
  qs("#prev-page").onclick = () => {
    params.set("page", data.page - 1);
    renderApplications(params);
  };
  qs("#next-page").onclick = () => {
    params.set("page", data.page + 1);
    renderApplications(params);
  };
}

async function renderDetail(id) {
  const data = await api(`/api/applications/${id}/detail`),
    item = data.application,
    form = await applicationForm(item);
  shell(
    pageHead(
      `${item.company} — ${item.job_title}`,
      "Application details, decisions, and complete history",
      `<div class="actions"><button class="btn secondary" id="pin-detail">${item.pinned ? "Unpin" : "Pin"}</button><button class="btn secondary" id="archive-detail">${item.archived_at ? "Restore" : "Archive"}</button><button class="btn danger" id="delete-detail">Delete</button></div>`,
    ) +
      `<section class="application-header">${badge(item.stage)}<span class="badge">${esc(item.priority)}</span><span>${esc(item.location || "Location not set")}</span><span>${esc(item.work_arrangement || "Arrangement not set")}</span><span>Applied ${esc(item.date_applied)}</span><span class="health health-${item.health.toLowerCase().replaceAll(" ", "-")}">Workflow health: ${esc(item.health)}</span></section><section class="card full quick-actions"><strong>Workflow actions</strong><select id="detail-stage">${STAGES.map((stage) => `<option ${stage === item.stage ? "selected" : ""}>${stage}</option>`).join("")}</select><button class="btn small" data-related-page="interviews">Add Interview</button><button class="btn small" data-related-page="follow_ups">Add Follow-Up</button><button class="btn small danger" id="mark-rejected">Mark Rejected</button><button class="btn small secondary" data-related-page="networking_contacts">Link Contact</button></section><section class="next-action-card"><div><div class="eyebrow">Next action</div><h2>${esc(item.next_action || "No next action")}</h2><p>${item.next_action_date ? `Due ${esc(item.next_action_date)} · ${remaining(item.next_action_date)}` : "Choose a due date to activate reminders"}</p></div><button class="btn" id="complete-next" ${item.next_action ? "" : "disabled"}>Complete</button></section>${timelineView(data.timeline, id)}<section class="card full"><h2>Application Summary</h2><div class="summary-grid"><p><strong>Source</strong><br>${esc(item.source || "—")}</p><p><strong>Resume Version</strong><br>${esc(item.resume_version || "No resume specified")}</p><p><strong>Job URL</strong><br>${item.job_url ? `<a href="${esc(item.job_url)}" target="_blank" rel="noopener">Open posting</a>` : "—"}</p><p><strong>Tags</strong><br>${item.tags.map((tag) => `<span class="badge">${esc(tag.name)}</span>`).join(" ") || "—"}</p></div></section>${detailTabs(data)}<section class="card full"><details><summary><strong>Edit complete application</strong></summary><form id="application-form">${form}<div id="form-error"></div><div class="actions"><button class="btn">Save</button><button type="button" class="btn secondary" id="cancel-edit">Cancel</button></div></form></details></section><section class="card full"><h2>Related applications at ${esc(item.company)}</h2>${data.related.map((rel) => `<button class="related-card" data-detail="${rel.id}">${esc(rel.job_title)} ${badge(rel.stage)} · ${rel.date_applied}</button>`).join("") || empty("No other applications at this company")}</section><div class="previous-next">${data.previous ? `<button class="btn secondary" data-detail="${data.previous}">← Previous</button>` : "<span></span>"}${data.next ? `<button class="btn secondary" data-detail="${data.next}">Next →</button>` : ""}</div>`,
  );
  bindApplicationForm(item);
  qsa("[data-detail]").forEach(
    (button) => (button.onclick = () => go(`detail:${button.dataset.detail}`)),
  );
  qs("#pin-detail").onclick = async () => {
    await api(`/api/applications/${id}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned: !item.pinned }),
    });
    go(`detail:${id}`);
  };
  qs("#archive-detail").onclick = async () => {
    await api(
      `/api/applications/${id}/${item.archived_at ? "restore" : "archive"}`,
      { method: "POST", body: "{}" },
    );
    go(`detail:${id}`);
  };
  qs("#delete-detail").onclick = async () => {
    if (
      confirm("Permanently delete this application and every related record?")
    ) {
      await api(`/api/applications/${id}`, { method: "DELETE" });
      go("applications");
    }
  };
  qs("#complete-next").onclick = async () => {
    const next = prompt("Optional next action after completion") || "";
    await api(`/api/applications/${id}/next-action`, {
      method: "POST",
      body: JSON.stringify({ next_action: next, next_action_date: null }),
    });
    go(`detail:${id}`);
  };
  qs("#detail-stage").onchange = async (event) => {
    await api(`/api/applications/${id}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage: event.target.value }),
    });
    go(`detail:${id}`);
  };
  qsa("[data-related-page]").forEach((button) => {
    button.onclick = () => {
      state.relatedAppId = String(id);
      go(button.dataset.relatedPage);
    };
  });
  qs("#mark-rejected").onclick = () => {
    state.relatedAppId = String(id);
    go("rejections");
  };
  bindTimeline(id);
  bindChecklist(id);
}
function timelineView(events, id) {
  return `<section class="card full timeline-section"><div class="section-head"><h2>Visual Timeline</h2><div class="actions"><select id="timeline-filter"><option value="all">All</option><option value="stage">Stage changes</option><option value="interview">Interviews</option><option value="follow_up">Follow-ups</option><option value="recruiter">Recruiter activity</option><option value="rejection">Rejections</option><option value="offer">Offers</option><option value="notes">Notes</option><option value="automatic">Automatic</option><option value="manual">Manual</option></select><select id="timeline-sort"><option value="desc">Newest</option><option value="asc">Oldest</option></select><a class="btn small secondary" id="timeline-csv" href="/api/applications/${id}/timeline/csv">CSV</a><a class="btn small secondary" id="timeline-json" href="/api/applications/${id}/timeline/json">JSON</a></div></div><div class="timeline">${events.map((event) => `<article class="timeline-event ${STAGE_CLASS[event.stage] || ""}"><time>${esc(event.event_date)} ${esc(event.event_time || "")}</time><div><span class="badge">${esc(event.category)}</span><h3>${esc(event.title)}</h3><p>${esc(event.description || "")}</p><small>${esc(event.source)} · ${esc(event.actor_username || "")}</small></div></article>`).join("") || empty("No timeline events")}</div><details><summary>Add manual timeline event</summary><form id="timeline-form" class="form-grid">${field("event_date", "Event date", "date", date(), "required")}${field("event_time", "Time", "time")}${select("category", "Category", ["recruiter", "assessment", "interview", "follow_up", "offer", "notes"], "notes")}${select("event_type", "Event type", ["recruiter_viewed", "recruiter_called", "recruiter_emailed", "assessment_received", "assessment_submitted", "hiring_manager_contacted", "reference_requested", "reference_submitted", "background_check_started", "documents_requested", "verbal_offer", "custom"], "custom")}${field("title", "Title", "text", "", "required")}${field("contact_person", "Contact")}${select("stage", "Optional stage", ["", ...STAGES], "")}<label class="full">Note<textarea name="description"></textarea></label>${field("next_action", "Next action")}${field("next_action_date", "Next-action date", "date")}<button class="btn">Add Event</button></form></details></section>`;
}
function bindTimeline(id) {
  const update = async () => {
    const query = new URLSearchParams({
      category: qs("#timeline-filter").value,
      sort: qs("#timeline-sort").value,
    });
    qs("#timeline-csv").href = `/api/applications/${id}/timeline/csv?${query}`;
    qs("#timeline-json").href =
      `/api/applications/${id}/timeline/json?${query}`;
    const events = await api(`/api/applications/${id}/timeline?${query}`);
    qs(".timeline").innerHTML =
      events
        .map(
          (event) =>
            `<article class="timeline-event ${STAGE_CLASS[event.stage] || ""}"><time>${esc(event.event_date)} ${esc(event.event_time || "")}</time><div><span class="badge">${esc(event.category)}</span><h3>${esc(event.title)}</h3><p>${esc(event.description || "")}</p><small>${esc(event.source)} · ${esc(event.actor_username || "")}</small></div></article>`,
        )
        .join("") || empty("No timeline events match these filters");
  };
  qs("#timeline-filter").onchange = update;
  qs("#timeline-sort").onchange = update;
  qs("#timeline-form").onsubmit = async (event) => {
    event.preventDefault();
    await api(`/api/applications/${id}/timeline`, {
      method: "POST",
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget)),
      ),
    });
    toast("Timeline updated");
    go(`detail:${id}`);
  };
}
function detailTabs(data) {
  const progress = data.checklist.filter((item) => item.completed).length;
  return `<section class="card full"><div class="tabs" role="tablist"><button>Overview</button><button>Timeline</button><button>Interviews (${data.interviews.length})</button><button>Follow-Ups (${data.follow_ups.length})</button><button>Networking (${data.networking.length})</button><button>Resume</button><button>Checklist</button><button>Notes</button>${data.audit ? "<button>Audit History</button>" : ""}</div><div class="tab-content"><h2>Application Checklist</h2><p>${progress} of ${data.checklist.length} complete</p><progress value="${progress}" max="${data.checklist.length || 1}"></progress><div id="checklist">${data.checklist.map((item) => `<label class="checklist-item"><input type="checkbox" data-checklist="${item.id}" ${item.completed ? "checked" : ""}> ${esc(item.label)} <small>${esc(item.note || "")}</small></label>`).join("")}</div><form id="checklist-add" class="toolbar"><input name="label" placeholder="Custom checklist item" required><button class="btn small">Add</button></form>${data.audit ? `<details><summary>Manager audit history</summary>${data.audit.map((item) => `<p>${esc(item.created_at)} · ${esc(item.actor_username)} · ${esc(item.action)} ${esc(item.details || "")}</p>`).join("")}</details>` : ""}</div></section>`;
}
function bindChecklist(id) {
  qsa("[data-checklist]").forEach(
    (input) =>
      (input.onchange = () =>
        api(`/api/applications/${id}/checklist/${input.dataset.checklist}`, {
          method: "POST",
          body: JSON.stringify({ completed: input.checked }),
        })),
  );
  qs("#checklist-add").onsubmit = async (event) => {
    event.preventDefault();
    await api(`/api/applications/${id}/checklist`, {
      method: "POST",
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget)),
      ),
    });
    go(`detail:${id}`);
  };
}

const jsonExample = JSON.stringify(
  [
    {
      company: "ABC Technologies",
      job_title: "QA Engineer",
      date_applied: date(),
      source: "LinkedIn",
      stage: "Applied",
      priority: "High",
      resume_version: "QA36",
      tags: ["QA", "Remote"],
      pinned: true,
    },
  ],
  null,
  2,
);
const textExample = `company: ABC Technologies\njob_title: QA Engineer\ndate_applied: ${date()}\nsource: LinkedIn\nstage: Applied\npriority: High\nresume_used: Test 35\ntags: QA, Remote\npinned: true`;
async function renderBulk() {
  const owner = await managerOwner();
  shell(
    pageHead(
      "Bulk Import",
      "Preview, validate, and import JSON or structured text",
    ) +
      `<section class="card full"><form id="bulk-form"><div class="form-grid">${owner}${select("format", "Format", ["json", "structured_text"], "json")}${select(
        "import_mode",
        "Mode",
        [
          { value: "valid_rows_only", label: "Valid rows only" },
          { value: "all_or_nothing", label: "All or nothing" },
        ],
      )}${select("duplicate_action", "Duplicates", [
        { value: "skip", label: "Skip" },
        { value: "import_anyway", label: "Import anyway" },
        { value: "update_existing", label: "Update existing" },
      ])}<label class="full">Input<textarea name="text" rows="15" required>${esc(jsonExample)}</textarea></label></div><div class="actions"><button class="btn" name="intent" value="preview">Validate</button><button class="btn secondary" type="button" id="copy-example">Copy Example</button><button class="btn secondary" type="button" id="clear-input">Clear</button><button class="btn" name="intent" value="import" disabled>Import</button></div><div id="bulk-error"></div></form></section><section id="preview"></section>`,
  );
  const form = qs("#bulk-form");
  form.elements.format.onchange = () =>
    (form.elements.text.value =
      form.elements.format.value === "json" ? jsonExample : textExample);
  qs("#copy-example").onclick = () =>
    navigator.clipboard
      .writeText(form.elements.text.value)
      .then(() => toast("Example copied"));
  qs("#clear-input").onclick = () => (form.elements.text.value = "");
  form.onsubmit = async (event) => {
    event.preventDefault();
    const intent = event.submitter.value,
      input = Object.fromEntries(new FormData(form));
    try {
      if (intent === "preview") {
        const result = await api("/api/import/preview", {
          method: "POST",
          body: JSON.stringify(input),
        });
        state.preview = result.rows;
        form.querySelector("[value=import]").disabled = !result.rows.some(
          (row) => row.valid,
        );
        qs("#preview").innerHTML = table(
          [
            "Row",
            "Company",
            "Title",
            "Date",
            "Stage",
            "Resume Version",
            "Result",
            "Messages",
          ],
          result.rows
            .map(
              (row) =>
                `<tr><td>${row.row_number}</td><td>${esc(row.data.company)}</td><td>${esc(row.data.job_title)}</td><td>${esc(row.data.date_applied)}</td><td>${badge(row.data.stage)}</td><td>${esc(row.data.resume_version || "No resume specified")}</td><td>${esc(row.result)}</td><td>${esc(row.errors.join("; ") || (row.duplicate ? `Matches #${row.duplicate_id}` : "Ready"))}</td></tr>`,
            )
            .join(""),
        );
      } else {
        const result = await api("/api/import", {
          method: "POST",
          body: JSON.stringify(input),
        });
        toast(
          `${result.created_rows} created · ${result.updated_rows} updated · ${result.skipped_rows} skipped`,
        );
        go("applications");
      }
    } catch (error) {
      qs("#bulk-error").innerHTML = errorBox(error);
    }
  };
}

const trackerMeta = {
  interviews: {
    title: "Interviews",
    fields: [
      "application_id",
      "interview_round",
      "interview_type",
      "scheduled_at",
      "time_zone",
      "format",
      "interviewer_names",
      "result",
    ],
  },
  rejections: {
    title: "Rejections",
    fields: [
      "application_id",
      "rejection_date",
      "stage_at_rejection",
      "rejection_reason",
      "eligible_for_reapplication",
      "reapplication_date",
    ],
  },
  follow_ups: {
    title: "Follow-Ups",
    fields: [
      "application_id",
      "follow_up_type",
      "contact_name",
      "communication_channel",
      "suggested_date",
      "due_date",
      "status",
      "next_follow_up_date",
    ],
  },
  networking_contacts: {
    title: "Networking",
    fields: [
      "contact_name",
      "company",
      "job_title",
      "linkedin_url",
      "email",
      "relationship_type",
      "connection_request_date",
      "next_follow_up_date",
      "networking_stage",
    ],
  },
};
async function renderTracker(type) {
  const meta = trackerMeta[type],
    [items, apps] = await Promise.all([
      api(`/api/${type}`),
      api("/api/applications?page_size=100&archived=all"),
    ]);
  const appOptions = [
    { value: "", label: "Select application" },
    ...apps.items.map((item) => ({
      value: item.id,
      label: `${item.company} — ${item.job_title}`,
    })),
  ];
  const controls = meta.fields
    .map((name) => {
      if (name === "application_id")
        return select(
          name,
          "Application",
          appOptions,
          state.relatedAppId,
          type === "networking_contacts" ? "" : "required",
        );
      if (name === "status")
        return select(
          name,
          "Status",
          [
            "Due",
            "Sent",
            "Waiting",
            "Responded",
            "No Response",
            "Completed",
            "Cancelled",
          ],
          "Due",
        );
      if (name === "interview_type")
        return select(name, "Interview type", [
          "Recruiter Screen",
          "Hiring Manager",
          "Behavioral",
          "Technical",
          "Coding",
          "Panel",
          "Final Interview",
          "Other",
        ]);
      if (name === "format")
        return select(name, "Format", ["Phone", "Video", "Onsite", "Other"]);
      if (name === "networking_stage")
        return select(name, "Stage", [
          "Identified",
          "Connection Sent",
          "Connected",
          "Message Sent",
          "Responded",
          "Referral Requested",
          "Referred",
          "Closed",
        ]);
      const inputType =
        name === "scheduled_at"
          ? "datetime-local"
          : name.includes("date")
            ? "date"
            : name === "linkedin_url"
              ? "url"
              : name === "eligible_for_reapplication"
                ? "checkbox"
                : "text";
      return field(
        name,
        pretty(name),
        inputType,
        "",
        [
          "contact_name",
          "interview_round",
          "interview_type",
          "scheduled_at",
          "rejection_date",
          "stage_at_rejection",
          "follow_up_type",
          "due_date",
        ].includes(name)
          ? "required"
          : "",
      );
    })
    .join("");
  shell(
    pageHead(meta.title, "Owned records linked to your application workflow") +
      `<div class="grid"><section class="card wide">${table(["ID", ...meta.fields, "Owner", "Actions"], items.map((item) => `<tr><td>${item.id}</td>${meta.fields.map((name) => `<td>${esc(item[name] ?? "—")}</td>`).join("")}<td>${esc(item.owner_username || "")}</td><td><button class="btn small danger" data-delete="${item.id}">Delete</button></td></tr>`).join(""))}</section><section class="card"><h2>Add ${meta.title.replace(/s$/, "")}</h2><form id="tracker-form" class="form-grid">${await managerOwner()}${controls}<label class="full">Notes<textarea name="notes"></textarea></label><button class="btn full">Save</button><div id="tracker-error" class="full"></div></form></section></div>`,
  );
  if (type === "follow_ups")
    qs("select[name=application_id]").onchange = async (event) => {
      if (event.target.value) {
        const result = await api(
          `/api/follow-ups/suggest?application_id=${event.target.value}`,
        );
        qs("input[name=suggested_date]").value =
          result.suggested_first_follow_up;
        qs("input[name=due_date]").value = result.suggested_first_follow_up;
      }
    };
  qs("#tracker-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      await api(`/api/${type}`, {
        method: "POST",
        body: JSON.stringify(
          Object.fromEntries(new FormData(event.currentTarget)),
        ),
      });
      toast("Record saved");
      state.relatedAppId = "";
      renderTracker(type);
    } catch (error) {
      qs("#tracker-error").innerHTML = errorBox(error);
    }
  };
  qsa("[data-delete]").forEach(
    (button) =>
      (button.onclick = async () => {
        if (confirm("Delete this record?")) {
          await api(`/api/${type}/${button.dataset.delete}`, {
            method: "DELETE",
          });
          renderTracker(type);
        }
      }),
  );
}

async function renderResumes() {
  const [items, analytics] = await Promise.all([
    api("/api/resumes"),
    api("/api/resumes/analytics"),
  ]);
  shell(
    pageHead(
      "Resume Tracker",
      "Metadata and outcome evidence for each resume version",
    ) +
      `<div class="grid"><section class="card wide"><h2>Resume versions</h2>${table(["Version", "Target role", "Category", "File", "Status", "Actions"], items.map((item) => `<tr><td>${esc(item.version_name)}</td><td>${esc(item.target_role || "—")}</td><td>${esc(item.job_category || "—")}</td><td>${esc(item.file_name || "Metadata only")}</td><td>${item.is_archived ? "Archived" : "Active"}</td><td><button class="btn small secondary" data-resume-archive="${item.id}" data-value="${item.is_archived ? 0 : 1}">${item.is_archived ? "Restore" : "Archive"}</button></td></tr>`).join(""))}<h2>Resume analytics</h2>${table(["Version", "Sample", "Responses", "Interviews", "Offers", "Response rate", "Interview conversion"], analytics.map((item) => `<tr><td>${esc(item.version_name)}</td><td>${item.sample_size}</td><td>${item.responses}</td><td>${item.interviews}</td><td>${item.offers}</td><td>${item.response_rate}%</td><td>${item.interview_conversion}%</td></tr>`).join(""))}</section><section class="card"><h2>Add resume metadata</h2><form id="resume-form" class="form-grid">${await managerOwner()}${field("version_name", "Version name", "text", "", "required")}${field("target_role", "Target role")}${field("job_category", "Job category")}${field("file_name", "File name")}${field("resume_date", "Resume date", "date", date())}<label class="full">Notes<textarea name="notes"></textarea></label><button class="btn full">Save</button></form><p class="muted">Files are not uploaded; only secure metadata is stored.</p></section></div>`,
  );
  qs("#resume-form label.full")?.insertAdjacentHTML(
    "beforebegin",
    `${field("revision_label", "Revision label")}${field("change_summary", "Change summary")}`,
  );
  const resumeHeading = qsa("h2").find(
    (heading) => heading.textContent === "Resume versions",
  );
  resumeHeading?.insertAdjacentHTML(
    "afterend",
    `<div class="toolbar"><select id="compare-left" aria-label="First resume version"><option value="">Compare versionâ€¦</option>${items.map((item) => `<option value="${item.id}">${esc(item.version_name)}</option>`).join("")}</select><select id="compare-right" aria-label="Second resume version"><option value="">Withâ€¦</option>${items.map((item) => `<option value="${item.id}">${esc(item.version_name)}</option>`).join("")}</select><button class="btn small secondary" id="compare-resumes">Compare</button></div><div id="resume-comparison" aria-live="polite"></div>`,
  );
  qsa("[data-resume-archive]").forEach((button) =>
    button.insertAdjacentHTML(
      "beforebegin",
      `<button class="btn small secondary" data-resume-clone="${button.dataset.resumeArchive}">New revision</button>`,
    ),
  );
  qs("#resume-form").onsubmit = async (event) => {
    event.preventDefault();
    await api("/api/resumes", {
      method: "POST",
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget)),
      ),
    });
    renderResumes();
  };
  qsa("[data-resume-archive]").forEach(
    (button) =>
      (button.onclick = async () => {
        await api(`/api/resumes/${button.dataset.resumeArchive}`, {
          method: "PATCH",
          body: JSON.stringify({ is_archived: Number(button.dataset.value) }),
        });
        renderResumes();
      }),
  );
  qsa("[data-resume-clone]").forEach(
    (button) =>
      (button.onclick = async () => {
        const version_name = prompt("New version name");
        if (version_name) {
          await api(`/api/resumes/${button.dataset.resumeClone}/clone`, {
            method: "POST",
            body: JSON.stringify({
              version_name,
              change_summary: "Created as a new revision",
            }),
          });
          renderResumes();
        }
      }),
  );
  qs("#compare-resumes").onclick = async () => {
    const left = qs("#compare-left").value,
      right = qs("#compare-right").value;
    if (!left || !right) return toast("Choose two resume versions");
    const data = await api(`/api/resumes/compare?left=${left}&right=${right}`);
    qs("#resume-comparison").innerHTML =
      `<div class="comparison-grid"><article><h3>${esc(data.left.version_name)}</h3><p>${data.left.applications} applications Â· ${data.left.interviews || 0} interviews Â· ${data.left.offers || 0} offers</p></article><article><h3>${esc(data.right.version_name)}</h3><p>${data.right.applications} applications Â· ${data.right.interviews || 0} interviews Â· ${data.right.offers || 0} offers</p></article></div><p class="muted">Metadata and performance comparison; document wording is not stored.</p>`;
  };
}

async function renderReminders() {
  const [items, categories] = await Promise.all([
    api("/api/reminders"),
    api("/api/reminder-categories"),
  ]);
  const options = categories
    .filter((item) => !item.archived_at)
    .map((item) => ({
      value: item.id,
      label: `${item.name} (${item.reminder_count})`,
    }));
  shell(
    pageHead(
      "Reminder Center",
      "One place for due, overdue, snoozed, and completed work",
      `<button class="btn secondary" id="manage-categories">Manage Categories</button>`,
    ) +
      `<div class="grid"><section class="card wide"><div class="toolbar"><select id="reminder-filter"><option value="">All categories</option>${options.map((item) => `<option value="${item.value}">${esc(item.label)}</option>`).join("")}</select></div><div id="reminder-list">${items.map((item) => `<article class="reminder" data-category="${item.category_id}"><div><span class="badge">${esc(item.calculated_status)}</span><span class="badge">${esc(item.priority)}</span><h3>${esc(item.title)}</h3><p>${esc(item.due_date)} ${esc(item.due_time || "")} · ${esc(item.description || "")}</p></div><div class="actions"><button class="btn small" data-complete-reminder="${item.id}">Complete</button><button class="btn small secondary" data-snooze="${item.id}" data-days="1">Tomorrow</button><button class="btn small secondary" data-snooze="${item.id}" data-days="7">One week</button><button class="btn small danger" data-delete-reminder="${item.id}">Delete</button></div></article>`).join("") || empty("No reminders")}</div></section><section class="card"><h2>Add reminder</h2><form id="reminder-form" class="form-grid">${select("category_id", "Category", options, "", "required")}${field("title", "Title", "text", "", "required")}${field("due_date", "Due date", "date", date(), "required")}${field("due_time", "Due time", "time", "09:00")}${select("priority", "Priority", ["Low", "Medium", "High"], "Medium")}<label class="full">Description<textarea name="description"></textarea></label><button class="btn full">Save</button></form></section></div>`,
  );
  qs("#manage-categories").onclick = () => renderCategories(categories);
  qs("#reminder-filter").onchange = (event) =>
    qsa(".reminder").forEach(
      (item) =>
        (item.hidden =
          event.target.value && item.dataset.category !== event.target.value),
    );
  qs("#reminder-form").onsubmit = async (event) => {
    event.preventDefault();
    await api("/api/reminders", {
      method: "POST",
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget)),
      ),
    });
    renderReminders();
  };
  qsa("[data-complete-reminder]").forEach(
    (button) =>
      (button.onclick = async () => {
        await api(`/api/reminders/${button.dataset.completeReminder}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "Completed",
            completed_at: new Date().toISOString(),
          }),
        });
        renderReminders();
      }),
  );
  qsa("[data-snooze]").forEach(
    (button) =>
      (button.onclick = async () => {
        await api(`/api/reminders/${button.dataset.snooze}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "Snoozed",
            snoozed_until: `${addClientDays(date(), Number(button.dataset.days))}T09:00:00Z`,
          }),
        });
        renderReminders();
      }),
  );
  qsa("[data-delete-reminder]").forEach(
    (button) =>
      (button.onclick = async () => {
        await api(`/api/reminders/${button.dataset.deleteReminder}`, {
          method: "DELETE",
          body: "{}",
        });
        renderReminders();
      }),
  );
}
function renderCategories(categories) {
  shell(
    pageHead(
      "Reminder Categories",
      "Built-in categories stay stable; custom categories belong to you",
      `<button class="btn secondary" data-page="reminders">Back to Reminders</button>`,
    ) +
      `<div class="grid"><section class="card wide">${categories.map((item) => `<article class="category-row"><i style="background:${esc(item.color)}"></i><strong>${esc(item.name)}</strong><span>${item.is_builtin ? "Built-in" : "Custom"} · ${item.reminder_count} reminders</span>${item.is_builtin ? "" : `<div class="actions"><button class="btn small secondary" data-category-rename="${item.id}" data-name="${esc(item.name)}">Rename</button><button class="btn small secondary" data-category-archive="${item.id}" data-value="${item.archived_at ? "restore" : "archive"}">${item.archived_at ? "Restore" : "Archive"}</button><button class="btn small danger" data-category-delete="${item.id}">Delete</button></div>`}</article>`).join("")}</section><section class="card"><h2>New custom category</h2><form id="category-form">${field("name", "Name", "text", "", "required")}${field("color", "Color", "color", "#3157d5")}${select("icon", "Icon", ["bell", "calendar", "send", "users", "target", "file"])}<button class="btn">Create</button></form></section></div>`,
  );
  qs("#category-form").onsubmit = async (event) => {
    event.preventDefault();
    await api("/api/reminder-categories", {
      method: "POST",
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget)),
      ),
    });
    renderReminders();
  };
  qsa("[data-category-archive]").forEach(
    (button) =>
      (button.onclick = () =>
        api(`/api/reminder-categories/${button.dataset.categoryArchive}`, {
          method: "PATCH",
          body: JSON.stringify({ [button.dataset.value]: true }),
        }).then(renderReminders)),
  );
  qsa("[data-category-rename]").forEach((button) => {
    button.onclick = async () => {
      const name = prompt("New category name", button.dataset.name);
      if (name) {
        await api(`/api/reminder-categories/${button.dataset.categoryRename}`, {
          method: "PATCH",
          body: JSON.stringify({ name }),
        });
        renderReminders();
      }
    };
  });
  qsa("[data-category-delete]").forEach(
    (button) =>
      (button.onclick = async () => {
        const replacement = prompt(
          "Enter a replacement category ID for existing reminders, or leave blank when unused",
        );
        try {
          await api(
            `/api/reminder-categories/${button.dataset.categoryDelete}`,
            {
              method: "DELETE",
              body: JSON.stringify({
                reassign_to: replacement ? Number(replacement) : null,
              }),
            },
          );
          renderReminders();
        } catch (error) {
          toast(error.message);
        }
      }),
  );
}

async function renderCalendar() {
  const current = state.calendarDate,
    year = current.getFullYear(),
    month = current.getMonth(),
    start = new Date(year, month, 1).toISOString().slice(0, 10),
    end = new Date(year, month + 1, 0).toISOString().slice(0, 10),
    data = await api(
      `/api/calendar?view=${state.calendarView}&date_from=${start}&date_to=${end}`,
    );
  let content;
  if (state.calendarView === "month") {
    const cells = monthCells(year, month);
    content = `<div class="calendar-grid"><div class="calendar-weekdays">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<b>${day}</b>`).join("")}</div>${cells
      .map(
        (cell) =>
          `<section class="calendar-day ${cell.currentMonth ? "" : "outside"}"><time>${Number(cell.date.slice(-2))}</time>${data.events
            .filter((event) => event.date.slice(0, 10) === cell.date)
            .map(
              (event) =>
                `<button data-event="${event.related_record_id}" data-event-type="${event.related_record_type}">${esc(event.title)}</button>`,
            )
            .join("")}</section>`,
      )
      .join("")}</div>`;
  } else if (state.calendarView === "week") {
    const dayIndex = (current.getDay() + 6) % 7,
      weekStart = addClientDays(current.toISOString().slice(0, 10), -dayIndex),
      days = Array.from({ length: 7 }, (_, index) =>
        addClientDays(weekStart, index),
      );
    content = `<div class="week-grid">${days
      .map(
        (day) =>
          `<section><h3>${new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</h3>${
            data.events
              .filter((event) => event.date.slice(0, 10) === day)
              .map(
                (event) =>
                  `<button class="agenda-event" data-event="${event.related_record_id}" data-event-type="${event.related_record_type}"><strong>${esc(event.title)}</strong><span>${esc(event.type)}</span></button>`,
              )
              .join("") || empty("No events")
          }</section>`,
      )
      .join("")}</div>`;
  } else {
    content = `<div class="agenda">${data.events.map((event) => `<button class="agenda-event" data-event="${event.related_record_id}" data-event-type="${event.related_record_type}"><time>${esc(event.date.slice(0, 16))}</time><strong>${esc(event.title)}</strong><span>${esc(event.type)}</span></button>`).join("") || empty("No events in this period")}</div>`;
  }
  shell(
    pageHead(
      "Calendar",
      `${state.calendarView} view · applications, interviews, follow-ups, networking, reminders, goals`,
      `<div class="actions"><button class="btn secondary" id="cal-prev">←</button><strong>${current.toLocaleString(undefined, { month: "long", year: "numeric" })}</strong><button class="btn secondary" id="cal-next">→</button>${select("calendar-view", "View", ["month", "week", "agenda"], state.calendarView)}</div>`,
    ) + content,
  );
  qs("#cal-prev").onclick = () => {
    state.calendarDate = new Date(year, month - 1, 1);
    renderCalendar();
  };
  qs("#cal-next").onclick = () => {
    state.calendarDate = new Date(year, month + 1, 1);
    renderCalendar();
  };
  qs("select[name=calendar-view]").onchange = (event) => {
    state.calendarView = event.target.value;
    renderCalendar();
  };
  qsa("[data-event]").forEach(
    (button) =>
      (button.onclick = () =>
        button.dataset.eventType === "application"
          ? go(`detail:${button.dataset.event}`)
          : go(button.dataset.eventType + "s")),
  );
}

async function renderGoals() {
  const settings = await api("/api/goals/settings");
  shell(
    pageHead(
      "Goal Settings",
      "Effective-dated targets preserve historical results",
    ) +
      `<div class="grid"><section class="card wide">${table(["Period", "Category", "Target", "Effective", "Ends", "Enabled"], settings.map((item) => `<tr><td>${item.period_type}</td><td>${pretty(item.category)}</td><td>${item.target}</td><td>${item.effective_date}</td><td>${item.end_date || "—"}</td><td>${item.enabled ? "Yes" : "No"}</td></tr>`).join(""))}</section><section class="card"><h2>Set a new target</h2><form id="goal-form">${select("period_type", "Period", ["daily", "weekly"])}${select("category", "Category", ["applications", "follow_ups", "connections", "recruiter_messages", "interview_prep_minutes"])}${field("target", "Target", "number", 5, "min='0' required")}${field("effective_date", "Effective date", "date", date(), "required")}${field("end_date", "Optional end date", "date")}<label class="check"><input type="checkbox" name="enabled" value="true" checked> Enabled</label><button class="btn">Save Target</button></form></section></div>`,
  );
  qs("#goal-form").onsubmit = async (event) => {
    event.preventDefault();
    await api("/api/goals/settings", {
      method: "POST",
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget)),
      ),
    });
    renderGoals();
  };
}
async function renderGoalHistory() {
  const [daily, weekly] = await Promise.all([
    api(
      `/api/goals/history?period_type=daily&date_from=${addClientDays(date(), -30)}&date_to=${date()}`,
    ),
    api(
      `/api/goals/comparison?period_type=weekly&date_from=${addClientDays(date(), -84)}&date_to=${date()}`,
    ),
  ]);
  shell(
    pageHead(
      "Goal History & Comparison",
      "Trends, achieved-versus-missed results, streaks, and shortfalls",
    ) +
      `<div class="grid"><section class="card"><span>Achievement rate</span><div class="metric">${daily.summary.achievement_percentage}%</div></section><section class="card"><span>Current/longest achieved streak</span><div class="metric">${daily.summary.longest_achieved_streak}</div></section><section class="card"><span>Average shortfall</span><div class="metric">${daily.summary.average_shortfall}</div></section><section class="card wide"><h2>Daily trend</h2><div class="trend-chart">${daily.items.map((item) => `<i title="${esc(item.period_start)} ${esc(item.category)} ${item.completion_percentage}%" style="height:${Math.min(100, item.completion_percentage)}%" class="${item.achieved ? "achieved" : "missed"}"></i>`).join("")}</div>${table(["Date", "Category", "Target", "Actual", "Completion", "Result"], daily.items.map((item) => `<tr><td>${item.period_start}</td><td>${pretty(item.category)}</td><td>${item.target}</td><td>${item.actual}</td><td>${item.completion_percentage}%</td><td>${item.achieved ? "Achieved" : "Missed"}</td></tr>`).join(""))}</section><section class="card"><h2>Weekly achieved vs missed</h2><div class="comparison-bar"><i style="width:${weekly.summary.achievement_percentage}%"></i></div><p>${weekly.summary.achieved} achieved · ${weekly.summary.missed} missed</p><p>Longest achieved: ${weekly.summary.longest_achieved_streak}<br>Longest missed: ${weekly.summary.longest_missed_streak}<br>Average above: ${weekly.summary.average_above_target}<br>Average shortfall: ${weekly.summary.average_shortfall}</p></section></div>`,
  );
}

async function renderAging() {
  const data = await api("/api/analytics/aging");
  shell(
    pageHead(
      "Application Aging & Health",
      "Workflow health based on real activity—not a hiring prediction",
    ) +
      `<div class="grid">${Object.entries(data.summary)
        .map(
          ([band, count]) =>
            `<section class="card"><span>${esc(band)}</span><div class="metric">${count}</div></section>`,
        )
        .join(
          "",
        )}<section class="card full">${table(["Company", "Role", "Stage", "Applied", "Last activity", "Inactive", "Follow-up", "Next action", "Aging", "Health"], data.items.map((item) => `<tr class="clickable-row" data-detail="${item.id}"><td>${esc(item.company)}</td><td>${esc(item.job_title)}</td><td>${badge(item.stage)}</td><td>${item.date_applied}</td><td>${item.last_activity}</td><td>${item.days_inactive}d</td><td>${esc(item.follow_up_status || "—")}</td><td>${esc(item.next_action || "—")}</td><td>${esc(item.aging_category)}</td><td>${esc(item.health)}</td></tr>`).join(""))}</section></div>`,
  );
  qsa("[data-detail]").forEach(
    (row) => (row.onclick = () => go(`detail:${row.dataset.detail}`)),
  );
}
async function renderStageAnalytics() {
  const data = await api("/api/analytics/stage-duration");
  shell(
    pageHead(
      "Stage-Duration Analytics",
      "Durations use completed immutable stage visits only",
    ) +
      `<div class="grid"><section class="card wide"><div class="bar-chart">${
        data.stages
          .filter((item) => item.sample_size)
          .map(
            (item) =>
              `<div><span>${esc(item.stage)}</span><i style="width:${Math.min(100, (item.average || 0) * 5)}%"></i><strong>${item.average}d</strong></div>`,
          )
          .join("") || empty("Insufficient completed stage-history data")
      }</div>${table(["Stage", "Sample", "Average", "Median", "Minimum", "Maximum"], data.stages.map((item) => `<tr><td>${item.stage}</td><td>${item.sample_size}</td><td>${item.average ?? "—"}</td><td>${item.median ?? "—"}</td><td>${item.minimum ?? "—"}</td><td>${item.maximum ?? "—"}</td></tr>`).join(""))}</section><section class="card"><h2>Currently stalled</h2>${data.stalled.map((item) => `<p>${esc(item.company)} — ${esc(item.job_title)}<br><strong>${Math.round(item.duration_days)} days in ${esc(item.new_stage)}</strong></p>`).join("") || empty("No applications stalled 14+ days")}</section></div>`,
  );
}
async function renderCompleteStageAnalytics() {
  await renderStageAnalytics();
  const metrics = await api("/api/analytics/stage-transitions");
  qs(".grid").insertAdjacentHTML(
    "beforeend",
    `<section class="card full"><h2>Lifecycle transitions</h2><div class="summary-grid">${[
      ["Applied to first response", metrics.applied_to_first_response],
      ["Applied to recruiter screen", metrics.applied_to_recruiter_screen],
      ["Applied to interview", metrics.applied_to_interview],
      ["Interview to offer", metrics.interview_to_offer],
      ["Applied to rejection", metrics.applied_to_rejection],
      ["Complete lifecycle", metrics.complete_lifecycle],
    ]
      .map(
        ([label, value]) =>
          `<p><strong>${esc(label)}</strong><br>${value == null ? "Insufficient data" : `${value} days`}</p>`,
      )
      .join("")}</div><p class="muted">${esc(metrics.note)}</p></section>`,
  );
}
function renderExports() {
  shell(
    pageHead(
      "Exports",
      "Download only the records authorized for your account",
    ) +
      `<div class="grid">${[
        ["applications", "Applications CSV"],
        ["interviews", "Interviews CSV"],
        ["rejections", "Rejections CSV"],
        ["follow_ups", "Follow-Ups CSV"],
        ["networking", "Networking CSV"],
        ["reminders", "Reminders CSV"],
        ["resume-analytics", "Resume Analytics CSV"],
        ["goals", "Goal History CSV"],
        ["aging", "Aging Report CSV"],
        ["stage-duration", "Stage-Duration Report CSV"],
        ["json", "Complete Versioned JSON"],
      ]
        .map(
          ([id, label]) =>
            `<a class="card export-card" href="/api/exports/${id}"><h2>${esc(label)}</h2><p>Download securely</p></a>`,
        )
        .join("")}</div>`,
  );
}
async function renderSettings() {
  const [settings, tags] = await Promise.all([
    api("/api/settings"),
    api("/api/tags?archived=all"),
  ]);
  shell(
    pageHead(
      "Settings",
      "Profile, security, appearance, dashboard, goals, reminders, follow-ups, and application defaults",
    ) +
      `<nav class="settings-tabs" aria-label="Settings sections"><button class="btn small secondary" data-page="profile">Profile</button><button class="btn small secondary" id="security-settings">PIN & Security</button><button class="btn small secondary" id="dashboard-settings-link">Dashboard Settings</button><button class="btn small secondary" data-page="goals">Goal Settings</button><button class="btn small secondary" data-page="reminders">Reminder Settings</button></nav><section class="card wide"><h2>Appearance and workflow defaults</h2><form id="settings-form" class="form-grid">${select("theme", "Theme", ["light", "dark", "system"], settings.theme)}${select(
        "week_start",
        "Week starts",
        [
          { value: 1, label: "Monday" },
          { value: 0, label: "Sunday" },
        ],
        settings.week_start,
      )}${field("first_follow_up_delay", "First follow-up delay", "number", settings.first_follow_up_delay, "min='0'")}${field("second_follow_up_delay", "Second follow-up delay", "number", settings.second_follow_up_delay, "min='0'")}${select(
        "follow_up_day_type",
        "Delay units",
        [
          { value: "business", label: "Business days" },
          { value: "calendar", label: "Calendar days" },
        ],
        settings.follow_up_day_type,
      )}${field("default_reminder_time", "Default reminder time", "time", settings.default_reminder_time)}<label class="check full"><input type="checkbox" name="auto_create_follow_up_reminder" value="true" ${settings.auto_create_follow_up_reminder ? "checked" : ""}> Automatically create follow-up reminders</label><button class="btn">Save Settings</button></form></section><section class="card full"><h2>Tag Management</h2><form id="tag-form" class="toolbar">${field("name", "Tag name", "text", "", "required")}${field("color", "Color", "color", "#3157d5")}<button class="btn small">Create Tag</button></form>${tags.map((tag) => `<article class="category-row"><i style="background:${esc(tag.color)}"></i><strong>${esc(tag.name)}</strong><span>${tag.archived_at ? "Archived" : "Active"}</span><div class="actions"><button class="btn small secondary" data-tag-rename="${tag.id}" data-name="${esc(tag.name)}">Rename</button><button class="btn small secondary" data-tag-archive="${tag.id}" data-archived="${tag.archived_at ? 0 : 1}">${tag.archived_at ? "Restore" : "Archive"}</button></div></article>`).join("") || empty("No tags yet")}</section>`,
  );
  qs("#settings-form").onsubmit = async (event) => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    input.auto_create_follow_up_reminder = Boolean(
      input.auto_create_follow_up_reminder,
    );
    await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    state.user.theme = input.theme;
    applyTheme(input.theme);
    localStorage.setItem("jobquest-theme", input.theme);
    toast("Settings saved");
  };
  qs("#security-settings").onclick = () =>
    toast("PIN changes require current credential verification");
  qs("#dashboard-settings-link").onclick = () => {
    state.page = "dashboard";
    renderDashboard();
    setTimeout(() => qs("#dashboard-settings")?.click(), 0);
  };
  qs("#tag-form").onsubmit = async (event) => {
    event.preventDefault();
    await api("/api/tags", {
      method: "POST",
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget)),
      ),
    });
    renderSettings();
  };
  qsa("[data-tag-rename]").forEach((button) => {
    button.onclick = async () => {
      const name = prompt("New tag name", button.dataset.name);
      if (name)
        await api(`/api/tags/${button.dataset.tagRename}`, {
          method: "PATCH",
          body: JSON.stringify({ name }),
        });
      renderSettings();
    };
  });
  qsa("[data-tag-archive]").forEach((button) => {
    button.onclick = async () => {
      await api(`/api/tags/${button.dataset.tagArchive}`, {
        method: "PATCH",
        body: JSON.stringify({
          archived_at: Number(button.dataset.archived)
            ? new Date().toISOString()
            : null,
        }),
      });
      renderSettings();
    };
  });
}
function renderProfile() {
  shell(
    pageHead("Profile", "Identity and access information") +
      `<section class="card"><h2>${esc(state.user.full_name)}</h2><p><strong>Username</strong><br>${esc(state.user.username)}</p><p><strong>Email</strong><br>${esc(state.user.email || "—")}</p><p><strong>Phone</strong><br>${esc(state.user.phone || "—")}</p><p>${badge(state.user.role)}</p></section>`,
  );
}

async function renderManager() {
  return renderDashboard(true);
}
async function renderUsers() {
  const users = await api("/api/manager/users");
  shell(
    pageHead(
      "User Management",
      "Activate, deactivate, promote, and demote with last-manager safeguards",
    ) +
      table(
        [
          "User",
          "Contact",
          "Role",
          "Status",
          "Applications",
          "Interviews",
          "Follow-ups",
          "Last activity",
          "Actions",
        ],
        users
          .map(
            (user) =>
              `<tr><td><strong>${esc(user.full_name)}</strong><br>@${esc(user.username)}</td><td>${esc(user.email || "—")}</td><td>${user.role}</td><td>${user.is_active ? "Active" : "Inactive"}</td><td>${user.application_count}</td><td>${user.interview_count}</td><td>${user.follow_up_count}</td><td>${esc(user.last_activity || "—")}</td><td><button class="btn small secondary" data-role="${user.id}" data-value="${user.role === "MANAGER" ? "USER" : "MANAGER"}">${user.role === "MANAGER" ? "Demote" : "Promote"}</button> <button class="btn small danger" data-active="${user.id}" data-value="${user.is_active ? 0 : 1}">${user.is_active ? "Deactivate" : "Activate"}</button></td></tr>`,
          )
          .join(""),
      ),
  );
  qsa("[data-role]").forEach(
    (button) =>
      (button.onclick = () =>
        updateUser(button.dataset.role, { role: button.dataset.value })),
  );
  qsa("[data-active]").forEach(
    (button) =>
      (button.onclick = () =>
        updateUser(button.dataset.active, {
          is_active: Number(button.dataset.value),
        })),
  );
}
async function updateUser(id, input) {
  try {
    await api(`/api/manager/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    renderUsers();
  } catch (error) {
    toast(error.message);
  }
}
async function renderImports() {
  const items = await api("/api/import/history");
  shell(
    pageHead("Import History", "Permanent attempts and row outcomes") +
      table(
        [
          "ID",
          "Owner",
          "Format",
          "Mode",
          "Total",
          "Created",
          "Updated",
          "Skipped",
          "Rejected",
          "Status",
          "Created",
        ],
        items
          .map(
            (item) =>
              `<tr><td>${item.id}</td><td>${esc(item.owner_username || item.user_id)}</td><td>${item.input_format}</td><td>${item.import_mode}</td><td>${item.total_rows}</td><td>${item.created_rows}</td><td>${item.updated_rows}</td><td>${item.skipped_rows}</td><td>${item.rejected_rows}</td><td>${item.status}</td><td>${item.created_at}</td></tr>`,
          )
          .join(""),
      ),
  );
}
async function renderAudit() {
  const items = await api("/api/manager/audit");
  shell(
    pageHead(
      "Technical Audit History",
      "Manager-only actor, owner, action, and change evidence",
    ) +
      table(
        ["Time", "Owner", "Actor", "Entity", "ID", "Action", "Details"],
        items
          .map(
            (item) =>
              `<tr><td>${item.created_at}</td><td>${esc(item.owner_username)}</td><td>${esc(item.actor_username)}</td><td>${item.entity_type}</td><td>${item.entity_id}</td><td>${item.action}</td><td>${esc(item.details || "")}</td></tr>`,
          )
          .join(""),
      ),
  );
}

function remaining(due) {
  const days = Math.ceil(
    (Date.parse(`${due}T23:59:59`) - Date.now()) / 86400000,
  );
  return days < 0
    ? `${Math.abs(days)} days overdue`
    : days === 0
      ? "Due today"
      : `${days} days remaining`;
}
function addClientDays(value, days) {
  const next = new Date(`${value}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
applyTheme(localStorage.getItem("jobquest-theme") || "system");
(async () => {
  try {
    const result = await api("/api/auth/me");
    state.user = result.user;
    state.csrf = result.csrf_token;
    applyTheme(state.user.theme || "system");
    go("dashboard");
  } catch {
    authView();
  }
})();
