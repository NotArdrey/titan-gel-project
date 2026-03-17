create table if not exists hospital.telehealth_appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_reference text not null unique,
  facility_id uuid not null references hospital.facilities(id) on delete cascade,
  facility_name text not null,
  appointment_type text not null check (appointment_type in ('virtual_consultation', 'online_appointment')),
  patient_full_name text not null,
  patient_age integer not null check (patient_age > 0 and patient_age <= 130),
  patient_sex text not null check (patient_sex in ('female', 'male', 'other', 'prefer_not_to_say')),
  patient_contact_number text not null,
  patient_email text not null,
  patient_address text,
  chief_complaint text not null,
  existing_conditions text,
  preferred_channel text,
  department text,
  preferred_date date not null,
  preferred_time time not null,
  emergency_contact_name text not null,
  emergency_contact_number text not null,
  consent_accepted boolean not null default false,
  status text not null default 'booked' check (status in ('booked', 'checked_in', 'completed', 'cancelled')),
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_telehealth_appointments_facility_date
  on hospital.telehealth_appointments (facility_id, preferred_date, preferred_time);

create index if not exists idx_telehealth_appointments_status
  on hospital.telehealth_appointments (status, preferred_date);

drop trigger if exists trg_telehealth_appointments_updated_at on hospital.telehealth_appointments;
create trigger trg_telehealth_appointments_updated_at
before update on hospital.telehealth_appointments
for each row execute function hospital.set_updated_at();

alter table hospital.telehealth_appointments enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'hospital'
      and tablename = 'telehealth_appointments'
      and policyname = 'telehealth_appointments_admin_select'
  ) then
    create policy telehealth_appointments_admin_select
      on hospital.telehealth_appointments
      for select
      to public
      using (hospital.is_admin());
  end if;
end
$$;