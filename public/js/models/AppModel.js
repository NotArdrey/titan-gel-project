import { APP_CONFIG } from "../config.js";

export class AppModel {
  constructor(config = APP_CONFIG) {
    this.config = config;
    this.supabase = null;
    this.supabasePromise = null;
  }

  async getSupabaseClient() {
    if (this.supabase) {
      return this.supabase;
    }

    if (!this.supabasePromise) {
      this.supabasePromise = import("https://esm.sh/@supabase/supabase-js@2.49.8")
        .then((module) => {
          this.supabase = module.createClient(this.config.supabaseUrl, this.config.supabasePublishableKey);
          return this.supabase;
        })
        .catch((error) => {
          this.supabasePromise = null;
          throw new Error(`Supabase client failed to load: ${error.message}`);
        });
    }

    return this.supabasePromise;
  }

  async fetchFacilities(search = "") {
    const encodedSearch = encodeURIComponent(search.trim());
    const query = encodedSearch ? `?search=${encodedSearch}` : "";
    const response = await this.callHospitalApi(`/map/facilities${query}`);
    return response.facilities ?? [];
  }

  async fetchFacilityProfile(facilityId) {
    const response = await this.callHospitalApi(`/profile/facilities/${facilityId}`);
    return response.facility ?? null;
  }

  async searchClaimableFacilities(query) {
    const encodedQuery = encodeURIComponent(query.trim());
    const response = await this.callHospitalApi(`/owner/facilities/search?query=${encodedQuery}`, {
      requireAuth: true,
    });
    return response.facilities ?? [];
  }

  async fetchOwnerFacility() {
    const response = await this.callHospitalApi("/owner/me/facility", {
      requireAuth: true,
    });
    return response.facility ?? null;
  }

  async fetchAdminClaims(status = "pending") {
    const response = await this.callHospitalApi(`/admin/claims?status=${encodeURIComponent(status)}`, {
      requireAuth: true,
    });
    return response.claims ?? [];
  }

  async submitClaim(data, file) {
    const user = await this.requireUser();
    const docPath = file ? await this.uploadClaimDocument(user.id, data.facilityId, file) : null;

    return this.callHospitalApi("/owner/claims", {
      method: "POST",
      requireAuth: true,
      body: {
        facilityId: data.facilityId,
        prcDocPath: docPath,
        ltoDocPath: docPath,
      },
    });
  }

  async updateOwnerFacility(data) {
    return this.callHospitalApi(`/owner/facilities/${data.facilityId}`, {
      method: "PUT",
      requireAuth: true,
      body: data,
    });
  }

  async adminReviewClaim(claimId, decision, reviewNotes = "") {
    return this.callHospitalApi(`/admin/claims/${claimId}/review`, {
      method: "POST",
      requireAuth: true,
      body: {
        decision,
        reviewNotes,
      },
    });
  }

  async createTelehealthAppointment(data) {
    return this.callHospitalApi("/telehealth/appointments", {
      method: "POST",
      body: data,
    });
  }

  async signInOwner(email, password) {
    const supabase = await this.getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new Error(error.message);
    }

    const role = await this.getCurrentRole();
    if (role !== "owner") {
      await supabase.auth.signOut();
      throw new Error("This account is not assigned as an owner.");
    }

    return data;
  }

  async signInAdmin(email, password) {
    const supabase = await this.getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new Error(error.message);
    }

    const role = await this.getCurrentRole();
    if (role !== "admin") {
      await supabase.auth.signOut();
      throw new Error("This account is not assigned as an admin.");
    }

    return data;
  }

  async sendChat(message) {
    const response = await this.callEdgeFunction(this.config.functions.triageChat, {
      method: "POST",
      body: {
        message,
      },
      includeAuth: false,
    });

    return response.reply ?? "I’m unable to provide triage advice right now. Please try again.";
  }

  async getCurrentRole() {
    const supabase = await this.getSupabaseClient();
    const user = await this.requireUser();
    const { data, error } = await supabase
      .schema("hospital")
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data?.role ?? "public";
  }

  async requireUser() {
    const supabase = await this.getSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error("Please sign in first.");
    }

    return user;
  }

  async uploadClaimDocument(userId, facilityId, file) {
    const supabase = await this.getSupabaseClient();
    const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "bin";
    const path = `${userId}/${facilityId}/verification-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from(this.config.storageBucket)
      .upload(path, file, { upsert: false });

    if (error) {
      throw new Error(error.message);
    }

    return path;
  }

  async getAccessToken() {
    const supabase = await this.getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }

  async callHospitalApi(path, options = {}) {
    return this.callEdgeFunction(this.config.functions.hospitalApi, {
      path,
      method: options.method ?? "GET",
      body: options.body,
      includeAuth: Boolean(options.requireAuth),
    });
  }

  async callEdgeFunction(functionName, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      apikey: this.config.supabasePublishableKey,
    };

    if (options.includeAuth) {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error("Please sign in first.");
      }
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const endpointPath = options.path ?? "";
    const timeoutMs = options.timeoutMs ?? 12000;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(`${this.config.supabaseUrl}/functions/v1/${functionName}${endpointPath}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Request timed out. Please check your connection and try again.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error ?? "Request failed.");
    }

    return payload;
  }
}
