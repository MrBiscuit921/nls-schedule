/**
 * scheduler.js
 *
 * Auto-refreshes NLS classification data from Wikipedia on a smart schedule:
 *  - Checks every hour whether a refresh is needed
 *  - Refreshes if data is older than STALE_HOURS (default 6)
 *  - On race weekends (Saturday + Sunday) refreshes more aggressively (every 2h)
 *  - Always does one refresh on server startup if data is missing or stale
 *
 * Usage — add ONE line to your app entry point (e.g. server.js / index.js):
 *
 *   require("./services/scheduler");
 *
 * That's it. The scheduler self-starts and runs for the lifetime of the process.
 */

const Classification = require("../models/Classification");
const {
  fetchDriverClassification,
  fetchTeamClassification,
} = require("./wikipediaService");

// ─── Config ──────────────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour
const STALE_HOURS = 6; // normal staleness threshold
const RACE_WEEKEND_STALE = 2; // tighter threshold on race days

// NLS 2026 race weekend dates (Saturday of each event — Sunday is also covered).
// Update this list each season.
const RACE_WEEKENDS = [
  "2026-03-28", // NLS1
  "2026-04-11", // NLS2
  "2026-04-18", // NLS3 (24H qualifier weekend)
  "2026-05-23", // 24H
  "2026-05-24",
  "2026-07-04", // NLS6
  "2026-08-01", // NLS7
  "2026-08-29", // NLS8
  "2026-09-26", // NLS9
  "2026-10-17", // NLS10
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function isRaceWeekend() {
  const today = todayUTC();
  // Also treat the day after each race date as a race weekend day
  // (results often finalised the following morning)
  return RACE_WEEKENDS.some((d) => {
    const raceDate = new Date(d);
    const dayAfter = new Date(raceDate);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    return today === d || today === dayAfter.toISOString().slice(0, 10);
  });
}

function staleThresholdHours() {
  return isRaceWeekend() ? RACE_WEEKEND_STALE : STALE_HOURS;
}

async function getOldestUpdate() {
  // Find the least-recently updated classification document
  const doc = await Classification.findOne().sort({lastUpdated: 1});
  return doc ? doc.lastUpdated : null;
}

function hoursAgo(date) {
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
}

// ─── Core refresh logic (mirrors classifications.js /refresh route) ───────────

async function runRefresh() {
  console.log(
    `[scheduler] Starting classifications refresh at ${new Date().toISOString()}`,
  );

  try {
    const [driverData, teamData] = await Promise.all([
      fetchDriverClassification(),
      fetchTeamClassification(),
    ]);

    if (!driverData?.overall?.length) {
      console.error("[scheduler] ⚠ No driver data returned — skipping save");
      return;
    }
    if (!teamData?.overall?.length) {
      console.error("[scheduler] ⚠ No team data returned — skipping save");
      return;
    }

    const now = new Date();
    const ops = [];

    // Driver overall
    ops.push(
      Classification.findOneAndUpdate(
        {type: "driver", category: "overall"},
        {
          type: "driver",
          category: "overall",
          data: driverData.overall,
          lastUpdated: now,
        },
        {upsert: true},
      ),
    );

    // Driver classes
    for (const [category, data] of Object.entries(driverData.classes || {})) {
      if (data?.length) {
        ops.push(
          Classification.findOneAndUpdate(
            {type: "driver", category},
            {type: "driver", category, data, lastUpdated: now},
            {upsert: true},
          ),
        );
      }
    }

    // Team overall
    ops.push(
      Classification.findOneAndUpdate(
        {type: "team", category: "overall"},
        {
          type: "team",
          category: "overall",
          data: teamData.overall,
          lastUpdated: now,
        },
        {upsert: true},
      ),
    );

    // Team classes
    for (const [category, data] of Object.entries(teamData.classes || {})) {
      if (data?.length) {
        ops.push(
          Classification.findOneAndUpdate(
            {type: "team", category},
            {type: "team", category, data, lastUpdated: now},
            {upsert: true},
          ),
        );
      }
    }

    await Promise.all(ops);
    console.log(
      `[scheduler] ✓ Refresh complete — ${ops.length} classifications saved`,
    );
  } catch (err) {
    console.error("[scheduler] ✗ Refresh failed:", err.message);
  }
}

// ─── Scheduler loop ───────────────────────────────────────────────────────────

async function checkAndRefresh() {
  try {
    const lastUpdated = await getOldestUpdate();
    const threshold = staleThresholdHours();

    if (!lastUpdated) {
      console.log("[scheduler] No data found — running initial refresh");
      await runRefresh();
      return;
    }

    const age = hoursAgo(lastUpdated);
    if (age >= threshold) {
      console.log(
        `[scheduler] Data is ${age.toFixed(1)}h old (threshold: ${threshold}h${isRaceWeekend() ? " — race weekend" : ""}) — refreshing`,
      );
      await runRefresh();
    } else {
      console.log(
        `[scheduler] Data is ${age.toFixed(1)}h old — no refresh needed (next check in 1h)`,
      );
    }
  } catch (err) {
    console.error("[scheduler] Check error:", err.message);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

// Run immediately on startup, then on the hourly interval
checkAndRefresh();
setInterval(checkAndRefresh, CHECK_INTERVAL_MS);

console.log("[scheduler] ✓ Auto-refresh scheduler started");
console.log(`[scheduler]   Normal interval : every ${STALE_HOURS}h`);
console.log(`[scheduler]   Race weekend    : every ${RACE_WEEKEND_STALE}h`);
console.log(`[scheduler]   Check frequency : every 1h`);
