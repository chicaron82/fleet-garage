-- Seed batch 2 YWG fleet vehicles from lot walk (May 10, 2026)
-- 28 new vehicles — duplicates already in registry excluded
-- Uses WHERE NOT EXISTS — safe to re-run

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5429618','5429618','LUR488','Chevrolet','Trailblazer',2026,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5429618');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5424205','5424205','LUR171','Kia','Seltos',2025,'Orange','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5424205');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5424296','5424296','LUR180','Nissan','Kicks',2025,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5424296');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5424023','5424023','LUR154','Kia','Seltos',2025,'Orange','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5424023');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5420211','5420211','LFJ328','Nissan','Kicks',2025,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5420211');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5424726','5424726','LUR225','Volkswagen','Jetta',2025,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5424726');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5429063','5429063','LUR447','Chevrolet','Trax',2026,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5429063');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5760871','5760871','0FD601','Toyota','Corolla',2025,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5760871');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5421649','5421649','XT193P','Nissan','Rogue',2025,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5421649');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5334446','5334446','DFPL155','Volkswagen','Jetta',2025,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5334446');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5420138','5420138','LFJ311','Kia','Sportage',2025,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5420138');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5429816','5429816','LUR464','Volkswagen','Jetta',2026,'Silver','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5429816');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5426895','5426895','LUR382','Nissan','Sentra',2026,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5426895');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5421417','5421417','LUR112','Ford','Bronco Sport',2025,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5421417');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5426507','5426507','LUR389','Toyota','Corolla',2026,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5426507');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5424486','5424486','LUR200','Hyundai','Elantra',2025,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5424486');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5420617','5420617','LFJ372','Kia','Seltos',2025,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5420617');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5514039','5514039','SB085H','Tesla','Model 3 Long Range',2022,'Blue','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5514039');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5767546','5767546','0GK628','Toyota','Corolla',2026,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5767546');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5429576','5429576','LUR497','Nissan','Rogue',2026,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5429576');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5429147','5429147','LUR457','Chevrolet','Trax',2026,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5429147');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5752852','5752852','0ES727','Nissan','Versa',2025,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5752852');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5426473','5426473','LUR386','Toyota','Corolla',2026,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5426473');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5420989','5420989','LFJ301','Nissan','Altima',2025,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5420989');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5426408','5426408','LFJ279','Kia','Forte',2024,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5426408');

-- BC plate units — owning branch Vancouver, in YWG circulation, registration expires November
INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-3158854','3158854','WC617T','Kia','Sportage',2025,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '3158854');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-3154770','3154770','WF047P','Nissan','Kicks',2024,'Blue','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '3154770');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-3162039','3162039','XF541E','Nissan','Kicks',2025,'Blue','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '3162039');

-- Plate ↔ unit pairings
INSERT INTO vehicle_identifiers (plate, unit_number, confirmed, confirmed_at, confirmed_by) VALUES
  ('LUR488',  '5429618', TRUE, NOW(), 'seed'),
  ('LUR171',  '5424205', TRUE, NOW(), 'seed'),
  ('LUR180',  '5424296', TRUE, NOW(), 'seed'),
  ('LUR154',  '5424023', TRUE, NOW(), 'seed'),
  ('LFJ328',  '5420211', TRUE, NOW(), 'seed'),
  ('LUR225',  '5424726', TRUE, NOW(), 'seed'),
  ('LUR447',  '5429063', TRUE, NOW(), 'seed'),
  ('0FD601',  '5760871', TRUE, NOW(), 'seed'),
  ('XT193P',  '5421649', TRUE, NOW(), 'seed'),
  ('DFPL155', '5334446', TRUE, NOW(), 'seed'),
  ('LFJ311',  '5420138', TRUE, NOW(), 'seed'),
  ('LUR464',  '5429816', TRUE, NOW(), 'seed'),
  ('LUR382',  '5426895', TRUE, NOW(), 'seed'),
  ('LUR112',  '5421417', TRUE, NOW(), 'seed'),
  ('LUR389',  '5426507', TRUE, NOW(), 'seed'),
  ('LUR200',  '5424486', TRUE, NOW(), 'seed'),
  ('LFJ372',  '5420617', TRUE, NOW(), 'seed'),
  ('SB085H',  '5514039', TRUE, NOW(), 'seed'),
  ('0GK628',  '5767546', TRUE, NOW(), 'seed'),
  ('LUR497',  '5429576', TRUE, NOW(), 'seed'),
  ('LUR457',  '5429147', TRUE, NOW(), 'seed'),
  ('0ES727',  '5752852', TRUE, NOW(), 'seed'),
  ('LUR386',  '5426473', TRUE, NOW(), 'seed'),
  ('LFJ301',  '5420989', TRUE, NOW(), 'seed'),
  ('LFJ279',  '5426408', TRUE, NOW(), 'seed'),
  ('WC617T',  '3158854', TRUE, NOW(), 'seed'),
  ('WF047P',  '3154770', TRUE, NOW(), 'seed'),
  ('XF541E',  '3162039', TRUE, NOW(), 'seed')
ON CONFLICT (plate, unit_number) DO NOTHING;
