# Edge Functions and Frontend Wiring

## Deployed Functions
- `hospital-api`
- `triage-chat`

## Required Supabase Secrets
Set these in your project before using chat:
- `GROQ_API_KEY`
- Optional: `GROQ_MODEL` (default: `llama-3.1-8b-instant`)

## `hospital-api` Routes
- `GET /map/facilities` (public, approved facilities only)
- `GET /profile/facilities/:facilityId` (public, approved facilities only)
- `GET /owner/facilities/search?query=...` (owner auth)
- `POST /owner/claims` (owner auth)
- `GET /owner/me/facility` (owner auth)
- `PUT /owner/facilities/:facilityId` (owner auth)
- `GET /admin/claims?status=pending` (admin auth)
- `POST /admin/claims/:claimId/review` (admin auth)

## `triage-chat` Route
- `POST /` body: `{ "message": "..." }`

## Frontend Integration
The `views/*.html` pages now load `../public/js/app.js` (module) and call these APIs through `public/js/models/AppModel.js`.

Updated flows:
- Map page loads from `GET /map/facilities`
- Profile page loads from `GET /profile/facilities/:id`
- Owner login/claim/manage uses owner endpoints + storage upload
- Admin login/dashboard uses admin review endpoints
- Chat uses `triage-chat` proxy
