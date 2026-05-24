-- Migration 061: Re-key mock user IDs → real Supabase auth UUIDs
--
-- All 17 USERS mock entries (u1–u17) have real Supabase auth accounts.
-- This migrates any rows written with mock IDs to use the real profile UUIDs,
-- eliminating the duplicate entries caused by useTeamMembers merging both sources.
--
-- Run the PREVIEW block first to see row counts, then run the MIGRATION block.
-- Safe to run multiple times — UPDATE WHERE only touches rows that still match.
--
-- After running: remove USERS from useUserResolver + useTeamMembers in code.

-- ── STEP 1: PREVIEW (run this first, no changes made) ────────────────────────
-- Shows how many rows in each table still reference mock IDs.
-- Rows with 0 are already clean; any non-zero rows will be re-keyed.

WITH id_map (mock_id, real_id, name) AS (VALUES
  ('u1',  '9f560505-ea86-4dcf-81d6-a9d960c9eae8', 'Aaron S.'),
  ('u2',  'd5316662-3855-4d53-9dca-4c2ad1096569', 'DiZee'),
  ('u3',  '8fa5ae06-8df4-4117-9c99-e14f7954a7c1', 'Belle'),
  ('u4',  '16100fcd-b6a8-4208-b052-6043cb6d7d54', 'CoZee'),
  ('u5',  '5e68c1e3-d933-42ca-848b-fba70bd370c6', 'Tori'),
  ('u6',  'cad144fd-d2de-481d-b876-d9c8e58b226b', 'ZeeRah'),
  ('u7',  'd5c0fa78-fd94-41c9-bfae-8762f699e3c8', 'Zee'),
  ('u8',  'e0df695e-9e39-4bec-aeca-79565792539d', 'GenZee'),
  ('u9',  'f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5', 'ZeeDric'),
  ('u10', 'd02817ce-a870-4234-a2d3-2d034ba6480e', 'PerplexiZee'),
  ('u11', '70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef', 'Geoff N.'),
  ('u12', '3b2a8659-4546-4231-9085-6d92e28a1133', 'Ray T.'),
  ('u13', 'e39ea2d1-76d8-4348-bf71-598700128782', 'Big Boss'),
  ('u14', '204b9e39-345c-41bc-b408-40a2504da618', 'Marcus L.'),
  ('u15', '5d227b68-8af2-4259-ba15-82a999656156', 'Linh T.'),
  ('u16', 'e8550917-df55-4917-b77d-575213c8833f', 'Harpreet T.'),
  ('u17', '2440ff1f-7c36-4c30-9b7f-8b63be16f45e', 'Howard W.')
)
SELECT tbl, mock_id, name, affected_rows FROM (
  SELECT 'shifts'               AS tbl, m.mock_id, m.name, COUNT(*)::int AS affected_rows FROM shifts               s JOIN id_map m ON s.user_id          = m.mock_id GROUP BY m.mock_id, m.name
  UNION ALL
  SELECT 'off_standard_entries',        m.mock_id, m.name, COUNT(*)      FROM off_standard_entries o JOIN id_map m ON o.user_id          = m.mock_id GROUP BY m.mock_id, m.name
  UNION ALL
  SELECT 'holds (flagged_by_id)',        m.mock_id, m.name, COUNT(*)      FROM holds                 h JOIN id_map m ON h.flagged_by_id    = m.mock_id GROUP BY m.mock_id, m.name
  UNION ALL
  SELECT 'releases (approved_by_id)',    m.mock_id, m.name, COUNT(*)      FROM releases              r JOIN id_map m ON r.approved_by_id   = m.mock_id GROUP BY m.mock_id, m.name
  UNION ALL
  SELECT 'vsa_trips (driver_id)',        m.mock_id, m.name, COUNT(*)      FROM vsa_trips             t JOIN id_map m ON t.driver_id        = m.mock_id GROUP BY m.mock_id, m.name
  UNION ALL
  SELECT 'vehicle_checkins',             m.mock_id, m.name, COUNT(*)      FROM vehicle_checkins      c JOIN id_map m ON c.checked_in_by_id = m.mock_id GROUP BY m.mock_id, m.name
  UNION ALL
  SELECT 'lost_found (found_by)',         m.mock_id, m.name, COUNT(*)      FROM lost_found            l JOIN id_map m ON l.found_by         = m.mock_id GROUP BY m.mock_id, m.name
  UNION ALL
  SELECT 'audits (auditor_id)',           m.mock_id, m.name, COUNT(*)      FROM audits                a JOIN id_map m ON a.auditor_id       = m.mock_id GROUP BY m.mock_id, m.name
  UNION ALL
  SELECT 'facility_issues',              m.mock_id, m.name, COUNT(*)      FROM facility_issues       f JOIN id_map m ON f.reported_by      = m.mock_id GROUP BY m.mock_id, m.name
  UNION ALL
  SELECT 'fleet_balance (entered_by)',   m.mock_id, m.name, COUNT(*)      FROM fleet_balance         b JOIN id_map m ON b.entered_by       = m.mock_id GROUP BY m.mock_id, m.name
  UNION ALL
  SELECT 'shift_summaries',             m.mock_id, m.name, COUNT(*)      FROM shift_summaries       s JOIN id_map m ON s.user_id          = m.mock_id GROUP BY m.mock_id, m.name
  UNION ALL
  SELECT 'shift_checkpoints',           m.mock_id, m.name, COUNT(*)      FROM shift_checkpoints     s JOIN id_map m ON s.user_id          = m.mock_id GROUP BY m.mock_id, m.name
  UNION ALL
  SELECT 'notifications (recipient)',    m.mock_id, m.name, COUNT(*)      FROM notifications         n JOIN id_map m ON n.recipient_user_id = m.mock_id GROUP BY m.mock_id, m.name
  UNION ALL
  SELECT 'user_pto',                    m.mock_id, m.name, COUNT(*)      FROM user_pto              p JOIN id_map m ON p.user_id          = m.mock_id GROUP BY m.mock_id, m.name
) t
WHERE affected_rows > 0
ORDER BY tbl, mock_id;


-- ── STEP 2: MIGRATION (run after reviewing the preview above) ─────────────────
-- Wrapped in a transaction — rolls back entirely if anything fails.

BEGIN;

  -- Standard re-key: UPDATE ... FROM mapping
  UPDATE shifts               SET user_id          = m.real_id FROM (VALUES ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')) AS m(mock_id, real_id) WHERE user_id = m.mock_id;

  UPDATE off_standard_entries SET user_id          = m.real_id FROM (VALUES ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')) AS m(mock_id, real_id) WHERE user_id = m.mock_id;

  UPDATE holds                SET flagged_by_id    = m.real_id FROM (VALUES ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')) AS m(mock_id, real_id) WHERE flagged_by_id = m.mock_id;

  UPDATE releases             SET approved_by_id   = m.real_id FROM (VALUES ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')) AS m(mock_id, real_id) WHERE approved_by_id = m.mock_id;

  UPDATE vsa_trips            SET driver_id        = m.real_id FROM (VALUES ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')) AS m(mock_id, real_id) WHERE driver_id = m.mock_id;

  UPDATE vehicle_checkins     SET checked_in_by_id = m.real_id FROM (VALUES ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')) AS m(mock_id, real_id) WHERE checked_in_by_id = m.mock_id;

  UPDATE lost_found           SET found_by         = m.real_id FROM (VALUES ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')) AS m(mock_id, real_id) WHERE found_by = m.mock_id;

  UPDATE audits               SET auditor_id       = m.real_id FROM (VALUES ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')) AS m(mock_id, real_id) WHERE auditor_id = m.mock_id;

  UPDATE facility_issues      SET reported_by      = m.real_id FROM (VALUES ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')) AS m(mock_id, real_id) WHERE reported_by = m.mock_id;

  UPDATE fleet_balance        SET entered_by       = m.real_id FROM (VALUES ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')) AS m(mock_id, real_id) WHERE entered_by = m.mock_id;

  UPDATE shift_summaries      SET user_id          = m.real_id FROM (VALUES ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')) AS m(mock_id, real_id) WHERE user_id = m.mock_id;

  UPDATE shift_checkpoints    SET user_id          = m.real_id FROM (VALUES ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')) AS m(mock_id, real_id) WHERE user_id = m.mock_id;

  UPDATE notifications        SET recipient_user_id = m.real_id FROM (VALUES ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')) AS m(mock_id, real_id) WHERE recipient_user_id = m.mock_id;

  -- user_pto has user_id as PRIMARY KEY — insert new row then delete old
  -- ON CONFLICT DO NOTHING: if real UUID already has a pto row, keep it, drop the mock row
  INSERT INTO user_pto (user_id, pto_entitlement, updated_at)
  SELECT m.real_id, p.pto_entitlement, p.updated_at
  FROM user_pto p
  JOIN (VALUES
    ('u1','9f560505-ea86-4dcf-81d6-a9d960c9eae8'),('u2','d5316662-3855-4d53-9dca-4c2ad1096569'),
    ('u3','8fa5ae06-8df4-4117-9c99-e14f7954a7c1'),('u4','16100fcd-b6a8-4208-b052-6043cb6d7d54'),
    ('u5','5e68c1e3-d933-42ca-848b-fba70bd370c6'),('u6','cad144fd-d2de-481d-b876-d9c8e58b226b'),
    ('u7','d5c0fa78-fd94-41c9-bfae-8762f699e3c8'),('u8','e0df695e-9e39-4bec-aeca-79565792539d'),
    ('u9','f5c12ccb-f5fc-4a0d-a5c0-e87fcf8479e5'),('u10','d02817ce-a870-4234-a2d3-2d034ba6480e'),
    ('u11','70b481c2-9492-4e2f-84ee-7cfc5bd7e7ef'),('u12','3b2a8659-4546-4231-9085-6d92e28a1133'),
    ('u13','e39ea2d1-76d8-4348-bf71-598700128782'),('u14','204b9e39-345c-41bc-b408-40a2504da618'),
    ('u15','5d227b68-8af2-4259-ba15-82a999656156'),('u16','e8550917-df55-4917-b77d-575213c8833f'),
    ('u17','2440ff1f-7c36-4c30-9b7f-8b63be16f45e')
  ) AS m(mock_id, real_id) ON p.user_id = m.mock_id
  ON CONFLICT (user_id) DO NOTHING;

  DELETE FROM user_pto
  WHERE user_id IN ('u1','u2','u3','u4','u5','u6','u7','u8','u9','u10','u11','u12','u13','u14','u15','u16','u17');

COMMIT;
