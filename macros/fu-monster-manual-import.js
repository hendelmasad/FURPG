// Freeform Universal — Monster Manual Import Macro
// Create a Script Macro in Foundry and paste the contents of this file.
// Or reference this file from a macro using: import('./systems/freeform-universal/macros/fu-monster-manual-import.js?' + Date.now())
//
// Parses one or more Monster Manual entries and creates a Threat Actor for each.
//
// Expected entry format:
//   Name (DR): Covenant Zealot (2), fanatical cultist
//   Hits: 4 + (BOSS: equal to number of PCs)
//   Drive: Cement his authority through fear.
//   Tags:
//   - zealous
//   - armored
//   - plasma rifle
//   Actions: Threaten you with violence, Demand your cash, Hit you hard.
//   Conditions: suppressed, flanked
//   Problems: If the players hesitate, reinforcements arrive.
//
//   Description: A fanatical alien warrior...
//
//   Setting: Nazi Spacemen Must Die
//
// Tags use bullet-point format (- item or * item), one per line.
// Actions and Conditions use comma-separated format.
// A single paste may contain several entries; each new "Name (DR):" line starts a new threat.

const FU_MM_LABELS = ["Name (DR)", "Hits", "Drive", "Tags", "Actions", "Conditions", "Problems", "Description", "Setting"];

/** Match a line that begins one of the labelled fields, e.g. "Tags:" → "Tags". */
function fuMmMatchLabel(line) {
  const m = line.match(/^\s*(Name\s*\(DR\)|Hits|Drive|Tags|Actions|Conditions|Problems|Description|Setting)\s*:(.*)$/i);
  if (!m) return null;
  const raw = m[1].replace(/\s+/g, " ").trim().toLowerCase();
  const canonical = FU_MM_LABELS.find(l => l.toLowerCase() === raw) || m[1];
  return { label: canonical, rest: m[2] };
}

/** Split a raw paste into individual entry blocks, each beginning at a "Name (DR):" line. */
function splitIntoEntries(rawText) {
  const lines = (rawText || "").replace(/\r\n/g, "\n").split("\n");
  const entries = [];
  let current = null;
  for (const line of lines) {
    const lbl = fuMmMatchLabel(line);
    if (lbl && lbl.label === "Name (DR)") {
      if (current !== null) entries.push(current.join("\n"));
      current = [line];
    } else if (current !== null) {
      current.push(line);
    }
  }
  if (current !== null) entries.push(current.join("\n"));
  return entries;
}

/**
 * Split a comma/newline-delimited list into trimmed, non-empty strings.
 * Strips leading bullet characters (- or *) from each item.
 * Used for Actions and Conditions (chip-based fields).
 */
function splitList(txt) {
  return (txt || "")
    .split(/[\n,]/)
    .map(s => s.trim())
    .map(s => s.replace(/^[-*]\s*/, ""))
    .filter(s => s.length);
}

/**
 * Convert a bullet-point or comma-separated Tags field into a ProseMirror-ready
 * HTML bullet list. Each item becomes a <li> inside a <ul>, so the Tags field
 * on the Threat sheet renders as individual bullet points immediately on import.
 */
function tagsToHtml(txt) {
  const items = splitList(txt);
  if (!items.length) return "";
  return `<ul>${items.map(t => `<li>${t}</li>`).join("")}</ul>`;
}

/** Parse a single entry block into a normalized data object, or null if unusable. */
function parseEntry(entryText) {
  const lines = entryText.replace(/\r\n/g, "\n").split("\n");

  const fields = {};
  let currentLabel = null;
  for (const line of lines) {
    const lbl = fuMmMatchLabel(line);
    if (lbl) {
      currentLabel = lbl.label;
      fields[currentLabel] = (fields[currentLabel] ? fields[currentLabel] + "\n" : "") + lbl.rest.trim();
    } else if (currentLabel) {
      fields[currentLabel] += "\n" + line;
    }
  }

  const nameLine = (fields["Name (DR)"] || "").trim();
  if (!nameLine) return null;

  const parenIdx = nameLine.indexOf("(");
  let name = (parenIdx >= 0 ? nameLine.slice(0, parenIdx) : nameLine).replace(/[,:]\s*$/, "").trim();
  if (!name) name = "Unnamed Threat";
  const drMatch = nameLine.match(/\(([^)]*)\)/);
  const dr = drMatch ? (parseInt(drMatch[1], 10) || 0) : 1;

  const hitsRaw = (fields["Hits"] || "").trim();
  const hitsNumMatch = hitsRaw.match(/\d+/);
  const hits = hitsNumMatch ? parseInt(hitsNumMatch[0], 10) : 3;
  const isBoss = /\bBOSS\b/i.test(hitsRaw);

  const drive = (fields["Drive"] || "").trim().replace(/\s*\n\s*/g, " ");

  // Tags → HTML bullet list for ProseMirror rich text field
  const tags = tagsToHtml(fields["Tags"]);

  // Actions and Conditions → chip arrays (comma-separated format)
  const actions = splitList(fields["Actions"]).map(name => ({ name }));
  const conditions = splitList(fields["Conditions"]).map(name => ({ name, active: false }));

  const problems = (fields["Problems"] || "").trim();

  const descRaw = (fields["Description"] || "").trim();
  const description = descRaw
    ? descRaw.split(/\n\s*\n/).map(p => `<p>${p.trim().replace(/\n/g, "<br>")}</p>`).join("")
    : "";

  const setting = (fields["Setting"] || "").trim();

  return { name, dr, hits, isBoss, drive, tags, actions, conditions, problems, description, setting };
}

async function importMonsterManualEntries(rawText) {
  const entries = splitIntoEntries(rawText);
  if (!entries.length) {
    ui.notifications.warn("Monster Manual Import: no entries found. Each entry must start with a 'Name (DR):' line.");
    return;
  }

  let created = 0;
  for (const entry of entries) {
    let data;
    try {
      data = parseEntry(entry);
    } catch (err) {
      console.warn("FU Monster Manual Import — failed to parse an entry, skipping.", err, entry);
      continue;
    }
    if (!data) continue;

    try {
      await Actor.create({
        name: data.name,
        type: "threat",
        system: {
          dangerRating: data.dr,
          isBoss: data.isBoss,
          bossHits: 0,
          hits: { value: data.hits, max: data.hits },
          drive: data.drive,
          tags: data.tags,
          actions: data.actions,
          conditions: data.conditions,
          problems: data.problems,
          description: data.description,
          setting: data.setting,
          notes: ""
        }
      });
      created++;
    } catch (err) {
      console.warn(`FU Monster Manual Import — failed to create threat "${data.name}", skipping.`, err);
    }
  }

  ui.notifications.info(`Monster Manual Import: ${created} threat(s) created.`);
}

new Dialog({
  title: "Monster Manual Import",
  content: `
    <form>
      <p style="font-family:'Cinzel','Georgia',serif;color:#5C3D11;font-weight:600;letter-spacing:1px;margin-bottom:4px;">FREEFORM UNIVERSAL</p>
      <p style="font-family:'Crimson Text',serif;color:#5C3D11;margin-bottom:8px;">
        Paste one or more Monster Manual entries below.
        Each entry will become a Threat Actor in Foundry.
      </p>
      <textarea name="mmtext" rows="20" style="width:100%;font-family:monospace;font-size:12px;background:#F0E8C8;color:#1C1208;border:1px solid #8B6914;border-radius:2px;padding:6px;"
        placeholder="Name (DR): Covenant Zealot (2)&#10;Hits: 4&#10;Drive: Cement his authority through fear.&#10;Tags:&#10;- zealous&#10;- armored&#10;- plasma rifle&#10;Actions: Threaten you with violence, Demand your cash&#10;Conditions: suppressed&#10;Problems: ...&#10;&#10;Description: ...&#10;&#10;Setting: ..."></textarea>
    </form>
  `,
  buttons: {
    import: {
      icon: '<i class="fas fa-skull"></i>',
      label: "Import",
      callback: async (html) => {
        const text = html.find("[name='mmtext']").val();
        await importMonsterManualEntries(text);
      }
    },
    cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
  },
  default: "import"
}, { classes: ["freeform-universal", "fu-mm-import", "dialog"], width: 600, height: 500 }).render(true);
