// Freeform Universal — Chronicle Macro
// Pops up a dialog with a plain text area for session notes.
// On "Publish", creates a new page in the "Session Log" journal
// with an auto-incrementing sequence number based on today's date.
//
// Sequence format: YYYY-MM-DD-NNN (e.g. 2026-08-05-001)
// Counter resets to 001 each new date.
// The counter is stored as a world setting so it persists across
// macro invocations within the same session.

(async function () {

  // ── Helper: today's date as YYYY-MM-DD ──────────────────────────────────
  function todayStamp() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // ── Helper: next sequence number for today ───────────────────────────────
  // Stored as a world-level flag on the "Session Log" journal itself,
  // keyed by date — no extra settings registration needed.
  async function nextSequence(journal, today) {
    const stored = journal.getFlag("freeform-universal", "chronicleDate");
    const count  = journal.getFlag("freeform-universal", "chronicleCount") || 0;

    let next;
    if (stored === today) {
      next = count + 1;
    } else {
      // New date — reset counter
      next = 1;
    }

    await journal.setFlag("freeform-universal", "chronicleDate", today);
    await journal.setFlag("freeform-universal", "chronicleCount", next);
    return String(next).padStart(3, "0");
  }

  // ── Find or create the Session Log journal ───────────────────────────────
  let journal = game.journal.getName("Session Log");
  if (!journal) {
    journal = await JournalEntry.create({ name: "Session Log" });
    ui.notifications.info("Chronicle: 'Session Log' journal created.");
  }

  // ── Build the dialog ─────────────────────────────────────────────────────
  const today = todayStamp();

  const content = `
    <form>
      <p style="font-family:'Cinzel','Georgia',serif;font-size:12px;
        color:#000000;letter-spacing:1px;margin-bottom:8px;">
        ${today} — Session Log Entry
      </p>
      <textarea name="entry" rows="12"
        style="width:100%;font-family:'Crimson Text','Georgia',serif;
          font-size:14px;color:#000000;background:#F0E8C8;
          border:1px solid #8B6914;border-radius:2px;padding:8px;
          resize:vertical;"
        placeholder="What happened? Write your session notes here..."></textarea>
    </form>`;

  new Dialog({
    title: "Chronicle — Session Log",
    content,
    buttons: {
      publish: {
        icon: '<i class="fas fa-book"></i>',
        label: "Publish",
        callback: async (html) => {
          const text = html.find("[name='entry']").val()?.trim();
          if (!text) {
            ui.notifications.warn("Chronicle: nothing to publish — entry is empty.");
            return;
          }

          const seq = await nextSequence(journal, today);
          const pageTitle = `${today}-${seq}`;

          // Wrap plain text in <p> tags, preserving paragraph breaks
          const bodyHtml = text
            .split(/\n\s*\n/)
            .map(p => `<p>${p.trim().replace(/\n/g, "<br>")}</p>`)
            .join("");

          await JournalEntryPage.create({
            name: pageTitle,
            type: "text",
            text: { content: bodyHtml, format: 1 }
          }, { parent: journal });

          ui.notifications.info(`Chronicle: entry ${pageTitle} published to Session Log.`);
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    },
    default: "publish"
  }, {
    classes: ["freeform-universal", "dialog"],
    width: 520,
    height: 420
  }).render(true);

})();
