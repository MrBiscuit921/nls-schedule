const mongoose = require("mongoose");

const ClassificationSchema = new mongoose.Schema({
    type: { type: String, required: true, enum: ["driver", "team"] },
    category: { type: String, required: true }, // e.g. "overall", "sp9", "at2", etc.
    data: { type: mongoose.Schema.Types.Mixed, required: true }, // flexible field to store classification data
    lastUpdated: { type: Date, default: Date.now },
});

ClassificationSchema.index({ type: 1, category: 1 }, { unique: true }); // Ensure unique classification per type and category

module.exports = mongoose.model("Classification", ClassificationSchema);