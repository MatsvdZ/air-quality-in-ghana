require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");
const ExcelJS = require("exceljs");

const mapController = require("./src/controllers/mapController");
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
app.set("layout", "layout");
app.use(express.static("public"));

// ---------------- ROUTES ----------------




app.use((req, res, next) => {
  res.locals.activePage = ""; // default zodat EJS nooit crasht
  next();
});


// Home Pagina
app.get("/", (req, res) => {
  res.locals.activePage = "home";
  res.render("index", { title: "Home" });
});

app.get("/map", (req, res) => {
  res.locals.activePage = "map";
  res.render("map", { title: "Map" });
});

app.get("/download", (req, res) => {
  res.locals.activePage = "download";
  res.render("download", { title: "Download" });
});

app.get("/download/no2.json", async (req, res) => {
  try {
    const data = await Measurement.find({}).sort({ start: -1 }).lean();

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="no2-data.json"'
    );

    res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    res.status(500).send("Download failed");
  }
});

app.get("/download/no2.xlsx", async (req, res) => {
  const measurements = await Measurement.find({}).sort({ start: -1 }).lean();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("NO2");

  ws.columns = [
    { header: "Tube ID", key: "tubeId" },
    { header: "Location ID", key: "locationId" },
    { header: "Period", key: "period" },
    { header: "Start", key: "start" },
    { header: "End", key: "end" },
    { header: "NO2", key: "no2" },
    { header: "Remarks", key: "remarks" },
  ];

  measurements.forEach((m) =>
    ws.addRow({
      tubeId: m.tubeId,
      locationId: m.locationId,
      period: m.period,
      start: m.start,
      end: m.end,
      no2: m.no2,
      remarks: m.remarks,
    })
  );

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="no2-data.xlsx"');

  await wb.xlsx.write(res);
  res.end();
});

app.get("/download/locations.json", async (req, res) => {
  const data = await Location.find({}).sort({ locationId: 1 }).lean();

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="locations.json"');

  res.send(JSON.stringify(data, null, 2));
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
app.use((req, res) =>
  res.status(404).send("<h1>404 - Pagina niet gevonden</h1>")
);

// Start de Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
