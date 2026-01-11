document.addEventListener('DOMContentLoaded', async () => {
    const mapElement = document.querySelector('.kumasi-map');
    if (!mapElement) return;

    // 1. Kaart initialiseren
    const map = L.map(mapElement, {
        scrollWheelZoom: false
    }).setView([6.6796, -1.6063], 12);

    window.__leafletMap = map;

    // De kaartstijl
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 16
    }).addTo(map);

    try {
        const response = await fetch('/api/locations');
        const allLocations = await response.json();
        let markers = [];

        // 1. Data voorbereiden
        allLocations.forEach(loc => {
            loc.history.forEach(h => {
                if (h.dateStr) {
                    const d = new Date(h.dateStr);
                    if (!isNaN(d)) {
                        h.rawDate = d;
                        h.dateStr = d.toLocaleDateString('en-GB', {
                            year: 'numeric',
                            month: 'short'
                        });
                    }
                }
            });
        });

        // 2. Periodes bepalen
        const periodMap = new Map();
        allLocations.forEach(loc => {
            loc.history.forEach(h => {
                if (!h.dateStr || !h.rawDate) return;
                const existing = periodMap.get(h.dateStr);
                if (!existing || h.rawDate < existing) {
                    periodMap.set(h.dateStr, h.rawDate);
                }
            });
        });

        const uniquePeriods = [...periodMap.entries()]
            .sort((a, b) => a[1] - b[1])
            .map(entry => entry[0]);

        // 3. De Teken-functie
        function updateMapDisplay(period) {
            const label = document.querySelector('.date-label');
            if (label) label.textContent = `Period: ${period}`;

            // Verwijder oude markers zoals je gewend bent
            markers.forEach(marker => map.removeLayer(marker));
            markers = [];

            allLocations.forEach(loc => {
                const lat = Number(loc.lat);
                const lon = Number(loc.lon);
                if (!lat || !lon) return;

                const m = loc.history.find(h => h.dateStr === period);

                let valueText = '-';
                let color = '#bdc3c7';
                let tubeId = '-';
                let remarkHtml = '';
                let radius = 10;

                if (m) {
                    tubeId = m.tubeId || '-';
                    radius = 12;
                    const numVal = Number(m.val);

                    if (!isNaN(numVal) && numVal > 0) {
                        valueText = numVal;
                        color = getColor(numVal);
                    } else {
                        radius = 10;
                        valueText = '-';
                        color = '#bdc3c7';
                    }

                    if (m.remarks) {
                        const r = String(m.remarks).trim();
                        if (r && r !== 'null' && r !== 'undefined') {
                            remarkHtml = `
                                <div style="margin-top:5px; font-size:11px; color:#d35400;">
                                    <i>${r}</i>
                                </div>`;
                        }
                    }
                }
                
                let desc = loc.description || '';
                if (desc) desc = desc.charAt(0).toUpperCase() + desc.slice(1);

                const marker = L.circleMarker([lat, lon], {
                    color: '#fff',
                    weight: 1,
                    fillColor: color,
                    fillOpacity: 0.8,
                    radius
                }).addTo(map);

                // Popup-indeling
                marker.bindPopup(`
                    <b>${loc.name}</b><br>
                    <small style="color:#555">${desc}</small>
                    ${remarkHtml}
                    <hr style="margin:10px 0; border-top:1px solid #eee">
                    <div><b>Period:</b> ${period}</div>
                    <div><b>Tube ID:</b> ${tubeId}</div>
                    <div>
                        <b>NO₂ concentration:</b>
                        <b style="color:${color}">${valueText}</b>
                    </div>
                `);

                markers.push(marker);
            });
        }

        // 4. Slider bediening
        const slider = document.querySelector('.time-slider');
        if (slider && uniquePeriods.length) {
            slider.max = uniquePeriods.length - 1;
            slider.value = slider.max;

            slider.addEventListener('input', e => {
                updateMapDisplay(uniquePeriods[e.target.value]);
            });

            updateMapDisplay(uniquePeriods[slider.value]);
        }

    } catch (err) {
        console.error('Map loading failed:', err);
    }
});

// Kleurenschaal
function getColor(value) {
    if (value > 40) return '#e74c3c';
    if (value > 10) return '#f39c12';
    return '#27ae60';
}