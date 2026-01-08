document.addEventListener('DOMContentLoaded', async () => {
    const mapElement = document.querySelector('.kumasi-map');

    // Stop als er geen kaart op deze pagina staat
    if (!mapElement) {
        console.warn("⚠️ Map element not found on this page.");
        return;
    }

    console.log("🗺️ Initializing map...");

    // 1. Kaart initialiseren (Startpunt Kumasi)
    const map = L.map(mapElement).setView([6.6885, -1.6244], 12);

    // Tegels laden (OpenStreetMap)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // 2. Data ophalen via de API
    try {
        console.log("🔄 Fetching location data from server...");
        
        // Vraag de server om de JSON data
        const response = await fetch('/api/locations');
        
        // Check of het verzoek gelukt is
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Zet de data om in een leesbare lijst
        const locations = await response.json();
        console.log(`✅ Data received: ${locations.length} locations.`);

// 3. Loop door alle locaties en zet markers
        locations.forEach(loc => {
            if (loc.lat && loc.lon) {
                
                // We pakken de beschrijving of een lege tekst als die er niet is
                let desc = loc.description || '';
                
                // Als er tekst is, maak de eerste letter een hoofdletter
                if (desc.length > 0) {
                    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
                }
                // ---------------------------------

                L.marker([loc.lat, loc.lon])
                    .addTo(map)
                    .bindPopup(`
                        <b>${loc.name}</b><br>
                        <small>${desc}</small>
                    `);
            }
        });

    } catch (error) {
        console.error("❌ Error loading map data:", error);
    }
});