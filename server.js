require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const Measurement = require("./src/models/measurement");


const app = express();
const PORT = 3000;

async function connectDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");
}

connectDb().catch((err) => {
  console.error("❌ MongoDB connect error:", err.message);
  process.exit(1);
});


app.set("view engine", "ejs");
app.set("views", "views");

app.use(expressLayouts);
app.set("layout", "layout"); // gebruikt views/layout.ejs


app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index", {
    title: "Air Quality Ghana"
  });
});

app.get("/api/no2", async (req, res) => {
  const data = await Measurement.find({})
    .sort({ start: -1 })
    .limit(200)
    .lean();

  res.json(data);
});


app.listen(PORT, () => {
  console.log(`✅ Server draait op http://localhost:${PORT}`);
});