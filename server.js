require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");

const mapController = require("./src/controllers/mapController");
const Measurement = require("./src/models/measurement");

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
app.set("layout", "layout");
app.use(express.static("public"));


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

// API: Locaties ophalen (via Controller)
app.get("/api/locations", mapController.getLocations);

// API: NO2 Data ophalen (Direct uit Database)
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

// 404 Handler (Als pagina niet bestaat)
app.use((req, res) => res.status(404).send("<h1>404 - Pagina niet gevonden</h1>"));

// Start de Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});