const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
  type: {type: String, required: true}, // practice, quali, race
  label: {type: String, required: true},
  date: {type: String, required: true}, // YYYY-MM-DD
  start: {type: Number, required: true}, // hours in 24h format
  startMin: {type: Number, default: 0}, // minutes after the hour
  end: {type: Number, required: true},
  endMin: {type: Number, default: 0},
  endDate: {type: String}, // optional end date for sessions that go past midnight
});

const DaySchema = new mongoose.Schema({
  label: {type: String, required: true}, // eg Thursday 16 Apr
  sessions: [SessionSchema],
});

const RoundSchema = new mongoose.Schema({
  id: {type: String, required: true, unique: true}, // eg "NLS1"
  name: {type: String, required: true},
  shortDate: {type: String, required: true}, // eg "16 Apr"
  days: [DaySchema],
});

module.exports = mongoose.model("Round", RoundSchema);
