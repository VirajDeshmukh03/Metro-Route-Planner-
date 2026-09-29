/**
 * ===================================================================
 * METRO ROUTE PLANNER - APPLICATION CONTROLLER
 * Glues Graph Data Structures, Leaflet Real Pune Map, SVG Schematic
 * Rendering, and UI Controls
 * ===================================================================
 */

// Application State
let metroGraph = null;
let currentCriteria = "fastest";
let currentRouteResult = null;
let currentMapView = "leaflet"; // "leaflet" | "schematic"

// Leaflet Map State
let leafletMap = null;
let leafletTracksLayer = null;
let leafletRouteLayer = null;
let leafletStationsLayer = null;

// Initialize on document ready
document.addEventListener("DOMContentLoaded", () => {
  initializeGraph();
  setupUIControls();
  initializeLeafletMap();
  renderLeafletMap();
  renderMetroMap();
  
  // Calculate initial route: PCMC to Ramwadi
  handleFindRoute();
});

/**
 * Initialize graph from metroData.js
 */
function initializeGraph() {
  metroGraph = new MetroGraph();

  // 1. Add all stations (creates hash map entries and vertices with lat/lng)
  for (const station of INITIAL_STATIONS) {
    metroGraph.addStation(station);
  }

  // 2. Add all bidirectional connections (populates adjacency list)
  for (const edge of INITIAL_EDGES) {
    metroGraph.addConnection(edge.u, edge.v, edge.time, edge.fare, edge.line);
  }
}

/**
 * Setup event listeners and dropdowns
 */
function setupUIControls() {
  const fromSelect = document.getElementById("fromStation");
  const toSelect = document.getElementById("toStation");
  const stationToggleSelect = document.getElementById("stationToggleSelect");
  const connectionToggleSelect = document.getElementById("connectionToggleSelect");
  const edgeWeightSelect = document.getElementById("edgeWeightSelect");

  // Populate station dropdowns
  metroGraph.stations.forEach(station => {
    const optFrom = new Option(`${station.name} (${station.line} Line)`, station.id);
    const optTo = new Option(`${station.name} (${station.line} Line)`, station.id);
    const optToggle = new Option(`${station.name} (${station.line} Line)`, station.id);

    fromSelect.appendChild(optFrom);
    toSelect.appendChild(optTo);
    stationToggleSelect.appendChild(optToggle);
  });

  // Set default route: PCMC (0) to Ramwadi (10)
  fromSelect.value = 0;
  toSelect.value = 10;
  stationToggleSelect.value = 6; // default to Civil Court for closure demo

  // Populate connection dropdowns
  populateConnectionDropdowns();

  // Swap stations button
  document.getElementById("swapBtn").addEventListener("click", () => {
    const temp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = temp;
    handleFindRoute();
  });

  // Auto recalculate when station changes
  fromSelect.addEventListener("change", () => handleFindRoute());
  toSelect.addEventListener("change", () => handleFindRoute());

  // Criteria buttons
  const prefBtns = document.querySelectorAll(".pref-btn");
  prefBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      prefBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentCriteria = btn.dataset.criteria;
      handleFindRoute();
    });
  });
}

/**
 * Populate connections dropdowns
 */
function populateConnectionDropdowns() {
  const connectionToggleSelect = document.getElementById("connectionToggleSelect");
  const edgeWeightSelect = document.getElementById("edgeWeightSelect");

  connectionToggleSelect.innerHTML = "";
  edgeWeightSelect.innerHTML = "";

  metroGraph.allEdges.forEach(edge => {
    const label = `${edge.nameU} ⇄ ${edge.nameV} (${edge.line} Line, ${edge.time}m)`;
    const optConn = new Option(label, edge.id);
    const optWeight = new Option(label, edge.id);

    connectionToggleSelect.appendChild(optConn);
    edgeWeightSelect.appendChild(optWeight);
  });
}

// ===================================================================
// LEAFLET REAL PUNE GEOGRAPHIC MAP INTEGRATION
// ===================================================================

/**
 * Initialize Leaflet Map centered on Pune, India
 */
function initializeLeafletMap() {
  if (typeof L === "undefined") {
    console.warn("Leaflet library not loaded, falling back to schematic view.");
    switchMapView("schematic");
    return;
  }

  // Pune geographic center
  const center = typeof PUNE_MAP_CENTER !== "undefined" ? PUNE_MAP_CENTER : [18.5400, 73.8560];
  const zoom = typeof PUNE_DEFAULT_ZOOM !== "undefined" ? PUNE_DEFAULT_ZOOM : 13;

  leafletMap = L.map("leafletMap", {
    center: center,
    zoom: zoom,
    zoomControl: true,
    attributionControl: true
  });

  // Base Layer 1: ESRI World Street Map (Real city roads, highways, landmarks, rivers of Pune)
  // Permissive for local file:// protocol without 403 blocks or API keys!
  const esriStreetLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 18,
    attribution: 'Tiles &copy; Esri &mdash; Street Map of Pune'
  });

  // Base Layer 2: ESRI World Topo Map (Topographic and terrain view of Pune)
  const esriTopoLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 18,
    attribution: 'Tiles &copy; Esri &mdash; Topo Map'
  });

  // Base Layer 3: ESRI World Imagery (High-Resolution Satellite Aerial View)
  const esriSatelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 18,
    attribution: 'Tiles &copy; Esri &mdash; Satellite View'
  });

  // Set ESRI World Street Map as the active default
  esriStreetLayer.addTo(leafletMap);

  // Add Layer Switcher Control (Top Right)
  const baseMaps = {
    "🗺️ Real City Map (Street)": esriStreetLayer,
    "🏔️ Topographic Map": esriTopoLayer,
    "🛰️ Satellite View": esriSatelliteLayer
  };
  L.control.layers(baseMaps, null, { position: "topright" }).addTo(leafletMap);

  // Initialize Layer Groups for metro tracks, stations, and active route
  leafletTracksLayer = L.layerGroup().addTo(leafletMap);
  leafletRouteLayer = L.layerGroup().addTo(leafletMap);
  leafletStationsLayer = L.layerGroup().addTo(leafletMap);

  // Scale bar (metric)
  L.control.scale({ imperial: false, metric: true, position: "bottomleft" }).addTo(leafletMap);

  // Automatically fit map view to all Pune stations
  setTimeout(() => {
    if (metroGraph && metroGraph.stations.length > 0) {
      const allLatLngs = metroGraph.stations.map(s => [s.lat, s.lng]);
      leafletMap.fitBounds(L.latLngBounds(allLatLngs), { padding: [35, 35] });
    }
  }, 100);
}

/**
 * Render all Tracks and Stations on the Leaflet Real Pune Map
 */
function renderLeafletMap() {
  if (!leafletMap) return;

  // Clear existing tracks and stations
  leafletTracksLayer.clearLayers();
  leafletStationsLayer.clearLayers();

  // 1. Draw Real Track Polylines between GPS Coordinates
  metroGraph.allEdges.forEach(edge => {
    const u = metroGraph.stations[edge.u];
    const v = metroGraph.stations[edge.v];
    const color = LINE_COLORS[edge.line] || "#60a5fa";

    const coords = [
      [u.lat, u.lng],
      [v.lat, v.lng]
    ];

    // Background track outline for visibility
    L.polyline(coords, {
      color: "#080d1a",
      weight: 8,
      opacity: 0.8
    }).addTo(leafletTracksLayer);

    // Colored Metro Track
    const polyline = L.polyline(coords, {
      color: color,
      weight: edge.line === "Connector" || edge.line === "Express" ? 4 : 5,
      opacity: edge.active ? 0.95 : 0.35,
      dashArray: edge.active ? null : "6, 8"
    }).addTo(leafletTracksLayer);

    // Track Tooltip on hover
    polyline.bindTooltip(
      `<b>${edge.line} Line</b><br>${edge.nameU} ⇄ ${edge.nameV}<br>Time: ${edge.time} min | Fare: ₹${edge.fare}${edge.active ? "" : " <span style='color:#f43f5e;'>[DISABLED]</span>"}`,
      { sticky: true }
    );
  });

  // 2. Draw Real Station Nodes with Metro Logo Badges
  metroGraph.stations.forEach(station => {
    const isClosed = metroGraph.isStationClosed(station.id);
    const isMajorHub = station.interchange || station.id === 0 || station.id === 10 || station.id === 11 || station.id === 13;
    
    // Official Metro Station Badge Icon
    const badgeHtml = `
      <div class="metro-station-badge line-${station.line} ${station.interchange ? 'is-interchange' : ''} ${isClosed ? 'is-closed' : ''}" title="${station.name}">
        <svg viewBox="0 0 24 24" class="metro-logo-svg">
          <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
        </svg>
      </div>
    `;

    const iconSize = station.interchange ? [32, 32] : [26, 26];
    const iconAnchor = station.interchange ? [16, 16] : [13, 13];

    const metroIcon = L.divIcon({
      className: "custom-leaflet-metro-marker",
      html: badgeHtml,
      iconSize: iconSize,
      iconAnchor: iconAnchor,
      popupAnchor: [0, -16]
    });

    const marker = L.marker([station.lat, station.lng], { icon: metroIcon }).addTo(leafletStationsLayer);

    // Tooltip: Permanent for key interchange hubs, hover for others
    marker.bindTooltip(`<b>${station.name}</b>${isClosed ? " <span style='color:#f43f5e;'>[CLOSED]</span>" : ""}`, {
      permanent: isMajorHub,
      direction: "top",
      offset: [0, -14],
      className: "station-label-tooltip"
    });

    // Rich Interactive Station Popup
    const popupContent = `
      <div class="station-popup">
        <div class="station-popup-title">
          <span>🚇 ${station.name}</span>
          <span class="line-tag line-${station.line}">${station.line}</span>
        </div>
        <div class="station-popup-desc">
          Status: <b>${isClosed ? '🔴 CLOSED (Offline)' : '🟢 OPEN (Operational)'}</b><br>
          ${station.interchange ? '★ Major Interchange Junction<br>' : ''}
          <span style="font-family:monospace; font-size:10px; color:#94a3b8;">GPS: ${station.lat.toFixed(4)}° N, ${station.lng.toFixed(4)}° E</span>
        </div>
        <div class="station-popup-actions">
          <button type="button" class="station-popup-btn" onclick="setStationFrom(${station.id})">Set as Origin</button>
          <button type="button" class="station-popup-btn" onclick="setStationTo(${station.id})">Set as Dest</button>
        </div>
        <button type="button" class="station-popup-btn ${isClosed ? '' : 'danger'}" style="width:100%; margin-top:6px;" onclick="toggleStationFromPopup(${station.id})">
          ${isClosed ? 'Reopen Station' : 'Close Station (Dynamic Update)'}
        </button>
      </div>
    `;

    marker.bindPopup(popupContent);
  });
}

// Global timer for train movement animation along route
let trainAnimationTimer = null;

/**
 * Highlight the computed route on the Leaflet Real Pune Map
 */
function highlightRouteOnLeaflet(path) {
  if (!leafletMap || !leafletRouteLayer) return;

  if (trainAnimationTimer) {
    clearInterval(trainAnimationTimer);
    trainAnimationTimer = null;
  }

  leafletRouteLayer.clearLayers();

  if (!path || path.length < 2) return;

  const latlngs = path.map(id => [
    metroGraph.stations[id].lat,
    metroGraph.stations[id].lng
  ]);

  // Outer Glowing Blue Polyline
  L.polyline(latlngs, {
    color: "#3b82f6",
    weight: 12,
    opacity: 0.85,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(leafletRouteLayer);

  // Inner Bright White Core Polyline
  L.polyline(latlngs, {
    color: "#ffffff",
    weight: 4,
    opacity: 1.0,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(leafletRouteLayer);

  // Origin Marker highlight (Green ring)
  const originStation = metroGraph.stations[path[0]];
  L.circleMarker([originStation.lat, originStation.lng], {
    radius: 14,
    color: "#10b981",
    fillColor: "#10b981",
    fillOpacity: 0.35,
    weight: 4
  }).addTo(leafletRouteLayer);

  // Destination Marker highlight (Red ring)
  const destStation = metroGraph.stations[path[path.length - 1]];
  L.circleMarker([destStation.lat, destStation.lng], {
    radius: 14,
    color: "#f43f5e",
    fillColor: "#f43f5e",
    fillOpacity: 0.35,
    weight: 4
  }).addTo(leafletRouteLayer);

  // Label all stations along the active journey
  for (let i = 0; i < path.length; i++) {
    const st = metroGraph.stations[path[i]];
    const isStart = (i === 0);
    const isEnd = (i === path.length - 1);

    if (!isStart && !isEnd) {
      const midMarker = L.circleMarker([st.lat, st.lng], {
        radius: 8,
        color: "#ffffff",
        fillColor: "#3b82f6",
        fillOpacity: 1.0,
        weight: 3
      }).addTo(leafletRouteLayer);

      midMarker.bindTooltip(`<b>${i}. ${st.name}</b>`, {
        permanent: true,
        direction: "top",
        offset: [0, -8],
        className: "station-label-tooltip"
      });
    }
  }

  // Add Animated Metro Train Marker traversing the active route!
  const trainDivIcon = L.divIcon({
    className: "train-vehicle-div-icon",
    html: `
      <div class="train-vehicle-badge" title="Metro Train in Transit">
        <span>🚇</span>
        <div class="train-pulse-ring"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  const activeTrainMarker = L.marker(
    [metroGraph.stations[path[0]].lat, metroGraph.stations[path[0]].lng],
    { icon: trainDivIcon, zIndexOffset: 3000 }
  ).addTo(leafletRouteLayer);

  // Animate train moving along path coordinates smoothly
  animateTrainMarker(activeTrainMarker, path);

  // Smoothly fit bounds to show entire journey in view
  try {
    leafletMap.fitBounds(L.latLngBounds(latlngs), {
      padding: [45, 45],
      maxZoom: 14,
      animate: true,
      duration: 0.6
    });
  } catch (e) {
    console.error("Leaflet fitBounds error:", e);
  }
}

/**
 * Animate metro train moving along path stations in real time
 */
function animateTrainMarker(marker, path) {
  if (!marker || !path || path.length < 2) return;

  let currentIdx = 0;
  let progress = 0;
  const stepSpeed = 0.04; // smooth motion speed

  trainAnimationTimer = setInterval(() => {
    if (!marker._map) {
      clearInterval(trainAnimationTimer);
      return;
    }

    progress += stepSpeed;
    if (progress >= 1) {
      progress = 0;
      currentIdx++;
      if (currentIdx >= path.length - 1) {
        currentIdx = 0; // loop back to origin!
      }
    }

    const st1 = metroGraph.stations[path[currentIdx]];
    const st2 = metroGraph.stations[path[currentIdx + 1]];
    const lat = st1.lat + (st2.lat - st1.lat) * progress;
    const lng = st1.lng + (st2.lng - st1.lng) * progress;

    marker.setLatLng([lat, lng]);
  }, 45);
}

/**
 * Switch between Leaflet Real Geographic Map and SVG Schematic Transit Diagram
 */
function switchMapView(mode) {
  currentMapView = mode;
  const btnLeaflet = document.getElementById("btnLeafletView");
  const btnSchematic = document.getElementById("btnSchematicView");
  const leafletEl = document.getElementById("leafletMap");
  const svgEl = document.getElementById("metroSvg");

  if (mode === "leaflet") {
    btnLeaflet.classList.add("active");
    btnSchematic.classList.remove("active");
    leafletEl.style.display = "block";
    svgEl.style.display = "none";
    if (leafletMap) {
      setTimeout(() => leafletMap.invalidateSize(), 50);
    }
  } else {
    btnSchematic.classList.add("active");
    btnLeaflet.classList.remove("active");
    svgEl.style.display = "block";
    leafletEl.style.display = "none";
  }
}

/**
 * Fit Leaflet map bounds to active route
 */
function fitRouteBounds() {
  if (currentRouteResult && currentRouteResult.path && currentRouteResult.path.length > 1) {
    highlightRouteOnLeaflet(currentRouteResult.path);
  } else {
    resetPuneView();
  }
}

/**
 * Reset Leaflet map view to center of Pune
 */
function resetPuneView() {
  if (leafletMap && metroGraph && metroGraph.stations.length > 0) {
    const allLatLngs = metroGraph.stations.map(s => [s.lat, s.lng]);
    leafletMap.fitBounds(L.latLngBounds(allLatLngs), { padding: [35, 35], animate: true });
  }
}

/**
 * Quick helpers called from Leaflet Marker Popups
 */
window.setStationFrom = function(stationId) {
  document.getElementById("fromStation").value = stationId;
  if (leafletMap) leafletMap.closePopup();
  handleFindRoute();
};

window.setStationTo = function(stationId) {
  document.getElementById("toStation").value = stationId;
  if (leafletMap) leafletMap.closePopup();
  handleFindRoute();
};

window.toggleStationFromPopup = function(stationId) {
  document.getElementById("stationToggleSelect").value = stationId;
  if (leafletMap) leafletMap.closePopup();
  handleToggleStation();
};

// ===================================================================
// SCHEMATIC TRANSIT DIAGRAM (SVG) RENDERING
// ===================================================================

/**
 * Render Interactive SVG Schematic Metro Map
 */
function renderMetroMap() {
  const trackBasesGroup = document.getElementById("trackBasesGroup");
  const tracksGroup = document.getElementById("tracksGroup");
  const edgeLabelsGroup = document.getElementById("edgeLabelsGroup");
  const stationsGroup = document.getElementById("stationsGroup");

  trackBasesGroup.innerHTML = "";
  tracksGroup.innerHTML = "";
  edgeLabelsGroup.innerHTML = "";
  stationsGroup.innerHTML = "";

  // 1. Draw Edges / Tracks
  metroGraph.allEdges.forEach(edge => {
    const u = metroGraph.stations[edge.u];
    const v = metroGraph.stations[edge.v];
    const color = LINE_COLORS[edge.line] || "#94a3b8";

    // Track Background (for thickness & contrast)
    const baseLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    baseLine.setAttribute("x1", u.x);
    baseLine.setAttribute("y1", u.y);
    baseLine.setAttribute("x2", v.x);
    baseLine.setAttribute("y2", v.y);
    baseLine.setAttribute("class", "svg-edge-bg");
    trackBasesGroup.appendChild(baseLine);

    // Colored Track Line
    const trackLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    trackLine.setAttribute("x1", u.x);
    trackLine.setAttribute("y1", u.y);
    trackLine.setAttribute("x2", v.x);
    trackLine.setAttribute("y2", v.y);
    trackLine.setAttribute("stroke", color);
    trackLine.setAttribute("class", `svg-edge-line ${edge.active ? "" : "inactive"}`);
    trackLine.setAttribute("id", `edge-svg-${edge.id}`);
    tracksGroup.appendChild(trackLine);

    // Edge Travel Time Label at Midpoint
    const midX = (u.x + v.x) / 2;
    const midY = (u.y + v.y) / 2;
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", midX);
    label.setAttribute("y", midY - 6);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "svg-edge-label");
    label.textContent = `${edge.time}m`;
    edgeLabelsGroup.appendChild(label);
  });

  // 2. Draw Stations Nodes
  metroGraph.stations.forEach(station => {
    const isClosed = metroGraph.isStationClosed(station.id);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", `station-node ${isClosed ? "station-closed" : ""}`);
    g.setAttribute("id", `station-svg-${station.id}`);

    // Click handler to select station
    g.addEventListener("click", () => handleStationMapClick(station.id));

    // Station Circle (Metro Badge)
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", station.x);
    circle.setAttribute("cy", station.y);
    circle.setAttribute("r", station.interchange ? 11 : 9);
    circle.setAttribute("stroke", isClosed ? "#f43f5e" : (LINE_COLORS[station.line] || "#60a5fa"));
    circle.setAttribute("class", `station-circle ${station.interchange ? "station-interchange" : ""}`);
    g.appendChild(circle);

    // Metro 'M' Logo inside Station Circle
    const mGlyph = document.createElementNS("http://www.w3.org/2000/svg", "text");
    mGlyph.setAttribute("x", station.x);
    mGlyph.setAttribute("y", station.y + 3.5);
    mGlyph.setAttribute("text-anchor", "middle");
    mGlyph.setAttribute("font-size", station.interchange ? "9px" : "8px");
    mGlyph.setAttribute("font-weight", "800");
    mGlyph.setAttribute("fill", isClosed ? "#fda4af" : (station.interchange ? "#ec4899" : "#ffffff"));
    mGlyph.setAttribute("pointer-events", "none");
    mGlyph.textContent = "M";
    g.appendChild(mGlyph);

    // Station Label
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", station.x);
    const yOffset = station.y > 300 ? 22 : -14;
    text.setAttribute("y", station.y + yOffset);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "station-name");
    text.textContent = station.name + (isClosed ? " (CLOSED)" : "");
    g.appendChild(text);

    stationsGroup.appendChild(g);
  });
}

/**
 * Handle clicking on a station on the SVG Map
 */
function handleStationMapClick(stationId) {
  const fromSelect = document.getElementById("fromStation");
  const toSelect = document.getElementById("toStation");

  const currentFrom = parseInt(fromSelect.value);
  if (currentFrom !== stationId) {
    toSelect.value = stationId;
  } else {
    fromSelect.value = stationId;
  }
  handleFindRoute();
}

/**
 * Highlight active route on the SVG schematic map with animated glow
 */
function highlightRouteOnMap(path) {
  const activeRouteGroup = document.getElementById("activeRouteGroup");
  activeRouteGroup.innerHTML = "";

  if (!path || path.length < 2) return;

  let d = "";
  for (let i = 0; i < path.length; i++) {
    const s = metroGraph.stations[path[i]];
    d += (i === 0 ? `M ${s.x} ${s.y} ` : `L ${s.x} ${s.y} `);

    const stationElem = document.getElementById(`station-svg-${s.id}`);
    if (stationElem) stationElem.classList.add("active-route");
  }

  // Outer Glowing Path
  const glowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  glowPath.setAttribute("d", d);
  glowPath.setAttribute("class", "route-glow-path");
  activeRouteGroup.appendChild(glowPath);

  // Inner Crisp Path
  const corePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  corePath.setAttribute("d", d);
  corePath.setAttribute("class", "route-core-path");
  activeRouteGroup.appendChild(corePath);
}

/**
 * Clear existing route highlights
 */
function clearRouteVisualization() {
  document.getElementById("activeRouteGroup").innerHTML = "";
  document.querySelectorAll(".station-node").forEach(node => {
    node.classList.remove("active-route");
  });
  if (leafletRouteLayer) {
    leafletRouteLayer.clearLayers();
  }
}

// ===================================================================
// ROUTE CALCULATION AND RESULTS PRESENTATION
// ===================================================================

/**
 * Core Routing Controller: Invokes BFS or Dijkstra
 */
function handleFindRoute() {
  const fromId = parseInt(document.getElementById("fromStation").value);
  const toId = parseInt(document.getElementById("toStation").value);

  if (isNaN(fromId) || isNaN(toId)) return;

  // Clear previous route visualization
  clearRouteVisualization();

  // Validate station availability
  if (metroGraph.isStationClosed(fromId)) {
    displayNoRouteMessage(`Origin station "${metroGraph.stations[fromId].name}" is currently CLOSED due to maintenance.`);
    return;
  }
  if (metroGraph.isStationClosed(toId)) {
    displayNoRouteMessage(`Destination station "${metroGraph.stations[toId].name}" is currently CLOSED.`);
    return;
  }

  // Execute Algorithm based on selected criteria
  let result = null;
  if (currentCriteria === "stops") {
    // Breadth-First Search (Fewest Stops)
    result = metroGraph.bfsFewestStops(fromId, toId);
  } else {
    // Dijkstra's Algorithm with Min-Heap
    // criteria: "fastest", "fare", "transfer", "balanced"
    result = metroGraph.dijkstra(fromId, toId, currentCriteria);
  }

  currentRouteResult = result;

  // Display Result
  if (!result.success || result.path.length === 0) {
    displayNoRouteMessage("No active route available. Check if connecting stations or tracks are closed.");
  } else {
    displayRouteResults(result);
    // Highlight on both Leaflet and SVG maps
    highlightRouteOnLeaflet(result.path);
    highlightRouteOnMap(result.path);
  }
}

/**
 * Display route metrics and step-by-step itinerary
 */
function displayRouteResults(result) {
  // Update metric counters
  document.getElementById("valTime").textContent = `${result.totalTime} min`;
  document.getElementById("valStops").textContent = result.stops;
  document.getElementById("valFare").textContent = `₹${result.totalFare}`;
  document.getElementById("valTransfers").textContent = result.transfers;

  // Update Header Badges
  document.getElementById("routeResultTitle").innerHTML = `<span>📍</span> Optimal Route: ${metroGraph.stations[result.path[0]].name} ➔ ${metroGraph.stations[result.path[result.path.length - 1]].name}`;
  document.getElementById("routeResultSubtitle").textContent = `Optimized for: ${result.preference} • ${result.stops} stops • ${result.transfers} interchange(s)`;
  document.getElementById("algorithmBadge").textContent = `${result.algorithm} • Time: ${result.timeComplexity}`;

  // Build Step-by-Step Itinerary
  const container = document.getElementById("itineraryContainer");
  container.innerHTML = "";

  result.path.forEach((stationId, index) => {
    const station = metroGraph.stations[stationId];
    const isFirst = index === 0;
    const isLast = index === result.path.length - 1;
    
    // Check if transfer happened at this station
    const transferInfo = result.interchangeStations.find(t => t.stationId === stationId);

    const item = document.createElement("div");
    item.className = "itinerary-item";

    let iconClass = isFirst ? "origin" : isLast ? "destination" : (transferInfo ? "interchange" : "");
    let iconSymbol = isFirst ? "🟢" : isLast ? "🔴" : (transferInfo ? "🔄" : "⚪");
    let roleText = isFirst ? "Origin Station • Board Train" : isLast ? "Destination Station • Alight" : `Stop ${index}`;

    let interchangeHtml = "";
    if (transferInfo) {
      interchangeHtml = `
        <div class="interchange-banner">
          ⚠️ <b>Transfer Required:</b> Switch from <span class="line-tag line-${transferInfo.fromLine}">${transferInfo.fromLine} Line</span> to <span class="line-tag line-${transferInfo.toLine}">${transferInfo.toLine} Line</span>
        </div>
      `;
    }

    item.innerHTML = `
      <div class="itinerary-icon ${iconClass}">${iconSymbol}</div>
      <div class="itinerary-details">
        <div class="itinerary-station-name">
          <span>${station.name}</span>
          <span class="line-tag line-${station.line}">${station.line} Line</span>
        </div>
        <div class="itinerary-subtext">${roleText}</div>
        ${interchangeHtml}
      </div>
    `;

    container.appendChild(item);
  });
}

/**
 * Display "No Route" message
 */
function displayNoRouteMessage(message) {
  document.getElementById("valTime").textContent = "-- min";
  document.getElementById("valStops").textContent = "--";
  document.getElementById("valFare").textContent = "₹ --";
  document.getElementById("valTransfers").textContent = "--";

  document.getElementById("routeResultTitle").innerHTML = `<span>⚠️</span> No Route Available`;
  document.getElementById("routeResultSubtitle").textContent = message;

  const container = document.getElementById("itineraryContainer");
  container.innerHTML = `
    <div style="background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.3); border-radius:8px; padding:18px; text-align:center; color:#fda4af;">
      <b style="font-size:15px; display:block; margin-bottom:6px;">Routing Interruption</b>
      <p style="font-size:13px;">${message}</p>
      <button class="btn-secondary" onclick="handleResetNetwork()" style="margin-top:12px;">Reset All Network Disruptions</button>
    </div>
  `;
}

// ===================================================================
// DYNAMIC GRAPH CONTROLLERS
// ===================================================================

/**
 * Toggle Station Status (Open / Closed)
 */
function handleToggleStation() {
  const stationId = parseInt(document.getElementById("stationToggleSelect").value);
  const newOpenState = metroGraph.toggleStation(stationId);

  updateDynamicStatusUI();
  renderLeafletMap();
  renderMetroMap();
  handleFindRoute();
}

/**
 * Toggle Track / Connection Status (Active / Inactive)
 */
function handleToggleConnection() {
  const edgeId = parseInt(document.getElementById("connectionToggleSelect").value);
  const newActiveState = metroGraph.toggleConnection(edgeId);

  updateDynamicStatusUI();
  renderLeafletMap();
  renderMetroMap();
  populateConnectionDropdowns();
  handleFindRoute();
}

/**
 * Update Edge Travel Time (Signal Delay)
 */
function handleUpdateEdgeWeight() {
  const edgeId = parseInt(document.getElementById("edgeWeightSelect").value);
  const newTime = parseInt(document.getElementById("newTimeInput").value);

  if (isNaN(newTime) || newTime <= 0) {
    alert("Please enter a valid positive travel time in minutes.");
    return;
  }

  metroGraph.updateConnectionWeight(edgeId, newTime);
  populateConnectionDropdowns();
  renderLeafletMap();
  renderMetroMap();
  handleFindRoute();
}

/**
 * Reset all dynamic network changes
 */
function handleResetNetwork() {
  metroGraph.resetAllDynamicChanges();
  updateDynamicStatusUI();
  populateConnectionDropdowns();
  renderLeafletMap();
  renderMetroMap();
  handleFindRoute();
}

/**
 * Update Status Badges & Counters
 */
function updateDynamicStatusUI() {
  const closedCount = metroGraph.closedStations.size;
  const statusBadge = document.getElementById("networkStatusBadge");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const closedCounter = document.getElementById("closedStationsCount");

  closedCounter.textContent = `${closedCount} Closed`;

  if (closedCount === 0) {
    statusBadge.style.background = "rgba(16, 185, 129, 0.12)";
    statusBadge.style.borderColor = "rgba(16, 185, 129, 0.3)";
    statusBadge.style.color = "#34d399";
    statusDot.style.background = "#10b981";
    statusDot.style.boxShadow = "0 0 8px #10b981";
    statusText.textContent = "Network Operational";
  } else {
    statusBadge.style.background = "rgba(244, 63, 94, 0.15)";
    statusBadge.style.borderColor = "rgba(244, 63, 94, 0.4)";
    statusBadge.style.color = "#fda4af";
    statusDot.style.background = "#f43f5e";
    statusDot.style.boxShadow = "0 0 8px #f43f5e";
    statusText.textContent = `${closedCount} Station(s) Offline (Dynamic Recalculation Active)`;
  }
}

// ===================================================================
// MID-SEM DEMO SCENARIO PRESETS (For quick demonstration during Viva)
// ===================================================================

function runDemoScenario(scenarioId) {
  // Reset first
  metroGraph.resetAllDynamicChanges();
  updateDynamicStatusUI();

  const fromSelect = document.getElementById("fromStation");
  const toSelect = document.getElementById("toStation");

  if (scenarioId === 1) {
    // Demo 1: Baseline PCMC to Ramwadi (Fastest route via Civil Court)
    fromSelect.value = 0; // PCMC
    toSelect.value = 10; // Ramwadi
    setCriteria("fastest");
  } else if (scenarioId === 2) {
    // Demo 2: Civil Court Interchange Closed -> Dynamic rerouting via Shivajinagar-Ruby Hall bypass connector!
    fromSelect.value = 0; // PCMC
    toSelect.value = 10; // Ramwadi
    metroGraph.toggleStation(6, false); // Close Civil Court
    setCriteria("fastest");
  } else if (scenarioId === 3) {
    // Demo 3: Severe delay on Khadki to Shivajinagar track (+20m delay)
    fromSelect.value = 0; // PCMC
    toSelect.value = 10; // Ramwadi
    const khadkiShivajiEdge = metroGraph.allEdges.find(e => (e.u === 4 && e.v === 5) || (e.u === 5 && e.v === 4));
    if (khadkiShivajiEdge) {
      metroGraph.updateConnectionWeight(khadkiShivajiEdge.id, 25);
    }
    setCriteria("fastest");
  } else if (scenarioId === 4) {
    // Demo 4: Multi-Line journey Vanaz to Swargate
    fromSelect.value = 13; // Vanaz
    toSelect.value = 11; // Swargate
    setCriteria("fastest");
  }

  updateDynamicStatusUI();
  populateConnectionDropdowns();
  renderLeafletMap();
  renderMetroMap();
  handleFindRoute();
}

function setCriteria(criteria) {
  currentCriteria = criteria;
  document.querySelectorAll(".pref-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.criteria === criteria);
  });
}

