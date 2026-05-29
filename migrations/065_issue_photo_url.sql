-- Add photo_url column to facility_issues
alter table facility_issues
  add column if not exists photo_url text;
