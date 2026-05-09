-- Seed real YWG fleet vehicles from lot walk (May 8, 2026)
-- All vehicles in YWG circulation regardless of owning branch
-- Uses WHERE NOT EXISTS — safe to re-run

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5514229','5514229','LJF674','Tesla','Model 3 Long Range',2022,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5514229');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-3163318','3163318','XF217E','Kia','Seltos',2025,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '3163318');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5420971','5420971','LFJ304','Hyundai','Elantra',2025,'Blue','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5420971');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5422118','5422118','LUR266','Toyota','Camry Hybrid',2025,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5422118');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5421656','5421656','LUR143','Nissan','Kicks',2025,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5421656');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5332879','5332879','DFDA732','Nissan','Versa',2025,'Blue','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5332879');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5420690','5420690','LFJ351','Kia','Seltos',2025,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5420690');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5422712','5422712','LUR316','Toyota','Corolla',2026,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5422712');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5424452','5424452','LUR193','Hyundai','Elantra',2025,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5424452');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5421664','5421664','LUR148','Mazda','CX-5',2025,'Blue','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5421664');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5420401','5420401','LFJ370','Kia','Seltos',2025,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5420401');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5424395','5424395','LUR191','Volkswagen','Jetta',2025,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5424395');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5777685','5777685','0ET191','Volkswagen','Jetta',2025,'Silver','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5777685');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5421748','5421748','LUR126','Ford','Explorer',2026,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5421748');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5421615','5421615','LUR142','Kia','Seltos',2025,'Blue','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5421615');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5732904','5732904','0DE193','Hyundai','Elantra',2025,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5732904');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5422100','5422100','LUR265','Toyota','Corolla Hybrid',2025,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5422100');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5429139','5429139','LUR458','Chevrolet','Trax',2026,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5429139');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5424924','5424924','LUR245','Kia','Seltos',2025,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5424924');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5420393','5420393','LFJ371','Nissan','Rogue',2025,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5420393');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5429022','5429022','LUR430','Volvo','XC90',2026,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5429022');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5422951','5422951','LUR276','Nissan','Versa',2025,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5422951');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5426440','5426440','LUR378','Toyota','Corolla',2026,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5426440');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-3161031','3161031','XE894V','Toyota','Corolla Hatchback',2025,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '3161031');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5424510','5424510','LUR204','Ford','Escape',2025,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5424510');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5424148','5424148','LUR165','Kia','Seltos',2025,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5424148');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5422472','5422472','LUR358','Kia','Kicks',2026,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5422472');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5426838','5426838','LUR429','Ford','Explorer',2026,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5426838');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5276233','5276233','DEEL822','Hyundai','Venue',2025,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5276233');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5753827','5753827','0ES679','Toyota','Corolla Hybrid',2025,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5753827');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-2148476','2148476','261PDU','Toyota','Corolla Hybrid',2026,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '2148476');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5420229','5420229','LFJ331','Nissan','Sentra',2025,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5420229');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5422928','5422928','LUR278','Volkswagen','Jetta',2025,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5422928');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5429964','5429964','LUR444','Chevrolet','Trailblazer',2026,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5429964');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5429766','5429766','LUR474','Hyundai','Venue',2026,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5429766');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5426879','5426879','LUR395','Kia','Seltos',2026,'Black','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5426879');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5420757','5420757','LFJ346','Hyundai','Venue',2025,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5420757');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5420922','5420922','LFJ306','Kia','Seltos',2025,'Plum','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5420922');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5420310','5420310','LFJ354','Kia','Seltos',2025,'White','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5420310');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5429733','5429733','LUR471','Toyota','Corolla',2026,'Blue','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5429733');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5426861','5426861','LUR396','Toyota','Corolla',2026,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5426861');

INSERT INTO vehicles (id, unit_number, license_plate, make, model, year, color, status, branch_id)
SELECT 'unit-5759733','5759733','0FB042','Toyota','Corolla Hybrid',2025,'Gray','CLEAR','YWG'
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE unit_number = '5759733');

-- Pre-confirmed plate ↔ unit pairings (Aaron personally verified on lot walk, May 8 2026)
INSERT INTO vehicle_identifiers (plate, unit_number, confirmed, confirmed_at, confirmed_by) VALUES
  ('LJF674',  '5514229', TRUE, NOW(), 'seed'),
  ('XF217E',  '3163318', TRUE, NOW(), 'seed'),
  ('LFJ304',  '5420971', TRUE, NOW(), 'seed'),
  ('LUR266',  '5422118', TRUE, NOW(), 'seed'),
  ('LUR143',  '5421656', TRUE, NOW(), 'seed'),
  ('DFDA732', '5332879', TRUE, NOW(), 'seed'),
  ('LFJ351',  '5420690', TRUE, NOW(), 'seed'),
  ('LUR316',  '5422712', TRUE, NOW(), 'seed'),
  ('LUR193',  '5424452', TRUE, NOW(), 'seed'),
  ('LUR148',  '5421664', TRUE, NOW(), 'seed'),
  ('LFJ370',  '5420401', TRUE, NOW(), 'seed'),
  ('LUR191',  '5424395', TRUE, NOW(), 'seed'),
  ('0ET191',  '5777685', TRUE, NOW(), 'seed'),
  ('LUR126',  '5421748', TRUE, NOW(), 'seed'),
  ('LUR142',  '5421615', TRUE, NOW(), 'seed'),
  ('0DE193',  '5732904', TRUE, NOW(), 'seed'),
  ('LUR265',  '5422100', TRUE, NOW(), 'seed'),
  ('LUR458',  '5429139', TRUE, NOW(), 'seed'),
  ('LUR245',  '5424924', TRUE, NOW(), 'seed'),
  ('LFJ371',  '5420393', TRUE, NOW(), 'seed'),
  ('LUR430',  '5429022', TRUE, NOW(), 'seed'),
  ('LUR276',  '5422951', TRUE, NOW(), 'seed'),
  ('LUR378',  '5426440', TRUE, NOW(), 'seed'),
  ('XE894V',  '3161031', TRUE, NOW(), 'seed'),
  ('LUR204',  '5424510', TRUE, NOW(), 'seed'),
  ('LUR165',  '5424148', TRUE, NOW(), 'seed'),
  ('LUR358',  '5422472', TRUE, NOW(), 'seed'),
  ('LUR429',  '5426838', TRUE, NOW(), 'seed'),
  ('DEEL822', '5276233', TRUE, NOW(), 'seed'),
  ('0ES679',  '5753827', TRUE, NOW(), 'seed'),
  ('261PDU',  '2148476', TRUE, NOW(), 'seed'),
  ('LFJ331',  '5420229', TRUE, NOW(), 'seed'),
  ('LUR278',  '5422928', TRUE, NOW(), 'seed'),
  ('LUR444',  '5429964', TRUE, NOW(), 'seed'),
  ('LUR474',  '5429766', TRUE, NOW(), 'seed'),
  ('LUR395',  '5426879', TRUE, NOW(), 'seed'),
  ('LFJ346',  '5420757', TRUE, NOW(), 'seed'),
  ('LFJ306',  '5420922', TRUE, NOW(), 'seed'),
  ('LFJ354',  '5420310', TRUE, NOW(), 'seed'),
  ('LUR471',  '5429733', TRUE, NOW(), 'seed'),
  ('LUR396',  '5426861', TRUE, NOW(), 'seed'),
  ('0FB042',  '5759733', TRUE, NOW(), 'seed')
ON CONFLICT (plate, unit_number) DO NOTHING;
