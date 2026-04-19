const axios = require("axios");

async function fetchWikiText() {
  const params = {
    action: "parse",
    page: "2026_Nürburgring_Langstrecken-Serie",
    format: "json",
    prop: "wikitext",
  };
  try {
    const response = await axios.get("https://en.wikipedia.org/w/api.php", {
      params,
      timeout: 15000,
      headers: {
        "User-Agent":
          "NLS-Schedule-Bot/1.0 (https://github.com/yourusername/nls-schedule)",
      },
    });
    if (!response.data.parse || !response.data.parse.wikitext) {
      throw new Error("Invalid Wikipedia API response structure");
    }
    console.log("✓ Successfully fetched Wikipedia wikitext");
    return response.data.parse.wikitext["*"];
  } catch (error) {
    console.error("Error fetching Wikipedia text:", error.message);
    throw new Error(`Failed to fetch Wikipedia page: ${error.message}`);
  }
}

// ─── Cell cleaner ────────────────────────────────────────────────────────────

function cleanCell(raw) {
  let v = raw.trim();

  // Strip rowspan/colspan attributes (e.g. rowspan="2"| or rowspan=2|)
  v = v.replace(/(?:rowspan|colspan)\s*=\s*(?:"[^"]*"|\d+)\s*\|/gi, "");

  // Strip leading cell attributes: align="left"| or style="..."| (one or more)
  v = v.replace(/^(?:[a-zA-Z-]+=(?:"[^"]*"|'[^']*'|\S+)\s*\|)+\s*/i, "");

  // {{msrslt|type|value}} → value (the number) for numeric positions,
  // or the type label for non-numeric (ret, nc, dsq, C, np, ns, dns, wd)
  v = v.replace(/\{\{msrslt\|([^|{}]+)\|([^|{}]+)\}\}/gi, (_, type, value) => {
    const t = type.trim().toLowerCase();
    // Numeric result types: use the value (actual position number)
    if (t === "p" || t === "1" || t === "2" || t === "3") return value.trim();
    // Non-numeric: use the type label as display text
    return t.toUpperCase();
  });

  // {{sub|N}} and {{sup|N}} → strip (footnote markers on race results)
  v = v.replace(/\{\{su[bp]\|[^{}]*\}\}/gi, "");

  // Flag templates → strip
  v = v.replace(/\{\{flag[^{}]*\}\}\s*/gi, "");

  // {{Tooltip|TEXT|hover}} → TEXT
  v = v.replace(/\{\{Tooltip\|([^|{}]+)\|[^{}]+\}\}/gi, "$1");

  // [[Page|Label]] → Label
  v = v.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1");
  // [[Page]] → Page
  v = v.replace(/\[\[([^\]]+)\]\]/g, "$1");

  // Strip any remaining {{ }} templates
  v = v.replace(/\{\{[^{}]*\}\}/g, "");

  // Strip wiki bold/italic markup
  v = v.replace(/'{2,3}/g, "");

  // Replace <br> with space
  v = v.replace(/<br\s*\/?>/gi, " ");

  // Collapse whitespace
  v = v.replace(/\s+/g, " ").trim();

  return v;
}

// ─── Wikitable parser (rowspan-aware) ────────────────────────────────────────

function parseWikiTable(tableText) {
  const rowChunks = tableText.split(/\n\|-[^\n]*/);

  let headers = [];
  const rows = [];

  // rowspan carry-forward buffer: colIndex → {value, remaining}
  const rowspanBuf = {};

  for (let ci = 0; ci < rowChunks.length; ci++) {
    const chunk = rowChunks[ci];
    const lines = chunk.split("\n");

    // ── Header chunk (first chunk, before any |-)
    if (ci === 0) {
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("!")) continue;
        const parts = t.split("!!");
        for (const part of parts) {
          let h = part.replace(/^!+/, "");
          // Check for colspan and expand into multiple header entries
          const colspanMatch = h.match(/colspan\s*=\s*["']?(\d+)["']?\s*\|/i);
          const colspanCount = colspanMatch ? parseInt(colspanMatch[1], 10) : 1;
          h = h.replace(/colspan\s*=\s*(?:"[^"]*"|\d+)\s*\|\s*/gi, "");
          h = cleanCell(h);
          if (h) {
            for (let c = 0; c < colspanCount; c++) {
              headers.push(colspanCount > 1 ? `${h}_${c + 1}` : h);
            }
          }
        }
      }
      continue;
    }

    // ── Data chunk
    const rawCells = []; // [{value, rowspan}]
    let skipChunk = false;

    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;

      // Row-header cell (position number): starts with !
      if (t.startsWith("!") && !t.startsWith("!!")) {
        // Repeated header row at bottom of table → skip chunk
        if (t.includes("Tooltip") || /^!+\s*Pos\.?/.test(t)) {
          skipChunk = true;
          break;
        }
        // Parse rowspan if present
        const rsMatch = t.match(/rowspan\s*=\s*(?:"?(\d+)"?)\s*\|/i);
        const rs = rsMatch ? parseInt(rsMatch[1], 10) : 1;
        const stripped = t
          .replace(/^!+/, "")
          .replace(/rowspan\s*=\s*(?:"?\d+"?)\s*\|/i, "");
        rawCells.push({value: cleanCell(stripped), rowspan: rs});
        continue;
      }

      // Data cell: starts with |
      if (
        t.startsWith("|") &&
        !t.startsWith("{|") &&
        !t.startsWith("|-") &&
        !t.startsWith("|}")
      ) {
        const content = t.replace(/^\|+/, "");

        // colspan row → "Non-championship entries" separator → skip chunk
        if (/colspan\s*=/i.test(content)) {
          skipChunk = true;
          break;
        }

        // Inline multiple cells: ||
        const parts = content.split("||");
        for (const part of parts) {
          const rsMatch = part.match(/rowspan\s*=\s*(?:"?(\d+)"?)\s*\|/i);
          const rs = rsMatch ? parseInt(rsMatch[1], 10) : 1;
          const stripped = part.replace(/rowspan\s*=\s*(?:"?\d+"?)\s*\|/i, "");
          rawCells.push({value: cleanCell(stripped), rowspan: rs});
        }
      }
    }

    if (skipChunk || rawCells.length === 0) continue;

    // Build row object, applying rowspan carry-forward
    const rowObj = {};
    let rawIdx = 0;

    for (let col = 0; col < headers.length; col++) {
      if (rowspanBuf[col] && rowspanBuf[col].remaining > 0) {
        rowObj[headers[col]] = rowspanBuf[col].value;
        rowspanBuf[col].remaining--;
      } else {
        if (rawIdx < rawCells.length) {
          const cell = rawCells[rawIdx++];
          rowObj[headers[col]] = cell.value;
          if (cell.rowspan > 1) {
            rowspanBuf[col] = {value: cell.value, remaining: cell.rowspan - 1};
          } else {
            delete rowspanBuf[col];
          }
        } else {
          rowObj[headers[col]] = "";
        }
      }
    }

    // Skip repeated header rows
    const posKey = headers[0] || "Pos.";
    const posVal = String(rowObj[posKey] || "").trim();
    if (posVal === "Pos." || posVal === "Pos") continue;

    rows.push(rowObj);
  }

  return rows;
}

// ─── Post-processing ─────────────────────────────────────────────────────────

function postProcessRows(rows) {
  if (!rows.length) return [];

  // Keep only championship rows (numeric positions, possibly with =)
  const filtered = rows.filter((row) => {
    const pos = String(row["Pos."] || row["Pos"] || "").trim();
    return (
      pos !== "" &&
      pos !== "—" &&
      pos !== "-" &&
      pos !== "Pos." &&
      pos !== "Pos"
    );
  });

  if (!filtered.length) return [];

  // Drop columns that are entirely empty or all dashes
  const allKeys = Object.keys(filtered[0]);
  const usedKeys = allKeys.filter((key) =>
    filtered.some((row) => {
      const v = String(row[key] || "").trim();
      return v !== "" && v !== "—" && v !== "-";
    }),
  );

  return filtered.map((row) => {
    const clean = {};
    for (const k of usedKeys) clean[k] = row[k] ?? "";
    return clean;
  });
}

// ─── Section extractors ───────────────────────────────────────────────────────

// Extract wikitext between a heading match and the next same-or-higher heading.
// Works on the full wikitext or on any substring.
function extractSection(text, headingPattern, endPattern) {
  const startMatch = text.match(headingPattern);
  if (!startMatch) return null;

  const startIdx = startMatch.index + startMatch[0].length;
  const remaining = text.slice(startIdx);

  const endMatch = remaining.match(endPattern);
  const endIdx = endMatch ? endMatch.index : remaining.length;

  return remaining.slice(0, endIdx);
}

// Extract the first {| ... |} wikitable block (handles nesting)
function extractFirstTable(sectionText) {
  const start = sectionText.indexOf("{|");
  if (start === -1) return null;

  let depth = 0;
  let i = start;
  while (i < sectionText.length - 1) {
    if (sectionText[i] === "{" && sectionText[i + 1] === "|") {
      depth++;
      i += 2;
    } else if (sectionText[i] === "|" && sectionText[i + 1] === "}") {
      depth--;
      if (depth === 0) return sectionText.substring(start, i + 2);
      i += 2;
    } else {
      i++;
    }
  }
  return null;
}

// ─── Driver Classification ────────────────────────────────────────────────────
//
// Actual Wikipedia structure:
//   === Drivers' Classifications ===              (level 3)
//     ==== Gesamtwertung (Overall) ====           (level 4) — merged overall table
//                                                   columns: Pos. | Driver | Team | Class | NLS1… | Points
//     ==== Klassensieger-Trophäe (Class) ====     (level 4)
//       ===== SP9 Pro =====                       (level 5) — per-class tables
//       ===== SP9 Pro-Am =====
//       ===== SP9 Am =====  … etc.

async function fetchDriverClassification() {
  console.log("🔍 fetchDriverClassification() called");
  const wikiText = await fetchWikiText();
  console.log(`✓ Got wikitext: ${wikiText.length} characters`);

  const result = {overall: [], classes: {}};

  // === Drivers' Classifications === ends at the next === (Teams Classifications) or == heading
  const driverSection = extractSection(
    wikiText,
    /===\s*Drivers['']?\s*Classifications?\s*===/i,
    /\n===\s*[^=]/,
  );

  if (!driverSection) {
    console.error("❌ Could not find Drivers' Classifications section");
    return result;
  }
  console.log(`✓ Found driver section (${driverSection.length} chars)`);

  // ── Overall table: ==== Gesamtwertung (Overall) ====
  const overallSection = extractSection(
    driverSection,
    /====\s*Gesamtwertung\s*\(Overall\)\s*====/i,
    /\n====\s*[^=]/,
  );

  if (overallSection) {
    const overallTable = extractFirstTable(overallSection);
    if (overallTable) {
      const overallRows = parseWikiTable(overallTable);
      const overallData = postProcessRows(overallRows);
      if (overallData.length > 0) {
        result.overall = overallData;
        console.log(
          `✓ Driver overall (Gesamtwertung): ${overallData.length} rows`,
        );
      } else {
        console.warn(
          "⚠ Driver overall table parsed but no championship rows found",
        );
      }
    } else {
      console.warn("⚠ Could not extract wikitable from Gesamtwertung section");
    }
  } else {
    console.warn("⚠ Could not find Gesamtwertung (Overall) section");
  }

  // ── Per-class tables under ==== Klassensieger-Trophäe (Class) ====
  const klassenSection = extractSection(
    driverSection,
    /====\s*Klassensieger-Trophäe\s*\(Class\)\s*====/i,
    /\n====\s*[^=]/,
  );

  // Search for ===== Class ===== headings in Klassen section (preferred) or full driver section
  const searchIn = klassenSection ?? driverSection;
  console.log(
    `  Searching in: ${klassenSection ? "Klassensieger-Trophäe section" : "full driver section"}`,
  );

  const classHeadings = [...searchIn.matchAll(/\n=====\s*(.+?)\s*=====\s*\n/g)];
  console.log(`  Found ${classHeadings.length} driver class subsections`);

  for (let i = 0; i < classHeadings.length; i++) {
    const match = classHeadings[i];
    const className = match[1].trim();

    const classStart = match.index + match[0].length;
    const classEnd =
      i + 1 < classHeadings.length
        ? classHeadings[i + 1].index
        : searchIn.length;
    const classText = searchIn.slice(classStart, classEnd);

    const tableWikitext = extractFirstTable(classText);
    if (!tableWikitext) {
      console.warn(`  ⚠ No table found for driver class: ${className}`);
      continue;
    }

    const rows = parseWikiTable(tableWikitext);
    const data = postProcessRows(rows);

    if (data.length > 0) {
      result.classes[className] = data;
      console.log(`  ✓ Driver class "${className}": ${data.length} rows`);
    } else {
      console.warn(`  ⚠ Empty data for driver class: ${className}`);
    }
  }

  // Fallback overall: use first class if Gesamtwertung table was empty
  if (result.overall.length === 0) {
    const firstClass = Object.keys(result.classes)[0];
    if (firstClass) {
      result.overall = result.classes[firstClass];
      console.log(
        `✓ Driver overall fallback → "${firstClass}": ${result.overall.length} rows`,
      );
    }
  }

  console.log(`Total driver classes: ${Object.keys(result.classes).length}`);
  return result;
}

// ─── Team Classification ──────────────────────────────────────────────────────
//
// Actual Wikipedia structure:
//   === Teams Classifications ===                 (level 3)
//     ==== NLS Speed-Trophäe (Overall) ====       (level 4) — overall table
//                                                   columns: Pos. | Team | Class | NLS1… | Points
//     ==== KW-Team-Trophäe ====                   (level 4)
//       ===== SP9 Pro =====                       (level 5)
//       ===== SP9 Pro-Am =====  … etc.

async function fetchTeamClassification() {
  console.log("🔍 fetchTeamClassification() called");
  const wikiText = await fetchWikiText();
  console.log(`✓ Got wikitext: ${wikiText.length} characters`);

  const result = {overall: [], classes: {}};

  // === Teams Classifications === ends at next == heading (See also / Notes etc.)
  const teamSection = extractSection(
    wikiText,
    /===\s*Teams\s+Classifications?\s*===/i,
    /\n==\s*[^=]/,
  );

  if (!teamSection) {
    console.error("❌ Could not find Teams Classifications section");
    return result;
  }
  console.log(`✓ Found team section (${teamSection.length} chars)`);

  // ── Overall table: ==== NLS Speed-Trophäe (Overall) ====
  const overallSection = extractSection(
    teamSection,
    /====\s*NLS Speed-Trophäe\s*\(Overall\)\s*====/i,
    /\n====\s*[^=]/,
  );

  if (overallSection) {
    const overallTable = extractFirstTable(overallSection);
    if (overallTable) {
      const overallRows = parseWikiTable(overallTable);
      const overallData = postProcessRows(overallRows);
      if (overallData.length > 0) {
        result.overall = overallData;
        console.log(
          `✓ Team overall (NLS Speed-Trophäe): ${overallData.length} rows`,
        );
      } else {
        console.warn(
          "⚠ Team overall table parsed but no championship rows found",
        );
      }
    } else {
      console.warn("⚠ Could not extract wikitable from team overall section");
    }
  } else {
    console.warn("⚠ Could not find NLS Speed-Trophäe (Overall) section");
  }

  // ── Per-class tables: ==== KW-Team-Trophäe ==== → ===== Class =====
  const kwSection = extractSection(
    teamSection,
    /====\s*KW-Team-Trophäe\s*====/i,
    /\n====\s*[^=]/,
  );

  if (!kwSection) {
    console.warn("⚠ Could not find KW-Team-Trophäe section");
    return result;
  }
  console.log(`✓ Found KW-Team-Trophäe section (${kwSection.length} chars)`);

  const classHeadings = [
    ...kwSection.matchAll(/\n=====\s*(.+?)\s*=====\s*\n/g),
  ];
  console.log(`  Found ${classHeadings.length} team class subsections`);

  for (let i = 0; i < classHeadings.length; i++) {
    const match = classHeadings[i];
    const className = match[1].trim();

    const classStart = match.index + match[0].length;
    const classEnd =
      i + 1 < classHeadings.length
        ? classHeadings[i + 1].index
        : kwSection.length;
    const classText = kwSection.slice(classStart, classEnd);

    const tableWikitext = extractFirstTable(classText);
    if (!tableWikitext) {
      console.warn(`  ⚠ No table found for team class: ${className}`);
      continue;
    }

    const rows = parseWikiTable(tableWikitext);
    const data = postProcessRows(rows);

    if (data.length > 0) {
      result.classes[className] = data;
      console.log(`  ✓ Team class "${className}": ${data.length} rows`);
    } else {
      console.warn(`  ⚠ Empty data for team class: ${className}`);
    }
  }

  console.log(`Total team classes: ${Object.keys(result.classes).length}`);
  return result;
}

module.exports = {
  fetchDriverClassification,
  fetchTeamClassification,
};
