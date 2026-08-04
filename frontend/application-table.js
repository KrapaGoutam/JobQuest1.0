const dash = "\u2014";

function element(document, tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  return node;
}

function button(document, text, className, attributes = {}) {
  const node = element(document, "button", { className, text });
  node.type = "button";
  for (const [name, value] of Object.entries(attributes))
    node.setAttribute(name, String(value));
  return node;
}

export const APPLICATION_COLUMNS = [
  { key: "selection", label: "Select" },
  { key: "date_applied", label: "Applied", sortable: true, filterable: true },
  { key: "company", label: "Company", sortable: true, filterable: true },
  { key: "job_title", label: "Job Title", sortable: true, filterable: true },
  { key: "location", label: "Location" },
  { key: "work_arrangement", label: "Arrangement", filterable: true },
  { key: "stage", label: "Stage", sortable: true, filterable: true },
  { key: "priority", label: "Priority", sortable: true, filterable: true },
  { key: "source", label: "Source" },
  {
    key: "resume_version",
    label: "Resume Version",
    sortable: true,
    filterable: true,
  },
  { key: "next_action", label: "Next Action" },
  { key: "next_action_date", label: "Due", sortable: true, filterable: true },
  { key: "updated_at", label: "Updated", sortable: true, filterable: true },
  { key: "actions", label: "Actions" },
];

function appendCell(document, row, item, column, callbacks) {
  const cell = element(document, "td");
  if (column.key === "selection") {
    const input = element(document, "input");
    input.type = "checkbox";
    input.checked = callbacks.selected?.has(item.id) || false;
    input.setAttribute(
      "aria-label",
      `Select ${item.company} ${item.job_title}`,
    );
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () =>
      callbacks.onSelect?.(item, input.checked),
    );
    cell.append(input);
  } else if (column.key === "company") {
    cell.append(element(document, "strong", { text: item.company }));
  } else if (column.key === "stage") {
    const stage = element(document, "span", {
      className: "badge stage-badge",
      text: item.stage,
    });
    stage.dataset.stage = item.stage || "";
    cell.append(stage);
  } else if (column.key === "resume_version") {
    if (item.resume_id) {
      const resume = button(
        document,
        item.linked_resume_version || "Linked resume",
        "link-button",
      );
      resume.addEventListener("click", (event) => {
        event.stopPropagation();
        callbacks.onResume?.(item);
      });
      cell.append(resume);
    } else cell.textContent = "No resume linked";
  } else if (column.key === "actions") {
    const preview = button(document, "Preview", "btn small secondary");
    preview.setAttribute(
      "aria-label",
      `Quick preview ${item.company} ${item.job_title}`,
    );
    preview.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onPreview?.(item);
    });
    const move = button(document, "Move", "btn small secondary");
    move.dataset.move = String(item.id);
    move.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onMove?.(item);
    });
    const actions = element(document, "div", { className: "actions" });
    actions.append(preview, move);
    cell.append(actions);
  } else cell.textContent = String(item[column.key] || dash);
  row.append(cell);
}

export function createApplicationTable(document, options = {}) {
  const {
    items = [],
    sort = "updated_at",
    direction = "desc",
    onSort,
    onFilter,
    onOpen,
    onMove,
    onResume,
    onPreview,
    selected = new Set(),
    onSelect,
    onSelectAll,
  } = options;
  const wrapper = element(document, "div", { className: "table-wrap" });
  const table = element(document, "table", { className: "applications-table" });
  const head = element(document, "thead");
  const headRow = element(document, "tr");
  for (const column of APPLICATION_COLUMNS) {
    const cell = element(document, "th");
    cell.scope = "col";
    const group = element(document, "div", { className: "column-heading" });
    if (column.key === "selection") {
      const selectAll = element(document, "input");
      selectAll.type = "checkbox";
      selectAll.checked =
        items.length > 0 && items.every((item) => selected.has(item.id));
      selectAll.indeterminate =
        items.some((item) => selected.has(item.id)) && !selectAll.checked;
      selectAll.setAttribute("aria-label", "Select all visible applications");
      selectAll.addEventListener("change", () =>
        onSelectAll?.(items, selectAll.checked),
      );
      group.append(selectAll);
    } else if (column.sortable) {
      const active = sort === column.key;
      cell.setAttribute(
        "aria-sort",
        active ? (direction === "asc" ? "ascending" : "descending") : "none",
      );
      const sortButton = button(document, column.label, "column-sort", {
        "aria-label": `Sort by ${column.label}`,
        "aria-pressed": active,
      });
      if (active)
        sortButton.append(
          element(document, "span", {
            className: "sort-direction",
            text: direction === "asc" ? " \u2191" : " \u2193",
          }),
        );
      sortButton.addEventListener("click", () =>
        onSort?.(column.key, active && direction === "asc" ? "desc" : "asc"),
      );
      group.append(sortButton);
    } else group.append(element(document, "span", { text: column.label }));
    if (column.filterable) {
      const filter = button(document, "Filter", "column-filter", {
        "aria-label": `Filter ${column.label}`,
      });
      filter.dataset.columnFilter = column.key;
      filter.addEventListener("click", () =>
        onFilter?.(column.key, column.label),
      );
      group.append(filter);
    }
    cell.append(group);
    headRow.append(cell);
  }
  head.append(headRow);
  const body = element(document, "tbody");
  if (!items.length) {
    const row = element(document, "tr");
    const cell = element(document, "td");
    cell.colSpan = APPLICATION_COLUMNS.length;
    cell.append(
      element(document, "div", {
        className: "empty",
        text: "No applications match these filters",
      }),
    );
    row.append(cell);
    body.append(row);
  } else {
    for (const item of items) {
      const row = element(document, "tr", { className: "clickable-row" });
      row.tabIndex = 0;
      row.dataset.open = String(item.id);
      row.addEventListener("click", () => onOpen?.(item));
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.(item);
        }
      });
      for (const column of APPLICATION_COLUMNS)
        appendCell(document, row, item, column, {
          onMove,
          onResume,
          onPreview,
          selected,
          onSelect,
        });
      body.append(row);
    }
  }
  table.append(head, body);
  wrapper.append(table);
  return wrapper;
}
