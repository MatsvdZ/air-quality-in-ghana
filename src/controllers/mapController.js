const Location = require("../models/location");
const Measurement = require("../models/measurement");

exports.getLocations = async (req, res) => {
    try {
        // 1. Haal alle ruwe data op
        const locations = await Location.find({}).lean();
        const measurements = await Measurement.find({}).lean();

        // 2. Koppel metingen aan locaties
        const result = locations.map(loc => {
            // Check verschillende schrijfwijzen van ID
            const locId = loc.locationId || loc["Location ID"] || loc.LocationID;
            
            // Zoek de metingen die bij deze locatie horen
            const myData = measurements.filter(m => {
                const measLocId = m.locationId || m["Location ID"];
                // We gebruiken String() en trim() om zeker te weten dat ze matchen
                return String(measLocId).trim() === String(locId).trim();
            });

            // 3. Sorteer op datum (Oud -> Nieuw) voor de slider
            myData.sort((a, b) => new Date(a.start) - new Date(b.start));

            // 4. Maak een lijstje 'geschiedenis'
            const history = myData.map(m => ({
                dateStr: new Date(m.start).toISOString().slice(0, 7), // Bijv: "2025-10"
                val: m.no2 || m.value || m["NO2 concentration"] // De waarde
            }));

            // 5. Stuur het 'schone' pakketje terug
            return {
                name: loc.Location || loc.name,
                lat: loc.Latitude || loc.lat,
                lon: loc.Longitude || loc.lon,
                description: loc.Description || loc.description,
                history: history
            };
        });

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json([]); // Stuur lege lijst bij fout
    }
};