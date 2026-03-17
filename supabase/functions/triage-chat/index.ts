// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

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
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const groqApiKey = Deno.env.get("GROQ_API_KEY") ?? "";
const groqModel = Deno.env.get("GROQ_MODEL") ?? "llama-3.1-8b-instant";

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables.");
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey);

const requestClient = (authorization: string | null) =>
  createClient(supabaseUrl, anonKey, {
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

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
    throw new HttpError(429, "Too many chat requests. Please wait a minute.");
  }
};

const logAudit = async (
  endpoint: string,
  actorUserId: string | null,
  actorRole: string,
  requestIp: string,
  requestId: string,
  statusCode: number,
  metadata: Record<string, unknown> = {},
) => {
  await serviceClient.schema("hospital").from("edge_audit_logs").insert({
    function_name: "triage-chat",
    endpoint,
    action: "triage_chat",
    actor_user_id: actorUserId,
    actor_role: actorRole,
    request_ip: requestIp,
    request_id: requestId,
    status_code: statusCode,
    metadata,
  });
};

const logError = async (
  endpoint: string,
  actorUserId: string | null,
  requestIp: string,
  requestId: string,
  error: Error,
  metadata: Record<string, unknown> = {},
) => {
  await serviceClient.schema("hospital").from("edge_error_logs").insert({
    function_name: "triage-chat",
    endpoint,
    actor_user_id: actorUserId,
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
  const endpoint = new URL(req.url).pathname.replace(/^\/triage-chat/, "") || "/";
  const authorization = req.headers.get("Authorization");
  const client = requestClient(authorization);

  let actorUserId: string | null = null;
  let actorRole = "public";
  let statusCode = 500;
  let metadata: Record<string, unknown> = {};

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Only POST is supported.");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (user) {
      actorUserId = user.id;
      const { data: roleData } = await serviceClient
        .schema("hospital")
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      actorRole = roleData?.role ?? "public";
    }

    const subject = actorUserId ?? requestIp;
    await consumeRateLimit("triage-chat", subject, 20, 60);

    const body = await req.json().catch(() => ({}));
    const message = String(body.message ?? "").trim();

    if (!message || message.length < 3) {
      throw new HttpError(400, "Please provide more symptom details.");
    }
    if (message.length > 500) {
      throw new HttpError(400, "Message is too long. Keep it under 500 characters.");
    }
    if (!groqApiKey) {
      throw new HttpError(500, "Groq API key is not configured.");
    }

    const startedAt = Date.now();
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: groqModel,
        temperature: 0.2,
        max_tokens: 240,
        messages: [
          {
            role: "system",
            content:
              "You are a healthcare triage assistant. Give concise facility-level guidance (primary, secondary, tertiary/ER). Never provide diagnosis. Always include a short emergency disclaimer.",
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    const groqJson = await groqResponse.json().catch(() => ({}));
    if (!groqResponse.ok) {
      const errorMessage = groqJson?.error?.message ?? "Groq request failed.";
      throw new HttpError(502, errorMessage);
    }

    const reply = groqJson?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new HttpError(502, "Groq returned an empty response.");
    }

    const latencyMs = Date.now() - startedAt;
    metadata = {
      latencyMs,
      model: groqModel,
      inputLength: message.length,
    };

    statusCode = 200;
    return json({ requestId, reply, model: groqModel });
  } catch (error) {
    statusCode = error instanceof HttpError ? error.status : 500;

    await logError(endpoint, actorUserId, requestIp, requestId, error as Error, {
      method: req.method,
    }).catch(() => null);

    return json(
      {
        requestId,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      statusCode,
    );
  } finally {
    await logAudit(endpoint, actorUserId, actorRole, requestIp, requestId, statusCode, {
      method: req.method,
      ...metadata,
    }).catch(() => null);
  }
});
