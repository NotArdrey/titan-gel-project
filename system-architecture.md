Healthcare Triage & Navigation Platform
Core Goal: A digital first-responder that intelligently routes patients to the appropriate healthcare facility (Primary, Secondary, or Tertiary) based on their symptoms and location, preventing hospital overcrowding and saving lives during emergencies.

1. System Architecture: HTML/JS + Supabase + Groq
1.1. Presentation Layer (Fully Responsive Frontend)
The user interface is built to be lightweight and 100% responsive. Whether accessed on a large DOH desktop monitor, a hospital owner's tablet, or a patient's smartphone on a slow 3G network, the layout will automatically adapt, scale, and reorganize for optimal viewing.

Tech Stack: HTML5, CSS3 (utilizing Flexbox/CSS Grid or a utility framework like Tailwind for mobile-first responsiveness), and Vanilla JavaScript.

Libraries: Supabase JavaScript Client (@supabase/supabase-js).

Hosting: Vercel, Netlify, or GitHub Pages (perfect for fast-loading static assets).

Responsive Behavior: Navigation collapses into a hamburger menu on mobile, data tables become scrollable cards, and the interactive map dynamically resizes to fill the mobile viewport without breaking the page layout.

1.2. Backend & Security Layer (Supabase)
Supabase acts as the complete, serverless backend.

PostgreSQL Database: Stores all registered facilities, DOH approval statuses, and static site content.

Supabase Auth: Handles secure logins and enforces the 4 distinct user roles.

Supabase Storage: A secure, cloud-based bucket for Hospital Owners to upload their verification IDs and business permits.

Row Level Security (RLS): Database-level security policies ensure that public users only query approved hospitals, and Hospital Owners can only UPDATE the specific facility tied to their unique User ID.

Supabase Edge Functions: Secure, serverless TypeScript/JS functions that securely hold your Groq API key. Your frontend calls this function, which then communicates with Groq, keeping your credentials hidden from the public browser.

1.3. External API Integrations (Triggered via JS)
Mapping & Routing: Leaflet + OpenStreetMap (free/open) or Google Maps JavaScript API (renders the responsive map, plots custom color-coded pins, and supports distance/routing links).

AI Triage Engine: Groq API (delivering ultra-low latency AI responses to power the Chat Health Assistant).

2. User Roles & Access Control
Role 1: Regular Patient (Public)

Access: Anonymous (No login required).

Permissions: Can view the map, read educational content, and interact with the Groq-powered AI Chat. RLS restricts their map view to strictly status = 'approved' facilities.

Role 2: Hospital Owner (Facility Manager)

Access: Authenticated via Email/Password.

Permissions: Can submit a facility claim and upload verification documents (PRC ID, LTO) to Supabase Storage. Once approved by the DOH, they gain UPDATE access to modify their specific facility's operating hours, contact numbers, and available services.

Role 3: DOH Admin (Superuser)

Access: Authenticated (Role securely assigned directly within the database).

Permissions: Has a global oversight dashboard. Can review pending claims, verify uploaded documents, and update a facility's status from pending to approved, immediately pushing it live to the patient map.

Role 4: Doctor (Telehealth Provider)

Access: Authenticated via the Doctor Consultation page/portal.

Permissions: Can accept virtual consultations and process online appointment bookings for selected/assigned hospitals, including follow-up telehealth scheduling.

3. UI & UX Documentation
Part 1: The Patient Interface (Public View)
Global Navigation: Logo, Website Name, Home, Find Hospital, Hospital Guide, Health Tips, About, Contact. (Collapses into a mobile-friendly drawer on smaller screens).

Section 1: Hero Interface:

BIG logo, name, and tagline.

A massive, touch-friendly "Find the Nearest Hospital" button.

Quick Symptom Guide detailing when to bypass clinics and go directly to the ER.

Section 2: Interactive Map (Leaflet/OpenStreetMap or Google Maps):

A responsive map container that centers on the user's current location.

Color-coded map pins: 💚 Primary, 💛 Secondary, ❤️ Tertiary.

Clickable pins open a mobile-friendly info window showing: Hospital Name, Address, Services, Contact, and a Distance Calculator link.

Section 3: Hospital Classification Guide:

Clear, structured text defining Primary (Barangay health centers/Clinics), Secondary (District hospitals), and Tertiary (Large medical centers) care.

Section 4: Find the Right Care (Symptom Guide & AI Chat):

A responsive table or grid matching symptoms (Fever vs. Heart Attack) to the recommended facility type.

Groq AI Chat Health Assistant Widget: A fast-loading, responsive chat window. Patients type symptoms, and the Groq model instantly suggests the facility level (backed by a strict medical disclaimer).

Section 5: Emergency Navigation:

"Nearest Emergency Room" quick-route button.

Large, tap-to-call buttons for Ambulances and Emergency contacts.

Section 6: Hospital Profiles:

Dedicated, mobile-optimized pages for each facility detailing specific departments and operating hours.

Section 7: Telehealth Gateway:

Categorized lists of virtual consultation links and telemedicine portals.

Section 8: Patient Education Hub:

Readable, responsive article layouts covering Basic First aid, Preventive health tips, and Chronic disease management.

Footer: Data privacy notice, information disclaimer, emergency instructions.

Part 2: The Hospital Owner Dashboard
Login/Registration: Clean, centered forms that are easy to type into on a phone.

Claiming UI:

Search bar to locate their unverified facility.

Drag-and-drop or tap-to-upload file input for verification documents.

"Pending DOH Review" status indicator.

Management UI (Post-Approval):

A clean, responsive dashboard to update contact numbers and daily operating hours.

Mobile-friendly toggle switches or checkboxes to update available services (e.g., X-Ray, Maternity, 24/7 ER).

Part 3: The DOH Admin Dashboard
Admin Login Portal: Strict access control.

Verification Queue:

A responsive data table displaying all facilities with a pending status. On mobile screens, this table transforms into stacked cards for easier reading.

Displays: Facility Name, Applicant Name, Date Submitted, and a "View Documents" button.

Review Modal:

A pop-up that scales to the screen size, displaying the applicant's uploaded credentials from Supabase Storage.

Action buttons: [Approve Facility] (updates the database and pushes the hospital to the live map) or [Reject].