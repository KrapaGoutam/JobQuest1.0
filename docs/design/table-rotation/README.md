# Table Allocation Rotation — Approved Design Reference

Status: APPROVED FOR IMPLEMENTATION

This directory contains the approved UX/UI reference for the
The Lineup Table Allocation Rotation multi-view upgrade.

## Primary visual reference

`approved-design-export/Table Rotation Multi-View Standalone.html`

Treat this as the primary interactive design reference unless inspection
shows another exported file contains a newer approved version.

## Supporting Claude Design export

The entire Claude Design export is preserved under:

`approved-design-export/`

It is reference material only.

Do not copy prototype code directly into production without first mapping it
to the existing The Lineup architecture and component/design system.

## Physical restaurant floor layout

Canonical spatial floor reference:

`reference/floor-layout-reference.png`

The physical layout contains:

- T1–T5: left wall
- T6–T8: lower center booth area
- T9–T14: middle two-top row
- T15–T19: upper booth row
- B1–B8: bar seats

The image defines physical positioning.

The existing The Lineup design tokens define application colors/styling.

## Approved views

1. Grid
2. Floor
3. Picker
4. Servers
5. Dashboard

All five views represent one shared table-rotation state.

## Important approved interactions

- Quick Add Staff available to Staff, Assistant Manager, Manager and Owner
- Clocked-in team members prioritized in Quick Add
- Server reorder
- Pause / Resume
- Clear assignment
- Clear row
- Delete row
- Clear server column
- Remove server from active rotation
- Undo / Redo
- Clear board
- Manual Add Row
- Automatic row growth
- Floor-map table assignment
- Server View `+ Table`
- Dashboard read-only Master Rotation board
- Light and dark themes

## Auto-row rule

Grid and Picker should maintain approximately two empty trailing rows.

When any cell in either:

- the last row
- the second-to-last row

receives an assignment, automatically append enough rows to restore
approximately two empty rows at the bottom.

Manual Add Row remains available.

## Implementation rule

Claude Code must first inspect the existing production architecture.

Priority:

1. Existing production security/data architecture
2. Approved functional requirements
3. Approved design reference
4. Claude Design prototype code

Prototype code must never override correct authentication, RLS,
Supabase architecture, permissions, or existing application conventions.