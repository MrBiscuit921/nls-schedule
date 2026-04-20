import {useEffect, useState} from "react";
import axios from "axios";
import "../nls-styles.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export default function Standings() {
  const [driverData, setDriverData] = useState([]);
  const [teamData, setTeamData] = useState([]);
  const [driverCategory, setDriverCategory] = useState("all");
  const [teamCategory, setTeamCategory] = useState("all");
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [errorDrivers, setErrorDrivers] = useState(null);
  const [errorTeams, setErrorTeams] = useState(null);

  // Fetch driver standings - get ALL classifications merged
  useEffect(() => {
    const fetchAllDriverStandings = async () => {
      setLoadingDrivers(true);
      setErrorDrivers(null);
      try {
        const res = await axios.get(
          `${API_URL}/classifications/drivers?merged=true`,
        );
        const data = Array.isArray(res.data) ? res.data : res.data || [];
        setDriverData(data);
      } catch (err) {
        console.error("Error fetching driver standings:", err);
        setErrorDrivers(
          "No driver standings available. Please refresh from Wikipedia first.",
        );
        setDriverData([]);
      } finally {
        setLoadingDrivers(false);
      }
    };

    fetchAllDriverStandings();
  }, []);

  // Fetch team standings - get ALL classifications merged
  useEffect(() => {
    const fetchAllTeamStandings = async () => {
      setLoadingTeams(true);
      setErrorTeams(null);
      try {
        const res = await axios.get(
          `${API_URL}/classifications/teams?merged=true`,
        );
        const data = Array.isArray(res.data) ? res.data : res.data || [];
        setTeamData(data);
      } catch (err) {
        console.error("Error fetching team standings:", err);
        setErrorTeams(
          "No team standings available. Please refresh from Wikipedia first.",
        );
        setTeamData([]);
      } finally {
        setLoadingTeams(false);
      }
    };

    fetchAllTeamStandings();
  }, []);

  // Clean display value - strip HTML tags, wiki markup, and normalize text
  const cleanDisplayValue = (value) => {
    if (value === null || value === undefined) return "";
    let str = String(value);

    // Strip HTML tags completely (<br>, <span>, etc.)
    str = str.replace(/<[^>]*>/g, " ");

    // Strip wiki rowspan/colspan markup: rowspan=2| or rowspan="2" align="left"|
    str = str.replace(/rowspan\s*=\s*["']?\d+["']?\s*\|?\s*/gi, "");
    str = str.replace(/colspan\s*=\s*["']?\d+["']?\s*\|?\s*/gi, "");
    str = str.replace(/align\s*=\s*["'][^"']*["']\s*\|?\s*/gi, "");

    // Strip any remaining wiki-style attributes like style="..."
    str = str.replace(/style\s*=\s*["'][^"']*["']\s*/gi, "");

    // Clean up stray pipe characters from wiki parsing
    str = str.replace(/^\|+\s*/, "");
    str = str.replace(/\s*\|+$/, "");

    // Replace multiple spaces/newlines with single space
    str = str.replace(/\s+/g, " ").trim();

    return str;
  };

  const getCellValue = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return cleanDisplayValue(value);
    if (typeof value === "number") return value;
    if (typeof value === "object") {
      if (value.text !== undefined) {
        return value.text === "" ? "" : cleanDisplayValue(value.text);
      }
      return "";
    }
    return cleanDisplayValue(String(value));
  };

  // Extract unique classifications (which table each row came from), excluding Gesamtwertung and overall
  const getUniqueClasses = (data) => {
    const classes = new Set();
    if (Array.isArray(data)) {
      data.forEach((row) => {
        if (row._Classification) {
          const classification = String(row._Classification).toLowerCase();
          if (
            classification !== "gesamtwertung (overall)" &&
            classification !== "overall" &&
            classification !== "nls speed-trophäe (overall)"
          ) {
            classes.add(row._Classification);
          }
        }
      });
    }
    return Array.from(classes).sort();
  };

  const driverClasses = getUniqueClasses(driverData);
  const teamClasses = getUniqueClasses(teamData);

  // Check if a row is malformed (wiki parsing artifacts)
  const isValidRow = (row) => {
    const pos = getCellValue(row["Pos."] || row["Pos"] || "");

    // Skip rows where position contains wiki markup
    if (
      pos.includes("rowspan") ||
      pos.includes("colspan") ||
      pos === "—" ||
      pos === "-"
    ) {
      return false;
    }

    // Skip rows that are just team/car numbers without proper data
    const team = getCellValue(row["Team"] || row["Teams"] || "");
    if (team.startsWith("#") && !pos) {
      return false;
    }

    // Skip if ALL fields look like wiki artifacts
    const values = Object.values(row).map((v) => getCellValue(v));
    const validValues = values.filter(
      (v) => v && !v.includes("rowspan") && !v.includes("colspan"),
    );
    if (validValues.length < 2) {
      return false;
    }

    return true;
  };

  const renderTable = (data, title, isTeamTable = false) => {
    if (!data || data.length === 0) {
      return <p>No data available</p>;
    }

    // Filter out duplicate header rows, malformed rows, and non-championship entries
    const filteredData = data.filter((row) => {
      // Skip header rows
      if (
        (row.Pos === "Pos." || row["Pos."] === "Pos.") &&
        (row.Points === "Points" || row.Points === "Points")
      ) {
        return false;
      }
      // Skip "Non-championship entries" rows
      if (
        Object.values(row).some(
          (val) =>
            String(val).toLowerCase().includes("non-championship") ||
            String(val).toLowerCase().includes("championship entries"),
        )
      ) {
        return false;
      }
      // Skip rows where Pos is "—" (non-championship marker)
      const posValue = getCellValue(row.Pos || row["Pos."]);
      if (posValue === "—" || posValue === "-" || posValue === "") {
        return false;
      }
      // Skip overall classifications (Gesamtwertung, NLS Speed-Trophäe Overall)
      const classification = String(row._Classification || "").toLowerCase();
      if (
        classification === "gesamtwertung (overall)" ||
        classification === "overall" ||
        classification === "nls speed-trophäe (overall)"
      ) {
        return false;
      }
      // Skip malformed rows
      if (!isValidRow(row)) {
        return false;
      }
      return true;
    });

    if (filteredData.length === 0) {
      return <p>No data available</p>;
    }

    // Get headers from the first valid row
    const allHeaders = Object.keys(filteredData[0]);

    // For team standings, prioritize team-focused columns
    let headers;
    if (isTeamTable) {
      // Team standings: Pos, Team, Class (classification), Points, race results
      // const priorityHeaders = [
      //   "Pos.",
      //   "Pos",
      //   "Team",
      //   "Teams",
      //   "_Classification",
      //   "Points",
      // ];
      const raceHeaders = allHeaders.filter(
        (h) =>
          h.startsWith("NLS") ||
          h.startsWith("Race") ||
          h.match(/^[A-Z]{2,3}\d+$/),
      );

      headers = [];
      // Add position
      if (allHeaders.includes("Pos.")) headers.push("Pos.");
      else if (allHeaders.includes("Pos")) headers.push("Pos");

      // Add team
      if (allHeaders.includes("Team")) headers.push("Team");
      else if (allHeaders.includes("Teams")) headers.push("Teams");

      // Add classification
      if (allHeaders.includes("_Classification"))
        headers.push("_Classification");

      // Add race results
      headers.push(...raceHeaders);

      // Add points
      if (allHeaders.includes("Points")) headers.push("Points");
    } else {
      // Driver standings: show all relevant columns
      headers = allHeaders.filter((h) => {
        // Skip internal fields we don't want to show
        return true;
      });
    }

    // Filter out completely empty columns
    const headerData = {};
    headers.forEach((h) => {
      let hasValue = false;
      for (const row of filteredData) {
        const val = getCellValue(row[h]);
        if (val && val !== "" && val !== "—" && val !== "-") {
          hasValue = true;
          break;
        }
      }
      headerData[h] = hasValue;
    });

    headers = headers.filter((h) => headerData[h]);

    // Reorder: Move _Classification after Team field
    if (headers.includes("_Classification")) {
      const filtered = headers.filter((h) => h !== "_Classification");
      const teamIndex = filtered.findIndex(
        (h) => h === "Team" || h === "teams" || h === "Teams",
      );
      if (teamIndex >= 0) {
        headers = [
          ...filtered.slice(0, teamIndex + 1),
          "_Classification",
          ...filtered.slice(teamIndex + 1),
        ];
      } else {
        headers = filtered;
        headers.splice(2, 0, "_Classification"); // Insert after position
      }
    }

    // For team standings, consolidate by team
    let displayData = filteredData;
    if (isTeamTable) {
      const teamMap = new Map();

      filteredData.forEach((row) => {
        const team = getCellValue(row["Team"] || row["Teams"] || "");
        const classification = getCellValue(row._Classification || "");
        const key = `${team}|${classification}`;

        if (!teamMap.has(key)) {
          // Create clean copy without driver info for team table
          const cleanRow = {...row};
          delete cleanRow["Driver"];
          delete cleanRow["Drivers"];
          delete cleanRow["driver"];
          delete cleanRow["drivers"];
          teamMap.set(key, cleanRow);
        }
      });

      displayData = Array.from(teamMap.values());
    }

    // Sort by Points (descending) if the column exists
    const pointsColumn = headers.find((h) => h === "Points" || h === "points");
    if (pointsColumn) {
      displayData.sort((a, b) => {
        const pointsA = parseInt(getCellValue(a[pointsColumn])) || 0;
        const pointsB = parseInt(getCellValue(b[pointsColumn])) || 0;
        return pointsB - pointsA;
      });
    }

    // For driver standings, also remove driver column from team table headers
    if (isTeamTable) {
      headers = headers.filter(
        (h) =>
          h !== "Driver" &&
          h !== "Drivers" &&
          h !== "driver" &&
          h !== "drivers",
      );
    }

    return (
      <div className="standings-table-container">
        <h3>{title}</h3>
        <div className="table-wrapper">
          <table className="standings-table compact">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>
                    {header === "_Classification" ? "Class" : header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, idx) => (
                <tr key={idx}>
                  {headers.map((header) => {
                    let value = getCellValue(row[header]);
                    const isWrapCell =
                      header === "Team" ||
                      header === "Driver" ||
                      header === "Teams" ||
                      header === "Drivers"
                        ? "wrap-cell"
                        : "";

                    return (
                      <td
                        key={`${idx}-${header}`}
                        title={value}
                        className={isWrapCell}>
                        {header === "_Classification"
                          ? getCellValue(row._Classification)
                          : value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderClassFilter = (classes, selectedClass, onSelectClass) => {
    return (
      <div className="class-filter-capsules">
        <button
          key="all"
          className={`class-capsule ${selectedClass === "all" ? "active" : ""}`}
          onClick={() => onSelectClass("all")}>
          All
        </button>
        {classes.map((cls) => (
          <button
            key={cls}
            className={`class-capsule ${selectedClass === cls ? "active" : ""}`}
            onClick={() => onSelectClass(cls)}>
            {cls}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="wrap">
      <h1>NLS 2026 Standings</h1>

      {/* Driver Standings Section */}
      <section className="standings-section">
        <div className="standings-header">
          <h2>Driver Standings</h2>
        </div>

        {renderClassFilter(driverClasses, driverCategory, setDriverCategory)}

        {errorDrivers ? (
          <p className="error-message">{errorDrivers}</p>
        ) : loadingDrivers ? (
          <p>Loading driver standings...</p>
        ) : (
          renderTable(
            driverCategory === "all"
              ? driverData
              : driverData.filter(
                  (row) => row._Classification === driverCategory,
                ),
            "Driver Standings",
            false,
          )
        )}
      </section>

      {/* Team Standings Section */}
      <section className="standings-section">
        <div className="standings-header">
          <h2>Team Standings</h2>
        </div>

        {renderClassFilter(teamClasses, teamCategory, setTeamCategory)}

        {errorTeams ? (
          <p className="error-message">{errorTeams}</p>
        ) : loadingTeams ? (
          <p>Loading team standings...</p>
        ) : (
          renderTable(
            teamCategory === "all"
              ? teamData
              : teamData.filter((row) => row._Classification === teamCategory),
            "Team Standings",
            true,
          )
        )}
      </section>
    </div>
  );
}
