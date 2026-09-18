-- Final round performance pass: import_rows had no index at all since it was
-- introduced in migration 001, noted as Known Debt in Round 6
-- ("fine at current scale, worth adding if import volume ever grows") and
-- revisited here. GET /api/import/history/:id/rows (advanced.js) queries
-- "WHERE batch_id=? ORDER BY row_number" - a composite index covers both the
-- filter and the sort in one pass.
CREATE INDEX idx_import_rows_batch_row ON import_rows(batch_id, row_number);
