// Round 5: pure helpers for the networking-contacts UI, shared between the
// standalone Networking tracker page and the application-detail contacts
// summary.

const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

// A normalized, safe href for a user-supplied URL (LinkedIn/profile links are
// free text in the database), or null if it's empty, unparsable, or uses a
// protocol other than http(s) - e.g. `javascript:`. Callers render `null` as
// plain text instead of a link.
export function safeExternalUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

// A compact, human label for a contact - "Jane Doe — Recruiter at Acme" -
// degrading gracefully as relationship_type/company are missing.
export function contactLabel(contact) {
  const role = [contact.relationship_type, contact.company]
    .filter(Boolean)
    .join(" at ");
  return role ? `${contact.contact_name} — ${role}` : contact.contact_name;
}

// True when a next-follow-up date has passed. Plain YYYY-MM-DD string
// comparison, matching how the rest of the app treats these dates (local
// calendar days, not timestamps) - see ui-utils.js's kanbanGroupKey.
export function isFollowUpOverdue(nextFollowUpDate, today = new Date()) {
  if (!nextFollowUpDate) return false;
  const pad = (value) => String(value).padStart(2, "0");
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return String(nextFollowUpDate).slice(0, 10) < todayIso;
}
