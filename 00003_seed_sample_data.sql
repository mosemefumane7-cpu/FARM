-- ============================================================
-- Realistic sample data for Batloung Farm
-- ============================================================

INSERT INTO public.suppliers (business_name, contact_person, phone, province, address) VALUES
  ('Gauteng Fresh Produce (Pty) Ltd', 'Thabo Mokoena',   '+27 11 442 8890', 'Gauteng',        '14 Market Street, City Deep, Johannesburg'),
  ('Free State Harvest Co-op',        'Anna van Wyk',    '+27 51 447 2210', 'Free State',     '22 Bloem Plaza, Bloemfontein'),
  ('KZN Tropical Traders',            'Sipho Ndlovu',    '+27 31 305 7741', 'KwaZulu-Natal',  '8 Victoria Embankment, Durban'),
  ('Cape Orchard Suppliers',          'Pieter de Klerk', '+27 21 461 3320', 'Western Cape',   '45 Long Street, Cape Town'),
  ('Eastern Cape Citrus Growers',     'Nomsa Mbeki',     '+27 41 582 1190', 'Eastern Cape',   '3 Govan Mbeki Avenue, Port Elizabeth'),
  ('Limpopo Valley Farms',            'Johannes Sithole','+27 15 291 6640', 'Limpopo',        '17 Landdros Mare Street, Polokwane'),
  ('Mpumalanga Fruit Link',           'Lerato Dlamini',  '+27 13 752 4408', 'Mpumalanga',     '9 Samora Machel Drive, Nelspruit'),
  ('North West Agri Supply',          'Kagiso Molefe',   '+27 18 381 2277', 'North West',     '26 Oliver Tambo Way, Rustenburg');

INSERT INTO public.fruits (fruit_name, description, status) VALUES
  ('Apples',  'Crisp red apples sourced from Western Cape orchards.',            'ACTIVE'),
  ('Bananas', 'Ripening bananas from Limpopo and Mpumalanga plantations.',       'ACTIVE'),
  ('Oranges', 'Juicy citrus oranges from Eastern Cape groves.',                  'ACTIVE'),
  ('Mangoes', 'Sweet seasonal mangoes from the Limpopo Valley.',                 'ACTIVE'),
  ('Grapes',  'Seedless table grapes from Western Cape vineyards.',              'ACTIVE');

INSERT INTO public.vendors (vendor_name, phone, location, registration_date) VALUES
  ('Mamello Fruit Stall',      '+266 5812 4471', 'Maseru Market, Maseru',         '2025-01-14'),
  ('Thabo Street Fruits',      '+266 6290 1183', 'Teyateyaneng, Berea',           '2025-02-03'),
  ('Lerato Produce Corner',    '+266 5877 6620', 'Mafeteng Town Centre, Mafeteng','2025-02-19'),
  ('Hlotse Fresh Cart',        '+266 6304 2298', 'Hlotse, Leribe',                '2025-03-08'),
  ('Mohale''s Hoek Fruit Hub', '+266 5791 3345', 'Mohale''s Hoek',                '2025-04-02'),
  ('Maputsoe Vendors Union',   '+266 6218 7706', 'Maputsoe, Leribe',              '2025-05-21'),
  ('Quthing Roadside Fruits',  '+266 5844 9902', 'Quthing',                       '2025-06-11'),
  ('Butha-Buthe Market Stall', '+266 6355 4417', 'Butha-Buthe',                   '2025-07-30');

-- Selling price per fruit and packaging size (each size differs)
INSERT INTO public.fruit_prices (fruit_id, packaging_size, selling_price) VALUES
  (1,'SMALL',32.00),(1,'MEDIUM',58.00),(1,'LARGE',92.00),
  (2,'SMALL',26.00),(2,'MEDIUM',48.00),(2,'LARGE',78.00),
  (3,'SMALL',29.00),(3,'MEDIUM',54.00),(3,'LARGE',86.00),
  (4,'SMALL',38.00),(4,'MEDIUM',68.00),(4,'LARGE',108.00),
  (5,'SMALL',45.00),(5,'MEDIUM',82.00),(5,'LARGE',132.00);

-- Opening stock balances: one row per fruit x packaging size
INSERT INTO public.stock (fruit_id, packaging_size, available_quantity, low_stock_threshold) VALUES
  (1,'SMALL',40,20),(1,'MEDIUM',25,20),(1,'LARGE',6,20),
  (2,'SMALL',60,20),(2,'MEDIUM',45,20),(2,'LARGE',30,20),
  (3,'SMALL',35,20),(3,'MEDIUM',18,20),(3,'LARGE',22,20),
  (4,'SMALL',12,20),(4,'MEDIUM',30,20),(4,'LARGE',15,20),
  (5,'SMALL',20,20),(5,'MEDIUM',9,20),(5,'LARGE',25,20);

-- Purchases (each call is one atomic transaction that also raises stock)
SELECT public.record_purchase(1, '2026-09-05', '[
  {"fruit_id":1,"packaging_size":"LARGE","quantity":10,"unit_cost":62.00},
  {"fruit_id":2,"packaging_size":"MEDIUM","quantity":50,"unit_cost":33.00}
]'::jsonb);

SELECT public.record_purchase(4, '2026-09-18', '[
  {"fruit_id":5,"packaging_size":"LARGE","quantity":30,"unit_cost":88.00},
  {"fruit_id":1,"packaging_size":"MEDIUM","quantity":60,"unit_cost":38.00},
  {"fruit_id":3,"packaging_size":"SMALL","quantity":40,"unit_cost":19.00}
]'::jsonb);

SELECT public.record_purchase(6, '2026-10-02', '[
  {"fruit_id":2,"packaging_size":"LARGE","quantity":45,"unit_cost":52.00},
  {"fruit_id":4,"packaging_size":"MEDIUM","quantity":35,"unit_cost":44.00}
]'::jsonb);

SELECT public.record_purchase(5, '2026-10-16', '[
  {"fruit_id":3,"packaging_size":"LARGE","quantity":50,"unit_cost":55.00},
  {"fruit_id":3,"packaging_size":"MEDIUM","quantity":10,"unit_cost":34.00}
]'::jsonb);

SELECT public.record_purchase(3, '2026-10-29', '[
  {"fruit_id":2,"packaging_size":"SMALL","quantity":70,"unit_cost":16.00},
  {"fruit_id":4,"packaging_size":"LARGE","quantity":25,"unit_cost":70.00},
  {"fruit_id":5,"packaging_size":"SMALL","quantity":35,"unit_cost":28.00}
]'::jsonb);

-- Sales (each call validates stock atomically and reduces it)
SELECT public.record_sale(1, '2026-09-12', '[
  {"fruit_id":1,"packaging_size":"LARGE","quantity":4,"unit_price":92.00},
  {"fruit_id":2,"packaging_size":"MEDIUM","quantity":10,"unit_price":48.00}
]'::jsonb, 'CASH');

SELECT public.record_sale(2, '2026-09-20', '[
  {"fruit_id":5,"packaging_size":"LARGE","quantity":6,"unit_price":132.00},
  {"fruit_id":1,"packaging_size":"MEDIUM","quantity":12,"unit_price":58.00}
]'::jsonb, 'CREDIT');

SELECT public.record_sale(3, '2026-09-27', '[
  {"fruit_id":3,"packaging_size":"SMALL","quantity":15,"unit_price":29.00},
  {"fruit_id":2,"packaging_size":"LARGE","quantity":8,"unit_price":78.00}
]'::jsonb, 'MOBILE_MONEY');

SELECT public.record_sale(1, '2026-10-05', '[
  {"fruit_id":4,"packaging_size":"MEDIUM","quantity":10,"unit_price":68.00},
  {"fruit_id":5,"packaging_size":"MEDIUM","quantity":5,"unit_price":82.00}
]'::jsonb, 'CREDIT');

SELECT public.record_sale(4, '2026-10-12', '[
  {"fruit_id":1,"packaging_size":"MEDIUM","quantity":20,"unit_price":58.00},
  {"fruit_id":3,"packaging_size":"LARGE","quantity":12,"unit_price":86.00}
]'::jsonb, 'CASH');

SELECT public.record_sale(5, '2026-10-21', '[
  {"fruit_id":2,"packaging_size":"SMALL","quantity":25,"unit_price":26.00},
  {"fruit_id":4,"packaging_size":"LARGE","quantity":6,"unit_price":108.00},
  {"fruit_id":1,"packaging_size":"SMALL","quantity":10,"unit_price":32.00}
]'::jsonb, 'CREDIT');

SELECT public.record_sale(2, '2026-11-02', '[
  {"fruit_id":5,"packaging_size":"LARGE","quantity":8,"unit_price":132.00},
  {"fruit_id":3,"packaging_size":"MEDIUM","quantity":10,"unit_price":54.00}
]'::jsonb, 'MOBILE_MONEY');

SELECT public.record_sale(6, '2026-11-10', '[
  {"fruit_id":1,"packaging_size":"LARGE","quantity":2,"unit_price":92.00},
  {"fruit_id":2,"packaging_size":"MEDIUM","quantity":15,"unit_price":48.00},
  {"fruit_id":5,"packaging_size":"SMALL","quantity":12,"unit_price":45.00}
]'::jsonb, 'CREDIT');

-- Part payments against credit sales (sale 2, 4, 6, 8 are credit)
SELECT public.record_payment(2, 800.00, 'CASH',         '2026-09-25');
SELECT public.record_payment(6, 600.00, 'MOBILE_MONEY', '2026-10-28');