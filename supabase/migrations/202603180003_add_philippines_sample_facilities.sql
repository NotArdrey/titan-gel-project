insert into hospital.provinces (name)
values
  ('Bulacan'),
  ('Cebu'),
  ('Iloilo')
on conflict (name) do nothing;

insert into hospital.cities (province_id, name)
select p.id, 'Manila'
from hospital.provinces p
where p.name = 'Metro Manila'
  and not exists (
    select 1
    from hospital.cities c
    where c.province_id = p.id
      and c.name = 'Manila'
  );

insert into hospital.cities (province_id, name)
select p.id, 'Pasig'
from hospital.provinces p
where p.name = 'Metro Manila'
  and not exists (
    select 1
    from hospital.cities c
    where c.province_id = p.id
      and c.name = 'Pasig'
  );

insert into hospital.cities (province_id, name)
select p.id, 'Malolos'
from hospital.provinces p
where p.name = 'Bulacan'
  and not exists (
    select 1
    from hospital.cities c
    where c.province_id = p.id
      and c.name = 'Malolos'
  );

insert into hospital.cities (province_id, name)
select p.id, 'Santa Maria'
from hospital.provinces p
where p.name = 'Bulacan'
  and not exists (
    select 1
    from hospital.cities c
    where c.province_id = p.id
      and c.name = 'Santa Maria'
  );

insert into hospital.cities (province_id, name)
select p.id, 'Cebu City'
from hospital.provinces p
where p.name = 'Cebu'
  and not exists (
    select 1
    from hospital.cities c
    where c.province_id = p.id
      and c.name = 'Cebu City'
  );

insert into hospital.cities (province_id, name)
select p.id, 'Iloilo City'
from hospital.provinces p
where p.name = 'Iloilo'
  and not exists (
    select 1
    from hospital.cities c
    where c.province_id = p.id
      and c.name = 'Iloilo City'
  );

insert into hospital.facilities (id, name, level, status)
values
  ('33333333-3333-3333-3333-333333333333', 'Philippine General Hospital', 'tertiary', 'approved'),
  ('44444444-4444-4444-4444-444444444444', 'The Medical City', 'tertiary', 'approved'),
  ('55555555-5555-5555-5555-555555555555', 'Bulacan Medical Center', 'tertiary', 'approved'),
  ('66666666-6666-6666-6666-666666666666', 'Rogaciano M. Mercado Memorial Hospital', 'secondary', 'approved'),
  ('77777777-7777-7777-7777-777777777777', 'Vicente Sotto Memorial Medical Center', 'tertiary', 'approved'),
  ('88888888-8888-8888-8888-888888888888', 'Western Visayas Medical Center', 'tertiary', 'approved')
on conflict (id) do update set
  name = excluded.name,
  level = excluded.level,
  status = excluded.status;

insert into hospital.facility_addresses (facility_id, address_line, barangay, city_id, postal_code, latitude, longitude)
values
  (
    '33333333-3333-3333-3333-333333333333',
    'Taft Avenue',
    'Ermita',
    (
      select c.id
      from hospital.cities c
      join hospital.provinces p on p.id = c.province_id
      where c.name = 'Manila' and p.name = 'Metro Manila'
      limit 1
    ),
    '1000',
    14.5777710,
    120.9857069
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'Ortigas Avenue',
    'Ugong',
    (
      select c.id
      from hospital.cities c
      join hospital.provinces p on p.id = c.province_id
      where c.name = 'Pasig' and p.name = 'Metro Manila'
      limit 1
    ),
    '1604',
    14.5899758,
    121.0692915
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'Potenciano Street',
    'Guinhawa',
    (
      select c.id
      from hospital.cities c
      join hospital.provinces p on p.id = c.province_id
      where c.name = 'Malolos' and p.name = 'Bulacan'
      limit 1
    ),
    '3000',
    14.858686,
    120.8164953
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    'Jose Corazon de Jesus Street',
    'Poblacion',
    (
      select c.id
      from hospital.cities c
      join hospital.provinces p on p.id = c.province_id
      where c.name = 'Santa Maria' and p.name = 'Bulacan'
      limit 1
    ),
    '3022',
    14.818871,
    120.9597297
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    'B. Rodriguez Street',
    'Santa Cruz',
    (
      select c.id
      from hospital.cities c
      join hospital.provinces p on p.id = c.province_id
      where c.name = 'Cebu City' and p.name = 'Cebu'
      limit 1
    ),
    '6000',
    10.307815,
    123.8916295
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    'Q. Abeto Street',
    'Mandurriao',
    (
      select c.id
      from hospital.cities c
      join hospital.provinces p on p.id = c.province_id
      where c.name = 'Iloilo City' and p.name = 'Iloilo'
      limit 1
    ),
    '5000',
    10.7186771,
    122.5417902
  )
on conflict (facility_id) do update set
  address_line = excluded.address_line,
  barangay = excluded.barangay,
  city_id = excluded.city_id,
  postal_code = excluded.postal_code,
  latitude = excluded.latitude,
  longitude = excluded.longitude;