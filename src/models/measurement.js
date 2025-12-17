const mongoose = require("mongoose");

const measurementSchema = new mongoose.Schema(
  {
    tubeId: String,
    locationId: { type: String, index: true },
    period: String,

    start: { type: Date, index: true },
    end: Date,

    no2: Number,
    remarks: String,

    raw: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Measurement", measurementSchema);