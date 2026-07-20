-- ACD-49 (D2) — Add storage bucket constraints (size + MIME) to `assessment-documents`.
-- Bucket is private (set in baseline) but had no file_size_limit / allowed_mime_types.
-- Limit uploads to 25 MB and to the only two document types the app produces/needs: docx + pdf.

UPDATE storage.buckets
SET
    file_size_limit    = 26214400, -- 25 MB (25 * 1024 * 1024)
    allowed_mime_types = ARRAY[
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/pdf'
    ]
WHERE id = 'assessment-documents';
