import { AppModel } from "../models/AppModel.js";
import { LayoutView } from "../ui/LayoutView.js";
import { ChatView } from "../ui/ChatView.js";
import { MapView } from "../ui/MapView.js";

export class AppController {
  constructor() {
    this.model = new AppModel();
    this.layoutView = new LayoutView();
    this.chatView = new ChatView();
    this.mapView = new MapView();
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

    this.chatView.appendUserMessage(message);
    this.chatView.clearInput();
    const loadingElement = this.chatView.showLoading();

    try {
      const reply = await this.model.sendChat(message);
      this.chatView.hideLoading(loadingElement);
      this.chatView.appendAssistantMessage(reply);
      await this.handleChatRecommendation(reply);
    } catch (error) {
      this.chatView.hideLoading(loadingElement);
      this.chatView.appendAssistantMessage(error.message || "Unable to process chat request.");
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
          distanceLabel: `${distanceKm.toFixed(1)} km`,
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
            distanceLabel: `${distanceKm.toFixed(1)} km`,
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
        false,
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
            facilityId: matches[0].id,
          },
          file,
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
      serviceUpdates,
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
      offersOnlineBooking,
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
      virtualBadge.className = facility.offersVirtualConsultation
        ? "inline-flex items-center px-2 py-1 rounded-full text-xs bg-teal-100 text-teal-800"
        : "inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600";
      virtualBadge.textContent = facility.offersVirtualConsultation ? "Virtual consultation available" : "No virtual consultation";
      badges.appendChild(virtualBadge);

      const bookingBadge = document.createElement("span");
      bookingBadge.className = facility.offersOnlineBooking
        ? "inline-flex items-center px-2 py-1 rounded-full text-xs bg-teal-100 text-teal-800"
        : "inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600";
      bookingBadge.textContent = facility.offersOnlineBooking ? "Online booking available" : "No online booking";
      badges.appendChild(bookingBadge);

      card.appendChild(badges);

      const actions = document.createElement("div");
      actions.className = "mt-4 flex flex-wrap gap-2";

      const doctorUrlBase = `doctor.html?facilityId=${encodeURIComponent(facility.id)}&facilityName=${encodeURIComponent(facility.name)}`;
      const virtualLink = document.createElement("a");
      virtualLink.className = facility.offersVirtualConsultation
        ? "inline-flex items-center px-3 py-2 text-sm rounded bg-teal-600 text-white hover:bg-teal-700"
        : "inline-flex items-center px-3 py-2 text-sm rounded bg-gray-200 text-gray-500 cursor-not-allowed";
      virtualLink.textContent = facility.offersVirtualConsultation ? "Request Virtual Consultation" : "Virtual Consultation Unavailable";
      if (facility.offersVirtualConsultation) {
        virtualLink.href = `${doctorUrlBase}&appointmentType=virtual_consultation`;
      }
      actions.appendChild(virtualLink);

      const bookingLink = document.createElement("a");
      bookingLink.className = facility.offersOnlineBooking
        ? "inline-flex items-center px-3 py-2 text-sm rounded border border-teal-600 text-teal-700 hover:bg-teal-50"
        : "inline-flex items-center px-3 py-2 text-sm rounded border border-gray-200 text-gray-500 cursor-not-allowed";
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
      "Virtual consultation not enabled for this facility",
    );
    this.setDoctorCapabilityState(
      "doctor-booking-status",
      offersOnlineBooking,
      "Online booking enabled",
      "Online booking not enabled for this facility",
    );

    this.toggleDoctorAppointmentOption(appointmentTypeInput, "virtual_consultation", offersVirtualConsultation);
    this.toggleDoctorAppointmentOption(appointmentTypeInput, "online_appointment", offersOnlineBooking);

    let initialAppointmentType = ["virtual_consultation", "online_appointment"].includes(requestedAppointmentType)
      ? requestedAppointmentType
      : appointmentTypeInput?.value;

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
      dateInput.min = new Date().toISOString().split("T")[0];
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
          false,
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
    element.className = enabled
      ? "inline-flex items-center px-2 py-1 rounded-full text-xs bg-teal-100 text-teal-800"
      : "inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600";
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
      consentAccepted: Boolean(document.getElementById("doctor-consent")?.checked),
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

    reference.textContent = `Reference ${appointment.appointmentReference} • ${appointment.preferredDate} ${appointment.preferredTime}`;
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
        closesAt: "17:00",
      };
    }

    return {
      opensAt: this.normalizeHour(parts[0]),
      closesAt: this.normalizeHour(parts[1]),
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
}
