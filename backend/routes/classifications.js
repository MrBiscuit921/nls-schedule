const express = require("express");
const router = express.Router();
const Classification = require("../models/Classification");
const {
  fetchDriverClassification,
  fetchTeamClassification,
} = require("../services/wikipediaService");

// GET /api/classifications/drivers - get all driver classifications merged
router.get("/drivers", async (req, res) => {
  const {category = "overall"} = req.query;
  const {merged} = req.query;

  try {
    if (merged === "true") {
      // Return ALL driver classifications merged together
      const allDocuments = await Classification.find({type: "driver"});
      const mergedData = [];

      for (const doc of allDocuments) {
        if (Array.isArray(doc.data)) {
          const dataWithClass = doc.data.map((row) => ({
            ...row,
            _Classification: doc.category, // Add classification name
          }));
          mergedData.push(...dataWithClass);
        }
      }

      return res.json(mergedData);
    }

    // Original single category behavior
    const document = await Classification.findOne({type: "driver", category});
    if (!document) {
      return res.status(404).json({error: "Classification not found"});
    }
    res.json(document.data);
  } catch (error) {
    console.error("Error fetching driver classification:", error);
    res.status(500).json({error: "Internal server error"});
  }
});

// GET /api/classifications/teams - get all team classifications merged
router.get("/teams", async (req, res) => {
  const {category = "overall"} = req.query;
  const {merged} = req.query;

  try {
    if (merged === "true") {
      // Return ALL team classifications merged together
      const allDocuments = await Classification.find({type: "team"});
      const mergedData = [];

      for (const doc of allDocuments) {
        if (Array.isArray(doc.data)) {
          const dataWithClass = doc.data.map((row) => ({
            ...row,
            _Classification: doc.category, // Add classification name
          }));
          mergedData.push(...dataWithClass);
        }
      }

      return res.json(mergedData);
    }

    // Original single category behavior
    const document = await Classification.findOne({type: "team", category});
    if (!document) {
      return res.status(404).json({error: "Classification not found"});
    }
    res.json(document.data);
  } catch (error) {
    console.error("Error fetching team classification:", error);
    res.status(500).json({error: "Internal server error"});
  }
});

// POST /api/classifications/refresh - triggers a refresh of classifications from Wikipedia
router.post("/refresh", async (req, res) => {
  try {
    console.log("Starting classifications refresh...");
    const driverData = await fetchDriverClassification();
    const teamData = await fetchTeamClassification();

    console.log("Driver data received:", {
      hasOverall: !!driverData.overall,
      overallLength: driverData.overall ? driverData.overall.length : 0,
      classCount: Object.keys(driverData.classes || {}).length,
    });

    console.log("Team data received:", {
      hasOverall: !!teamData.overall,
      overallLength: teamData.overall ? teamData.overall.length : 0,
      classCount: Object.keys(teamData.classes || {}).length,
    });

    // Check if we got any data
    if (!driverData || !driverData.overall || driverData.overall.length === 0) {
      console.error("No driver data returned from Wikipedia");
      return res.status(400).json({
        error:
          "Failed to fetch driver classifications from Wikipedia. The page structure may have changed.",
      });
    }

    if (!teamData || !teamData.overall || teamData.overall.length === 0) {
      console.error("No team data returned from Wikipedia");
      return res.status(400).json({
        error:
          "Failed to fetch team classifications from Wikipedia. The page structure may have changed.",
      });
    }

    // store overall driver classification
    await Classification.findOneAndUpdate(
      {type: "driver", category: "overall"},
      {
        type: "driver",
        category: "overall",
        data: driverData.overall,
        lastUpdated: new Date(),
      },
      {upsert: true, returnDocument: "after"},
    );

    // store each driver class
    if (driverData.classes && Object.keys(driverData.classes).length > 0) {
      for (const [category, data] of Object.entries(driverData.classes)) {
        if (data && data.length > 0) {
          await Classification.findOneAndUpdate(
            {type: "driver", category: category},
            {
              type: "driver",
              category: category,
              data: data,
              lastUpdated: new Date(),
            },
            {upsert: true, returnDocument: "after"},
          );
        }
      }
    }

    // store overall team classification
    await Classification.findOneAndUpdate(
      {type: "team", category: "overall"},
      {
        type: "team",
        category: "overall",
        data: teamData.overall,
        lastUpdated: new Date(),
      },
      {upsert: true, returnDocument: "after"},
    );

    // store each team class
    if (teamData.classes && Object.keys(teamData.classes).length > 0) {
      for (const [category, data] of Object.entries(teamData.classes)) {
        if (data && data.length > 0) {
          await Classification.findOneAndUpdate(
            {type: "team", category: category},
            {
              type: "team",
              category: category,
              data: data,
              lastUpdated: new Date(),
            },
            {upsert: true, returnDocument: "after"},
          );
        }
      }
    }

    console.log("✓ Classifications refreshed successfully");
    res.json({message: "Classifications refreshed successfully"});
  } catch (error) {
    console.error("Error refreshing classifications:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});

module.exports = router;
