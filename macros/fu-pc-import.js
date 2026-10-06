// Freeform Universal — PC Template Import Macro
// Create a Script Macro in Foundry and paste the contents of this file.
// Or reference this file from a macro using: import('./systems/freeform-universal/macros/fu-pc-import.js')
//
// Parses one or more PC Template entries (as written by the PCElement Factory into
// PC_Templates.md) and creates a complete Character Actor for each — including all
// child Items (Trademarks with Edges, Flaws, Drive, Advantages, Ties, Assets with Tags).
//
// This is the PC-side counterpart to fu-monster-manual-import.js. Unlike the flat
// Threat format, PC data has genuine two-level nesting (Edges under Trademarks, Tags
// under Assets), so parsing is driven by indentation depth rather than sub-labels.
//
// Expected entry format (sub-items are indented dash lines directly under their parent):
//   Name: Wren Ashcroft, Acolyte of the Hollow Vigil
//
//   Grit: 2
//   Spirit: 4
//   Cred: 2
//
//   Trademarks:
//   - Silk Rope Magus
//     - Strangler's Calm
//     - Spirit Sight
//
//   Advantages:
//   - The Long Breath
//     - Trademark: Silk Rope Magus
//     - Description: ...
//
//   Flaws:
//   - Marked by the Rope
//
//   Ties:
//   - The Hollow Vigil
//     - Description: ...
//
//   Drive: Prove the Rope Was Worth It
//
//   Assets:
//   - Strangler's Silk
//     - Concealed
//     - One Use
//
//   Biography:
//   ... prose ...
//
// A single paste may contain several entries; each new top-level "Name:" line starts a new PC.

const FU_PC_SECTIONS = ["Name", "Grit", "Spirit", "Cred", "Trademarks", "Advantages", "Flaws", "Ties", "Drive", "Assets", "Biography"];

/** Leading-whitespace width of a line, with tabs expanded to 4 spaces. */
function fuPcIndentOf(line) {
  const expanded = line.replace(/\t/g, "    ");
  return expanded.length - expanded.trimStart().length;
}

/** Normalize a matched section label to its canonical casing. */
function fuPcCanonicalSection(raw) {
  const norm = raw.trim().toLowerCase();
  return FU_PC_SECTIONS.find(s => s.toLowerCase() === norm) || raw.trim();
}

const FU_PC_SECTION_RE = /^(Name|Grit|Spirit|Cred|Trademarks|Advantages|Flaws|Ties|Drive|Assets|Biography)\s*:(.*)$/i;

/** Split a raw paste into individual entry blocks, each beginning at a top-level "Name:" line. */
function fuPcSplitIntoEntries(rawText) {
  const lines = (rawText || "").replace(/\r\n/g, "\n").split("\n");
  const entries = [];
  let current = null;
  for (const line of lines) {
    const isName = fuPcIndentOf(line) === 0 && /^Name\s*:/i.test(line.trim());
    if (isName) {
      if (current !== null) entries.push(current.join("\n"));
      current = [line];
    } else if (current !== null) {
      current.push(line);
    }
    // Lines before the first top-level "Name:" are ignored.
  }
  if (current !== null) entries.push(current.join("\n"));
  return entries;
}

/**
 * Split an entry into top-level sections. A section begins at a zero-indent line
 * matching one of the known section labels; its content is every line until the
 * next such label line. Returns { label: { rest, body } }.
 */
function fuPcSplitSections(entryText) {
  const lines = entryText.replace(/\r\n/g, "\n").split("\n");
  const sections = {};
  let current = null;
  for (const line of lines) {
    const m = (fuPcIndentOf(line) === 0) ? line.trim().match(FU_PC_SECTION_RE) : null;
    if (m) {
      const label = fuPcCanonicalSection(m[1]);
      current = { rest: m[2].trim(), body: [] };
      sections[label] = current;
    } else if (current) {
      current.body.push(line);
    }
  }
  return sections;
}

/**
 * Parse a nested dash-list by indentation depth (used for Trademarks and Assets).
 * Base-indent "- " lines are parent items; deeper "- " lines are children.
 * Returns [{ name, children: [string] }].
 */
function fuPcParseNestedList(bodyLines) {
  const items = [];
  let baseIndent = null;
  let current = null;
  for (const line of bodyLines) {
    if (!line.trim().length) continue;
    const indent = fuPcIndentOf(line);
    const trimmed = line.trim();
    const isDash = trimmed.startsWith("- ");
    if (baseIndent === null) {
      // Establish the parent indent level from the first content line.
      if (!isDash) continue; // skip leading noise that isn't a list item
      baseIndent = indent;
    }
    if (indent <= baseIndent && isDash) {
      current = { name: trimmed.slice(2).trim(), children: [] };
      if (current.name) items.push(current);
    } else if (current && indent > baseIndent && isDash) {
      const child = trimmed.slice(2).trim();
      if (child) current.children.push(child);
    } else {
      // Ambiguous indentation (e.g. a non-dash deeper line) — skip conservatively.
      console.warn("FU PC Import — skipping ambiguous nested-list line:", line);
    }
  }
  return items;
}

/**
 * Parse a keyed dash-list (used for Advantages and Ties). Base-indent "- " lines are
 * items; deeper lines are "Key: value" pairs (only the known keys Trademark/Description),
 * with continuation lines appended to the most recent value with a space.
 * Returns [{ name, trademark, description }].
 */
function fuPcParseKeyedList(bodyLines) {
  const items = [];
  let baseIndent = null;
  let current = null;
  let lastKey = null;
  for (const line of bodyLines) {
    if (!line.trim().length) continue;
    const indent = fuPcIndentOf(line);
    const trimmed = line.trim();
    const isDash = trimmed.startsWith("- ");
    const isBaseItem = isDash && (baseIndent === null || indent <= baseIndent);
    if (isBaseItem) {
      if (baseIndent === null) baseIndent = indent;
      current = { name: trimmed.slice(2).trim(), trademark: "", description: "" };
      if (current.name) items.push(current);
      lastKey = null;
      continue;
    }
    if (!current) continue;
    // A "- Key: value" or "Key: value" sub-line. Restrict to known keys so that
    // prose colons in continuation lines aren't misread as new keys.
    const kvText = isDash ? trimmed.slice(2).trim() : trimmed;
    const kv = kvText.match(/^(Trademark|Description)\s*:\s*(.*)$/i);
    if (kv) {
      lastKey = kv[1].toLowerCase();
      current[lastKey] = kv[2].trim();
    } else if (lastKey) {
      // Continuation of the previous value — join into one flowing line.
      current[lastKey] = (current[lastKey] ? current[lastKey] + " " : "") + trimmed;
    }
  }
  return items;
}

/** Parse a flat dash-list of names (used for Flaws). Returns [string]. */
function fuPcParseFlatList(bodyLines) {
  return bodyLines
    .map(l => l.trim())
    .filter(l => l.startsWith("- "))
    .map(l => l.slice(2).trim())
    .filter(Boolean);
}

/** True if the section content is a parenthetical-italic placeholder rather than a real list. */
function fuPcIsPlaceholder(text) {
  const t = (text || "").trim();
  if (!t) return false;
  return /^\*?\(/.test(t) && /\)\*?$/.test(t);
}

/** Wrap blank-line-delimited paragraphs in <p>, matching the Monster Manual macro's approach. */
function fuPcWrapProse(raw) {
  const text = (raw || "").trim();
  if (!text) return "";
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Parse a single entry block into a normalized PC data object, or null if unusable. */
function fuPcParseEntry(entryText) {
  const sections = fuPcSplitSections(entryText);

  const name = (sections["Name"]?.rest || "").replace(/\s*\n\s*/g, " ").trim();
  if (!name) return null;

  const firstInt = (s, fallback) => {
    const m = (s || "").match(/-?\d+/);
    return m ? parseInt(m[0], 10) : fallback;
  };
  const grit = firstInt(sections["Grit"]?.rest, 2);
  const spirit = firstInt(sections["Spirit"]?.rest, 2);
  const cred = firstInt(sections["Cred"]?.rest, 3);

  const trademarksRaw = fuPcParseNestedList(sections["Trademarks"]?.body || []);
  const trademarks = trademarksRaw.map(t => ({ name: t.name, edges: t.children }));

  const advantages = fuPcParseKeyedList(sections["Advantages"]?.body || [])
    .map(a => ({ name: a.name, trademarkRef: a.trademark, description: a.description }));

  const ties = fuPcParseKeyedList(sections["Ties"]?.body || [])
    .map(t => ({ name: t.name, description: t.description }));

  const flaws = fuPcParseFlatList(sections["Flaws"]?.body || []);

  // Drive — single line, collapse any accidental wraps.
  const drive = (sections["Drive"]?.rest || "").replace(/\s*\n\s*/g, " ").trim();

  // Assets — placeholder ("*(none specified...)*") means zero Assets, not a bogus item.
  const assetsBody = sections["Assets"]?.body || [];
  const assetsContent = assetsBody.join("\n").trim();
  let assets = [];
  if (assetsContent && !fuPcIsPlaceholder(assetsContent)) {
    assets = fuPcParseNestedList(assetsBody).map(a => ({ name: a.name, tags: a.children }));
  }

  // Biography — prose; rest of the label line plus its body, blank-line paragraphs.
  const bioRaw = [sections["Biography"]?.rest || "", (sections["Biography"]?.body || []).join("\n")]
    .filter(Boolean).join("\n");
  const biography = fuPcWrapProse(bioRaw);

  return { name, grit, spirit, cred, trademarks, advantages, ties, flaws, drive, assets, biography };
}

/**
 * Create the Character Actor and all its child Items for one parsed PC.
 *
 * The { _isBlank: true } option on Actor.create() is REQUIRED. The system registers
 * a preCreateActor hook (in freeform-universal.mjs) that intercepts any new
 * "character" type Actor creation to offer Foundry's blank/template chooser dialog —
 * unless the creation call's options already carry _isBlank or _fromTemplate, in
 * which case the hook passes the creation through untouched. Without this flag, the
 * hook intercepts this macro's creation call, cancels it, and pops the chooser dialog
 * instead — producing an unrelated blank/templated Actor with none of the parsed
 * PCEF data attached, rather than the actual imported character.
 */
async function fuPcCreatePC(data) {
  const actor = await Actor.create({
    name: data.name,
    type: "character",
    system: {
      grit: data.grit,
      spirit: data.spirit,
      hits: { value: data.grit, max: data.grit },
      dramaPoints: { value: data.spirit, max: data.spirit },
      cred: { value: data.cred, max: data.cred },
      dying: { active: false, expiresIn: 3 },
      biography: data.biography,
      custom: false
    }
  }, { _isBlank: true });

  const items = [];

  for (const tm of data.trademarks) {
    items.push({ name: tm.name, type: "trademark", system: { edges: tm.edges, memo: "" } });
  }

  for (const flawName of data.flaws) {
    items.push({ name: flawName, type: "flaw", system: { description: "" } });
  }

  if (data.drive) {
    items.push({ name: data.drive, type: "drive", system: { description: "" } });
  }

  for (const adv of data.advantages) {
    const desc = adv.description ? `<p>${adv.description}</p>` : "";
    const fullDescription = adv.trademarkRef
      ? `<p><em>Linked to Trademark: ${adv.trademarkRef}</em></p>${desc}`
      : desc;
    items.push({ name: adv.name, type: "advantage", system: { description: fullDescription } });
  }

  for (const tie of data.ties) {
    items.push({ name: tie.name, type: "tie", system: { description: tie.description ? `<p>${tie.description}</p>` : "" } });
  }

  for (const asset of data.assets) {
    items.push({
      name: asset.name,
      type: "gear",
      system: {
        description: "",
        cost: 0,
        tags: asset.tags.map(name => ({ id: foundry.utils.randomID(), name }))
      }
    });
  }

  if (items.length) await Item.create(items, { parent: actor });
  return actor;
}

async function fuPcImportEntries(rawText) {
  const entries = fuPcSplitIntoEntries(rawText);
  if (!entries.length) {
    ui.notifications.warn("PC Template Import: no entries found. Each entry must start with a top-level 'Name:' line.");
    return;
  }

  let created = 0;
  for (const entry of entries) {
    let data;
    try {
      data = fuPcParseEntry(entry);
    } catch (err) {
      console.warn("FU PC Import — failed to parse an entry, skipping.", err, entry);
      continue;
    }
    if (!data) {
      console.warn("FU PC Import — entry had no usable Name, skipping.", entry);
      continue;
    }

    try {
      await fuPcCreatePC(data);
      created++;
    } catch (err) {
      console.warn(`FU PC Import — failed to create character "${data.name}", skipping.`, err);
    }
  }

  ui.notifications.info(`PC Template Import: ${created} character(s) created.`);
}

new Dialog({
  title: "PC Template Import",
  content: `
    <form>
      <p style="font-family:'Cinzel','Georgia',serif;color:#5C3D11;font-weight:600;letter-spacing:1px;margin-bottom:4px;">FREEFORM UNIVERSAL</p>
      <p style="font-family:'Crimson Text',serif;color:#5C3D11;margin-bottom:8px;">
        Paste one or more PC Templates below.
        Each entry will become a Character Actor in Foundry, with all of its
        Trademarks, Edges, Flaws, Drive, Advantages, Ties, and Assets.
      </p>
      <textarea name="pctext" rows="20" style="width:100%;font-family:monospace;font-size:12px;background:#F0E8C8;color:#1C1208;border:1px solid #8B6914;border-radius:2px;padding:6px;"
        placeholder="Name: Wren Ashcroft, Acolyte of the Hollow Vigil&#10;&#10;Grit: 2&#10;Spirit: 4&#10;Cred: 2&#10;&#10;Trademarks:&#10;- Silk Rope Magus&#10;  - Strangler's Calm&#10;  - Spirit Sight&#10;&#10;Advantages:&#10;- The Long Breath&#10;  - Trademark: Silk Rope Magus&#10;  - Description: ...&#10;&#10;Flaws:&#10;- Marked by the Rope&#10;&#10;Drive: Prove the Rope Was Worth It&#10;&#10;Assets:&#10;- Strangler's Silk&#10;  - Concealed&#10;&#10;Biography:&#10;..."></textarea>
    </form>
  `,
  buttons: {
    import: {
      icon: '<i class="fas fa-user-plus"></i>',
      label: "Import",
      callback: async (html) => {
        const text = html.find("[name='pctext']").val();
        await fuPcImportEntries(text);
      }
    },
    cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
  },
  default: "import"
}, { classes: ["freeform-universal", "fu-pc-import", "dialog"], width: 600, height: 500 }).render(true);