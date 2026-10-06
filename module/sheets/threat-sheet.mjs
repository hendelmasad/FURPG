export class FUThreatSheet extends foundry.appv1.sheets.ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["freeform-universal", "sheet", "actor", "threat"],
      template: "systems/freeform-universal/templates/actor/threat-sheet.hbs",
      width: 560,
      height: 600,
      resizable: true,
      scrollY: [".sheet-body"]
    });
  }

  async _onCreate(data, options, userId) {
    await super._onCreate?.(data, options, userId);
  }

  async getData(options) {
    const context = await super.getData(options);
    const actorData = this.actor.toObject(false);
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Normalize conditions to objects { name, active } (legacy data stored plain strings)
    context.system.conditions = (context.system.conditions || []).map(c =>
      (typeof c === "string") ? { name: c, active: false } : { name: c?.name ?? "", active: !!c?.active }
    );

    // Normalize actions to objects { name } (legacy data may store plain strings)
    context.system.actions = (context.system.actions || []).map(a =>
      (typeof a === "string") ? { name: a } : { name: a?.name ?? "" }
    );

    // Boss adds Hits equal to the number of PCs. hits.max stays the base value;
    // the effective total (and the track) grows by bossHits while Boss is active.
    const baseMax = context.system.hits.max;
    const bossHits = context.system.bossHits || 0;
    const effectiveMax = context.system.isBoss ? baseMax + bossHits : baseMax;
    context.baseMax = baseMax;
    context.effectiveMax = effectiveMax;
    context.hitBoxes = Array.from({ length: effectiveMax }, (_, i) => i < context.system.hits.value);

    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const enrichOpts = { secrets: this.actor.isOwner, relativeTo: this.actor };
    context.enrichedTags = await TE.enrichHTML(context.system.tags || "", enrichOpts);
    context.enrichedNotes = await TE.enrichHTML(context.system.notes || "", enrichOpts);
    context.enrichedDescription = await TE.enrichHTML(context.system.description || "", enrichOpts);
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find("[data-action='track-set']").on("click", ev => this._onTrackSet(ev));
    html.find("[data-action='hits-max-inc']").on("click", () => this._adjustHitsMax(1));
    html.find("[data-action='hits-max-dec']").on("click", () => this._adjustHitsMax(-1));

    html.find("[data-action='tag-add']").on("click", ev => this._addTag(ev));
    html.find("[data-action='tag-delete']").on("click", ev => this._deleteTag(ev));

    html.find("[data-action='condition-add']").on("click", ev => this._addCondition(ev));
    html.find("[data-action='condition-delete']").on("click", ev => this._deleteCondition(ev));

    html.find("[data-action='action-add']").on("click", ev => this._addAction(ev));
    html.find("[data-action='action-delete']").on("click", ev => this._deleteAction(ev));

    html.find("[data-action='portrait-lightbox']").on("contextmenu", ev => this._openPortraitLightbox(ev));
  }

  async _onTrackSet(ev) {
    ev.preventDefault();
    const index = Number(ev.currentTarget.dataset.index);
    const current = this.actor.system.hits.value;
    const newValue = (current === index + 1) ? index : index + 1;
    await this.actor.update({ "system.hits.value": newValue });
  }

  async _adjustHitsMax(delta) {
    const sys = this.actor.system;
    const newMax = Math.max(1, (sys.hits.max || 1) + delta);
    const newVal = Math.min(sys.hits.value, newMax);
    await this.actor.update({ "system.hits.max": newMax, "system.hits.value": newVal });
  }

  async _commitPending(ev) {
    try {
      await this._onSubmit(ev, { preventClose: true, preventRender: true });
    } catch (e) { /* no-op */ }
  }

  async _addTag(ev) {
    await this._commitPending(ev);
    const list = ev.currentTarget.dataset.list;
    const arr = foundry.utils.deepClone(this.actor.system[list] || []);
    arr.push("");
    await this.actor.update({ [`system.${list}`]: arr });
  }

  async _deleteTag(ev) {
    await this._commitPending(ev);
    const list = ev.currentTarget.dataset.list;
    const i = Number(ev.currentTarget.dataset.index);
    const arr = foundry.utils.deepClone(this.actor.system[list] || []);
    arr.splice(i, 1);
    await this.actor.update({ [`system.${list}`]: arr });
  }

  /** Conditions are stored as objects { name, active }; legacy data may hold plain strings. */
  _conditionsArray() {
    return (this.actor.system.conditions || []).map(c =>
      (typeof c === "string") ? { name: c, active: false } : { name: c?.name ?? "", active: !!c?.active }
    );
  }

  async _addCondition(ev) {
    await this._commitPending(ev);
    const arr = this._conditionsArray();
    arr.push({ name: "", active: false });
    await this.actor.update({ "system.conditions": arr });
  }

  async _deleteCondition(ev) {
    await this._commitPending(ev);
    const i = Number(ev.currentTarget.dataset.index);
    const arr = this._conditionsArray();
    arr.splice(i, 1);
    await this.actor.update({ "system.conditions": arr });
  }

  /** Actions are stored as objects { name }; legacy data may hold plain strings. */
  _actionsArray() {
    return (this.actor.system.actions || []).map(a =>
      (typeof a === "string") ? { name: a } : { name: a?.name ?? "" }
    );
  }

  async _addAction(ev) {
    await this._commitPending(ev);
    const arr = this._actionsArray();
    arr.push({ name: "" });
    await this.actor.update({ "system.actions": arr });
  }

  async _deleteAction(ev) {
    await this._commitPending(ev);
    const i = Number(ev.currentTarget.dataset.index);
    const arr = this._actionsArray();
    arr.splice(i, 1);
    await this.actor.update({ "system.actions": arr });
  }

  _openPortraitLightbox(ev) {
    ev.preventDefault();
    const src = this.actor.img;
    const existing = document.getElementById("fu-portrait-lightbox");
    if (existing) existing.remove();
    const el = document.createElement("div");
    el.id = "fu-portrait-lightbox";
    el.className = "fu-portrait-lightbox";
    el.innerHTML = `<div class="fu-portrait-lightbox-inner">
      <img class="fu-portrait-lightbox-img" src="${src}" />
    </div>`;
    el.addEventListener("click", () => el.remove());
    document.body.appendChild(el);
  }

  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData);
    for (const key of ["conditions", "actions"]) {
      if (expanded.system?.[key] && !Array.isArray(expanded.system[key])) {
        const obj = expanded.system[key];
        expanded.system[key] = Object.keys(obj).sort((a, b) => Number(a) - Number(b)).map(k => obj[k]);
      }
    }
    return this.actor.update(expanded);
  }
}

Hooks.on("preCreateActor", (actor, data, options, userId) => {
  if (actor.type !== "threat") return;
  const defaultHits = game.settings.get("freeform-universal", "defaultThreatHits") || 3;
  const updates = {};
  if (!data.system?.hits?.max) updates["system.hits.max"] = defaultHits;
  if (data.system?.hits?.value === undefined) updates["system.hits.value"] = defaultHits;
  if (Object.keys(updates).length) actor.updateSource(updates);
});
