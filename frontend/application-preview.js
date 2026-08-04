function el(document, tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text ?? "");
  if (className) node.className = className;
  return node;
}

function detail(document, label, value) {
  const item = el(document, "div", undefined, "preview-detail");
  item.append(el(document, "dt", label), el(document, "dd", value || "—"));
  return item;
}

export function createApplicationPreview(document, data, callbacks = {}) {
  const item = data.application;
  const dialog = el(document, "dialog", undefined, "preview-drawer");
  dialog.setAttribute("aria-labelledby", "preview-title");
  const header = el(document, "header", undefined, "preview-header");
  const identity = el(document, "div");
  identity.append(
    el(document, "span", "Application preview", "eyebrow"),
    el(document, "h2", `${item.company} · ${item.job_title}`),
  );
  identity.querySelector("h2").id = "preview-title";
  const close = el(document, "button", "×", "icon-button");
  close.type = "button";
  close.setAttribute("aria-label", "Close application preview");
  close.addEventListener("click", () => dialog.close());
  header.append(identity, close);
  const summary = el(document, "dl", undefined, "preview-summary");
  for (const [label, value] of [
    ["Stage", item.stage],
    ["Date applied", item.date_applied],
    ["Next action", item.next_action],
    ["Next action date", item.next_action_date],
    ["Resume version", item.linked_resume_version || item.resume_version],
    ["Location", item.location],
  ])
    summary.append(detail(document, label, value));
  const notes = el(document, "section", undefined, "preview-section");
  notes.append(
    el(document, "h3", "Notes"),
    el(document, "p", item.notes || "No notes yet."),
  );
  const activity = el(document, "section", undefined, "preview-section");
  activity.append(el(document, "h3", "Recent activity"));
  const list = el(document, "ol", undefined, "preview-activity");
  for (const event of (data.timeline || []).slice(0, 5)) {
    const entry = el(document, "li");
    entry.append(
      el(document, "strong", event.title || event.event_type || "Update"),
    );
    entry.append(
      el(document, "span", event.event_date || event.created_at || ""),
    );
    list.append(entry);
  }
  if (!list.children.length)
    list.append(el(document, "li", "No activity yet."));
  activity.append(list);
  const footer = el(document, "footer", undefined, "preview-actions");
  const open = el(document, "button", "Open full record", "btn");
  open.type = "button";
  open.addEventListener("click", () => callbacks.onOpen?.(item));
  const edit = el(document, "button", "Edit", "btn secondary");
  edit.type = "button";
  edit.addEventListener("click", () => callbacks.onEdit?.(item));
  footer.append(edit, open);
  dialog.append(header, summary, notes, activity, footer);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  return dialog;
}
