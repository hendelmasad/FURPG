export class PressureTracker {
  static WIDGET_ID = "fu-pressure-tracker";

  static get value() {
    return Number(game.settings.get("freeform-universal", "pressureValue")) || 0;
  }

  static async set(v) {
    const clamped = Math.max(0, Math.min(6, Math.floor(v)));
    await game.settings.set("freeform-universal", "pressureValue", clamped);
    if (clamped >= 6) PressureTracker.alert();
  }

  static async add(n = 1) {
    const cur = PressureTracker.value;
    const next = Math.min(6, cur + n);
    await PressureTracker.set(next);
  }

  static async reset() {
    await PressureTracker.set(0);
  }

  static alert() {
    ui.notifications.warn(game.i18n.localize("FU.PressureAlert"), { permanent: false });
    ChatMessage.create({
      speaker: { alias: game.i18n.localize("FU.PressureTitle") },
      content: `<div class="fu-pressure-alert"><strong>${game.i18n.localize("FU.PressureAlert")}</strong></div>`
    });
  }

  static renderWidget() {
    PressureTracker.removeWidget();
    if (!game.user.isGM) return;

    const el = document.createElement("div");
    el.id = PressureTracker.WIDGET_ID;
    el.className = "fu-pressure-widget";
    document.body.appendChild(el);
    PressureTracker.refresh();
  }

  static removeWidget() {
    const el = document.getElementById(PressureTracker.WIDGET_ID);
    if (el) el.remove();
  }

  static refresh() {
    const el = document.getElementById(PressureTracker.WIDGET_ID);
    if (!el) return;
    const v = PressureTracker.value;
    const boxes = Array.from({ length: 6 }, (_, i) =>
      `<span class="fu-pressure-box${i < v ? " filled" : ""}" data-index="${i}"></span>`
    ).join("");
    el.innerHTML = `
      <div class="fu-pressure-header">
        <span class="fu-pressure-title">${game.i18n.localize("FU.PressureTitle")}</span>
        <span class="fu-pressure-count">${v}/6</span>
      </div>
      <div class="fu-pressure-track">${boxes}</div>
      <div class="fu-pressure-buttons">
        <button type="button" data-action="dec" title="-1">-</button>
        <button type="button" data-action="inc" title="+1">+</button>
        <button type="button" data-action="reset" title="${game.i18n.localize("FU.Reset")}">${game.i18n.localize("FU.Reset")}</button>
      </div>
    `;
    el.querySelector("[data-action='inc']").onclick = () => PressureTracker.add(1);
    el.querySelector("[data-action='dec']").onclick = () => PressureTracker.add(-1);
    el.querySelector("[data-action='reset']").onclick = () => PressureTracker.reset();
    el.querySelectorAll(".fu-pressure-box").forEach(box => {
      box.onclick = ev => {
        const idx = Number(ev.currentTarget.dataset.index);
        const current = PressureTracker.value;
        PressureTracker.set(current === idx + 1 ? idx : idx + 1);
      };
    });
  }
}
