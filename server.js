require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");
const ExcelJS = require("exceljs");

const Measurement = require("./src/models/measurement");
const Location = require("./src/models/location");

const app = express();
const session = require("express-session");
const MongoStore = require("connect-mongo").default;

const PORT = process.env.PORT || 3000;

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

// body parsing voor forms
app.use(express.urlencoded({ extended: true }));

// sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // secure: true, // aanzetten bij https deploy
      maxAge: 1000 * 60 * 60 * 8, // 8 uur
    },
  })
);

// auth guard
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect("/admin/login");
}

// ---------------- ROUTES ----------------

app.use((req, res, next) => {
  if (req.path === "/") res.locals.activePage = "home";
  else if (req.path.startsWith("/map")) res.locals.activePage = "map";
  else if (req.path.startsWith("/download")) res.locals.activePage = "download";
  else if (req.path.startsWith("/admin")) res.locals.activePage = "admin";
  else res.locals.activePage = "";
  next();
});

// Home Pagina
app.get("/", (req, res) => {
  res.render("index", { title: "Home" });
});

app.use((req, res, next) => {
  if (req.path === "/") res.locals.activePage = "home";
  else if (req.path.startsWith("/map")) res.locals.activePage = "map";
  else if (req.path.startsWith("/download")) res.locals.activePage = "download";
  else if (req.path.startsWith("/admin")) res.locals.activePage = "admin";
  else res.locals.activePage = "";
  next();
});

// Home Pagina
app.get("/", (req, res) => {
  res.render("index", { title: "Home" });
});

// Admin login pagina
app.get("/admin/login", (req, res) => {
  res.render("admin/login", {
    title: "Admin login",
    error: null,
    activePage: "admin",
  });
});

// login route
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.isAdmin = true;
    return res.redirect("/admin");
  }

  return res.status(401).render("admin/login", {
    title: "Admin login",
    error: "Incorrect username or password",
    activePage: "admin",
  });
});

// logout route
app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.get("/admin", requireAdmin, async (req, res) => {
  const locationCount = await Location.countDocuments();
  const measurementCount = await Measurement.countDocuments();

  res.render("admin/index", {
    title: "Admin",
    locationCount,
    measurementCount,
    activePage: "admin",
  });
});

app.get("/admin/locations/new", requireAdmin, (req, res) => {
  res.render("admin/new-location", {
    title: "Add location",
    error: null,
    activePage: "admin",
  });
});

app.post("/admin/locations", requireAdmin, async (req, res) => {
  try {
    const { locationId, name, lat, lon, description } = req.body;

    const latNum = Number(lat);
    const lonNum = Number(lon);

    if (!locationId || !name || Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      return res.status(400).render("admin/new-location", {
        title: "Add location",
        error: "Fill in Location ID, name, latitude and longitude.",
        activePage: "admin",
      });
    }

    await Location.create({
      locationId: locationId.trim(),
      name: name.trim(),
      lat: latNum,
      lon: lonNum,
      description: (description || "").trim(),
    });

    res.redirect("/admin");
  } catch (err) {
    res.status(500).render("admin/new-location", {
      title: "Add location",
      error: err.message,
      activePage: "admin",
    });
  }
});

app.get("/admin/measurements/new", requireAdmin, async (req, res) => {
  const locations = await Location.find({}).sort({ locationId: 1 }).lean();

  res.render("admin/new-measurement", {
    title: "Add measurement",
    error: null,
    locations,
    activePage: "admin",
  });
});

app.post("/admin/measurements", requireAdmin, async (req, res) => {
  try {
    const { locationId, tubeId, period, no2 } = req.body;

    const periodOk = /^\d{4}-\d{2}$/.test(period || "");
    const no2Num = Number(no2);

    if (!locationId || !periodOk || Number.isNaN(no2Num)) {
      const locations = await Location.find({}).sort({ locationId: 1 }).lean();
      return res.status(400).render("admin/new-measurement", {
        title: "Add measurement",
        error: "Choose a location, use period YYYY-MM, and enter a NO₂ number.",
        locations,
        activePage: "admin",
      });
    }

    await Measurement.create({
      locationId: locationId.trim(),
      tubeId: (tubeId || "").trim() || null,
      period: period.trim(),
      no2: no2Num,
      start: null,
      end: null,
      remarks: null,
    });

    res.redirect("/admin");
  } catch (err) {
    const locations = await Location.find({}).sort({ locationId: 1 }).lean();
    res.status(500).render("admin/new-measurement", {
      title: "Add measurement",
      error: err.message,
      locations,
      activePage: "admin",
    });
  }
});

// LIST: locaties
app.get("/admin/locations", requireAdmin, async (req, res) => {
  const q = (req.query.q || "").trim();

  const filter = q
    ? {
        $or: [
          { locationId: { $regex: q, $options: "i" } },
          { name: { $regex: q, $options: "i" } },
        ],
      }
    : {};

  const locations = await Location.find(filter).sort({ locationId: 1 }).lean();

  res.render("admin/locations", {
    title: "Locations",
    locations,
    q,
    activePage: "admin",
  });
});

// EDIT FORM: locatie
app.get("/admin/locations/:id/edit", requireAdmin, async (req, res) => {
  const location = await Location.findById(req.params.id).lean();
  if (!location) return res.status(404).send("Location not found");

  res.render("admin/edit-location", {
    title: "Edit location",
    location,
    error: null,
    activePage: "admin",
  });
});

// EDIT POST: locatie opslaan
app.post("/admin/locations/:id", requireAdmin, async (req, res) => {
  try {
    const { locationId, name, lat, lon, description } = req.body;

    const latNum = Number(lat);
    const lonNum = Number(lon);

    if (!locationId || !name || Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      const location = await Location.findById(req.params.id).lean();
      return res.status(400).render("admin/edit-location", {
        title: "Edit location",
        location,
        error: "Fill in Location ID, name, latitude and longitude.",
        activePage: "admin",
      });
    }

    await Location.findByIdAndUpdate(req.params.id, {
      locationId: locationId.trim(),
      name: name.trim(),
      lat: latNum,
      lon: lonNum,
      description: (description || "").trim(),
    });

    res.redirect("/admin/locations");
  } catch (err) {
    const location = await Location.findById(req.params.id).lean();
    res.status(500).render("admin/edit-location", {
      title: "Edit location",
      location,
      error: err.message,
      activePage: "admin",
    });
  }
});

// DELETE: locatie (en gekoppelde metingen)
app.post("/admin/locations/:id/delete", requireAdmin, async (req, res) => {
  const loc = await Location.findById(req.params.id).lean();
  if (!loc) return res.redirect("/admin/locations");

  await Location.findByIdAndDelete(req.params.id);
  await Measurement.deleteMany({ locationId: loc.locationId });

  res.redirect("/admin/locations");
});

// LIST: metingen
app.get("/admin/measurements", requireAdmin, async (req, res) => {
  const q = (req.query.q || "").trim();
  const locationId = (req.query.locationId || "").trim();
  const period = (req.query.period || "").trim();
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const perPage = 25;

  const filter = {};
  if (locationId) filter.locationId = locationId;
  if (period) filter.period = period;

  if (q) {
    filter.$or = [
      { tubeId: { $regex: q, $options: "i" } },
      { locationId: { $regex: q, $options: "i" } },
    ];
  }

  const total = await Measurement.countDocuments(filter);
  const totalPages = Math.max(Math.ceil(total / perPage), 1);
  const safePage = Math.min(page, totalPages);

  const measurements = await Measurement.find(filter)
    .sort({ period: -1, locationId: 1 })
    .skip((safePage - 1) * perPage)
    .limit(perPage)
    .lean();

  const locationIds = await Location.find({}, { locationId: 1, _id: 0 })
    .sort({ locationId: 1 })
    .lean();

  const periods = await Measurement.distinct("period");

  res.render("admin/measurements", {
    title: "Measurements",
    measurements,
    q,
    locationId,
    period,
    locationIds: locationIds.map((x) => x.locationId),
    periods: periods.sort().reverse(),
    page: safePage,
    totalPages,
    total,
    perPage,
    activePage: "admin",
  });
});

// EDIT FORM: meting
app.get("/admin/measurements/:id/edit", requireAdmin, async (req, res) => {
  const measurement = await Measurement.findById(req.params.id).lean();
  if (!measurement) return res.status(404).send("Measurement not found");

  const locations = await Location.find({}).sort({ locationId: 1 }).lean();
  res.render("admin/edit-measurement", {
    title: "Edit measurement",
    measurement,
    locations,
    error: null,
    activePage: "admin",
  });
});

// EDIT POST: meting opslaan
app.post("/admin/measurements/:id", requireAdmin, async (req, res) => {
  try {
    const { locationId, tubeId, period, no2 } = req.body;

    const periodOk = /^\d{4}-\d{2}$/.test(period || "");
    const no2Num = Number(no2);

    if (!locationId || !periodOk || Number.isNaN(no2Num)) {
      const measurement = await Measurement.findById(req.params.id).lean();
      const locations = await Location.find({}).sort({ locationId: 1 }).lean();
      return res.status(400).render("admin/edit-measurement", {
        title: "Edit measurement",
        measurement,
        locations,
        error: "Choose a location, use period YYYY-MM, and enter a NO₂ number.",
        activePage: "admin",
      });
    }

    await Measurement.findByIdAndUpdate(req.params.id, {
      locationId: locationId.trim(),
      tubeId: (tubeId || "").trim() || null,
      period: period.trim(),
      no2: no2Num,
    });

    res.redirect("/admin/measurements");
  } catch (err) {
    const measurement = await Measurement.findById(req.params.id).lean();
    const locations = await Location.find({}).sort({ locationId: 1 }).lean();
    res.status(500).render("admin/edit-measurement", {
      title: "Edit measurement",
      measurement,
      locations,
      error: err.message,
      activePage: "admin",
    });
  }
});

// DELETE: meting
app.post("/admin/measurements/:id/delete", requireAdmin, async (req, res) => {
  await Measurement.findByIdAndDelete(req.params.id);
  res.redirect("/admin/measurements");
});

app.get("/map", (req, res) => {
  res.render("map", { title: "Map" });
});

app.get("/download", (req, res) => {
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

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // escape quotes, wrap if needed
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

app.get("/download/no2.csv", async (req, res) => {
  try {
    const measurements = await Measurement.find({})
      .sort({ period: -1, locationId: 1 })
      .lean();

    const headers = [
      "Tube ID",
      "Location ID",
      "Period",
      "Start",
      "End",
      "NO2",
      "Remarks",
    ];
    const lines = [headers.join(",")];

    for (const m of measurements) {
      lines.push(
        [
          csvEscape(m.tubeId),
          csvEscape(m.locationId),
          csvEscape(m.period),
          csvEscape(m.start),
          csvEscape(m.end),
          csvEscape(m.no2),
          csvEscape(m.remarks),
        ].join(",")
      );
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="no2-data.csv"');
    res.send(lines.join("\n"));
  } catch (err) {
    console.error(err);
    res.status(500).send("CSV download failed");
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

app.get("/download/locations.csv", async (req, res) => {
  const locations = await Location.find({}).sort({ locationId: 1 }).lean();

  const headers = [
    "Location ID",
    "Name",
    "Latitude",
    "Longitude",
    "Description",
  ];

  const rows = locations.map((loc) => [
    loc.locationId,
    loc.name,
    loc.lat,
    loc.lon,
    loc.description || "",
  ]);

  const csv =
    headers.join(",") +
    "\n" +
    rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="locations.csv"');

  res.send(csv);
});

app.get("/download/locations.xlsx", async (req, res) => {
  const locations = await Location.find({}).sort({ locationId: 1 }).lean();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Locations");

  ws.columns = [
    { header: "Location ID", key: "locationId" },
    { header: "Name", key: "name" },
    { header: "Latitude", key: "lat" },
    { header: "Longitude", key: "lon" },
    { header: "Description", key: "description" },
  ];

  locations.forEach((loc) => {
    ws.addRow({
      locationId: loc.locationId,
      name: loc.name,
      lat: loc.lat,
      lon: loc.lon,
      description: loc.description || "",
    });
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="locations.xlsx"');

  await wb.xlsx.write(res);
  res.end();
});

// API: Data voor de kaart
app.get("/api/locations", async (req, res) => {
  try {
    // 1. Haal data op
    const [locations, measurements] = await Promise.all([
      Location.find({}).lean(),
      Measurement.find({}).lean(),
    ]);

    // Hulpfunctie om IDs te normaliseren
    const cleanId = (id) =>
      String(id || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    // 2. Maak een index van metingen per locatie
    const measurementsByLoc = new Map();

    measurements.forEach((m) => {
      const locId = cleanId(m.locationId);
      if (!locId) return;

      if (!measurementsByLoc.has(locId)) {
        measurementsByLoc.set(locId, []);
      }
      measurementsByLoc.get(locId).push(m);
    });

    // 3. Bouw het resultaat
    const result = locations.map((loc) => {
      // ✅ Zorg dat locationId altijd wordt meegestuurd
      const rawLocationId =
        loc.locationId || loc["Location ID"] || loc.location_id || loc.id || "";

      const locId = cleanId(rawLocationId);
      const myData = (locId && measurementsByLoc.get(locId)) || [];

      // Sorteer historie op datum
      myData.sort((a, b) => new Date(a.start) - new Date(b.start));

      return {
        locationId: String(rawLocationId || "").trim(), // ✅ toegevoegd
        name: loc.name,
        lat: loc.lat,
        lon: loc.lon,
        description: loc.description,
        history: myData.map((m) => ({
          // Formatteer datum naar YYYY-MM
          dateStr: m.period
            ? String(m.period)
            : m.start
              ? new Date(m.start).toISOString().slice(0, 7)
              : "Unknown",
          rawDate: m.start,
          val: m.no2,
          tubeId: m.tubeId,
          remarks: m.remarks,
        })),
      };
    });

    res.json(result);
  } catch (err) {
    console.error("API Fout:", err);
    res.status(500).json({ error: "Internal Server Error", data: [] });
  }
});

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
app.use((req, res) => res.status(404).send("<h1>404 - Page not found</h1>"));

// Start de Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
