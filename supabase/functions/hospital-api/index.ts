// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type Actor = {
  userId: string | null;
  role: "public" | "owner" | "admin";
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables.");
}

const requestClient = (authorization: string | null) =>
  createClient(supabaseUrl, anonKey, {
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });

const serviceClient = createClient(supabaseUrl, serviceRoleKey);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const dayLabel = (day: number) => {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[day] ?? "?";
};

const mapFacility = (facility: any) => {
  const addressSource = facility.facility_addresses ?? null;
  const address = Array.isArray(addressSource) ? addressSource[0] ?? null : addressSource;
  const citySource = address?.cities ?? null;
  const cityRow = Array.isArray(citySource) ? citySource[0] ?? null : citySource;
  const provinceSource = cityRow?.provinces ?? null;
  const provinceRow = Array.isArray(provinceSource) ? provinceSource[0] ?? null : provinceSource;
  const city = cityRow?.name ?? null;
  const province = provinceRow?.name ?? null;

  const contactsSource = facility.facility_contacts ?? [];
  const contacts = Array.isArray(contactsSource) ? contactsSource : [contactsSource];
  const mainContact = contacts.find((item: any) => item.kind === "main")?.phone_number ?? null;
  const emergencyContact = contacts.find((item: any) => item.kind === "emergency")?.phone_number ?? null;
  const hoursSource = facility.facility_operating_hours ?? [];
  const hours = (Array.isArray(hoursSource) ? hoursSource : [hoursSource]).sort((a: any, b: any) => a.day_of_week - b.day_of_week);

  const hoursLines = hours.map((item: any) => {
    if (item.is_closed) {
      return `${dayLabel(item.day_of_week)}: Closed`;
    }
    return `${dayLabel(item.day_of_week)}: ${item.opens_at ?? "--"} - ${item.closes_at ?? "--"}`;
  });

  const weekday = hours.filter((item: any) => item.day_of_week >= 1 && item.day_of_week <= 5 && !item.is_closed);
  const weekdayText = weekday.length
    ? `${weekday[0].opens_at ?? "--"} - ${weekday[0].closes_at ?? "--"}`
    : "Hours unavailable";

  const servicesSource = facility.facility_services ?? [];
  const services = (Array.isArray(servicesSource) ? servicesSource : [servicesSource])
    .filter((item: any) => item.available)
    .map((item: any) => ({
      code: item.service_catalog?.code,
      label: item.service_catalog?.label,
    }))
    .filter((item: any) => Boolean(item.code && item.label));

  return {
    id: facility.id,
    name: facility.name,
    level: facility.level,
    status: facility.status,
    statusLabel: facility.status === "approved" ? "DOH Approved" : facility.status,
    address: [address?.address_line, address?.barangay, city, province].filter(Boolean).join(", "),
    city,
    province,
    latitude: address?.latitude ?? null,
    longitude: address?.longitude ?? null,
    contacts: {
      main: mainContact,
      emergency: emergencyContact,
    },
    hours: {
      summary: weekdayText,
      weekdayText,
      lines: hoursLines,
    },
    services,
    distanceLabel: "--",
  };
};

const normalizeAppointmentType = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "virtual consultation" || normalized === "virtual_consultation") {
    return "virtual_consultation";
  }
  if (normalized === "online appointment" || normalized === "online_appointment") {
    return "online_appointment";
  }
  return normalized;
};

const toSafeText = (value: unknown, maxLength = 300) => String(value ?? "").trim().slice(0, maxLength);

const generateAppointmentReference = () => {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 7).toUpperCase();
  return `TH-${yy}${mm}${dd}-${suffix}`;
};

const buildDayOfProcessSteps = (appointmentType: string, preferredChannel: string | null) => {
  if (appointmentType === "virtual_consultation") {
    const channel = preferredChannel || "video call";
    return [
      "Prepare your phone/laptop and stable internet at least 15 minutes before schedule.",
      `Open your ${channel} channel 10 minutes before your appointment time.`,
      "Keep your ID, medication list, and latest vital signs ready.",
      "Wait for the doctor to start the consultation and confirm your symptoms.",
      "Follow prescribed home-care instructions and emergency escalation advice.",
    ];
  }

  return [
    "Arrive at least 20 minutes before your booked schedule.",
    "Present your booking reference and valid ID at the facility triage desk.",
    "Submit required forms and recent medical records if available.",
    "Wait for nurse/doctor call and proceed to assigned department.",
    "Follow discharge or follow-up instructions after consultation.",
  ];
};

const resolveActor = async (client: ReturnType<typeof requestClient>, authorization: string | null, requireAuth = false): Promise<Actor> => {
  if (!authorization) {
    if (requireAuth) {
      throw new HttpError(401, "Authorization is required.");
    }
    return { userId: null, role: "public" };
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    if (requireAuth) {
      throw new HttpError(401, "Invalid or expired session.");
    }
    return { userId: null, role: "public" };
  }

  const { data: roleData } = await serviceClient
    .schema("hospital")
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const role = (roleData?.role ?? "public") as Actor["role"];
  return {
    userId: user.id,
    role,
  };
};

const consumeRateLimit = async (scope: string, subject: string, maxRequests: number, windowSeconds = 60) => {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();

  const { data: current } = await serviceClient
    .schema("hospital")
    .from("edge_request_counters")
    .select("id,request_count")
    .eq("scope", scope)
    .eq("subject", subject)
    .eq("window_start", windowStart)
    .maybeSingle();

  if (!current) {
    await serviceClient.schema("hospital").from("edge_request_counters").insert({
      scope,
      subject,
      window_start: windowStart,
      request_count: 1,
    });
    return;
  }

  const nextCount = (current.request_count ?? 0) + 1;
  await serviceClient
    .schema("hospital")
    .from("edge_request_counters")
    .update({ request_count: nextCount })
    .eq("id", current.id);

  if (nextCount > maxRequests) {
    throw new HttpError(429, "Too many requests. Please try again shortly.");
  }
};

const logAudit = async (
  functionName: string,
  endpoint: string,
  action: string,
  actor: Actor,
  requestIp: string,
  requestId: string,
  statusCode: number,
  metadata: Record<string, unknown> = {},
) => {
  await serviceClient.schema("hospital").from("edge_audit_logs").insert({
    function_name: functionName,
    endpoint,
    action,
    actor_user_id: actor.userId,
    actor_role: actor.role,
    request_ip: requestIp,
    request_id: requestId,
    status_code: statusCode,
    metadata,
  });
};

const logError = async (
  functionName: string,
  endpoint: string,
  actor: Actor,
  requestIp: string,
  requestId: string,
  error: Error,
  metadata: Record<string, unknown> = {},
) => {
  await serviceClient.schema("hospital").from("edge_error_logs").insert({
    function_name: functionName,
    endpoint,
    actor_user_id: actor.userId,
    request_ip: requestIp,
    request_id: requestId,
    error_message: error.message,
    error_stack: error.stack?.slice(0, 2000) ?? null,
    metadata,
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const requestIp = req.headers.get("x-forwarded-for")?.split(",")?.[0]?.trim() ?? "unknown";
  const authorization = req.headers.get("Authorization");
  const client = requestClient(authorization);

  const url = new URL(req.url);
  const endpoint = url.pathname.replace(/^\/hospital-api/, "") || "/";

  let actor: Actor = { userId: null, role: "public" };
  let action = "unknown";
  let auditStatus = 500;
  let metadata: Record<string, unknown> = {};

  try {
    if (req.method === "GET" && endpoint === "/map/facilities") {
      action = "map_facilities";
      await consumeRateLimit("hospital-api-map", requestIp, 180, 60);

      const search = (url.searchParams.get("search") ?? "").trim();
      let query = client
        .schema("hospital")
        .from("facilities")
        .select(
          `
            id,
            name,
            level,
            status,
            facility_addresses(
              address_line,
              barangay,
              postal_code,
              latitude,
              longitude,
              cities(
                name,
                provinces(name)
              )
            ),
            facility_contacts(kind,phone_number,is_primary),
            facility_operating_hours(day_of_week,opens_at,closes_at,is_closed),
            facility_services(available,service_catalog(code,label))
          `,
        )
        .order("name", { ascending: true })
        .limit(100);

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) {
        throw new HttpError(400, error.message);
      }

      const facilities = (data ?? []).map(mapFacility);
      metadata = { count: facilities.length, search };
      auditStatus = 200;
      return json({ requestId, facilities });
    }

    if (req.method === "GET" && endpoint.startsWith("/profile/facilities/")) {
      action = "profile_facility";
      await consumeRateLimit("hospital-api-profile", requestIp, 180, 60);

      const facilityId = endpoint.replace("/profile/facilities/", "").trim();
      if (!facilityId) {
        throw new HttpError(400, "Facility id is required.");
      }

      const { data, error } = await client
        .schema("hospital")
        .from("facilities")
        .select(
          `
            id,
            name,
            level,
            status,
            facility_addresses(
              address_line,
              barangay,
              postal_code,
              latitude,
              longitude,
              cities(
                name,
                provinces(name)
              )
            ),
            facility_contacts(kind,phone_number,is_primary),
            facility_operating_hours(day_of_week,opens_at,closes_at,is_closed),
            facility_services(available,service_catalog(code,label))
          `,
        )
        .eq("id", facilityId)
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new HttpError(400, error.message);
      }
      if (!data) {
        throw new HttpError(404, "Facility not found.");
      }

      auditStatus = 200;
      metadata = { facilityId };
      return json({ requestId, facility: mapFacility(data) });
    }

    if (req.method === "GET" && endpoint === "/owner/facilities/search") {
      action = "owner_search_facilities";
      actor = await resolveActor(client, authorization, true);
      if (actor.role !== "owner") {
        throw new HttpError(403, "Owner role required.");
      }
      await consumeRateLimit("hospital-api-owner-search", actor.userId!, 60, 60);

      const search = (url.searchParams.get("query") ?? "").trim();
      if (!search) {
        auditStatus = 200;
        return json({ requestId, facilities: [] });
      }

      const { data, error } = await serviceClient
        .schema("hospital")
        .from("facilities")
        .select("id,name,level,status,owner_user_id")
        .ilike("name", `%${search}%`)
        .order("name", { ascending: true })
        .limit(20);

      if (error) {
        throw new HttpError(400, error.message);
      }

      const facilities = (data ?? []).filter((item: any) => !item.owner_user_id && item.status !== "approved");
      metadata = { count: facilities.length, search };
      auditStatus = 200;
      return json({ requestId, facilities });
    }

    if (req.method === "POST" && endpoint === "/owner/claims") {
      action = "owner_submit_claim";
      actor = await resolveActor(client, authorization, true);
      if (actor.role !== "owner") {
        throw new HttpError(403, "Owner role required.");
      }
      await consumeRateLimit("hospital-api-owner-claim", actor.userId!, 20, 60);

      const body = await req.json().catch(() => ({}));
      const facilityId = String(body.facilityId ?? "").trim();
      const prcDocPath = body.prcDocPath ? String(body.prcDocPath) : null;
      const ltoDocPath = body.ltoDocPath ? String(body.ltoDocPath) : null;

      if (!facilityId) {
        throw new HttpError(400, "Facility id is required.");
      }

      const { data: existingPending } = await client
        .schema("hospital")
        .from("facility_claims")
        .select("id")
        .eq("facility_id", facilityId)
        .eq("owner_user_id", actor.userId)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();

      if (existingPending) {
        throw new HttpError(409, "You already have a pending claim for this facility.");
      }

      const { data, error } = await client
        .schema("hospital")
        .from("facility_claims")
        .insert({
          facility_id: facilityId,
          owner_user_id: actor.userId,
          status: "pending",
          prc_doc_path: prcDocPath,
          lto_doc_path: ltoDocPath,
        })
        .select("id,facility_id,status,submitted_at")
        .single();

      if (error) {
        throw new HttpError(400, error.message);
      }

      metadata = { facilityId, claimId: data.id };
      auditStatus = 201;
      return json({ requestId, claim: data }, 201);
    }

    if (req.method === "GET" && endpoint === "/owner/me/facility") {
      action = "owner_get_facility";
      actor = await resolveActor(client, authorization, true);
      if (actor.role !== "owner") {
        throw new HttpError(403, "Owner role required.");
      }
      await consumeRateLimit("hospital-api-owner-me", actor.userId!, 120, 60);

      const { data, error } = await client
        .schema("hospital")
        .from("facilities")
        .select(
          `
            id,
            name,
            level,
            status,
            facility_addresses(
              address_line,
              barangay,
              postal_code,
              latitude,
              longitude,
              cities(
                name,
                provinces(name)
              )
            ),
            facility_contacts(kind,phone_number,is_primary),
            facility_operating_hours(day_of_week,opens_at,closes_at,is_closed),
            facility_services(available,service_catalog(code,label))
          `,
        )
        .eq("owner_user_id", actor.userId)
        .eq("status", "approved")
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new HttpError(400, error.message);
      }

      auditStatus = 200;
      return json({ requestId, facility: data ? mapFacility(data) : null });
    }

    if (req.method === "PUT" && endpoint.startsWith("/owner/facilities/")) {
      action = "owner_update_facility";
      actor = await resolveActor(client, authorization, true);
      if (actor.role !== "owner") {
        throw new HttpError(403, "Owner role required.");
      }
      await consumeRateLimit("hospital-api-owner-update", actor.userId!, 30, 60);

      const facilityId = endpoint.replace("/owner/facilities/", "").trim();
      if (!facilityId) {
        throw new HttpError(400, "Facility id is required.");
      }

      const body = await req.json().catch(() => ({}));
      const phoneNumber = body.phoneNumber ? String(body.phoneNumber).trim() : "";
      const opensAt = body.opensAt ? String(body.opensAt) : null;
      const closesAt = body.closesAt ? String(body.closesAt) : null;
      const serviceUpdates = typeof body.serviceUpdates === "object" && body.serviceUpdates ? body.serviceUpdates : {};

      if (phoneNumber) {
        const { data: existingMain } = await client
          .schema("hospital")
          .from("facility_contacts")
          .select("id")
          .eq("facility_id", facilityId)
          .eq("kind", "main")
          .limit(1)
          .maybeSingle();

        if (existingMain?.id) {
          const { error: updateContactError } = await client
            .schema("hospital")
            .from("facility_contacts")
            .update({ phone_number: phoneNumber })
            .eq("id", existingMain.id);
          if (updateContactError) {
            throw new HttpError(400, updateContactError.message);
          }
        } else {
          const { error: insertContactError } = await client
            .schema("hospital")
            .from("facility_contacts")
            .insert({
              facility_id: facilityId,
              kind: "main",
              phone_number: phoneNumber,
              is_primary: true,
            });
          if (insertContactError) {
            throw new HttpError(400, insertContactError.message);
          }
        }
      }

      if (opensAt && closesAt) {
        const weekdayRows = [1, 2, 3, 4, 5].map((day) => ({
          facility_id: facilityId,
          day_of_week: day,
          opens_at: opensAt,
          closes_at: closesAt,
          is_closed: false,
        }));

        const { error: hourUpsertError } = await client
          .schema("hospital")
          .from("facility_operating_hours")
          .upsert(weekdayRows, { onConflict: "facility_id,day_of_week" });

        if (hourUpsertError) {
          throw new HttpError(400, hourUpsertError.message);
        }
      }

      const serviceCodes = Object.keys(serviceUpdates);
      if (serviceCodes.length) {
        const { data: serviceCatalogRows, error: serviceCatalogError } = await client
          .schema("hospital")
          .from("service_catalog")
          .select("id,code")
          .in("code", serviceCodes);

        if (serviceCatalogError) {
          throw new HttpError(400, serviceCatalogError.message);
        }

        const serviceRows = (serviceCatalogRows ?? []).map((row: any) => ({
          facility_id: facilityId,
          service_id: row.id,
          available: Boolean(serviceUpdates[row.code]),
        }));

        if (serviceRows.length) {
          const { error: serviceUpsertError } = await client
            .schema("hospital")
            .from("facility_services")
            .upsert(serviceRows, { onConflict: "facility_id,service_id" });

          if (serviceUpsertError) {
            throw new HttpError(400, serviceUpsertError.message);
          }
        }
      }

      metadata = { facilityId };
      auditStatus = 200;
      return json({ requestId, success: true });
    }

    if (req.method === "POST" && endpoint === "/telehealth/appointments") {
      action = "telehealth_create_appointment";
      await consumeRateLimit("hospital-api-telehealth-create", requestIp, 40, 60);

      const body = await req.json().catch(() => ({}));
      const facilityId = toSafeText(body.facilityId, 64);
      const appointmentType = normalizeAppointmentType(body.appointmentType);
      const patientFullName = toSafeText(body.patientFullName, 160);
      const patientAge = Number(body.patientAge);
      const patientSex = toSafeText(body.patientSex, 32).toLowerCase();
      const patientContactNumber = toSafeText(body.patientContactNumber, 40);
      const patientEmail = toSafeText(body.patientEmail, 120).toLowerCase();
      const patientAddress = toSafeText(body.patientAddress, 260) || null;
      const chiefComplaint = toSafeText(body.chiefComplaint, 500);
      const existingConditions = toSafeText(body.existingConditions, 500) || null;
      const preferredChannel = toSafeText(body.preferredChannel, 80) || null;
      const department = toSafeText(body.department, 120) || null;
      const preferredDate = toSafeText(body.preferredDate, 10);
      const preferredTime = toSafeText(body.preferredTime, 5);
      const emergencyContactName = toSafeText(body.emergencyContactName, 160);
      const emergencyContactNumber = toSafeText(body.emergencyContactNumber, 40);
      const consentAccepted = Boolean(body.consentAccepted);

      if (!facilityId) {
        throw new HttpError(400, "Facility is required.");
      }
      if (!appointmentType || !["virtual_consultation", "online_appointment"].includes(appointmentType)) {
        throw new HttpError(400, "Appointment type is invalid.");
      }
      if (!patientFullName || !chiefComplaint || !patientContactNumber || !patientEmail) {
        throw new HttpError(400, "Patient details are incomplete.");
      }
      if (!Number.isFinite(patientAge) || patientAge < 1 || patientAge > 130) {
        throw new HttpError(400, "Patient age is invalid.");
      }
      if (!preferredDate || !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
        throw new HttpError(400, "Preferred date must use YYYY-MM-DD format.");
      }
      if (!preferredTime || !/^\d{2}:\d{2}$/.test(preferredTime)) {
        throw new HttpError(400, "Preferred time must use HH:MM format.");
      }
      if (!emergencyContactName || !emergencyContactNumber) {
        throw new HttpError(400, "Emergency contact details are required.");
      }
      if (!consentAccepted) {
        throw new HttpError(400, "Consent is required before booking.");
      }
      if (appointmentType === "virtual_consultation" && !preferredChannel) {
        throw new HttpError(400, "Preferred channel is required for virtual consultation.");
      }
      if (appointmentType === "online_appointment" && !department) {
        throw new HttpError(400, "Department is required for online appointment booking.");
      }

      const requestedSchedule = new Date(`${preferredDate}T${preferredTime}:00`);
      if (Number.isNaN(requestedSchedule.getTime())) {
        throw new HttpError(400, "Preferred schedule is invalid.");
      }

      const now = new Date();
      if (requestedSchedule.getTime() < now.getTime() - 5 * 60 * 1000) {
        throw new HttpError(400, "Preferred schedule cannot be in the past.");
      }

      const { data: facilityRow, error: facilityError } = await serviceClient
        .schema("hospital")
        .from("facilities")
        .select(
          `
            id,
            name,
            status,
            facility_services(available,service_catalog(code,label))
          `,
        )
        .eq("id", facilityId)
        .limit(1)
        .maybeSingle();

      if (facilityError) {
        throw new HttpError(400, facilityError.message);
      }
      if (!facilityRow || facilityRow.status !== "approved") {
        throw new HttpError(404, "Approved facility not found.");
      }

      const facility = mapFacility(facilityRow);
      const requiredServiceCode = appointmentType === "virtual_consultation" ? "telemedicine" : "online_booking";
      const hasRequiredService = (facility.services ?? []).some((service: any) => service.code === requiredServiceCode);
      if (!hasRequiredService) {
        throw new HttpError(409, `Selected facility does not offer ${appointmentType === "virtual_consultation" ? "virtual consultation" : "online booking"}.`);
      }

      const appointmentReference = generateAppointmentReference();
      const { data: appointment, error: appointmentError } = await serviceClient
        .schema("hospital")
        .from("telehealth_appointments")
        .insert({
          appointment_reference: appointmentReference,
          facility_id: facility.id,
          facility_name: facility.name,
          appointment_type: appointmentType,
          patient_full_name: patientFullName,
          patient_age: patientAge,
          patient_sex: patientSex,
          patient_contact_number: patientContactNumber,
          patient_email: patientEmail,
          patient_address: patientAddress,
          chief_complaint: chiefComplaint,
          existing_conditions: existingConditions,
          preferred_channel: preferredChannel,
          department,
          preferred_date: preferredDate,
          preferred_time: preferredTime,
          emergency_contact_name: emergencyContactName,
          emergency_contact_number: emergencyContactNumber,
          consent_accepted: consentAccepted,
          status: "booked",
        })
        .select(
          `
            id,
            appointment_reference,
            facility_id,
            facility_name,
            appointment_type,
            preferred_date,
            preferred_time,
            status,
            created_at
          `,
        )
        .single();

      if (appointmentError) {
        throw new HttpError(400, appointmentError.message);
      }

      metadata = {
        facilityId,
        appointmentReference,
        appointmentType,
      };
      auditStatus = 201;

      return json(
        {
          requestId,
          appointment: {
            id: appointment.id,
            appointmentReference: appointment.appointment_reference,
            facilityId: appointment.facility_id,
            facilityName: appointment.facility_name,
            appointmentType: appointment.appointment_type,
            preferredDate: appointment.preferred_date,
            preferredTime: appointment.preferred_time,
            status: appointment.status,
            createdAt: appointment.created_at,
            dayOfProcessSteps: buildDayOfProcessSteps(appointment.appointment_type, preferredChannel),
          },
        },
        201,
      );
    }

    if (req.method === "GET" && endpoint === "/admin/claims") {
      action = "admin_list_claims";
      actor = await resolveActor(client, authorization, true);
      if (actor.role !== "admin") {
        throw new HttpError(403, "Admin role required.");
      }
      await consumeRateLimit("hospital-api-admin-claims", actor.userId!, 120, 60);

      const statusFilter = (url.searchParams.get("status") ?? "pending").trim();
      let query = client
        .schema("hospital")
        .from("facility_claims")
        .select(
          `
            id,
            facility_id,
            owner_user_id,
            status,
            prc_doc_path,
            lto_doc_path,
            submitted_at,
            reviewed_at,
            review_notes,
            facilities(name,level,status)
          `,
        )
        .order("submitted_at", { ascending: false })
        .limit(100);

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        throw new HttpError(400, error.message);
      }

      const claims = (data ?? []).map((claim: any) => {
        const docs = [claim.prc_doc_path, claim.lto_doc_path].filter(Boolean);
        return {
          id: claim.id,
          facilityId: claim.facility_id,
          facilityName: claim.facilities?.name ?? "Unknown Facility",
          facilityLevel: claim.facilities?.level ?? "n/a",
          ownerUserId: claim.owner_user_id,
          ownerDisplay: claim.owner_user_id,
          status: claim.status,
          submittedAt: claim.submitted_at,
          reviewedAt: claim.reviewed_at,
          reviewNotes: claim.review_notes,
          documents: docs,
          documentSummary: docs.length ? docs.join(" | ") : "No documents uploaded",
        };
      });

      metadata = { count: claims.length, statusFilter };
      auditStatus = 200;
      return json({ requestId, claims });
    }

    if (req.method === "POST" && endpoint.startsWith("/admin/claims/") && endpoint.endsWith("/review")) {
      action = "admin_review_claim";
      actor = await resolveActor(client, authorization, true);
      if (actor.role !== "admin") {
        throw new HttpError(403, "Admin role required.");
      }
      await consumeRateLimit("hospital-api-admin-review", actor.userId!, 30, 60);

      const claimId = endpoint.replace("/admin/claims/", "").replace("/review", "").trim();
      if (!claimId) {
        throw new HttpError(400, "Claim id is required.");
      }

      const body = await req.json().catch(() => ({}));
      const decision = String(body.decision ?? "").trim();
      const reviewNotes = body.reviewNotes ? String(body.reviewNotes) : null;

      if (!["approved", "rejected"].includes(decision)) {
        throw new HttpError(400, "Decision must be approved or rejected.");
      }

      const { data: claimRow, error: claimError } = await client
        .schema("hospital")
        .from("facility_claims")
        .select("id,facility_id,owner_user_id,status")
        .eq("id", claimId)
        .single();

      if (claimError || !claimRow) {
        throw new HttpError(404, "Claim not found.");
      }

      const { error: claimUpdateError } = await client
        .schema("hospital")
        .from("facility_claims")
        .update({
          status: decision,
          reviewed_at: new Date().toISOString(),
          reviewed_by: actor.userId,
          review_notes: reviewNotes,
        })
        .eq("id", claimId);

      if (claimUpdateError) {
        throw new HttpError(400, claimUpdateError.message);
      }

      const facilityUpdate: Record<string, unknown> = {
        status: decision === "approved" ? "approved" : "rejected",
      };

      if (decision === "approved") {
        facilityUpdate.owner_user_id = claimRow.owner_user_id;
      }

      const { error: facilityUpdateError } = await client
        .schema("hospital")
        .from("facilities")
        .update(facilityUpdate)
        .eq("id", claimRow.facility_id);

      if (facilityUpdateError) {
        throw new HttpError(400, facilityUpdateError.message);
      }

      if (decision === "approved") {
        const { data: ownerRole } = await serviceClient
          .schema("hospital")
          .from("user_roles")
          .select("role")
          .eq("user_id", claimRow.owner_user_id)
          .eq("role", "owner")
          .maybeSingle();

        if (!ownerRole) {
          await serviceClient.schema("hospital").from("user_roles").insert({
            user_id: claimRow.owner_user_id,
            role: "owner",
          });
        }
      }

      metadata = { claimId, decision };
      auditStatus = 200;
      return json({ requestId, success: true });
    }

    throw new HttpError(404, "Endpoint not found.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    auditStatus = status;

    await logError("hospital-api", endpoint, actor, requestIp, requestId, error as Error, {
      method: req.method,
      action,
    }).catch(() => null);

    return json(
      {
        requestId,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      status,
    );
  } finally {
    await logAudit("hospital-api", endpoint, action, actor, requestIp, requestId, auditStatus, {
      method: req.method,
      ...metadata,
    }).catch(() => null);
  }
});
