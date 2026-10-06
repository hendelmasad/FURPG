/**
 * Two-step character creation flow:
 *   Step 1 — Blank sheet or browse templates?
 *   Step 2 — Visual card browser of the fu-character-templates compendium.
 *
 * Invoked from the preCreateActor hook, which cancels the default creation and
 * calls FUCharacterCreationDialog.show(actorName).
 */
export class FUCharacterCreationDialog {
  static TEMPLATE_PACK = "freeform-universal.fu-character-templates";

  constructor() {
    this._selectedId = null;
    this._actorName = "New Character";
  }

  static show(actorName = "New Character") {
    const dlg = new FUCharacterCreationDialog();
    dlg._actorName = actorName;
    dlg._renderStep1();
  }

  static _esc(str) {
    return Handlebars.Utils.escapeExpression(String(str ?? ""));
  }

  /* ------------------------------- Step 1 ---------------------------------- */

  _renderStep1() {
    const content = `
      <div class="fu-creation-body">
        <p class="fu-creation-intro">How would you like to begin?</p>
        <div class="fu-template-actions" style="border-top:none;">
          <button type="button" class="fu-btn-back" data-action="blank">Blank Sheet</button>
          <button type="button" class="fu-btn-select" data-action="browse">Browse Templates</button>
        </div>
      </div>
    `;

    const dlg = new Dialog({
      title: "Create New Character",
      content,
      buttons: {},
      render: html => {
        html.find('[data-action="blank"]').on("click", () => { dlg.close(); this._createBlank(); });
        html.find('[data-action="browse"]').on("click", () => { dlg.close(); this._renderStep2(); });
      }
    }, {
      classes: ["freeform-universal", "fu-creation-dialog"],
      width: 420
    });
    this._dialog = dlg;
    dlg.render(true);
  }

  /* ------------------------------- Step 2 ---------------------------------- */

  async _renderStep2() {
    const pack = game.packs?.get(FUCharacterCreationDialog.TEMPLATE_PACK);
    let docs = [];
    try {
      if (pack) docs = await pack.getDocuments();
    } catch (err) {
      console.warn("Freeform Universal | Could not load character templates", err);
    }
    docs = docs.filter(d => d.type === "character");

    const cards = docs.map(d => `
      <div class="fu-template-card" data-template-id="${d.id}">
        <img src="${FUCharacterCreationDialog._esc(d.img || "icons/svg/mystery-man.svg")}" alt="" />
        <div class="fu-template-name">${FUCharacterCreationDialog._esc(d.name)}</div>
      </div>`).join("");

    const grid = docs.length
      ? cards
      : `<p class="fu-template-empty">No templates found. Add characters to the 'Character Templates' compendium to use them here.</p>`;

    const actions = docs.length
      ? `
        <button type="button" class="fu-btn-back" data-action="back">Back</button>
        <button type="button" class="fu-btn-select" data-action="select" disabled>Select</button>
        <button type="button" class="fu-btn-cancel" data-action="cancel">Cancel</button>`
      : `
        <button type="button" class="fu-btn-select" data-action="blank">Create Blank</button>
        <button type="button" class="fu-btn-cancel" data-action="cancel">Cancel</button>`;

    const content = `
      <div class="fu-creation-body" style="padding:0;">
        <div class="fu-template-grid">${grid}</div>
        <div class="fu-template-actions">${actions}</div>
      </div>
    `;

    const dlg = new Dialog({
      title: "Choose a Template",
      content,
      buttons: {},
      render: html => {
        html.find(".fu-template-card").on("click", ev => {
          const card = ev.currentTarget;
          html.find(".fu-template-card").removeClass("selected");
          card.classList.add("selected");
          this._selectedId = card.dataset.templateId;
          html.find('[data-action="select"]').prop("disabled", false);
        });
        html.find('[data-action="back"]').on("click", () => { dlg.close(); this._renderStep1(); });
        html.find('[data-action="cancel"]').on("click", () => dlg.close());
        html.find('[data-action="blank"]').on("click", () => { dlg.close(); this._createBlank(); });
        html.find('[data-action="select"]').on("click", () => {
          if (!this._selectedId) return;
          const tmpl = docs.find(d => d.id === this._selectedId);
          dlg.close();
          if (tmpl) this._createFromTemplate(tmpl);
        });
      }
    }, {
      classes: ["freeform-universal", "fu-creation-dialog"],
      width: 500
    });
    this._dialog = dlg;
    dlg.render(true);
  }

  /* ------------------------------- Creation -------------------------------- */

  async _createBlank() {
    const actor = await Actor.create(
      { name: this._actorName || "New Character", type: "character" },
      { _isBlank: true }
    );
    actor?.sheet?.render(true);
  }

  async _createFromTemplate(templateActor) {
    // toObject() copies all system data AND all owned Items (Trademarks, Flaws,
    // Drives, Injuries, Conditions, Gear) because they are proper Item documents.
    const actorData = templateActor.toObject();
    delete actorData._id;
    delete actorData.folder;

    const sys = actorData.system ?? (actorData.system = {});
    const hitsMax = sys.hits?.max ?? 2;
    const spirit  = sys.spirit ?? 2;
    sys.hits        = { value: hitsMax, max: hitsMax };
    sys.dramaPoints = { value: spirit, max: spirit };
    sys.xp          = 0;
    sys.custom      = false;
    sys.dying       = { active: false, expiresIn: 0 };

    const newActor = await Actor.create(actorData, { _fromTemplate: true });
    if (newActor) newActor.sheet?.render(true);
  }
}
