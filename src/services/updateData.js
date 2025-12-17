const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

async function updateDataFromExcelUrl(excelUrl) {
  // 1) Download de Excel via de link
  const res = await fetch(excelUrl);
  if (!res.ok) throw new Error(`Excel download failed: ${res.status} ${res.statusText}`);

  // 2) Zet download om naar buffer
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 3) Lees de Excel in vanuit de buffer
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const ws = workbook.worksheets[0];
  if (!ws) throw new Error("No worksheet found in Excel");

  // 4) Lees headers uit rij 1
  const headers = {};
  ws.getRow(1).eachCell((cell, col) => {
    headers[col] = normalizeHeader(cell.text);
  });

  // 5) Lees data rijen
  const data = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const obj = {};
    row.eachCell((cell, col) => {
      const key = headers[col];
      if (!key) return;

      let value = cell.value;

      // ExcelJS kan objecten teruggeven (richText, formula, etc.)
      if (value && typeof value === "object") {
        if (value.text) value = value.text;         // sommige cellen
        else if (value.result) value = value.result; // formules
      }

      obj[key] = value ?? null;
    });

    // skip lege rijen (optioneel)
    const empty = Object.values(obj).every(v => v === null || v === "");
    if (!empty) data.push(obj);
  });

  // 6) Schrijf JSON output naar public/data/latest.json
  const outPath = path.join(__dirname, "../../public/data/latest.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const payload = {
    updatedAt: new Date().toISOString(),
    rowCount: data.length,
    data,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");

  return payload;
}

module.exports = { updateDataFromExcelUrl };