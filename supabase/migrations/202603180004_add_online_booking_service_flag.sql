insert into hospital.service_catalog (code, label, active)
values ('online_booking', 'Online Appointment Booking', true)
on conflict (code) do update
set label = excluded.label,
    active = true;

insert into hospital.facility_services (facility_id, service_id, available)
select
  '11111111-1111-1111-1111-111111111111'::uuid,
  sc.id,
  true
from hospital.service_catalog sc
where sc.code in ('telemedicine', 'online_booking')
on conflict (facility_id, service_id) do update
set available = excluded.available,
    updated_at = now();
