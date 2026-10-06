// Freeform Universal — Session Close Macro
// Consolidates all Session Log entries from a specific date into one
// polished journal entry, separated by horizontal rules, then clears
// those pages from the Session Log ready for the next session.
//
// Run at the end of each session before midnight.
// The consolidated journal is named: "Session — YYYY-MM-DD"

(async function () {

  // ── Helper: today's date as YYYY-MM-DD ──────────────────────────────────
  function todayStamp() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // ── Step 1 — pop up date confirmation dialog ─────────────────────────────
  const today = todayStamp();

  const dateConfirm = await new Promise(resolve => {
    new Dialog({
      title: "Close Session — Confirm Date",
      content: `
        <form>
          <p style="font-family:'Cinzel','Georgia',serif;font-size:12px;
            color:#000000;letter-spacing:1px;margin-bottom:8px;">
            Consolidate all Session Log entries for this date:
          </p>
          <input type="text" name="sessionDate" value="${today}"
            style="width:100%;font-family:'Crimson Text','Georgia',serif;
              font-size:16px;color:#000000;background:#F0E8C8;
              border:1px solid #8B6914;border-radius:2px;padding:6px;
              text-align:center;letter-spacing:2px;" />
          <p style="font-family:'Crimson Text',serif;font-size:12px;
            color:#5C3D11;margin-top:8px;font-style:italic;">
            Edit the date above if you're closing a previous session.
          </p>
        </form>`,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-scroll"></i>',
          label: "Close Session",
          callback: html => resolve(html.find("[name='sessionDate']").val()?.trim())
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      default: "confirm"
    }, { classes: ["freeform-universal", "dialog"], width: 380 }).render(true);
  });

  if (!dateConfirm) return; // cancelled

  const sessionDate = dateConfirm;

  // ── Step 2 — find the Session Log journal ───────────────────────────────
  const sessionLog = game.journal.getName("Session Log");
  if (!sessionLog) {
    ui.notifications.warn("Session Close: 'Session Log' journal not found — nothing to consolidate.");
    return;
  }

  // ── Step 3 — collect pages matching the session date, sorted by name ────
  const pages = sessionLog.pages.contents
    .filter(p => p.name.startsWith(sessionDate))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!pages.length) {
    ui.notifications.warn(`Session Close: no entries found for ${sessionDate} in Session Log.`);
    return;
  }

  // ── Step 4 — build the consolidated HTML ────────────────────────────────
  const parts = pages.map((p, i) => {
    const header = `<h2 style="font-family:'Cinzel','Georgia',serif;
      color:#5C3D11;letter-spacing:1px;">${p.name}</h2>`;
    const body = p.text?.content || "<p><em>(empty entry)</em></p>";
    const divider = i < pages.length - 1 ? "<hr />" : "";
    return `${header}${body}${divider}`;
  });

  const consolidatedHtml = parts.join("\n");

  // ── Step 5 — create the Session journal ─────────────────────────────────
  const sessionJournalName = `Session — ${sessionDate}`;
  let existing = game.journal.getName(sessionJournalName);
  if (existing) {
    ui.notifications.warn(`Session Close: '${sessionJournalName}' already exists — skipping creation. Delete it first if you want to regenerate.`);
    return;
  }

  const newJournal = await JournalEntry.create({ name: sessionJournalName });
  await JournalEntryPage.create({
    name: sessionJournalName,
    type: "text",
    text: { content: consolidatedHtml, format: 1 }
  }, { parent: newJournal });

  // ── Step 6 — delete the consolidated pages from Session Log ─────────────
  for (const page of pages) {
    await page.delete();
  }

  // Reset the chronicle counter flags on Session Log
  await sessionLog.unsetFlag("freeform-universal", "chronicleDate");
  await sessionLog.unsetFlag("freeform-universal", "chronicleCount");

  ui.notifications.info(`Session Close: '${sessionJournalName}' created with ${pages.length} entr${pages.length !== 1 ? "ies" : "y"}. Session Log cleared.`);

})();
