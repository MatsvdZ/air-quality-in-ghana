require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");

// Modellen importeren
const Measurement = require("./src/models/measurement");
const Location = require("./src/models/location");

const app = express();
const PORT = 3000;

// 1. Verbinden met Database
// Functie om verbinding te maken
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1); // Stop de server als de DB niet werkt
  }
};

connectDB();

// 2. Instellingen (EJS, Layouts, Public folder)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout"); // Verwijst naar views/layout.ejs
app.use(express.static("public")); // Voor css en js bestanden

// ---------------- ROUTES ----------------

// Home Pagina
app.get("/", (req, res) => {
  res.render("index", {
    title: "Air Quality Ghana"
  });
});

// Map Pagina
app.get("/map", (req, res) => {
  res.render("map", {
    title: "Map of Air Quality Ghana"
  });
});

// API: Locaties ophalen (Voor de kaart)
app.get("/api/locations", async (req, res) => {
  try {
    const locations = await Location.find({});
    console.log(`📡 API: Sending ${locations.length} locations to client`);
    res.json(locations);
  } catch (err) {
    console.error("❌ API Error (Locations):", err);
    res.status(500).json({ error: "Could not fetch locations" });
  }
});

// API: NO2 Data ophalen (Voor de test JSON)
app.get("/api/no2", async (req, res) => {
  try {
    const data = await Measurement.find({})
      .sort({ start: -1 })
      .limit(200)
      .lean();

    console.log(`📡 API: Sending ${data.length} measurements to client`);
    res.json(data);
  } catch (err) {
    console.error("❌ API Error (NO2):", err);
    res.status(500).json({ error: "Could not fetch measurements" });
  }
});

// Start de Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});