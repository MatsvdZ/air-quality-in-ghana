// =========================================================
// 1. GLAOBAL VARIABLES
// =========================================================
let selectedItems = [];
let allLocations = [];
let savedPeriod = null;
let markers = [];

// =========================================================
// 2. HTML GENERATOR
// =========================================================
function renderLocationHtml(mode, loc, data, index = null) {
  const isCard = mode === "card";
  const isOverlay = mode === "overlay";

  // --- Header Generation ---
  let headerHtml = "";
  if (isCard) {
    // - Card: Title + cross to remove item
    headerHtml = `
            <div class="comp-header-row">
                <h4 class="comp-title">${loc.name}</h4>
                <span class="comp-remove-btn" onclick="window.removeItem(${index})">&times;</span>
            </div>`;
  } else if (isOverlay) {
    // - Overlay: Title + close button
    headerHtml = `
            <a href="javascript:void(0)" class="leaflet-popup-close-button" onclick="window.closeOverlay()">×</a>
            <h3 class="popup-title">${loc.name}</h3>
        `;
  } else {
    // - Popup: Title only
    headerHtml = `<h3 class="popup-title">${loc.name}</h3>`;
  }

  // Description & Remarks
  const descHtml =
    !isCard && data.desc ? `<div class="popup-desc">${data.desc}</div>` : "";

  let remarkHtml = "";
  const remarkText = data.remarks;

  if (
    !isCard &&
    remarkText &&
    typeof remarkText === "string" &&
    remarkText.trim() !== ""
  ) {
    remarkHtml = `
          <div class="popup-remark">Note: ${remarkText}
          </div>`;
  }

  // Explanation box
  const explHtml = data.explanation
    ? `<div class="data-explanation">${data.explanation}</div>`
    : "";

  // Add to compare button
  const footerHtml = !isCard
    ? `<button class="action-btn" onclick="window.toggleComp('${loc.locationId}')">
             + Add to compare
           </button>`
    : "";

  // CSS classes
  const containerClass = isCard ? "compare-card" : "custom-popup";
  const lat = Number(loc.lat).toFixed(6);
  const lon = Number(loc.lon).toFixed(6);

  // Final HTML assembly
  return `
      <div class="${containerClass}">
         ${headerHtml}
         
        <div class="${isCard ? "comp-id" : "popup-id"} tube-id-wrapper">
          Tube ID: ${data.tubeId}    </div>
         
        <div class="popup-coords">
          ${lat}, ${lon}
        </div>

         ${descHtml}
         ${remarkHtml}

         <div class="data-period">${data.period}</div>

         <div class="data-box">            
            <span class="data-label">NO₂ Concentration</span>
            <div class="data-value-row">
               <span class="data-value" style="color:${data.color}">${data.valText}</span>
               <span class="data-unit">µg/m³</span>
            </div>
            ${explHtml}
         </div>

         ${footerHtml}
      </div>
    `;
}

// =========================================================
// 3. UI INTERACTIE (COMPARISON FUNCTIONALITY)
// =========================================================
window.closeOverlay = function () {
  const ov = document.getElementById("detailsOverlay");
  if (ov) ov.classList.remove("is-visible");
};

window.toggleComp = function (id) {
  // Validation 1: No duplicates allowed
  const exists = selectedItems.find(
    (item) => item.id === id && item.period === savedPeriod
  );
  if (exists) {
    alert("This location from this period is already in the comparison.");
    return;
  }

  // Validation 2: Max 2 items
  if (selectedItems.length >= 2) {
    alert("You can compare a maximum of 2 locations.");
    return;
  }

  selectedItems.push({ id: id, period: savedPeriod });

  // Update the UI
  const dock = document.getElementById("comparisonDock");
  const count = document.getElementById("comparisonCount");
  if (dock && count) {
    dock.classList.add("is-visible");
    count.innerText = `${selectedItems.length} location(s) selected`;
  }

  window.closeOverlay();
  if (window.__leafletMap) window.__leafletMap.closePopup();
};

window.showComparison = function () {
  const grid = document.getElementById("compareGrid");
  const modal = document.getElementById("compareModal");
  if (!grid || !modal) return;

  grid.innerHTML = "";

  selectedItems.forEach((item, index) => {
    // Get data again from history, as the slider may have changed
    const loc = allLocations.find((l) => l.locationId === item.id);
    if (!loc) return;

    const m = loc.history.find((h) => h.dateStr === item.period);
    const val = m ? Number(m.val) : 0;
    const color = m && val ? getColor(val) : "#ccc";
    const valText = m && val ? val.toFixed(2) : "No data";
    const currentTubeId = m && m.tubeId ? m.tubeId : "-";

    // Calculate the context ("Above limit") specifically for the comparison
    let explanation = "";
    if (m && val > 0) {
      if (val > 40) explanation = "Above EU annual limit";
      else if (val > 10) explanation = "Above WHO annual target";
      else explanation = "Within WHO annual target";
    }

    // Render the map in 'card' mode
    grid.innerHTML += renderLocationHtml(
      "card",
      loc,
      {
        period: item.period,
        valText: valText,
        color: color,
        tubeId: currentTubeId,
        explanation: explanation,
      },
      index
    );
  });
  modal.classList.add("is-active");
};

window.removeItem = function (index) {
  selectedItems.splice(index, 1);
  if (selectedItems.length === 0) {
    window.closeComparison();
    window.clearComparison();
  } else {
    window.showComparison();
    document.getElementById("comparisonCount").innerText =
      `${selectedItems.length} locations selected`;
  }
};

window.clearComparison = function () {
  selectedItems = [];
  document.getElementById("comparisonDock").classList.remove("is-visible");
};

window.closeComparison = function () {
  document.getElementById("compareModal").classList.remove("is-active");
};

// =========================================================
// 4. MAIN APP LOGIC
// =========================================================
document.addEventListener("DOMContentLoaded", async () => {
  const mapElement = document.querySelector(".kumasi-map");
  if (!mapElement) return;

  // --- A. MAP INITIALIZATION ---
  const map = L.map(mapElement, {
    zoomControl: false,
  }).setView([6.6596, -1.6063], 12);

  L.control.zoom({ position: "topleft" }).addTo(map);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      maxZoom: 16,
    }
  ).addTo(map);

  window.__leafletMap = map;

  // --- B. LEGEND LOGIC ---
  const legendContainer = document.getElementById("interactiveLegend");
  if (legendContainer) {
    legendContainer.addEventListener("click", (e) => {
      e.stopPropagation();
      legendContainer.classList.toggle("is-open");
    });
    document.addEventListener("click", () => {
      legendContainer.classList.remove("is-open");
    });
    if (typeof L !== "undefined") {
      L.DomEvent.disableClickPropagation(legendContainer);
      L.DomEvent.disableScrollPropagation(legendContainer);
    }
  }

  try {
    // --- C. RETRIEVE AND FORMAT DATA ---
    // Async fetch ensures that interface only loads when data is ready
    const response = await fetch("/api/locations");
    allLocations = await response.json();

    // Data cleaning
    allLocations.forEach((loc) => {
      if (!Array.isArray(loc.history)) loc.history = [];
      loc.history.forEach((h) => {
        if (h.dateStr) {
          const d = new Date(h.dateStr);
          if (!isNaN(d)) {
            h.rawDate = d;
            h.dateStr = d.toLocaleDateString("en-GB", {
              year: "numeric",
              month: "short",
            });
          }
        }
      });
    });

    // Determine unique periods

    const periodMap = new Map();
    allLocations.forEach((loc) => {
      loc.history.forEach((h) => {
        if (!h.dateStr || !h.rawDate) return;
        const existing = periodMap.get(h.dateStr);
        if (!existing || h.rawDate < existing) {
          periodMap.set(h.dateStr, h.rawDate);
        }
      });
    });

    const uniquePeriods = [...periodMap.entries()]
      .sort((a, b) => a[1] - b[1])
      .map((entry) => entry[0]);

    // --- D. CORE FUNCTION: UPDATE MAP ---
    // Called on every slider movement
    function updateMapDisplay(period) {
      savedPeriod = period;
      renderTableForMonth(period); // Update table as well

      const map = window.__leafletMap;
      if (!map) return;

      // Remove existing markers
      markers.forEach((marker) => map.removeLayer(marker));
      markers = [];

      allLocations.forEach((loc) => {
        const lat = Number(loc.lat);
        const lon = Number(loc.lon);
        if (!lat || !lon) return;

        // Find the reading for this specific month
        const m = loc.history.find((h) => h.dateStr === period);

        // Default values ​​when there is no data
        let valueText = "No data";
        let color = "#ccc";
        let explanation = "";
        let currentRemark = "";
        let currentTubeId = "-";

        // If there is data: determine color and texts
        if (m) {
          const val = Number(m.val);
          if (!isNaN(val) && val > 0) {
            valueText = val.toFixed(2);
            color = getColor(val);
            if (val > 40) explanation = "Above EU annual limit";
            else if (val > 10) explanation = "Above WHO annual target";
            else explanation = "Within WHO annual target";
          }
          if (m.remarks) currentRemark = m.remarks;
          else if (m.remark) currentRemark = m.remark;
        }

        if (m.tubeId) {
          currentTubeId = m.tubeId;
        }

        let desc = loc.description || "No description available.";
        if (desc && desc.length > 0) {
          desc = desc.charAt(0).toUpperCase() + desc.slice(1);
        }

        const displayData = {
          period: period,
          valText: valueText,
          color: color,
          explanation: explanation,
          desc: desc,
          remarks: currentRemark,
          tubeId: currentTubeId,
        };

        // Make and add marker
        const marker = L.circleMarker([lat, lon], {
          color: "#fff",
          weight: 1,
          fillColor: color,
          fillOpacity: 0.8,
          radius: 12,
        }).addTo(map);

        // Generate popup content
        const popupContent = renderLocationHtml("popup", loc, displayData);

        marker.bindPopup(popupContent, {
          maxWidth: 320,
          autoPan: true,
          autoPanPaddingTopLeft: [50, 50],
          autoPanPaddingBottomRight: [50, 300],
        });

        // --- MOBILE FIRST INTERACTION ---
        marker.on("click", (e) => {
          // Detect mobile devices by screen width
          if (window.innerWidth < 768) {
            L.DomEvent.stopPropagation(e);
            marker.closePopup();

            // Fill the mobile overlay and slide it into view
            const overlay = document.getElementById("detailsOverlay");
            if (overlay) {
              overlay.innerHTML = renderLocationHtml(
                "overlay",
                loc,
                displayData
              );
              overlay.classList.add("is-visible");
            }

            // 'FlyTo' animation: move the map slightly upwards
            const mapHeight = map.getSize().y;
            const targetPoint = map.project([lat, lon], map.getZoom());
            const offset = mapHeight * 0.25;
            const newCenterPoint = targetPoint.add([0, offset]);
            const newCenterLatLng = map.unproject(
              newCenterPoint,
              map.getZoom()
            );

            map.flyTo(newCenterLatLng, map.getZoom(), {
              animate: true,
              duration: 0.2,
            });
          }
        });

        markers.push(marker);
      });

      map.on("click", () => {
        window.closeOverlay();
      });
    }

    // --- E. TABLE & FILTER FUNCTIONS ---
    function populatePeriodDropdown() {
      const sel = document.getElementById("periodFilter");
      if (!sel) return;

      sel.innerHTML = uniquePeriods
        .map((p) => `<option value="${p}">${p}</option>`)
        .join("");
    }

    function setPeriod(period) {
      if (!period) return;
      updateMapDisplay(period);

      const slider = document.querySelector(".time-slider");
      if (slider) {
        const idx = uniquePeriods.indexOf(period);
        if (idx >= 0) slider.value = String(idx);
      }
      const sel = document.getElementById("periodFilter");
      if (sel) sel.value = period;
    }

    function wirePeriodDropdown() {
      const sel = document.getElementById("periodFilter");
      if (!sel) return;
      sel.addEventListener("change", () => {
        setPeriod(sel.value);
      });
    }

    populatePeriodDropdown();
    wirePeriodDropdown();

    let currentTableRows = [];

    function getFilters() {
      const q = (document.getElementById("qFilter")?.value || "")
        .trim()
        .toLowerCase();
      const minRaw = document.getElementById("minNo2")?.value ?? "";
      const maxRaw = document.getElementById("maxNo2")?.value ?? "";
      const hideNoData = !!document.getElementById("hideNoData")?.checked;

      return {
        q,
        min: minRaw === "" ? null : Number(minRaw),
        max: maxRaw === "" ? null : Number(maxRaw),
        hideNoData,
      };
    }

    function applyTableFilters(rows) {
      const { q, min, max, hideNoData } = getFilters();
      return rows.filter((r) => {
        // search
        if (q) {
          const hay = `${r.locationId} ${r.name}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }

        // hide nodata
        if (hideNoData && (r.no2 == null || Number.isNaN(r.no2))) return false;

        // min/max filters
        if (min != null) {
          if (r.no2 == null || Number.isNaN(r.no2)) return false;
          if (!(r.no2 >= min)) return false;
        }
        if (max != null) {
          if (r.no2 == null || Number.isNaN(r.no2)) return false;
          if (!(r.no2 <= max)) return false;
        }
        return true;
      });
    }

    function renderTable(rows) {
      const tbody = document.getElementById("tableBody");
      if (!tbody) return;
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="4">No results</td></tr>`;
        return;
      }

      tbody.innerHTML = rows
        .map((r) => {
          const no2Text =
            r.no2 == null || Number.isNaN(r.no2) ? "No data" : r.no2.toFixed(2);

          return `
            <tr>
                  <td>${r.locationId}</td>
                  <td>${r.name}</td>
                  <td>${r.period}</td>
                  <td>${no2Text}</td>
            </tr>
          `;
        })
        .join("");
    }

    function rerenderTable() {
      const filtered = applyTableFilters(currentTableRows);
      renderTable(filtered);
    }

    function renderTableForMonth(selectedPeriod) {
      const tbody = document.getElementById("tableBody");
      if (!tbody) return;

      // Bouw rows uit dezelfde bron als de kaart
      currentTableRows = allLocations.map((loc) => {
        const m = loc.history.find((h) => h.dateStr === selectedPeriod);
        const val = m?.val;
        return {
          locationId: loc.locationId || "",
          name: loc.name || "",
          period: selectedPeriod,
          no2:
            val === undefined || val === null || val === ""
              ? null
              : Number(val),
        };
      });

      // Sort: Data at the top, highest values first
      currentTableRows.sort((a, b) => {
        if (a.no2 == null && b.no2 == null)
          return a.locationId.localeCompare(b.locationId);
        if (a.no2 == null) return 1;
        if (b.no2 == null) return -1;
        return b.no2 - a.no2;
      });
      rerenderTable();
    }

    function wireTableFilters() {
      const qEl = document.getElementById("qFilter");
      const minEl = document.getElementById("minNo2");
      const maxEl = document.getElementById("maxNo2");
      const hideEl = document.getElementById("hideNoData");
      const resetBtn = document.getElementById("resetFilters");
      if (qEl) qEl.addEventListener("input", rerenderTable);
      if (minEl) minEl.addEventListener("input", rerenderTable);
      if (maxEl) maxEl.addEventListener("input", rerenderTable);
      if (hideEl) hideEl.addEventListener("change", rerenderTable);
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          if (qEl) qEl.value = "";
          if (minEl) minEl.value = "";
          if (maxEl) maxEl.value = "";
          if (hideEl) hideEl.checked = false;
          rerenderTable();
        });
      }
    }
    wireTableFilters();

    // --- F. SLIDER INITIALISATION ---
    const sliderContainer = document.querySelector(".slider-container");

    if (uniquePeriods.length && sliderContainer) {
      // Dynamic: Extract unique years from the data so that the dropdown is always correct
      const uniqueYears = [
        ...new Set(uniquePeriods.map((p) => p.split(" ")[1])),
      ];

      // Render slider HTML
      sliderContainer.innerHTML = `
                <div class="slider-header">
                    <span class="slider-static-label">Period:</span>
                    <span id="monthDisplay" class="slider-month-val">-</span>
                    <select id="yearSelect" class="year-select">
                        ${uniqueYears.map((y) => `<option value="${y}">${y}</option>`).join("")}
                    </select>
                </div>
                <input type="range" class="time-slider" min="0" max="${uniquePeriods.length - 1}" step="1">
                <div class="slider-labels">
                    <span>Oldest</span>
                    <span>Newest</span>
                </div>
            `;

      const slider = sliderContainer.querySelector(".time-slider");
      const yearSelect = document.getElementById("yearSelect");
      const monthDisplay = document.getElementById("monthDisplay");

      // Sync function: updates all linked components
      function syncAll(index) {
        const period = uniquePeriods[index];
        if (period) {
          const [month, year] = period.split(" ");
          slider.value = index;

          if (yearSelect.value !== year) {
            yearSelect.value = year;
          }

          if (monthDisplay) monthDisplay.textContent = month;

          if (typeof setPeriod === "function") {
            setPeriod(period);
          } else {
            updateMapDisplay(period);
          }
        }
      }

      // Event Listeners
      slider.addEventListener("input", (e) => syncAll(e.target.value));

      yearSelect.addEventListener("change", (e) => {
        const selectedYear = e.target.value;
        const firstIndex = uniquePeriods.findIndex((p) =>
          p.includes(selectedYear)
        );
        if (firstIndex !== -1) syncAll(firstIndex);
      });

      // Set initial state to the latest period
      slider.value = slider.max;
      syncAll(slider.value);
    } else {
      if (sliderContainer)
        sliderContainer.innerHTML = "<p>No data available</p>";
    }
  } catch (err) {
    console.error("Map loading failed:", err);
  }
});

// =========================================================
// 5. COLOR SCALE
// =========================================================
function getColor(value) {
  if (value > 80) return "#7E0023"; // above EU annual limit
  if (value > 70) return "#8F3F97"; // above EU annual limit
  if (value > 60) return "#C92033"; // above EU annual limit
  if (value > 50) return "#DA5634"; // above EU annual limit
  if (value > 40) return "#EA8C34"; // above EU annual limit
  if (value > 30) return "#ECAA33"; // above WHO target
  if (value > 20) return "#EEC732"; // above WHO target
  if (value > 10) return "#A3BF29"; // above WHO target
  return "#59B61F"; // within WHO target
}
