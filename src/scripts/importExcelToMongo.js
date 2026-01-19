/**
 * Import Excel → MongoDB
 * Sheet 0: NO2 measurements
 * Sheet 1: Locations
 */

require("dotenv").config();

const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const path = require("path");

const Measurement = require("../models/measurement");
const Location = require("../models/location");

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function normHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseCellValue(value) {
  if (value == null) return null;

  if (typeof value === "object") {
    if (value.text) return value.text;
    if (value.result) return value.result;
  }

  return value;
}

// ─────────────────────────────────────────────
// Main import function
// ─────────────────────────────────────────────

async function run() {
  console.log("🚀 Starting Excel import…");

  // 1️⃣ Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  // 2️⃣ Load Excel file
  const excelPath = path.join(
    __dirname,
    "..",
    "..",
    "data",
    "source",
    "latest.xlsx"
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  // ─────────────────────────────────────────────
  // SHEET 0 — MEASUREMENTS
  // ─────────────────────────────────────────────

  const measurementSheet = workbook.worksheets[0];
  if (!measurementSheet) {
    throw new Error("❌ Measurement sheet not found");
  }

  console.log("📄 Parsing measurements…");

  const measurementHeaders = {};
  measurementSheet.getRow(1).eachCell((cell, col) => {
    measurementHeaders[col] = normHeader(cell.text);
  });

  const measurements = [];

  measurementSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const obj = {};
    row.eachCell((cell, col) => {
      const key = measurementHeaders[col];
      if (!key) return;
      obj[key] = parseCellValue(cell.value);
    });

    // Vul startdatetime in als die mist maar period er is
    if ((!obj.startdatetime || obj.startdatetime === '') && obj.period) {
        obj.startdatetime = obj.period;
    }

    const doc = {
      tubeId: obj.tube_id ?? null,
      locationId: obj.location_id ?? null,
      period: obj.period ? new Date(obj.period) : null,
      start: obj.startdatetime ? new Date(obj.startdatetime) : null,
      end: obj.enddatetime ? new Date(obj.enddatetime) : null,
      no2: obj.no2_concentration != null ? Number(obj.no2_concentration) : null,
      remarks: obj.remarks ?? null,
      raw: obj,
    };

    // Validatie
    if (!obj.location_id || !obj.startdatetime) return;

    measurements.push(doc);
  });

  console.log(`✅ Parsed ${measurements.length} measurements`);

  // ─────────────────────────────────────────────
  // SHEET 1 — LOCATIONS
  // ─────────────────────────────────────────────

  const locationSheet = workbook.worksheets[1];
  if (!locationSheet) {
    throw new Error("❌ Location sheet not found");
  }

  console.log("📍 Parsing locations…");

  const locationHeaders = {};
  locationSheet.getRow(1).eachCell((cell, col) => {
    locationHeaders[col] = normHeader(cell.text);
  });

  const locations = [];

  locationSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const obj = {};
    row.eachCell((cell, col) => {
      const key = locationHeaders[col];
      if (!key) return;
      obj[key] = parseCellValue(cell.value);
    });

    const loc = {
      locationId: obj.location_id ?? null,
      name: obj.location ?? null,
      lat: obj.latitude != null ? Number(obj.latitude) : null,
      lon: obj.longitude != null ? Number(obj.longitude) : null,
      description: obj.description ?? null,
    };

    if (!loc.locationId) return;

    locations.push(loc);
  });

  console.log(`✅ Parsed ${locations.length} locations`);

  // ─────────────────────────────────────────────
  // STORE IN DATABASE
  // ─────────────────────────────────────────────

  console.log("💾 Writing to database…");

  // (optioneel) eerst leegmaken
  await Measurement.deleteMany({});
  await Location.deleteMany({});

  await Measurement.insertMany(measurements, { ordered: false });
  await Location.insertMany(locations, { ordered: false });

  console.log("🎉 Import complete!");
  console.log(`   Measurements: ${measurements.length}`);
  console.log(`   Locations:    ${locations.length}`);

  await mongoose.disconnect();
  console.log("👋 Disconnected from MongoDB");
}

// ─────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────

run().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
