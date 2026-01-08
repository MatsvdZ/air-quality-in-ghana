document.addEventListener('DOMContentLoaded', async () => {
    const mapElement = document.querySelector('.kumasi-map');
    if (!mapElement) return;

    // 1. Kaart initialiseren (Startpunt Kumasi)
    const map = L.map(mapElement).setView([6.6625, -1.6104], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    let allLocations = [];
    let uniqueDates = [];
    let mapMarkers = [];

    // 2. Data ophalen
    try {
        const response = await fetch('/api/locations');
        allLocations = await response.json();
        
        // Verzamelen van alle datums
        const dateSet = new Set();
        allLocations.forEach(loc => {
            loc.history.forEach(item => {
                if(item.dateStr) dateSet.add(item.dateStr);
            });
        });
        uniqueDates = Array.from(dateSet).sort(); // Sorteren
        
        console.log("📅 Datums:", uniqueDates);

        // Slider instellen
        const slider = document.querySelector('.time-slider');
        const dateLabel = document.querySelector('.date-label');
        
        if (uniqueDates.length > 0) {
            slider.max = uniqueDates.length - 1;
            slider.value = uniqueDates.length - 1; // Begin bij nieuwste datum
            updateMapDisplay(uniqueDates.length - 1);
        } else {
            if(dateLabel) dateLabel.innerText = "Geen data";
        }

        // Het verschuiven van de slider
        slider.addEventListener('input', (e) => {
            updateMapDisplay(parseInt(e.target.value));
        });

        // Update functie
        function updateMapDisplay(index) {
            const selectedDate = uniqueDates[index]; // Bijv: "2025-10"
            
            // Update tekst boven slider
            if(dateLabel) dateLabel.innerText = `Month: ${selectedDate}`;

            // Verwijder oude cirkels
            mapMarkers.forEach(marker => map.removeLayer(marker));
            mapMarkers = [];

            // Loop langs alle locaties
            allLocations.forEach(loc => {
                if (loc.lat && loc.lon) {
                    
                    // Zoek meting voor deze datum
                    const measurement = loc.history.find(h => h.dateStr === selectedDate);
                    
                    let color = '#999'; // Standaard grijs
                    let valText = 'No data';
                    let radius = 5;

                    if (measurement) {
                        const rawVal = measurement.val;
                        if (rawVal !== undefined) {
                            const val = parseFloat(rawVal);
                            color = getColor(val);
                            valText = `${val.toFixed(1)} µg/m³`;
                            radius = 10; // Iets groter als er data is
                        }
                    }

                    // Teken nieuwe cirkel
                    const marker = L.circleMarker([loc.lat, loc.lon], {
                        color: 'white', weight: 1,
                        fillColor: color, fillOpacity: 0.8,
                        radius: radius
                    }).addTo(map);

                    // De popup
                    marker.bindPopup(`
                        <b>${loc.name}</b><br>
                        <small style="color:#555">${loc.description || ''}</small>
                        <hr style="margin:5px 0; border:0; border-top:1px solid #eee">
                        Month: ${selectedDate}<br>
                        Value: <b style="color:${color}">${valText}</b>
                    `);

                    mapMarkers.push(marker);
                }
            });
        }

    } catch (error) {
        console.error("Fout:", error);
    }
});

// Kleuren bepalen functie (WHO Richtlijnen)
function getColor(d) {
    if (d > 40) return '#e74c3c'; // Rood (Slecht)
    if (d > 10) return '#f39c12'; // Oranje (Matig)
    return '#27ae60'; // Groen (Goed)
}