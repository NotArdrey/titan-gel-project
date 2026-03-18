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
const defaultGroqModel = "llama-3.1-8b-instant";

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

const sanitizeHistory = (rawHistory: unknown) => {
  if (!Array.isArray(rawHistory)) {
    return [];
  }

  return rawHistory
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const role = String((entry as Record<string, unknown>).role ?? "").toLowerCase();
      const content = String((entry as Record<string, unknown>).content ?? "").trim().slice(0, 500);

      if (!["user", "assistant"].includes(role) || !content) {
        return null;
      }

      return {
        role,
        content,
      };
    })
    .filter((entry): entry is { role: "user" | "assistant"; content: string } => Boolean(entry))
    .slice(-10);
};

const buildFallbackReply = (message: string, history: Array<{ role: "user" | "assistant"; content: string }>) => {
  const combined = `${history.map((entry) => entry.content).join(" ")} ${message}`.toLowerCase();

  const tertiaryKeywords = [
    "chest pain",
    "chest tightness",
    "difficulty breathing",
    "shortness of breath",
    "unconscious",
    "seizure",
    "stroke",
    "heavy bleeding",
    "severe allergic",
  ];
  const secondaryKeywords = [
    "high fever",
    "persistent vomiting",
    "dehydration",
    "worsening",
    "severe pain",
    "dizziness",
    "fainting",
  ];

  const hasTertiarySignal = tertiaryKeywords.some((keyword) => combined.includes(keyword));
  const hasSecondarySignal = secondaryKeywords.some((keyword) => combined.includes(keyword));

  if (hasTertiarySignal) {
    return "Based on your symptoms, seek tertiary care / ER immediately for urgent assessment. This is not a diagnosis. If symptoms are severe or rapidly worsening, call Philippines emergency services (911) now.";
  }

  if (hasSecondarySignal) {
    return "Based on your symptoms, you should go to a secondary-level hospital today for in-person evaluation. This is not a diagnosis. If breathing difficulty, chest pain, or fainting occurs, go to the ER immediately or call 911.";
  }

  return "Based on your symptoms, start with primary care (clinic or health center) for initial evaluation. This is not a diagnosis. If symptoms worsen or danger signs appear, proceed to a higher-level hospital or call 911.";
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
    const history = sanitizeHistory(body.history);

    if (!message || message.length < 3) {
      throw new HttpError(400, "Please provide more symptom details.");
    }
    if (message.length > 500) {
      throw new HttpError(400, "Message is too long. Keep it under 500 characters.");
    }

    const env = Deno.env.toObject();
    const groqApiKeyFromExactName = env.GROQ_API_KEY ?? "";
    const groqApiKeyFromNormalizedName = Object.entries(env).find(
      ([key, value]) => key.trim() === "GROQ_API_KEY" && typeof value === "string" && value.trim().length > 0,
    )?.[1] ?? "";
    const groqApiKey = (groqApiKeyFromExactName || groqApiKeyFromNormalizedName).trim();

    const groqModelFromExactName = env.GROQ_MODEL ?? "";
    const groqModelFromNormalizedName = Object.entries(env).find(
      ([key, value]) => key.trim() === "GROQ_MODEL" && typeof value === "string" && value.trim().length > 0,
    )?.[1] ?? "";
    const groqModel = (groqModelFromExactName || groqModelFromNormalizedName || defaultGroqModel).trim();
    const hasGroqKey = groqApiKey.length > 0;

    if (!hasGroqKey) {
      const reply = buildFallbackReply(message, history);
      const visibleGroqEnvKeys = Object.keys(env).filter((key) => key.toUpperCase().includes("GROQ"));

      metadata = {
        latencyMs: 0,
        model: "fallback-triage-v1",
        inputLength: message.length,
        historyItems: history.length,
        hasGroqKey,
        visibleGroqEnvKeys,
      };

      statusCode = 200;
      return json({ requestId, reply, model: "fallback-triage-v1", fallback: true });
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
          ...history,
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
      historyItems: history.length,
      hasGroqKey,
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
