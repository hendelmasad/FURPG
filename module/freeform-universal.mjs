import { FUCharacterSheet } from "./sheets/character-sheet.mjs";
import { FUThreatSheet } from "./sheets/threat-sheet.mjs";
import { FUGearSheet } from "./sheets/gear-sheet.mjs";
import { FUTrademarkSheet } from "./sheets/trademark-sheet.mjs";
import { FUFlawSheet, FUDriveSheet, FUInjurySheet, FUConditionSheet } from "./sheets/simple-item-sheet.mjs";
import { FUAdvantageSheet } from "./sheets/advantage-sheet.mjs";
import { FUTieSheet } from "./sheets/tie-sheet.mjs";
import { FUActor } from "./documents/actor.mjs";
import { registerSettings } from "./helpers/settings.mjs";
import { PressureTracker } from "./apps/pressure-tracker.mjs";
import { FURollDialog } from "./apps/roll-dialog.mjs";
import { ActionRoller } from "./apps/action-roller.mjs";
import { GMActionRoller } from "./apps/gm-action-roller.mjs";
import { FUCharacterCreationDialog } from "./apps/character-creation-dialog.mjs";
import { FURollSocket } from "./apps/roll-socket.mjs";

globalThis.FU = {
  RollDialog: FURollDialog,
  ActionRoller,
  GMActionRoller,
  PressureTracker,
  CharacterCreationDialog: FUCharacterCreationDialog,
  RollSocket: FURollSocket
};

/**
 * Intercept new character creation to offer a blank sheet or a template.
 * Passes through when creation originates from this dialog (_isBlank /
 * _fromTemplate) so we don't loop.
 */
Hooks.on("preCreateActor", (doc, data, options, userId) => {
  if (data.type !== "character") return true;
  if (options._fromTemplate || options._isBlank) return true;
  if (doc.pack) return true;
  const actorName = data.name?.trim() || "New Character";
  // Close Foundry's native Create Actor panel
  Object.values(ui.windows).forEach(w => {
    if (w.constructor.name === "DocumentSheet" || w.title?.includes("Create")) w.close();
  });
  FUCharacterCreationDialog.show(actorName);
  return false;
});
Hooks.once("init", async function () {
  console.log("Freeform Universal | Initializing system");

  CONFIG.Actor.documentClass = FUActor;

  registerSettings();

  // Unregister core sheets and register ours
  const Sheets = foundry.documents?.collections?.Actors ?? Actors;
  const ItemSheets = foundry.documents?.collections?.Items ?? Items;

  Sheets.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  Sheets.registerSheet("freeform-universal", FUCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "FU.SheetCharacter"
  });
  Sheets.registerSheet("freeform-universal", FUThreatSheet, {
    types: ["threat"],
    makeDefault: true,
    label: "FU.SheetThreat"
  });

  ItemSheets.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  ItemSheets.registerSheet("freeform-universal", FUGearSheet, {
    types: ["gear"],
    makeDefault: true,
    label: "FU.SheetGear"
  });
  ItemSheets.registerSheet("freeform-universal", FUTrademarkSheet, {
    types: ["trademark"],
    makeDefault: true,
    label: "FU.SheetTrademark"
  });
  ItemSheets.registerSheet("freeform-universal", FUFlawSheet, {
    types: ["flaw"],
    makeDefault: true,
    label: "FU.SheetFlaw"
  });
  ItemSheets.registerSheet("freeform-universal", FUDriveSheet, {
    types: ["drive"],
    makeDefault: true,
    label: "FU.SheetDrive"
  });
  ItemSheets.registerSheet("freeform-universal", FUInjurySheet, {
    types: ["injury"],
    makeDefault: true,
    label: "FU.SheetInjury"
  });
  ItemSheets.registerSheet("freeform-universal", FUConditionSheet, {
    types: ["condition"],
    makeDefault: true,
    label: "FU.SheetCondition"
  });
  ItemSheets.registerSheet("freeform-universal", FUAdvantageSheet, {
    types: ["advantage"],
    makeDefault: true,
    label: "FU.SheetAdvantage"
  });
  ItemSheets.registerSheet("freeform-universal", FUTieSheet, {
    types: ["tie"],
    makeDefault: true,
    label: "FU.SheetTie"
  });

  await foundry.applications.handlebars.loadTemplates([
    "systems/freeform-universal/templates/actor/parts/trademarks.hbs",
    "systems/freeform-universal/templates/actor/parts/tag-list.hbs",
    "systems/freeform-universal/templates/actor/parts/gear.hbs",
    "systems/freeform-universal/templates/actor/parts/track.hbs"
  ]);

  registerHandlebarsHelpers();
});

Hooks.once("ready", function () {
  // Roll confirmation socket — passes player pools to the GM for review.
  game.socket.on("system.freeform-universal", (data) => {
    FURollSocket.handle(data);
  });

  if (game.settings.get("freeform-universal", "pressureEnabled")) {
    PressureTracker.renderWidget();
  }
  populateRulesReference();
});

/**
 * Seed the Rules Reference compendium with the GM Guide journal entry on first
 * load. Idempotent: does nothing if the pack already contains the entry.
 */
async function populateRulesReference() {
  if (!game.user?.isGM) return;
  const pack = game.packs?.get("freeform-universal.fu-rules-reference");
  if (!pack) return;
  if (pack.locked) return;

  const title = "Freeform Universal — GM Guide";
  const index = await pack.getIndex();
  if (index.some(e => e.name === title)) return;

  const content = `
<h1>Freeform Universal — GM Guide</h1>

<h2>Character Limits &amp; the Custom Indicator</h2>
<p>Freeform Universal characters are built around a handful of core elements:</p>
<ul>
  <li><strong>Trademarks</strong> (default maximum: 5) — broad identity tags with Edges attached</li>
  <li><strong>Flaws</strong> (default maximum: 2) — troubles, disadvantages, Drama Point refresh triggers</li>
  <li><strong>Drive</strong> (default maximum: 1) — the singular overriding motivation</li>
</ul>
<p>These limits reflect the design intent of the game — a focused, legible character defined by a handful of strong concepts rather than an exhaustive list of abilities.</p>

<h3>The Custom Indicator</h3>
<p>When a character exceeds any of these limits, a small ⚙ badge appears near their name on the character sheet. This is not a hard block — the character still works normally. It is simply a signal to the GM that this character sits outside standard guidelines.</p>
<p>Clicking the ⚙ badge clears it manually if you have reviewed the character and are happy with it.</p>

<h3>Adjusting the Limits</h3>
<p>The default limits can be changed in <strong>Game Settings → System Settings</strong>. There is no maximum — set them as high as your game demands.</p>
<p>Reasons you might adjust limits:</p>
<ul>
  <li><strong>Higher Trademarks</strong> — for heroic or legendary characters, demigods, ancient beings</li>
  <li><strong>More Flaws</strong> — for grittier, more troubled characters</li>
  <li><strong>Multiple Drives</strong> — for characters with genuinely competing motivations</li>
</ul>

<h3>The Spirit of FU</h3>
<p>The rules are a framework, not a cage. The rule of cool always applies. If it makes for a better story, do it — and let the fiction justify the numbers.</p>

<hr />

<h2>The Oracle</h2>
<table>
  <thead>
    <tr><th>Roll</th><th>Result</th></tr>
  </thead>
  <tbody>
    <tr><td>6</td><td>Yes, and… — succeed with a bonus</td></tr>
    <tr><td>5</td><td>Yes — succeed</td></tr>
    <tr><td>4</td><td>Yes, but… — succeed at a cost</td></tr>
    <tr><td>3</td><td>No, but… — fail, but something softens it</td></tr>
    <tr><td>2</td><td>No — fail</td></tr>
    <tr><td>1</td><td>No, and… — fail and things get worse</td></tr>
    <tr><td>Botch</td><td>Terrible consequences</td></tr>
  </tbody>
</table>

<hr />

<h2>Drama Points</h2>
<p>Earn a Drama Point when:</p>
<ul>
  <li>A Trademark or Flaw causes trouble in play</li>
  <li>You act meaningfully on your Drive</li>
  <li>You play in an entertaining or genre-appropriate way</li>
</ul>
<p>Spend a Drama Point to:</p>
<ul>
  <li><strong>Effort</strong> — add an Action Die to your pool</li>
  <li><strong>Demonstrate Expertise</strong> — use a second Trademark (max two per check)</li>
  <li><strong>Do-over</strong> — re-roll the entire pool</li>
  <li><strong>Embellish</strong> — add a helpful detail to the scene</li>
  <li><strong>Soak</strong> — ignore or reduce harm at the moment it occurs</li>
</ul>

<hr />

<h2>Advancement</h2>
<p>Earn 1 XP at end of session for each true:</p>
<ol>
  <li>Overcame a significant enemy or threat</li>
  <li>Won a significant prize or advantage</li>
  <li>Learned an important detail about the world</li>
  <li>Completed a mission or achieved a goal</li>
</ol>
<p>Spend 10 XP for one advance:</p>
<ul>
  <li>Write a new Trademark (up to the configured maximum)</li>
  <li>Write a new Edge for any Trademark</li>
  <li>Increase Grit by 1 (maximum 6)</li>
  <li>Increase Spirit by 1 (maximum 6)</li>
</ul>
`.trim();

  try {
    await JournalEntry.create({
      name: title,
      pages: [{
        name: "GM Guide",
        type: "text",
        title: { show: false, level: 1 },
        text: { content, format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML }
      }]
    }, { pack: pack.collection });
    console.log("Freeform Universal | Seeded Rules Reference compendium");
  } catch (err) {
    console.warn("Freeform Universal | Could not seed Rules Reference compendium", err);
  }
}

/**
 * Register the two FU colorsets with Dice So Nice.
 *
 * Dice So Nice 6.2.6 (the installed version) exposes `game.dice3d.addColorset(colorset, mode)`.
 * `addColorset` writes into the module-private COLORSETS registry, which is surfaced
 * publicly as `game.dice3d.exports.COLORSETS` (NOT `game.dice3d.colorsets`, which does
 * not exist — that is why earlier verification always saw `{}`).
 *
 * Colorset field semantics in DSN:
 *   - background  → the body/face colour of the die
 *   - foreground  → the numeral/label colour
 *   - outline     → outline drawn around the numerals
 *   - edge        → bevelled edges (d4/d10/etc.)
 *   - visibility  → MUST be "visible" so the numerals render. "hidden" suppresses them.
 *   - material    → "plastic" keeps the specified colours faithful; "metal"/"wood" tint
 *                   and add bump maps that muddy the parchment/ivory and blood tones.
 *
 * `addColorset` is async (it may load a custom font); we await it so the registry is
 * populated before we log the verification line.
 */
async function registerFUColorsets(dice3d) {
  if (!dice3d || typeof dice3d.addColorset !== "function") {
    console.warn("FU | registerFUColorsets called without a valid dice3d instance", dice3d);
    return;
  }
  if (dice3d._fuColorsetsRegistered) {
    console.log("FU | Colorsets already registered, skipping");
    return;
  }

  // Action Die — parchment/ivory, warm and positive.
  await dice3d.addColorset({
    name: "fu-action",
    description: "FU Action Die",
    category: "Freeform Universal",
    foreground: ["#1C1208"],   // dark ink numerals
    background: ["#F0E8C8"],   // cream/ivory body
    outline: "#8B6914",        // brass outline
    edge: "#8B6914",           // brass edge
    texture: "none",
    material: "plastic",
    font: "Arial",
    visibility: "visible"
  }, "default");

  // Danger Die — black/blood, threatening.
  await dice3d.addColorset({
    name: "fu-danger",
    description: "FU Danger Die",
    category: "Freeform Universal",
    foreground: ["#8B1A1A"],   // blood-red numerals
    background: ["#0D0D0D"],   // near-black body
    outline: "#4A0000",        // deep-red outline
    edge: "#4A0000",           // deep-red edge
    texture: "none",
    material: "plastic",
    font: "Arial",
    visibility: "visible"
  }, "default");

  dice3d._fuColorsetsRegistered = true;

  // Verify against the public registry. `game.dice3d.exports.COLORSETS` is the
  // canonical place to confirm a colorset registered in DSN 6.x.
  const registry = dice3d.exports?.COLORSETS ?? {};
  const fuColorsets = Object.keys(registry).filter(k => k.startsWith("fu-"));
  console.log("FU | Colorsets registered. fu-* colorsets now in registry:", fuColorsets);
  if (!fuColorsets.includes("fu-action") || !fuColorsets.includes("fu-danger")) {
    console.warn("FU | Expected fu-action and fu-danger to be registered but one is missing.",
      "Full registry keys:", Object.keys(registry));
  }
}

Hooks.once("diceSoNiceReady", async (dice3d) => {
  console.log("FU | diceSoNiceReady fired");
  await registerFUColorsets(dice3d);
});

// Fallback: if Dice So Nice was already ready by the time this system finished
// loading (which can happen depending on module load order), the diceSoNiceReady
// hook above will never fire. Pick it up on the ready hook instead.
Hooks.once("ready", async () => {
  if (game.modules.get("dice-so-nice")?.active && game.dice3d) {
    if (!game.dice3d._fuColorsetsRegistered) {
      console.log("FU | DSN already ready at system ready — registering colorsets via fallback");
      await registerFUColorsets(game.dice3d);
    }
  }
});

Hooks.on("renderSceneControls", () => {
  if (game.settings.get("freeform-universal", "pressureEnabled")) {
    PressureTracker.renderWidget();
  } else {
    PressureTracker.removeWidget();
  }
});

/* -------------------------------------------------------------------------- */
/*  Spotlight Tracker (replaces initiative)                                    */
/*                                                                            */
/*  A GM-only boolean mark per Character (PC) combatant, shown in Foundry's    */
/*  native Combat Tracker. It is NOT initiative: no turn order, no roll, no    */
/*  sorting, and it never touches Foundry's round/turn machinery. State lives  */
/*  on the Combatant as a transient flag, never in template.json.             */
/*                                                                            */
/*  Foundry v13+ renders the Combat Tracker via ApplicationV2, so the         */
/*  renderCombatTracker hook passes a raw HTMLElement (not jQuery) as its      */
/*  second argument — verified against this install (v14, build 363). The      */
/*  combatant row is <li class="combatant" data-combatant-id="...">, with its  */
/*  control buttons inside .combatant-controls; the footer round/turn buttons  */
/*  live in <nav class="combat-controls">.                                     */
/* -------------------------------------------------------------------------- */

Hooks.on("renderCombatTracker", (app, element, _context, _options) => {
  const combat = app.viewed;
  if (!combat) return;

  // ApplicationV2 passes a raw HTMLElement; tolerate a jQuery wrapper just in case.
  const root = element instanceof HTMLElement ? element : element?.[0];
  if (!root) return;

  for (const combatant of combat.combatants) {
    if (combatant.actor?.type !== "character") continue; // PCs only — never Threats/NPCs

    const row = root.querySelector(`.combatant[data-combatant-id="${combatant.id}"]`);
    if (!row) continue;

    // Sit alongside the native row controls; fall back to the row itself.
    const controls = row.querySelector(".combatant-controls") ?? row;
    if (controls.querySelector(".fu-spotlight-btn")) continue; // avoid duplicate injection

    const spotlighted = !!combatant.getFlag("freeform-universal", "spotlighted");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `fu-spotlight-btn${spotlighted ? " spotlighted" : ""}`;
    btn.dataset.combatantId = combatant.id;
    btn.title = game.i18n.localize("FU.Spotlight.Toggle");
    btn.innerHTML = `<i class="fas fa-star"></i>`;

    if (!game.user.isGM) btn.disabled = true;

    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      await fuToggleSpotlight(combat, combatant.id);
    });

    controls.prepend(btn);
  }

  // Part 2a — optional one-click reset convenience (GM only, manual; NOT tied
  // to round advancement). Placed next to the native round/turn controls.
  if (game.user.isGM) {
    const footer = root.querySelector("nav.combat-controls");
    if (footer && !footer.querySelector(".fu-spotlight-reset")) {
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "fu-spotlight-btn fu-spotlight-reset";
      reset.title = game.i18n.localize("FU.Spotlight.ResetAll");
      reset.setAttribute("aria-label", game.i18n.localize("FU.Spotlight.ResetAll"));
      reset.innerHTML = `<i class="fas fa-rotate-left"></i>`;
      reset.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await fuResetAllSpotlights(combat);
      });
      footer.appendChild(reset);
    }
  }
});

/**
 * Toggle the spotlight mark on a single PC combatant. GM only. Pure boolean
 * state — no chat message, no round/turn changes, no side effects elsewhere.
 */
async function fuToggleSpotlight(combat, combatantId) {
  if (!game.user.isGM) return;
  const combatant = combat.combatants.get(combatantId);
  if (!combatant || combatant.actor?.type !== "character") return;

  const current = !!combatant.getFlag("freeform-universal", "spotlighted");
  await combatant.setFlag("freeform-universal", "spotlighted", !current);
}

/**
 * Clear the spotlight mark from every PC combatant. GM only, manual convenience.
 * Threats/NPCs never carry the flag, so they are untouched.
 */
async function fuResetAllSpotlights(combat) {
  if (!game.user.isGM) return;
  const pcCombatants = combat.combatants.filter(c => c.actor?.type === "character");
  for (const c of pcCombatants) {
    await c.unsetFlag("freeform-universal", "spotlighted");
  }
}

function registerHandlebarsHelpers() {
  Handlebars.registerHelper("fuRange", function (n) {
    n = Number(n) || 0;
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(i);
    return arr;
  });

  Handlebars.registerHelper("fuLt", (a, b) => Number(a) < Number(b));
  Handlebars.registerHelper("fuGt", (a, b) => Number(a) > Number(b));
  Handlebars.registerHelper("fuEq", (a, b) => a == b);
  Handlebars.registerHelper("fuOr", (...args) => {
    args.pop();
    return args.some(Boolean);
  });
  Handlebars.registerHelper("fuAnd", (...args) => {
    args.pop();
    return args.every(Boolean);
  });
  Handlebars.registerHelper("fuConcat", (...args) => {
    args.pop();
    return args.join("");
  });
}
