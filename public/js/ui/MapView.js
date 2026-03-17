export class MapView {
  constructor(doc = document) {
    this.doc = doc;
    this.currentFacilities = [];
    this.mapInstance = null;
    this.markerLayer = null;
    this.routeLayer = null;
    this.cachedUserCoordinates = null;
    this.facilityMarkerById = new Map();
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
        icon: this.createFacilityIcon(facility.level),
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
        maxZoom: 14,
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
      zoomControl: true,
    }).setView(this.defaultCenter, this.defaultZoom);

    leaflet
      .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      })
      .addTo(this.mapInstance);

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
      iconAnchor: [15, 15],
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
        distanceLabel: `${nearestDistanceKm.toFixed(1)} km`,
      },
      distanceKm: nearestDistanceKm,
    };
  }

  calculateDistanceKm(originCoordinates, destinationCoordinates) {
    const [originLatitude, originLongitude] = originCoordinates;
    const [destinationLatitude, destinationLongitude] = destinationCoordinates;
    const toRadians = (value) => (value * Math.PI) / 180;

    const earthRadiusKm = 6371;
    const latitudeDelta = toRadians(destinationLatitude - originLatitude);
    const longitudeDelta = toRadians(destinationLongitude - originLongitude);
    const originLatitudeRad = toRadians(originLatitude);
    const destinationLatitudeRad = toRadians(destinationLatitude);

    const haversine =
      Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
      Math.cos(originLatitudeRad) * Math.cos(destinationLatitudeRad) *
      Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);

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
        timeout: 12000,
        maximumAge: 60000,
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
      opacity: 0.9,
    }).addTo(this.routeLayer);

    window.L.circleMarker(originCoordinates, {
      radius: 8,
      color: "#1d4ed8",
      weight: 3,
      fillColor: "#60a5fa",
      fillOpacity: 0.9,
    })
      .bindTooltip("Your location", { permanent: false })
      .addTo(this.routeLayer);

    const destinationMarker = this.facilityMarkerById.get(facility.id);
    if (destinationMarker) {
      destinationMarker.openPopup();
    }

    this.mapInstance.fitBounds(routeLine.getBounds(), {
      padding: [40, 40],
      maxZoom: 15,
    });

    const distanceKm = (route.distance / 1000).toFixed(1);
    const durationLabel = this.formatDuration(route.duration);
    this.setMapFeedback(`Route ready: ${distanceKm} km • ${durationLabel} (driving estimate).`, false);
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
      const serviceLabels = (facility.services ?? [])
        .map((item) => item?.label)
        .filter(Boolean);

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
    const serviceLabels = (facility?.services ?? [])
      .map((item) => item?.label)
      .filter(Boolean);

    if (!serviceLabels.length) {
      return "No service details listed";
    }

    return serviceLabels.slice(0, 3).join(", ");
  }
}
