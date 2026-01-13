document.addEventListener("DOMContentLoaded", async () => {
  const mapElement = document.querySelector(".kumasi-map");
  if (!mapElement) return;

  // 1. Kaart initialiseren
  const map = L.map(mapElement, { scrollWheelZoom: false }).setView(
    [6.6796, -1.6063],
    12
  );

  window.__leafletMap = map;

  // De kaartstijl
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      maxZoom: 16,
    }
  ).addTo(map);

  try {
    const response = await fetch("/api/locations");
    const allLocations = await response.json();

    let markers = [];

    // 1. Data voorbereiden (maak dateStr consistent als "MMM YYYY")
    allLocations.forEach((loc) => {
      if (!Array.isArray(loc.history)) loc.history = [];

      loc.history.forEach((h) => {
        if (h.dateStr) {
          const d = new Date(h.dateStr); // verwacht iets als "2025-10" of ISO
          if (!isNaN(d)) {
            h.rawDate = d;
            h.dateStr = d.toLocaleDateString("en-GB", {
              year: "numeric",
              month: "short",
            }); // bijv. "Oct 2025"
          }
        }
      });
    });

    // 2. Periodes bepalen
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

    // ----------------------------
    // Period dropdown (optie 1)
    // ----------------------------
    function populatePeriodDropdown() {
      const sel = document.getElementById("periodFilter");
      if (!sel) return;

      sel.innerHTML = uniquePeriods
        .map((p) => `<option value="${p}">${p}</option>`)
        .join("");
    }

    function setPeriod(period) {
      if (!period) return;

      // update kaart + tabel
      updateMapDisplay(period);

      // sync slider
      const slider = document.querySelector(".time-slider");
      if (slider) {
        const idx = uniquePeriods.indexOf(period);
        if (idx >= 0) slider.value = String(idx);
      }

      // sync dropdown
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

    // ----------------------------
    // Table filters wiring
    // ----------------------------
    let currentTableRows = [];
    let currentPeriod = null;

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

        // min/max (let op: no2==null mag niet door min/max heen)
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

      currentPeriod = selectedPeriod;

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

      // Sort: data bovenaan, hoogste eerst
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

    // 3. De teken-functie
    function updateMapDisplay(period) {
      const label = document.querySelector(".date-label");
      if (label) label.textContent = `Period: ${period}`;

      // ✅ update ook de tabel op exact dezelfde periode
      renderTableForMonth(period);

      // Verwijder oude markers
      markers.forEach((marker) => map.removeLayer(marker));
      markers = [];

      allLocations.forEach((loc) => {
        const lat = Number(loc.lat);
        const lon = Number(loc.lon);
        if (!lat || !lon) return;

        const m = loc.history.find((h) => h.dateStr === period);

        let valueText = "-";
        let color = "#bdc3c7";
        let tubeId = "-";
        let remarkHtml = "";
        let radius = 10;
        let explanation = "";

        if (m) {
          tubeId = m.tubeId || "-";
          radius = 12;
          const numVal = Number(m.val);

          if (!isNaN(numVal) && numVal > 0) {
            valueText = numVal.toFixed(2);
            color = getColor(numVal);

            if (numVal > 40) explanation = "(Above EU annual limit)";
            else if (numVal > 10) explanation = "(Above WHO annual target)";
            else explanation = "(Within WHO annual target)";
          } else {
            radius = 10;
            valueText = "-";
            color = "#bdc3c7";
          }

          if (m.remarks) {
            const r = String(m.remarks).trim();
            if (r && r !== "null" && r !== "undefined") {
              remarkHtml = `
                <div style="margin-top:5px; font-size:11px; color:#d35400;">
                  <i>${r}</i>
                </div>`;
            }
          }
        }

        let desc = loc.description || "";
        if (desc) desc = desc.charAt(0).toUpperCase() + desc.slice(1);

        const marker = L.circleMarker([lat, lon], {
          color: "#fff",
          weight: 1,
          fillColor: color,
          fillOpacity: 0.8,
          radius,
        }).addTo(map);

        marker.bindPopup(`
          <b>${loc.name}</b><br>
          <small style="color:#555">${desc}</small>
          ${remarkHtml}
          <hr style="margin:10px 0; border-top:1px solid #eee">
          <div><b>Period:</b> ${period}</div>
          <div><b>Tube ID:</b> ${tubeId}</div>
          <div style="margin-top: 4px;">
            <b>NO₂ concentration:</b><br>
            <span style="font-size:1.2em; font-weight:bold; color:${color}">
              ${valueText}
            </span>
            <small style="color:#666; font-size:0.85em; margin-left: 6px;">
              ${explanation}
            </small>
          </div>
        `);

        markers.push(marker);
      });
    }

    // 4. Slider bediening (nu ook dropdown sync)
    const slider = document.querySelector(".time-slider");
    if (slider && uniquePeriods.length) {
      slider.max = uniquePeriods.length - 1;
      slider.value = slider.max;

      slider.addEventListener("input", (e) => {
        const period = uniquePeriods[e.target.value];
        setPeriod(period); // ✅ gebruikt dezelfde sync functie
      });

      // initial: newest
      setPeriod(uniquePeriods[slider.value]);
    } else {
      const label = document.querySelector(".date-label");
      if (label) label.textContent = "No data";
    }
  } catch (err) {
    console.error("Map loading failed:", err);
  }
});

// Kleurenschaal (Gebaseerd op WHO 2021 & EU Normen)
function getColor(value) {
  if (value > 80) return "#7E0023"; // EU annual limit
  if (value > 70) return "#8F3F97"; // EU annual limit
  if (value > 60) return "#C92033"; // EU annual limit
  if (value > 50) return "#DA5634"; // EU annual limit
  if (value > 40) return "#EA8C34"; // EU annual limit
  if (value > 30) return "#ECAA33"; // above WHO target
  if (value > 20) return "#EEC732"; // above WHO target
  if (value > 10) return "#A3BF29"; // above WHO target
  return "#59B61F"; // within WHO target
}
