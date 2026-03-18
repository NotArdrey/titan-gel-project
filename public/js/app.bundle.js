(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // public/js/config.js
  var APP_CONFIG;
  var init_config = __esm({
    "public/js/config.js"() {
      APP_CONFIG = {
        supabaseUrl: "https://igxoezaervwsmqkgmylj.supabase.co",
        supabasePublishableKey: "sb_publishable_suF4p4f9XR-Bnm2YFE6AOA_v0avk-vG",
        storageBucket: "hospital-verification-docs",
        functions: {
          hospitalApi: "hospital-api",
          triageChat: "triage-chat"
        }
      };
    }
  });

  // public/js/models/AppModel.js
  var AppModel;
  var init_AppModel = __esm({
    "public/js/models/AppModel.js"() {
      init_config();
      AppModel = class {
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
            this.supabasePromise = import("https://esm.sh/@supabase/supabase-js@2.49.8").then((module) => {
              this.supabase = module.createClient(this.config.supabaseUrl, this.config.supabasePublishableKey);
              return this.supabase;
            }).catch((error) => {
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
            requireAuth: true
          });
          return response.facilities ?? [];
        }
        async fetchOwnerFacility() {
          const response = await this.callHospitalApi("/owner/me/facility", {
            requireAuth: true
          });
          return response.facility ?? null;
        }
        async fetchAdminClaims(status = "pending") {
          const response = await this.callHospitalApi(`/admin/claims?status=${encodeURIComponent(status)}`, {
            requireAuth: true
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
              ltoDocPath: docPath
            }
          });
        }
        async updateOwnerFacility(data) {
          return this.callHospitalApi(`/owner/facilities/${data.facilityId}`, {
            method: "PUT",
            requireAuth: true,
            body: data
          });
        }
        async adminReviewClaim(claimId, decision, reviewNotes = "") {
          return this.callHospitalApi(`/admin/claims/${claimId}/review`, {
            method: "POST",
            requireAuth: true,
            body: {
              decision,
              reviewNotes
            }
          });
        }
        async createTelehealthAppointment(data) {
          return this.callHospitalApi("/telehealth/appointments", {
            method: "POST",
            body: data
          });
        }
        async signInOwner(email, password) {
          const supabase = await this.getSupabaseClient();
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
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
            password
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
        async sendChat(message, history = []) {
          const normalizedHistory = Array.isArray(history) ? history.filter((entry) => ["user", "assistant"].includes(entry?.role) && typeof entry?.content === "string").map((entry) => ({
            role: entry.role,
            content: entry.content.trim().slice(0, 500)
          })).filter((entry) => entry.content.length > 0).slice(-10) : [];
          const response = await this.callEdgeFunction(this.config.functions.triageChat, {
            method: "POST",
            body: {
              message,
              history: normalizedHistory
            },
            includeAuth: false
          });
          return response.reply ?? "I\u2019m unable to provide triage advice right now. Please try again.";
        }
        async getCurrentRole() {
          const supabase = await this.getSupabaseClient();
          const user = await this.requireUser();
          const { data, error } = await supabase.schema("hospital").from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
          if (error) {
            throw new Error(error.message);
          }
          return data?.role ?? "public";
        }
        async requireUser() {
          const supabase = await this.getSupabaseClient();
          const {
            data: { user },
            error
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
          const { error } = await supabase.storage.from(this.config.storageBucket).upload(path, file, { upsert: false });
          if (error) {
            throw new Error(error.message);
          }
          return path;
        }
        async getAccessToken() {
          const supabase = await this.getSupabaseClient();
          const {
            data: { session }
          } = await supabase.auth.getSession();
          return session?.access_token ?? null;
        }
        async callHospitalApi(path, options = {}) {
          return this.callEdgeFunction(this.config.functions.hospitalApi, {
            path,
            method: options.method ?? "GET",
            body: options.body,
            includeAuth: Boolean(options.requireAuth)
          });
        }
        async callEdgeFunction(functionName, options = {}) {
          const headers = {
            "Content-Type": "application/json",
            apikey: this.config.supabasePublishableKey
          };
          if (options.includeAuth) {
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
              throw new Error("Please sign in first.");
            }
            headers.Authorization = `Bearer ${accessToken}`;
          }
          const endpointPath = options.path ?? "";
          const timeoutMs = options.timeoutMs ?? 12e3;
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
          let response;
          try {
            response = await fetch(`${this.config.supabaseUrl}/functions/v1/${functionName}${endpointPath}`, {
              method: options.method ?? "GET",
              headers,
              body: options.body ? JSON.stringify(options.body) : void 0,
              signal: controller.signal
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
      };
    }
  });

  // public/js/ui/LayoutView.js
  var LayoutView;
  var init_LayoutView = __esm({
    "public/js/ui/LayoutView.js"() {
      LayoutView = class {
        constructor(doc = document) {
          this.doc = doc;
        }
        toggleDrawer() {
          const drawer = this.doc.getElementById("mobile-drawer");
          if (!drawer) {
            return;
          }
          drawer.classList.toggle("hidden");
        }
      };
    }
  });

  // public/js/ui/ChatView.js
  var ChatView;
  var init_ChatView = __esm({
    "public/js/ui/ChatView.js"() {
      ChatView = class {
        constructor(doc = document) {
          this.doc = doc;
          this.isChatOpen = false;
        }
        toggleChat() {
          const chatWindow = this.doc.getElementById("ai-chat-window");
          if (!chatWindow) {
            return;
          }
          this.isChatOpen = !this.isChatOpen;
          if (this.isChatOpen) {
            chatWindow.classList.remove("hidden");
            chatWindow.classList.add("flex");
            setTimeout(() => {
              const input = this.doc.getElementById("chat-input");
              if (input) {
                input.focus();
              }
            }, 100);
            return;
          }
          chatWindow.classList.add("hidden");
          chatWindow.classList.remove("flex");
        }
        getInputMessage() {
          const input = this.doc.getElementById("chat-input");
          if (!input) {
            return "";
          }
          return input.value.trim();
        }
        clearInput() {
          const input = this.doc.getElementById("chat-input");
          if (input) {
            input.value = "";
          }
        }
        appendUserMessage(message) {
          const msgContainer = this.doc.getElementById("chat-messages");
          if (!msgContainer) {
            return;
          }
          const userDiv = this.doc.createElement("div");
          userDiv.className = "flex justify-end";
          userDiv.innerHTML = `<div class="bg-gray-200 text-gray-900 rounded-lg p-3 text-sm max-w-[80%]">${message}</div>`;
          msgContainer.appendChild(userDiv);
          this.scrollToBottom();
        }
        showLoading() {
          const msgContainer = this.doc.getElementById("chat-messages");
          if (!msgContainer) {
            return null;
          }
          const loadingDiv = this.doc.createElement("div");
          loadingDiv.className = "flex loading-indicator";
          loadingDiv.id = "chat-loading";
          loadingDiv.innerHTML = `<div class="bg-teal-100 text-teal-900 rounded-lg p-3 text-sm max-w-[80%]"><i class="fas fa-circle-notch fa-spin"></i> Processing...</div>`;
          msgContainer.appendChild(loadingDiv);
          this.scrollToBottom();
          return loadingDiv;
        }
        hideLoading(loadingElement) {
          if (loadingElement) {
            loadingElement.remove();
          }
        }
        appendAssistantMessage(message) {
          const msgContainer = this.doc.getElementById("chat-messages");
          if (!msgContainer) {
            return;
          }
          const aiDiv = this.doc.createElement("div");
          aiDiv.className = "flex";
          aiDiv.innerHTML = `<div class="bg-teal-100 text-teal-900 rounded-lg p-3 text-sm max-w-[80%]">${message}</div>`;
          msgContainer.appendChild(aiDiv);
          this.scrollToBottom();
        }
        scrollToBottom() {
          const msgContainer = this.doc.getElementById("chat-messages");
          if (!msgContainer) {
            return;
          }
          msgContainer.scrollTop = msgContainer.scrollHeight;
        }
      };
    }
  });

  // public/js/ui/MapView.js
  var MapView;
  var init_MapView = __esm({
    "public/js/ui/MapView.js"() {
      MapView = class {
        constructor(doc = document) {
          this.doc = doc;
          this.currentFacilities = [];
          this.mapInstance = null;
          this.markerLayer = null;
          this.routeLayer = null;
          this.cachedUserCoordinates = null;
          this.facilityMarkerById = /* @__PURE__ */ new Map();
          this.defaultCenter = [14.5995, 120.9842];
          this.defaultZoom = 11;
        }
        hasMapContainer() {
          return Boolean(this.doc.getElementById("google-map-container"));
        }
        initializeMapShell() {
          const container = this.doc.getElementById("google-map-container");
          if (!container) {
            return false;
          }
          const placeholder = container.querySelector(".map-placeholder");
          if (placeholder) {
            placeholder.remove();
          }
          const existing = this.doc.getElementById("facility-list-panel");
          if (existing) {
            existing.remove();
          }
          const map = this.ensureMapInstance(container);
          if (!map) {
            this.renderFallbackList([], "Leaflet map library failed to load. Showing list fallback.");
            return false;
          }
          map.setView(this.defaultCenter, this.defaultZoom);
          return true;
        }
        bindFilter(onFilter) {
          const input = this.doc.getElementById("map-search-input");
          const button = this.doc.getElementById("map-filter-button");
          if (!input || !button) {
            return;
          }
          button.addEventListener("click", () => {
            onFilter(input.value.trim());
          });
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onFilter(input.value.trim());
            }
          });
        }
        bindNearest(onNearest) {
          const button = this.doc.getElementById("map-nearest-button");
          if (!button) {
            return;
          }
          button.addEventListener("click", async () => {
            const originalLabel = button.innerHTML;
            button.disabled = true;
            button.classList.add("opacity-70", "cursor-not-allowed");
            button.innerHTML = "<i class='fas fa-spinner fa-spin mr-1'></i> Locating...";
            try {
              await onNearest();
            } finally {
              button.disabled = false;
              button.classList.remove("opacity-70", "cursor-not-allowed");
              button.innerHTML = originalLabel;
            }
          });
        }
        renderMarkers(facilities) {
          this.currentFacilities = Array.isArray(facilities) ? facilities : [];
          const container = this.doc.getElementById("google-map-container");
          if (!container) {
            return;
          }
          const placeholder = container.querySelector(".map-placeholder");
          if (placeholder) {
            placeholder.remove();
          }
          const existing = this.doc.getElementById("facility-list-panel");
          if (existing) {
            existing.remove();
          }
          const map = this.ensureMapInstance(container);
          if (!map || !this.markerLayer) {
            this.renderFallbackList(this.currentFacilities, "Leaflet map library failed to load. Showing list fallback.");
            return;
          }
          this.markerLayer.clearLayers();
          this.facilityMarkerById.clear();
          const bounds = [];
          const leaflet = window.L;
          this.currentFacilities.forEach((facility) => {
            const coordinates = this.readCoordinates(facility);
            if (!coordinates) {
              return;
            }
            const marker = leaflet.marker(coordinates, {
              icon: this.createFacilityIcon(facility.level)
            });
            marker.bindPopup(`
        <div class="text-sm" style="padding-right: 32px; min-width: 220px;">
          <p class="font-semibold text-slate-900 leading-tight">${facility.name}</p>
          <p class="text-xs uppercase tracking-wide text-teal-700 mt-1">${facility.level}</p>
          <p class="text-xs text-slate-600 mt-1">${facility.address ?? "Address unavailable"}</p>
          <p class="text-xs text-slate-700 mt-2"><span class="font-semibold">Offers:</span> ${this.formatFacilityServices(facility)}</p>
        </div>
      `);
            marker.on("click", () => {
              this.focusOnFacility(facility);
              this.openFacilityModal(facility);
            });
            marker.addTo(this.markerLayer);
            this.facilityMarkerById.set(facility.id, marker);
            bounds.push(coordinates);
          });
          if (bounds.length) {
            map.fitBounds(bounds, {
              padding: [40, 40],
              maxZoom: 14
            });
            return;
          }
          map.setView(this.defaultCenter, this.defaultZoom);
          this.renderFallbackList(this.currentFacilities, "Map coordinates are unavailable for these facilities.");
        }
        ensureMapInstance(container) {
          const leaflet = window.L;
          if (!leaflet || typeof leaflet.map !== "function") {
            return null;
          }
          let mapCanvas = this.doc.getElementById("leaflet-map-canvas");
          if (!mapCanvas) {
            mapCanvas = this.doc.createElement("div");
            mapCanvas.id = "leaflet-map-canvas";
            mapCanvas.className = "absolute inset-0 z-0";
            container.prepend(mapCanvas);
          }
          if (this.mapInstance) {
            this.mapInstance.invalidateSize();
            return this.mapInstance;
          }
          this.mapInstance = leaflet.map(mapCanvas, {
            zoomControl: true
          }).setView(this.defaultCenter, this.defaultZoom);
          leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
          }).addTo(this.mapInstance);
          this.markerLayer = leaflet.layerGroup().addTo(this.mapInstance);
          this.routeLayer = leaflet.layerGroup().addTo(this.mapInstance);
          return this.mapInstance;
        }
        renderFallbackList(facilities, message = "") {
          const container = this.doc.getElementById("google-map-container");
          if (!container) {
            return;
          }
          const panel = this.doc.createElement("div");
          panel.id = "facility-list-panel";
          panel.className = "absolute bottom-3 left-3 right-3 sm:left-auto sm:top-3 sm:w-96 z-[420] overflow-y-auto max-h-[60%] rounded-lg bg-white/95 shadow-xl p-3";
          if (message) {
            const note = this.doc.createElement("div");
            note.className = "bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-700 mb-3";
            note.textContent = message;
            panel.appendChild(note);
          }
          if (!facilities.length) {
            const empty = this.doc.createElement("div");
            empty.className = "bg-white rounded-lg border border-slate-200 p-4 text-sm text-gray-600";
            empty.textContent = "No facilities found for this filter.";
            panel.appendChild(empty);
            container.appendChild(panel);
            return;
          }
          facilities.forEach((facility) => {
            const card = this.doc.createElement("button");
            card.type = "button";
            card.className = "w-full text-left bg-white rounded-lg shadow p-4 mb-3 hover:ring-2 hover:ring-teal-500";
            card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-bold text-slate-900">${facility.name}</p>
            <p class="text-xs uppercase tracking-wide text-teal-700 mt-1">${facility.level}</p>
            <p class="text-sm text-gray-600 mt-2">${facility.address ?? "Address unavailable"}</p>
          </div>
          <span class="text-xs rounded-full px-2 py-1 bg-teal-100 text-teal-800">View</span>
        </div>
      `;
            card.addEventListener("click", () => {
              this.focusOnFacility(facility);
              this.openFacilityModal(facility);
            });
            panel.appendChild(card);
          });
          container.appendChild(panel);
        }
        readCoordinates(facility) {
          const latitude = Number(facility?.latitude);
          const longitude = Number(facility?.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
          }
          return [latitude, longitude];
        }
        createFacilityIcon(level) {
          const normalizedLevel = String(level ?? "").toLowerCase();
          let color = "#16a34a";
          let label = "P";
          if (normalizedLevel === "secondary") {
            color = "#d97706";
            label = "S";
          }
          if (normalizedLevel === "tertiary") {
            color = "#dc2626";
            label = "T";
          }
          return window.L.divIcon({
            className: "facility-marker-icon",
            html: `<span style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:${color};color:#fff;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 3px 12px rgba(15,23,42,.35)">${label}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
        }
        focusOnFacility(facility) {
          if (!this.mapInstance) {
            return;
          }
          const marker = this.facilityMarkerById.get(facility.id);
          if (marker) {
            this.mapInstance.setView(marker.getLatLng(), 14);
            marker.openPopup();
            return;
          }
          const coordinates = this.readCoordinates(facility);
          if (coordinates) {
            this.mapInstance.setView(coordinates, 14);
          }
        }
        clearRoute() {
          if (this.routeLayer) {
            this.routeLayer.clearLayers();
          }
        }
        findNearestFacilityFromCurrent() {
          if (!Array.isArray(this.currentFacilities) || !this.currentFacilities.length) {
            throw new Error("No facilities are loaded yet.");
          }
          const originCoordinates = this.cachedUserCoordinates;
          if (!originCoordinates) {
            throw new Error("Your location is not ready yet.");
          }
          let nearest = null;
          let nearestDistanceKm = Number.POSITIVE_INFINITY;
          this.currentFacilities.forEach((facility) => {
            const destinationCoordinates = this.readCoordinates(facility);
            if (!destinationCoordinates) {
              return;
            }
            const distanceKm = this.calculateDistanceKm(originCoordinates, destinationCoordinates);
            if (distanceKm < nearestDistanceKm) {
              nearestDistanceKm = distanceKm;
              nearest = facility;
            }
          });
          if (!nearest) {
            throw new Error("No facility with coordinates is available right now.");
          }
          return {
            facility: {
              ...nearest,
              distanceLabel: `${nearestDistanceKm.toFixed(1)} km`
            },
            distanceKm: nearestDistanceKm
          };
        }
        calculateDistanceKm(originCoordinates, destinationCoordinates) {
          const [originLatitude, originLongitude] = originCoordinates;
          const [destinationLatitude, destinationLongitude] = destinationCoordinates;
          const toRadians = (value) => value * Math.PI / 180;
          const earthRadiusKm = 6371;
          const latitudeDelta = toRadians(destinationLatitude - originLatitude);
          const longitudeDelta = toRadians(destinationLongitude - originLongitude);
          const originLatitudeRad = toRadians(originLatitude);
          const destinationLatitudeRad = toRadians(destinationLatitude);
          const haversine = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) + Math.cos(originLatitudeRad) * Math.cos(destinationLatitudeRad) * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);
          const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
          return earthRadiusKm * centralAngle;
        }
        async getCurrentUserCoordinates() {
          if (this.cachedUserCoordinates) {
            return this.cachedUserCoordinates;
          }
          if (!navigator.geolocation) {
            throw new Error("Geolocation is not supported in this browser.");
          }
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 12e3,
              maximumAge: 6e4
            });
          }).catch((error) => {
            if (error?.code === 1) {
              throw new Error("Location permission was denied. Enable location to show directions.");
            }
            if (error?.code === 3) {
              throw new Error("Unable to get your location in time. Please try again.");
            }
            throw new Error("Unable to determine your location.");
          });
          this.cachedUserCoordinates = [position.coords.latitude, position.coords.longitude];
          return this.cachedUserCoordinates;
        }
        formatDuration(seconds) {
          const totalMinutes = Math.max(1, Math.round(seconds / 60));
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          if (!hours) {
            return `${minutes} min`;
          }
          return `${hours}h ${minutes}m`;
        }
        async renderRouteToFacility(facility) {
          if (!this.mapInstance) {
            throw new Error("Map is not ready yet.");
          }
          const destinationCoordinates = this.readCoordinates(facility);
          if (!destinationCoordinates) {
            throw new Error("Directions preview unavailable because this facility has no coordinates.");
          }
          const originCoordinates = await this.getCurrentUserCoordinates();
          const [originLatitude, originLongitude] = originCoordinates;
          const [destinationLatitude, destinationLongitude] = destinationCoordinates;
          const routingUrl = `https://router.project-osrm.org/route/v1/driving/${originLongitude},${originLatitude};${destinationLongitude},${destinationLatitude}?overview=full&geometries=geojson`;
          const response = await fetch(routingUrl);
          if (!response.ok) {
            throw new Error("Unable to fetch route data right now.");
          }
          const payload = await response.json();
          const route = payload?.routes?.[0];
          const routeCoordinates = route?.geometry?.coordinates;
          if (!Array.isArray(routeCoordinates) || !routeCoordinates.length) {
            throw new Error("No route found for this facility.");
          }
          this.clearRoute();
          const routePath = routeCoordinates.map(([longitude, latitude]) => [latitude, longitude]);
          const routeLine = window.L.polyline(routePath, {
            color: "#0f766e",
            weight: 5,
            opacity: 0.9
          }).addTo(this.routeLayer);
          window.L.circleMarker(originCoordinates, {
            radius: 8,
            color: "#1d4ed8",
            weight: 3,
            fillColor: "#60a5fa",
            fillOpacity: 0.9
          }).bindTooltip("Your location", { permanent: false }).addTo(this.routeLayer);
          const destinationMarker = this.facilityMarkerById.get(facility.id);
          if (destinationMarker) {
            destinationMarker.openPopup();
          }
          this.mapInstance.fitBounds(routeLine.getBounds(), {
            padding: [40, 40],
            maxZoom: 15
          });
          const distanceKm = (route.distance / 1e3).toFixed(1);
          const durationLabel = this.formatDuration(route.duration);
          this.setMapFeedback(`Route ready: ${distanceKm} km \u2022 ${durationLabel} (driving estimate).`, false);
        }
        openFacilityModal(facility) {
          const modal = this.doc.getElementById("facility-info-modal");
          if (!modal) {
            return;
          }
          const levelBadge = modal.querySelector("span");
          const name = this.doc.getElementById("f-name");
          const address = this.doc.getElementById("f-addr");
          const phone = this.doc.getElementById("f-phone");
          const hours = this.doc.getElementById("f-hours");
          const services = this.doc.getElementById("f-services");
          const distance = this.doc.getElementById("f-dist");
          const profileButton = this.doc.getElementById("view-profile-button");
          const directionsButton = this.doc.getElementById("facility-directions-button");
          if (levelBadge) {
            levelBadge.textContent = `${facility.level} Hospital`;
          }
          if (name) {
            name.textContent = facility.name;
          }
          if (address) {
            address.textContent = facility.address ?? "Address unavailable";
          }
          if (phone) {
            phone.textContent = facility.contacts?.main ?? "No phone listed";
          }
          if (hours) {
            hours.textContent = facility.hours?.summary ?? "Hours unavailable";
          }
          if (services) {
            const serviceLabels = (facility.services ?? []).map((item) => item?.label).filter(Boolean);
            services.textContent = serviceLabels.length ? serviceLabels.join(", ") : "No service details listed.";
          }
          if (distance) {
            distance.textContent = facility.distanceLabel ?? "--";
          }
          if (profileButton) {
            profileButton.onclick = () => {
              window.location.href = `profile.html?id=${facility.id}`;
            };
          }
          if (directionsButton) {
            directionsButton.onclick = async () => {
              const originalLabel = directionsButton.innerHTML;
              directionsButton.disabled = true;
              directionsButton.classList.add("opacity-70", "cursor-not-allowed");
              directionsButton.innerHTML = "<i class='fas fa-spinner fa-spin mr-1'></i> Routing...";
              try {
                await this.renderRouteToFacility(facility);
                modal.classList.add("hidden");
              } catch (error) {
                this.setMapFeedback(error.message || "Directions failed to load.", true);
              } finally {
                directionsButton.disabled = false;
                directionsButton.classList.remove("opacity-70", "cursor-not-allowed");
                directionsButton.innerHTML = originalLabel;
              }
            };
          }
          modal.classList.remove("hidden");
        }
        setMapFeedback(message, isError) {
          const mapFeedback = this.doc.getElementById("map-feedback");
          if (!mapFeedback) {
            return;
          }
          mapFeedback.textContent = message;
          mapFeedback.classList.toggle("text-red-600", isError);
          mapFeedback.classList.toggle("text-teal-700", !isError);
        }
        formatFacilityServices(facility) {
          const serviceLabels = (facility?.services ?? []).map((item) => item?.label).filter(Boolean);
          if (!serviceLabels.length) {
            return "No service details listed";
          }
          return serviceLabels.slice(0, 3).join(", ");
        }
      };
    }
  });

  // public/js/controllers/AppController.js
  var AppController_exports = {};
  __export(AppController_exports, {
    AppController: () => AppController
  });
  var AppController;
  var init_AppController = __esm({
    "public/js/controllers/AppController.js"() {
      init_AppModel();
      init_LayoutView();
      init_ChatView();
      init_MapView();
      AppController = class {
        constructor() {
          this.model = new AppModel();
          this.layoutView = new LayoutView();
          this.chatView = new ChatView();
          this.mapView = new MapView();
          this.chatHistory = [];
          this.maxChatHistoryItems = 12;
          this.selectedAdminClaim = null;
          this.ownerFacility = null;
          this.telehealthFacilities = [];
        }
        async init() {
          if (this.mapView.hasMapContainer()) {
            this.mapView.initializeMapShell();
            this.showText("map-feedback", "Loading facilities...", false);
            await this.loadMapFacilities();
            await this.autoRouteFromChatRecommendation();
            this.mapView.bindFilter(async (searchTerm) => {
              await this.loadMapFacilities(searchTerm);
            });
            this.mapView.bindNearest(async () => {
              await this.findNearestFacility();
            });
          }
          if (document.getElementById("view-profile")) {
            await this.initProfilePage();
          }
          if (document.getElementById("view-telehealth")) {
            await this.initTelehealthPage();
          }
          if (document.getElementById("view-doctor")) {
            await this.initDoctorPage();
          }
          if (document.getElementById("owner-login-form")) {
            this.initOwnerLoginPage();
          }
          if (document.getElementById("admin-login-form")) {
            this.initAdminLoginPage();
          }
          if (document.getElementById("owner-claim-form")) {
            this.initOwnerClaimPage();
          }
          if (document.getElementById("view-owner-manage")) {
            await this.initOwnerManagePage();
          }
          if (document.getElementById("claims-list")) {
            await this.initAdminDashboardPage();
          }
        }
        toggleDrawer() {
          this.layoutView.toggleDrawer();
        }
        toggleChat() {
          this.chatView.toggleChat();
        }
        async sendChat() {
          const message = this.chatView.getInputMessage();
          if (!message) {
            return;
          }
          const historyForRequest = this.chatHistory.slice(-this.maxChatHistoryItems);
          this.chatView.appendUserMessage(message);
          this.chatView.clearInput();
          const loadingElement = this.chatView.showLoading();
          try {
            const reply = await this.model.sendChat(message, historyForRequest);
            this.chatView.hideLoading(loadingElement);
            this.chatView.appendAssistantMessage(reply);
            this.chatHistory.push({ role: "user", content: message });
            this.chatHistory.push({ role: "assistant", content: reply });
            if (this.chatHistory.length > this.maxChatHistoryItems) {
              this.chatHistory.splice(0, this.chatHistory.length - this.maxChatHistoryItems);
            }
            await this.handleChatRecommendation(reply);
          } catch (error) {
            this.chatView.hideLoading(loadingElement);
            this.chatView.appendAssistantMessage(error.message || "Unable to process chat request.");
            this.chatHistory.push({ role: "user", content: message });
            if (this.chatHistory.length > this.maxChatHistoryItems) {
              this.chatHistory.splice(0, this.chatHistory.length - this.maxChatHistoryItems);
            }
          }
        }
        async handleChatRecommendation(reply) {
          const triageLevel = this.extractTriageLevel(reply);
          if (!triageLevel) {
            return;
          }
          let facilityId = "";
          try {
            const facilities = await this.model.fetchFacilities();
            const approvedFacilities = (facilities ?? []).filter((facility) => String(facility?.status ?? "").toLowerCase() === "approved");
            const replyLower = String(reply ?? "").toLowerCase();
            const explicitFacility = approvedFacilities.find((facility) => {
              const name = String(facility?.name ?? "").trim().toLowerCase();
              return name && replyLower.includes(name);
            });
            if (explicitFacility?.id) {
              facilityId = explicitFacility.id;
            }
          } catch (error) {
            console.error("Unable to fetch facilities for triage redirect.", error);
          }
          const params = new URLSearchParams();
          params.set("chatTriage", "1");
          params.set("level", triageLevel);
          if (facilityId) {
            params.set("facilityId", facilityId);
          }
          window.location.href = `map.html?${params.toString()}`;
        }
        extractTriageLevel(reply) {
          const text = String(reply ?? "").toLowerCase();
          if (!text) {
            return null;
          }
          if (/(tertiary|emergency room|\ber\b|critical care)/i.test(text)) {
            return "tertiary";
          }
          if (/(secondary)/i.test(text)) {
            return "secondary";
          }
          if (/(primary|clinic|health center|rural health unit)/i.test(text)) {
            return "primary";
          }
          return null;
        }
        renderMapMarkers(facilities) {
          this.mapView.renderMarkers(facilities);
        }
        navigate(route) {
          if (!route) {
            return;
          }
          window.location.href = `${route}.html`;
        }
        delay(ms) {
          return new Promise((resolve) => {
            window.setTimeout(resolve, ms);
          });
        }
        async loadMapFacilities(searchTerm = "") {
          try {
            const facilities = await this.model.fetchFacilities(searchTerm);
            const approvedFacilities = (facilities ?? []).filter((facility) => String(facility?.status ?? "").toLowerCase() === "approved");
            this.renderMapMarkers(approvedFacilities);
            this.showText("map-feedback", "", false);
          } catch (error) {
            this.renderMapMarkers([]);
            this.showText("map-feedback", error.message || "Failed to load facilities.", true);
          }
        }
        normalizeFacilityLevel(level) {
          const normalizedLevel = String(level ?? "").trim().toLowerCase();
          if (["primary", "secondary", "tertiary"].includes(normalizedLevel)) {
            return normalizedLevel;
          }
          return null;
        }
        findNearestFromFacilities(facilities, originCoordinates) {
          if (!Array.isArray(facilities) || !facilities.length) {
            return null;
          }
          let nearestFacility = null;
          let nearestDistanceKm = Number.POSITIVE_INFINITY;
          facilities.forEach((facility) => {
            const destinationCoordinates = this.mapView.readCoordinates(facility);
            if (!destinationCoordinates) {
              return;
            }
            const distanceKm = this.mapView.calculateDistanceKm(originCoordinates, destinationCoordinates);
            if (distanceKm < nearestDistanceKm) {
              nearestDistanceKm = distanceKm;
              nearestFacility = {
                ...facility,
                distanceLabel: `${distanceKm.toFixed(1)} km`
              };
            }
          });
          return nearestFacility;
        }
        clearChatTriageParams() {
          const url = new URL(window.location.href);
          url.searchParams.delete("chatTriage");
          url.searchParams.delete("level");
          url.searchParams.delete("facilityId");
          const nextQuery = url.searchParams.toString();
          const nextUrl = `${url.pathname}${nextQuery ? `?${nextQuery}` : ""}${url.hash}`;
          window.history.replaceState({}, "", nextUrl);
        }
        async autoRouteFromChatRecommendation() {
          if (!this.mapView.hasMapContainer()) {
            return;
          }
          const params = new URLSearchParams(window.location.search);
          if (params.get("chatTriage") !== "1") {
            return;
          }
          const requestedFacilityId = params.get("facilityId");
          const requestedLevel = this.normalizeFacilityLevel(params.get("level"));
          const allFacilities = Array.isArray(this.mapView.currentFacilities) ? this.mapView.currentFacilities : [];
          if (!allFacilities.length) {
            this.showText("map-feedback", "No facilities available for triage routing.", true);
            this.clearChatTriageParams();
            return;
          }
          let candidateFacilities = allFacilities;
          if (requestedLevel) {
            candidateFacilities = allFacilities.filter((facility) => this.normalizeFacilityLevel(facility?.level) === requestedLevel);
          }
          let targetFacility = null;
          if (requestedFacilityId) {
            targetFacility = allFacilities.find((facility) => facility.id === requestedFacilityId) ?? null;
          }
          try {
            const originCoordinates = await this.mapView.getCurrentUserCoordinates();
            if (!targetFacility) {
              const nearestFacility = this.findNearestFromFacilities(candidateFacilities, originCoordinates);
              if (!nearestFacility) {
                throw new Error("No hospital matched the AI triage recommendation.");
              }
              targetFacility = nearestFacility;
            }
            if (!targetFacility.distanceLabel) {
              const destinationCoordinates = this.mapView.readCoordinates(targetFacility);
              if (destinationCoordinates) {
                const distanceKm = this.mapView.calculateDistanceKm(originCoordinates, destinationCoordinates);
                targetFacility = {
                  ...targetFacility,
                  distanceLabel: `${distanceKm.toFixed(1)} km`
                };
              }
            }
            this.mapView.focusOnFacility(targetFacility);
            this.mapView.openFacilityModal(targetFacility);
            await this.mapView.renderRouteToFacility(targetFacility);
            this.showText("map-feedback", `AI triage routed you to ${targetFacility.name}.`, false);
          } catch (error) {
            this.showText("map-feedback", error.message || "Unable to auto-route from AI recommendation.", true);
          } finally {
            this.clearChatTriageParams();
          }
        }
        async findNearestFacility() {
          try {
            if (!this.mapView.currentFacilities?.length) {
              await this.loadMapFacilities();
            }
            await this.mapView.getCurrentUserCoordinates();
            const nearest = this.mapView.findNearestFacilityFromCurrent();
            this.mapView.focusOnFacility(nearest.facility);
            this.mapView.openFacilityModal(nearest.facility);
            this.showText(
              "map-feedback",
              `Nearest hospital: ${nearest.facility.name} (${nearest.distanceKm.toFixed(1)} km).`,
              false
            );
          } catch (error) {
            this.showText("map-feedback", error.message || "Unable to find nearest hospital.", true);
          }
        }
        async initProfilePage() {
          const facilityId = new URLSearchParams(window.location.search).get("id") || "11111111-1111-1111-1111-111111111111";
          try {
            const facility = await this.model.fetchFacilityProfile(facilityId);
            if (!facility) {
              this.showText("profile-feedback", "Facility not found.", true);
              return;
            }
            this.bindProfileData(facility);
          } catch (error) {
            this.showText("profile-feedback", error.message || "Unable to load profile.", true);
          }
        }
        bindProfileData(facility) {
          this.showText("profile-name", facility.name);
          this.showText("profile-location", [facility.city, facility.province].filter(Boolean).join(", ") || "Location unavailable");
          this.showText("profile-level", `${facility.level} care`);
          this.showText("profile-status", facility.statusLabel || "DOH status unavailable");
          const servicesContainer = document.getElementById("profile-services");
          if (servicesContainer) {
            servicesContainer.innerHTML = "";
            (facility.services ?? []).forEach((service) => {
              const item = document.createElement("div");
              item.className = "flex items-center text-gray-700";
              item.innerHTML = `<i class="fas fa-check-circle text-teal-500 mr-2 w-5"></i> ${service.label}`;
              servicesContainer.appendChild(item);
            });
          }
          this.showText("profile-main-phone", facility.contacts?.main ?? "N/A");
          this.showText("profile-emergency-phone", facility.contacts?.emergency ?? "N/A");
          const hoursContainer = document.getElementById("profile-hours");
          if (hoursContainer) {
            hoursContainer.innerHTML = "";
            (facility.hours?.lines ?? ["Hours unavailable"]).forEach((line) => {
              const li = document.createElement("li");
              li.textContent = line;
              hoursContainer.appendChild(li);
            });
          }
        }
        initOwnerLoginPage() {
          const form = document.getElementById("owner-login-form");
          form?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const email = document.getElementById("owner-email")?.value?.trim() ?? "";
            const password = document.getElementById("owner-password")?.value ?? "";
            this.showText("owner-login-feedback", "Signing in...", false);
            try {
              await this.model.signInOwner(email, password);
              window.location.href = "owner-claim.html";
            } catch (error) {
              this.showText("owner-login-feedback", error.message || "Login failed.", true);
            }
          });
        }
        initAdminLoginPage() {
          const form = document.getElementById("admin-login-form");
          form?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const email = document.getElementById("admin-email")?.value?.trim() ?? "";
            const password = document.getElementById("admin-password")?.value ?? "";
            this.showText("admin-login-feedback", "Signing in...", false);
            try {
              await this.model.signInAdmin(email, password);
              window.location.href = "admin-dashboard.html";
            } catch (error) {
              this.showText("admin-login-feedback", error.message || "Login failed.", true);
            }
          });
        }
        initOwnerClaimPage() {
          const form = document.getElementById("owner-claim-form");
          form?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const searchInput = document.getElementById("claim-facility-search");
            const fileInput = document.getElementById("claim-document-file");
            const searchTerm = searchInput?.value?.trim() ?? "";
            const file = fileInput?.files?.[0] ?? null;
            if (!searchTerm) {
              this.showText("owner-claim-feedback", "Enter a facility name first.", true);
              return;
            }
            this.showText("owner-claim-feedback", "Submitting claim...", false);
            try {
              const matches = await this.model.searchClaimableFacilities(searchTerm);
              if (!matches.length) {
                this.showText("owner-claim-feedback", "No claimable facility matched your search.", true);
                return;
              }
              await this.model.submitClaim(
                {
                  facilityId: matches[0].id
                },
                file
              );
              this.showText("owner-claim-feedback", "Claim submitted for DOH review.", false);
            } catch (error) {
              this.showText("owner-claim-feedback", error.message || "Unable to submit claim.", true);
            }
          });
        }
        async initOwnerManagePage() {
          try {
            this.ownerFacility = await this.model.fetchOwnerFacility();
            if (!this.ownerFacility) {
              this.showText("owner-manage-feedback", "No approved facility linked to your account yet.", true);
              return;
            }
            this.showText("owner-manage-feedback", `Managing: ${this.ownerFacility.name}`, false);
            const mainPhoneInput = document.getElementById("owner-phone-input");
            const hoursInput = document.getElementById("owner-hours-input");
            if (mainPhoneInput) {
              mainPhoneInput.value = this.ownerFacility.contacts?.main ?? "";
            }
            if (hoursInput) {
              hoursInput.value = this.ownerFacility.hours?.weekdayText ?? "08:00 - 17:00";
            }
            const serviceMap = this.ownerFacility.services?.reduce((acc, service) => {
              acc[service.code] = true;
              return acc;
            }, {});
            document.querySelectorAll("[data-service-code]").forEach((checkbox) => {
              checkbox.checked = Boolean(serviceMap?.[checkbox.dataset.serviceCode]);
            });
            document.getElementById("owner-save-details")?.addEventListener("click", async () => {
              await this.saveOwnerFacilityUpdates(true);
            });
            document.getElementById("owner-save-services")?.addEventListener("click", async () => {
              await this.saveOwnerFacilityUpdates(false);
            });
            document.getElementById("owner-save-telehealth")?.addEventListener("click", async () => {
              await this.saveOwnerFacilityUpdates(false);
            });
          } catch (error) {
            this.showText("owner-manage-feedback", error.message || "Unable to load owner dashboard.", true);
          }
        }
        async saveOwnerFacilityUpdates(includeDetails) {
          if (!this.ownerFacility?.id) {
            return;
          }
          const hoursValue = document.getElementById("owner-hours-input")?.value?.trim() ?? "";
          const serviceUpdates = {};
          document.querySelectorAll("[data-service-code]").forEach((checkbox) => {
            serviceUpdates[checkbox.dataset.serviceCode] = checkbox.checked;
          });
          const payload = {
            facilityId: this.ownerFacility.id,
            serviceUpdates
          };
          if (includeDetails) {
            payload.phoneNumber = document.getElementById("owner-phone-input")?.value?.trim() ?? "";
            const parsedHours = this.parseHourRange(hoursValue);
            payload.opensAt = parsedHours.opensAt;
            payload.closesAt = parsedHours.closesAt;
          }
          this.showText("owner-manage-feedback", "Saving updates...", false);
          try {
            await this.model.updateOwnerFacility(payload);
            this.showText("owner-manage-feedback", "Facility updates saved.", false);
          } catch (error) {
            this.showText("owner-manage-feedback", error.message || "Unable to save updates.", true);
          }
        }
        async initTelehealthPage() {
          const container = document.getElementById("telehealth-facility-list");
          if (!container) {
            return;
          }
          this.showText("telehealth-facilities-feedback", "Loading telehealth facilities...", false);
          try {
            const facilities = await this.model.fetchFacilities();
            const approvedFacilities = (facilities ?? []).filter((facility) => String(facility?.status ?? "").toLowerCase() === "approved");
            this.telehealthFacilities = approvedFacilities.map((facility) => this.mapTelehealthFacilityAvailability(facility));
            const filterSelect = document.getElementById("telehealth-offer-filter");
            filterSelect?.addEventListener("change", () => {
              this.renderTelehealthFacilities(filterSelect.value);
            });
            this.renderTelehealthFacilities(filterSelect?.value ?? "all");
            this.showText("telehealth-facilities-feedback", `${this.telehealthFacilities.length} hospital(s) available.`, false);
          } catch (error) {
            this.telehealthFacilities = [];
            container.innerHTML = "";
            this.showText("telehealth-facilities-feedback", error.message || "Unable to load telehealth facilities.", true);
          }
        }
        mapTelehealthFacilityAvailability(facility) {
          const offersVirtualConsultation = this.hasFacilityService(facility, "telemedicine");
          const offersOnlineBooking = this.hasFacilityService(facility, "online_booking");
          return {
            ...facility,
            offersVirtualConsultation,
            offersOnlineBooking
          };
        }
        hasFacilityService(facility, serviceCode) {
          const services = Array.isArray(facility?.services) ? facility.services : [];
          return services.some((item) => String(item?.code ?? "").toLowerCase() === serviceCode);
        }
        renderTelehealthFacilities(filter = "all") {
          const container = document.getElementById("telehealth-facility-list");
          if (!container) {
            return;
          }
          container.innerHTML = "";
          const filtered = this.telehealthFacilities.filter((facility) => {
            if (filter === "both") {
              return facility.offersVirtualConsultation && facility.offersOnlineBooking;
            }
            if (filter === "virtual_consultation") {
              return facility.offersVirtualConsultation;
            }
            if (filter === "online_booking") {
              return facility.offersOnlineBooking;
            }
            return facility.offersVirtualConsultation || facility.offersOnlineBooking;
          });
          if (!filtered.length) {
            const empty = document.createElement("div");
            empty.className = "col-span-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-gray-600";
            empty.textContent = "No hospitals match this telehealth filter right now.";
            container.appendChild(empty);
            return;
          }
          filtered.forEach((facility) => {
            const card = document.createElement("article");
            card.className = "bg-slate-50 border border-slate-200 rounded-lg p-4";
            const heading = document.createElement("h4");
            heading.className = "font-semibold text-slate-900";
            heading.textContent = facility.name;
            card.appendChild(heading);
            const location = document.createElement("p");
            location.className = "text-sm text-gray-600 mt-1";
            location.textContent = [facility.city, facility.province].filter(Boolean).join(", ") || "Location unavailable";
            card.appendChild(location);
            const badges = document.createElement("div");
            badges.className = "flex flex-wrap gap-2 mt-3";
            const virtualBadge = document.createElement("span");
            virtualBadge.className = facility.offersVirtualConsultation ? "inline-flex items-center px-2 py-1 rounded-full text-xs bg-teal-100 text-teal-800" : "inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600";
            virtualBadge.textContent = facility.offersVirtualConsultation ? "Virtual consultation available" : "No virtual consultation";
            badges.appendChild(virtualBadge);
            const bookingBadge = document.createElement("span");
            bookingBadge.className = facility.offersOnlineBooking ? "inline-flex items-center px-2 py-1 rounded-full text-xs bg-teal-100 text-teal-800" : "inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600";
            bookingBadge.textContent = facility.offersOnlineBooking ? "Online booking available" : "No online booking";
            badges.appendChild(bookingBadge);
            card.appendChild(badges);
            const actions = document.createElement("div");
            actions.className = "mt-4 flex flex-wrap gap-2";
            const doctorUrlBase = `doctor.html?facilityId=${encodeURIComponent(facility.id)}&facilityName=${encodeURIComponent(facility.name)}`;
            const virtualLink = document.createElement("a");
            virtualLink.className = facility.offersVirtualConsultation ? "inline-flex items-center px-3 py-2 text-sm rounded bg-teal-600 text-white hover:bg-teal-700" : "inline-flex items-center px-3 py-2 text-sm rounded bg-gray-200 text-gray-500 cursor-not-allowed";
            virtualLink.textContent = facility.offersVirtualConsultation ? "Request Virtual Consultation" : "Virtual Consultation Unavailable";
            if (facility.offersVirtualConsultation) {
              virtualLink.href = `${doctorUrlBase}&appointmentType=virtual_consultation`;
            }
            actions.appendChild(virtualLink);
            const bookingLink = document.createElement("a");
            bookingLink.className = facility.offersOnlineBooking ? "inline-flex items-center px-3 py-2 text-sm rounded border border-teal-600 text-teal-700 hover:bg-teal-50" : "inline-flex items-center px-3 py-2 text-sm rounded border border-gray-200 text-gray-500 cursor-not-allowed";
            bookingLink.textContent = facility.offersOnlineBooking ? "Book Online Appointment" : "Online Booking Unavailable";
            if (facility.offersOnlineBooking) {
              bookingLink.href = `${doctorUrlBase}&appointmentType=online_appointment`;
            }
            actions.appendChild(bookingLink);
            card.appendChild(actions);
            container.appendChild(card);
          });
        }
        async initDoctorPage() {
          const params = new URLSearchParams(window.location.search);
          const facilityId = params.get("facilityId");
          const requestedAppointmentType = params.get("appointmentType");
          const fallbackFacilityName = params.get("facilityName") || "General Telehealth Facility";
          let selectedFacility = null;
          if (facilityId) {
            try {
              const facility = await this.model.fetchFacilityProfile(facilityId);
              if (facility && String(facility.status ?? "").toLowerCase() === "approved") {
                selectedFacility = this.mapTelehealthFacilityAvailability(facility);
              }
            } catch (error) {
              this.showText("doctor-feedback", error.message || "Unable to load selected facility.", true);
            }
          }
          const facilityName = selectedFacility?.name || fallbackFacilityName;
          this.showText("doctor-facility-name", facilityName, false);
          const offersVirtualConsultation = selectedFacility ? selectedFacility.offersVirtualConsultation : true;
          const offersOnlineBooking = selectedFacility ? selectedFacility.offersOnlineBooking : true;
          const appointmentTypeInput = document.getElementById("doctor-appointment-type");
          const bookingResult = document.getElementById("doctor-booking-result");
          if (bookingResult) {
            bookingResult.classList.add("hidden");
          }
          this.setDoctorCapabilityState(
            "doctor-virtual-status",
            offersVirtualConsultation,
            "Virtual consultation enabled",
            "Virtual consultation not enabled for this facility"
          );
          this.setDoctorCapabilityState(
            "doctor-booking-status",
            offersOnlineBooking,
            "Online booking enabled",
            "Online booking not enabled for this facility"
          );
          this.toggleDoctorAppointmentOption(appointmentTypeInput, "virtual_consultation", offersVirtualConsultation);
          this.toggleDoctorAppointmentOption(appointmentTypeInput, "online_appointment", offersOnlineBooking);
          let initialAppointmentType = ["virtual_consultation", "online_appointment"].includes(requestedAppointmentType) ? requestedAppointmentType : appointmentTypeInput?.value;
          if (initialAppointmentType === "virtual_consultation" && !offersVirtualConsultation && offersOnlineBooking) {
            initialAppointmentType = "online_appointment";
          }
          if (initialAppointmentType === "online_appointment" && !offersOnlineBooking && offersVirtualConsultation) {
            initialAppointmentType = "virtual_consultation";
          }
          if (appointmentTypeInput && initialAppointmentType) {
            appointmentTypeInput.value = initialAppointmentType;
          }
          this.syncDoctorAppointmentFields(appointmentTypeInput?.value || "virtual_consultation");
          appointmentTypeInput?.addEventListener("change", () => {
            this.syncDoctorAppointmentFields(appointmentTypeInput.value);
          });
          const dateInput = document.getElementById("doctor-preferred-date");
          if (dateInput) {
            dateInput.min = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          }
          const virtualButton = document.getElementById("doctor-virtual-request");
          if (virtualButton && !offersVirtualConsultation) {
            virtualButton.disabled = true;
            virtualButton.classList.add("opacity-60", "cursor-not-allowed");
          }
          document.getElementById("doctor-virtual-request")?.addEventListener("click", () => {
            if (!offersVirtualConsultation) {
              this.showText("doctor-feedback", "Virtual consultation is disabled for this facility.", true);
              return;
            }
            this.showText("doctor-feedback", `Virtual consultation started for ${facilityName || "selected facility"}.`, false);
          });
          document.getElementById("doctor-booking-form")?.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (!offersOnlineBooking) {
              const selectedType = document.getElementById("doctor-appointment-type")?.value;
              if (selectedType === "online_appointment") {
                this.showText("doctor-feedback", "Online booking is disabled for this facility.", true);
                return;
              }
            }
            if (!offersVirtualConsultation) {
              const selectedType = document.getElementById("doctor-appointment-type")?.value;
              if (selectedType === "virtual_consultation") {
                this.showText("doctor-feedback", "Virtual consultation is disabled for this facility.", true);
                return;
              }
            }
            if (!selectedFacility?.id) {
              this.showText("doctor-feedback", "Select a hospital from Telehealth page first to continue booking.", true);
              return;
            }
            try {
              const payload = this.collectDoctorAppointmentPayload(selectedFacility.id);
              this.showText("doctor-feedback", "Submitting appointment booking...", false);
              const response = await this.model.createTelehealthAppointment(payload);
              const appointment = response?.appointment;
              if (!appointment?.appointmentReference) {
                throw new Error("Appointment booking failed. Please try again.");
              }
              this.renderDoctorBookingResult(appointment);
              this.showText(
                "doctor-feedback",
                `Booking confirmed. Reference: ${appointment.appointmentReference}.`,
                false
              );
              event.currentTarget.reset();
              if (appointmentTypeInput) {
                appointmentTypeInput.value = payload.appointmentType;
                this.syncDoctorAppointmentFields(appointmentTypeInput.value);
              }
            } catch (error) {
              this.showText("doctor-feedback", error.message || "Unable to submit appointment booking.", true);
            }
          });
        }
        setDoctorCapabilityState(elementId, enabled, enabledText, disabledText) {
          const element = document.getElementById(elementId);
          if (!element) {
            return;
          }
          element.textContent = enabled ? enabledText : disabledText;
          element.className = enabled ? "inline-flex items-center px-2 py-1 rounded-full text-xs bg-teal-100 text-teal-800" : "inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600";
        }
        toggleDoctorAppointmentOption(selectElement, optionValue, enabled) {
          if (!selectElement) {
            return;
          }
          const option = Array.from(selectElement.options).find((item) => item.value === optionValue);
          if (!option) {
            return;
          }
          option.disabled = !enabled;
        }
        syncDoctorAppointmentFields(appointmentType) {
          const virtualFields = document.getElementById("doctor-virtual-fields");
          const onlineFields = document.getElementById("doctor-online-fields");
          const preferredChannelInput = document.getElementById("doctor-preferred-channel");
          const departmentInput = document.getElementById("doctor-department");
          const isVirtual = appointmentType === "virtual_consultation";
          if (virtualFields) {
            virtualFields.classList.toggle("hidden", !isVirtual);
          }
          if (onlineFields) {
            onlineFields.classList.toggle("hidden", isVirtual);
          }
          if (preferredChannelInput) {
            preferredChannelInput.required = isVirtual;
          }
          if (departmentInput) {
            departmentInput.required = !isVirtual;
          }
        }
        collectDoctorAppointmentPayload(facilityId) {
          const appointmentType = document.getElementById("doctor-appointment-type")?.value;
          const payload = {
            facilityId,
            appointmentType,
            patientFullName: document.getElementById("doctor-patient-name")?.value?.trim() ?? "",
            patientAge: Number(document.getElementById("doctor-patient-age")?.value ?? 0),
            patientSex: document.getElementById("doctor-patient-sex")?.value ?? "",
            patientContactNumber: document.getElementById("doctor-patient-contact")?.value?.trim() ?? "",
            patientEmail: document.getElementById("doctor-patient-email")?.value?.trim() ?? "",
            patientAddress: document.getElementById("doctor-patient-address")?.value?.trim() ?? "",
            chiefComplaint: document.getElementById("doctor-chief-complaint")?.value?.trim() ?? "",
            existingConditions: document.getElementById("doctor-existing-conditions")?.value?.trim() ?? "",
            preferredChannel: document.getElementById("doctor-preferred-channel")?.value ?? "",
            department: document.getElementById("doctor-department")?.value?.trim() ?? "",
            preferredDate: document.getElementById("doctor-preferred-date")?.value ?? "",
            preferredTime: document.getElementById("doctor-preferred-time")?.value ?? "",
            emergencyContactName: document.getElementById("doctor-emergency-name")?.value?.trim() ?? "",
            emergencyContactNumber: document.getElementById("doctor-emergency-number")?.value?.trim() ?? "",
            consentAccepted: Boolean(document.getElementById("doctor-consent")?.checked)
          };
          if (!payload.patientFullName || !payload.patientContactNumber || !payload.patientEmail) {
            throw new Error("Please complete patient full name, contact number, and email.");
          }
          if (!["virtual_consultation", "online_appointment"].includes(appointmentType)) {
            throw new Error("Select a valid appointment type.");
          }
          if (!Number.isFinite(payload.patientAge) || payload.patientAge < 1 || payload.patientAge > 130) {
            throw new Error("Enter a valid patient age.");
          }
          if (!payload.chiefComplaint) {
            throw new Error("Chief complaint is required.");
          }
          if (!payload.preferredDate || !payload.preferredTime) {
            throw new Error("Preferred schedule is required.");
          }
          if (!payload.emergencyContactName || !payload.emergencyContactNumber) {
            throw new Error("Emergency contact name and number are required.");
          }
          if (!payload.consentAccepted) {
            throw new Error("Consent is required before booking.");
          }
          if (appointmentType === "virtual_consultation" && !payload.preferredChannel) {
            throw new Error("Preferred virtual channel is required for virtual consultation.");
          }
          if (appointmentType === "online_appointment" && !payload.department) {
            throw new Error("Department is required for online appointment booking.");
          }
          return payload;
        }
        renderDoctorBookingResult(appointment) {
          const resultRoot = document.getElementById("doctor-booking-result");
          const reference = document.getElementById("doctor-booking-reference");
          const stepsContainer = document.getElementById("doctor-dayof-steps");
          if (!resultRoot || !reference || !stepsContainer) {
            return;
          }
          reference.textContent = `Reference ${appointment.appointmentReference} \u2022 ${appointment.preferredDate} ${appointment.preferredTime}`;
          stepsContainer.innerHTML = "";
          (appointment.dayOfProcessSteps ?? []).forEach((step) => {
            const li = document.createElement("li");
            li.textContent = step;
            stepsContainer.appendChild(li);
          });
          resultRoot.classList.remove("hidden");
        }
        async initAdminDashboardPage() {
          try {
            const claims = await this.model.fetchAdminClaims();
            this.renderAdminClaims(claims);
            document.getElementById("admin-approve-button")?.addEventListener("click", async () => {
              await this.reviewSelectedClaim("approved");
            });
            document.getElementById("admin-reject-button")?.addEventListener("click", async () => {
              await this.reviewSelectedClaim("rejected");
            });
          } catch (error) {
            this.showText("admin-dashboard-feedback", error.message || "Unable to load admin queue.", true);
          }
        }
        renderAdminClaims(claims) {
          const list = document.getElementById("claims-list");
          if (!list) {
            return;
          }
          list.innerHTML = "";
          if (!claims.length) {
            list.innerHTML = "<li class='px-4 py-4 text-sm text-gray-600'>No pending claims.</li>";
            return;
          }
          claims.forEach((claim) => {
            const li = document.createElement("li");
            li.innerHTML = `
        <div class="px-4 py-4 sm:px-6 flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-teal-600 truncate">${claim.facilityName}</p>
            <p class="mt-2 flex items-center text-sm text-gray-500"><i class="fas fa-user mr-1.5"></i> ${claim.ownerDisplay}</p>
          </div>
          <div class="flex space-x-2">
            <button class="px-3 py-1 bg-yellow-100 text-yellow-800 rounded font-medium text-sm hover:bg-yellow-200" data-review-claim-id="${claim.id}">Review Claim</button>
          </div>
        </div>
      `;
            list.appendChild(li);
          });
          list.querySelectorAll("[data-review-claim-id]").forEach((button) => {
            button.addEventListener("click", () => {
              const claim = claims.find((item) => item.id === button.dataset.reviewClaimId);
              if (!claim) {
                return;
              }
              this.selectedAdminClaim = claim;
              this.showText("modal-title", `Review Documents: ${claim.facilityName}`);
              this.showText("admin-modal-docs", claim.documentSummary || "No documents uploaded");
              document.getElementById("admin-review-modal")?.classList.remove("hidden");
            });
          });
        }
        async reviewSelectedClaim(decision) {
          if (!this.selectedAdminClaim?.id) {
            return;
          }
          try {
            await this.model.adminReviewClaim(this.selectedAdminClaim.id, decision, "Reviewed via dashboard");
            this.showText("admin-dashboard-feedback", `Claim ${decision}.`, false);
            document.getElementById("admin-review-modal")?.classList.add("hidden");
            this.selectedAdminClaim = null;
            const claims = await this.model.fetchAdminClaims();
            this.renderAdminClaims(claims);
          } catch (error) {
            this.showText("admin-dashboard-feedback", error.message || "Unable to update claim.", true);
          }
        }
        parseHourRange(text) {
          const parts = text.split("-").map((part) => part.trim());
          if (parts.length !== 2) {
            return {
              opensAt: "08:00",
              closesAt: "17:00"
            };
          }
          return {
            opensAt: this.normalizeHour(parts[0]),
            closesAt: this.normalizeHour(parts[1])
          };
        }
        normalizeHour(value) {
          const twelveHour = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
          if (!twelveHour) {
            const twentyFour = value.match(/^(\d{1,2}):(\d{2})$/);
            if (twentyFour) {
              return `${twentyFour[1].padStart(2, "0")}:${twentyFour[2]}`;
            }
            return "08:00";
          }
          let hours = Number(twelveHour[1]);
          const minutes = twelveHour[2];
          const meridian = twelveHour[3].toUpperCase();
          if (meridian === "PM" && hours !== 12) {
            hours += 12;
          }
          if (meridian === "AM" && hours === 12) {
            hours = 0;
          }
          return `${String(hours).padStart(2, "0")}:${minutes}`;
        }
        showText(elementId, text, isError = false) {
          const element = document.getElementById(elementId);
          if (!element) {
            return;
          }
          element.textContent = text;
          element.classList.toggle("text-red-600", isError);
          element.classList.toggle("text-teal-700", !isError);
        }
      };
    }
  });

  // public/js/app.js
  var require_app = __commonJS({
    "public/js/app.js"() {
      var appController = null;
      var getDrawer = () => document.getElementById("mobile-drawer");
      var getChatRoot = () => document.getElementById("ai-chat");
      var getChatWindow = () => document.getElementById("ai-chat-window");
      var isDrawerOpen = () => {
        const drawer = getDrawer();
        return Boolean(drawer && !drawer.classList.contains("hidden"));
      };
      var isChatOpen = () => {
        const chatWindow = getChatWindow();
        return Boolean(chatWindow && !chatWindow.classList.contains("hidden"));
      };
      var syncMobileLayers = () => {
        const chatRoot = getChatRoot();
        if (!chatRoot) {
          return;
        }
        if (isDrawerOpen()) {
          chatRoot.style.pointerEvents = "none";
          chatRoot.style.opacity = "0";
          return;
        }
        chatRoot.style.pointerEvents = "";
        chatRoot.style.opacity = "";
      };
      var fallbackToggleDrawer = () => {
        const drawer = getDrawer();
        if (drawer) {
          drawer.classList.toggle("hidden");
        }
        syncMobileLayers();
      };
      var fallbackToggleChat = () => {
        const chatWindow = getChatWindow();
        if (!chatWindow) {
          return;
        }
        const isHidden = chatWindow.classList.contains("hidden");
        if (isHidden) {
          chatWindow.classList.remove("hidden");
          chatWindow.classList.add("flex");
          return;
        }
        chatWindow.classList.add("hidden");
        chatWindow.classList.remove("flex");
      };
      var closeChatIfOpen = () => {
        if (!isChatOpen()) {
          return;
        }
        if (appController && typeof appController.toggleChat === "function") {
          appController.toggleChat();
          return;
        }
        fallbackToggleChat();
      };
      window.toggleDrawer = () => {
        const openingDrawer = !isDrawerOpen();
        if (openingDrawer) {
          closeChatIfOpen();
        }
        if (appController && typeof appController.toggleDrawer === "function") {
          appController.toggleDrawer();
        } else {
          fallbackToggleDrawer();
        }
        syncMobileLayers();
      };
      window.toggleChat = () => {
        if (isDrawerOpen()) {
          window.toggleDrawer();
        }
        if (appController && typeof appController.toggleChat === "function") {
          appController.toggleChat();
        } else {
          fallbackToggleChat();
        }
      };
      window.sendChat = () => {
        if (appController && typeof appController.sendChat === "function") {
          appController.sendChat();
          return;
        }
      };
      window.renderMapMarkers = (facilities) => {
        if (appController && typeof appController.renderMapMarkers === "function") {
          appController.renderMapMarkers(facilities);
        }
      };
      window.navigate = (route) => {
        if (appController && typeof appController.navigate === "function") {
          appController.navigate(route);
          return;
        }
        if (!route) {
          return;
        }
        const target = route.endsWith(".html") ? route : `${route}.html`;
        window.location.href = target;
      };
      var initApp = async () => {
        const drawer = getDrawer();
        if (drawer) {
          drawer.addEventListener("click", (event) => {
            if (event.target === drawer && isDrawerOpen()) {
              window.toggleDrawer();
            }
          });
          drawer.querySelectorAll("a[href]").forEach((link) => {
            link.addEventListener("click", () => {
              if (isDrawerOpen()) {
                window.toggleDrawer();
              }
            });
          });
        }
        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && isDrawerOpen()) {
            window.toggleDrawer();
          }
        });
        try {
          const module2 = await Promise.resolve().then(() => (init_AppController(), AppController_exports));
          appController = new module2.AppController();
          await appController.init();
        } catch (error) {
          console.error("App controller failed to initialize.", error);
          const mapFeedback = document.getElementById("map-feedback");
          if (mapFeedback) {
            mapFeedback.textContent = "Map app failed to initialize. Check internet access for external libraries and refresh the page.";
            mapFeedback.classList.add("text-red-600");
            mapFeedback.classList.remove("text-teal-700");
          }
        }
        syncMobileLayers();
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initApp);
      } else {
        initApp();
      }
    }
  });
  require_app();
})();
