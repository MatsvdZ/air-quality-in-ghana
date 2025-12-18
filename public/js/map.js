document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.querySelector('.kumasi-map');

    // Alleen uitvoeren als de mapElement bestaat
    if (mapElement) {
        const kumasiLat = 6.6885;
        const kumasiLng = -1.6244;

        // Maak de kaart aan
        const map = L.map(mapElement).setView([kumasiLat, kumasiLng], 13);

        // Voeg de kaartlaag toe
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        // Zet een marker op de kaart
        L.marker([kumasiLat, kumasiLng]).addTo(map)
            .bindPopup("<b>Kumasi</b>")
            .openPopup();
    }
});