require("dotenv").config();

const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const path = require("path");
const Measurement = require("../models/measurement");

function normHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

async function run() {
  // 🔹 CONNECT
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  const excelPath = path.join(__dirname, "../../data/source/latest.xlsx");

  // 🔹 READ EXCEL
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  const ws = workbook.worksheets[0];
  if (!ws) throw new Error("No worksheet found");

  // 🔹 HEADERS
  const headers = {};
  ws.getRow(1).eachCell((cell, col) => {
    headers[col] = normHeader(cell.text);
  });

  const docs = [];

  // 🔹 ROWS
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const obj = {};
    row.eachCell((cell, col) => {
      const key = headers[col];
      if (!key) return;

      let value = cell.value;
      if (value && typeof value === "object") {
        if (value.text) value = value.text;
        else if (value.result) value = value.result;
      }
      obj[key] = value ?? null;
    });

    const doc = {
      tubeId: obj.tube_id ?? null,
      locationId: obj.location_id ?? null,
      period: obj.period ?? null,

      start: obj.startdatetime ? new Date(obj.startdatetime) : null,
      end: obj.enddatetime ? new Date(obj.enddatetime) : null,

      no2:
        obj.no2_concentration != null
          ? Number(obj.no2_concentration)
          : null,

      remarks: obj.remarks ?? null,
      raw: obj,
    };

    // 🔹 VALIDATIE
    if (!doc.locationId || !doc.start || doc.no2 == null) return;

    docs.push(doc);
  });

  console.log(`📄 Parsed ${docs.length} rows`);

  // 🔹 INSERT
  const res = await Measurement.insertMany(docs, { ordered: false });
  console.log(`✅ Inserted ${res.length} documents`);

  // 🔹 DISCONNECT
  await mongoose.disconnect();
  console.log("👋 Done");
}


// 🔹 RUN SCRIPT
run().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});