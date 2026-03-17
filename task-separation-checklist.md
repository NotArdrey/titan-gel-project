# Healthcare Triage & Navigation Platform
## Task Separation Checklist

## 1) Shared Planning (Both)
- [ ] Finalize MVP scope: Patient view, Hospital Owner dashboard, DOH Admin dashboard
- [ ] Agree API contract (request/response, status codes, error format)
- [ ] Agree data model naming (facilities, claims, profiles, services, documents)
- [ ] Define role matrix: public, owner, doctor, admin
- [ ] Define environment variables and deployment targets

## 2) Gemini — Frontend Checklist
- [x] Build responsive global navigation (desktop + mobile drawer)
- [x] Build Patient Home sections (Hero, symptom guide, emergency CTAs, footer)
- [x] Build responsive map container and marker rendering hooks (Google Maps or Leaflet/OpenStreetMap)
- [x] Build facility info card/modal UI (name, address, services, contact, distance)
- [x] Build hospital classification guide and symptom-to-care table/grid
- [x] Build AI chat widget UI with disclaimer, loading, and error states
- [x] Build hospital profile page template (departments, hours, contacts)
- [x] Build telehealth links page and education hub layouts
- [x] Build privacy and disclaimer page (data privacy notice, information disclaimer, emergency instructions)
- [x] Build Owner auth pages (login/register/forgot)
- [x] Build Owner claim flow UI (search facility, upload docs, pending status)
- [x] Build Owner management UI (contacts, hours, services toggles)
- [x] Build Admin login UI, verification queue table/cards, and review modal
- [x] Integrate all UIs with backend APIs and role-aware route guards
- [x] Run responsive + accessibility pass (mobile, tablet, keyboard, contrast)

## 3) GPT — Backend Checklist
- [x] Create Supabase `hospital` schema and core tables (`facilities`, `facility_claims`, `service_catalog`, `facility_services`, `user_roles`)
- [x] Normalize database to 3NF (`provinces`, `cities`, `facility_addresses`, `facility_contacts`, `facility_operating_hours`)
- [x] Add status model and constraints (pending, approved, rejected)
- [x] Configure Supabase Auth linkage and role mapping table (`user_roles` with owner/admin)
- [x] Implement RLS policies per table (public approved-only, owner self-only, admin full)
- [x] Create Storage bucket and policies for verification docs uploads
- [x] Build Edge Function Groq proxy (API key only server-side)
- [x] Add Edge Function validation, throttling, and audit logging
- [x] Implement facility endpoints for map/profile (approved-only for public)
- [x] Implement owner endpoints for claim submit and own-facility updates
- [x] Implement admin endpoints for claim review and approve/reject actions
- [x] Add migration files, seed data, and rollback-safe migration flow
- [x] Add monitoring hooks for function logs and error telemetry

## 4) Integration & Handoff
- [ ] Any AI provides endpoint spec and sample payloads
- [ ] Any AI integrates frontend flows with all success/error states
- [ ] Execute end-to-end test: public browse, owner claim, admin approval, map visibility update
- [ ] Run security verification for unauthorized read/write blocking via RLS
- [ ] Run mobile performance check (slow-network map/chat behavior)

## 5) Definition of Done
- [ ] Public users only see approved facilities
- [ ] Owners only edit linked facility after approval
- [ ] Admin can process pending claims with document review
- [ ] Groq API key is never exposed in browser/client
- [ ] Core pages are responsive and deployment is successful
