-- Preserve the display name of any legacy linked resume in the application's
-- optional manual text field. The legacy relationship and resume records stay
-- intact for historical reporting.
UPDATE applications
SET resume_version = (
  SELECT version_name
  FROM resumes
  WHERE resumes.id = applications.resume_id
)
WHERE resume_id IS NOT NULL
  AND (resume_version IS NULL OR trim(resume_version) = '')
  AND EXISTS (
    SELECT 1
    FROM resumes
    WHERE resumes.id = applications.resume_id
  );
