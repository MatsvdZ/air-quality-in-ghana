const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  locationId: { type: String, unique: true, index: true },
  name: String,
  lat: Number,
  lon: Number,
  description: String,
});

module.exports = mongoose.model("Location", locationSchema);
