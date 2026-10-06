import { FURollDialog } from "../apps/roll-dialog.mjs";
import { ActionRoller } from "../apps/action-roller.mjs";
import { normalizeGearTags } from "../helpers/gear.mjs";

const SIMPLE_ITEM_TYPES = ["flaw", "drive", "injury", "condition", "advantage", "tie"];

export class FUCharacterSheet extends foundry.appv1.sheets.ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["freeform-universal", "sheet", "actor", "character"],
      template: "systems/freeform-universal/templates/actor/character-sheet.hbs",
      width: 720,
      height: 780,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }],
      scrollY: [".sheet-body"]
    });
  }

  _maxTrademarks() { return game.settings.get("freeform-universal", "maxTrademarks") ?? 5; }
  _maxFlaws()      { return game.settings.get("freeform-universal", "maxFlaws") ?? 2; }
  _maxDrives()     { return game.settings.get("freeform-universal", "maxDrives") ?? 1; }
  _maxAdvantages() { return game.settings.get("freeform-universal", "maxAdvantages") ?? 3; }
  _maxTies()       { return game.settings.get("freeform-universal", "maxTies") ?? 2; }

  async getData(options) {
    const context = await super.getData(options);
    const actorData = this.actor.toObject(false);
    context.system = actorData.system;
    context.flags  = actorData.flags;

    context.trademarks = this.actor.items.filter(i => i.type === "trademark")
      .map(i => ({ id: i.id, name: i.name, edges: i.system.edges || [] }));
    context.flaws      = this.actor.items.filter(i => i.type === "flaw")
      .map(i => ({ id: i.id, name: i.name }));
    context.drives     = this.actor.items.filter(i => i.type === "drive")
      .map(i => ({ id: i.id, name: i.name }));
    context.advantages = this.actor.items.filter(i => i.type === "advantage")
      .map(i => ({ id: i.id, name: i.name }));
    context.ties       = this.actor.items.filter(i => i.type === "tie")
      .map(i => ({ id: i.id, name: i.name }));
    context.injuries   = this.actor.items.filter(i => i.type === "injury")
      .map(i => ({ id: i.id, name: i.name, damage: i.system.damage || 1 }));
    context.conditions = this.actor.items.filter(i => i.type === "condition")
      .map(i => ({ id: i.id, name: i.name }));
    context.gear       = this.actor.items.filter(i => i.type === "gear")
      .map(i => ({ id: i.id, name: i.name, system: i.system, tags: normalizeGearTags(i.system?.tags) }));

    context.trademarkLimit = this._maxTrademarks();
    context.flawLimit      = this._maxFlaws();
    context.driveLimit     = this._maxDrives();
    context.advantageLimit = this._maxAdvantages();
    context.tieLimit       = this._maxTies();

    const isCustom =
      context.trademarks.length > context.trademarkLimit ||
      context.flaws.length      > context.flawLimit      ||
      context.drives.length     > context.driveLimit     ||
      context.advantages.length > context.advantageLimit ||
      context.ties.length       > context.tieLimit       ||
      this.actor.system.custom === true;
    context.isCustom = isCustom;
    if (isCustom !== this.actor.system.custom)
      this.actor.update({ "system.custom": isCustom }, { render: false });

    context.xpBoxes    = Array.from({ length: 10 }, (_, i) => i < (context.system.xp || 0));
    context.hitBoxes   = Array.from({ length: context.system.hits.max }, (_, i) => i < context.system.hits.value);
    context.dramaBoxes = Array.from({ length: context.system.dramaPoints.max }, (_, i) => i < context.system.dramaPoints.value);
    context.injuryOverflow = context.injuries.length > context.system.grit;
    context.xpTriggers = ["FU.XPTrigger.Enemy","FU.XPTrigger.Prize","FU.XPTrigger.Detail","FU.XPTrigger.Mission"];

    // Career XP tracking
    context.xpEarned = context.system.xpEarned || 0;
    context.xpSpent  = context.system.xpSpent  || 0;
    context.xpLog    = (context.system.xpLog   || []).slice().reverse(); // newest first
    context.xpNet    = (context.system.xpEarned || 0) - (context.system.xpSpent || 0);

    // Rich text Biography — same ProseMirror enrichment pattern as Trademark memo / Gear description
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    context.enrichedBiography = await TE.enrichHTML(context.system.biography || "", {
      secrets: this.actor.isOwner,
      relativeTo: this.actor
    });

    return context;
  }

  async _render(force, options) {
    this._accordionState = this.element?.length ? this._getAccordionState(this.element) : null;
    await super._render(force, options);
  }

  _getAccordionState(html) {
    const state = { trademarks: [], gear: [] };
    html.find(".fu-trademark.expanded").each((_, el) => state.trademarks.push(el.dataset.itemId));
    html.find(".fu-gear-row.expanded").each((_, el) => state.gear.push(el.dataset.itemId));
    return state;
  }

  _restoreAccordionState(html, state) {
    if (!state) return;
    state.trademarks.forEach(id => html.find(`.fu-trademark[data-item-id="${id}"]`).addClass("expanded"));
    state.gear.forEach(id => html.find(`.fu-gear-row[data-item-id="${id}"]`).addClass("expanded"));
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find("[data-action='roll']").on("click", () => this._openRollDialog());
    html.find("[data-action='track-set']").on("click", ev => this._onTrackSet(ev));
    html.find("[data-action='xp-set']").on("click", ev => this._onXpSet(ev));

    html.find("[data-action='trademark-add']").on("click", () => this._addTrademark());
    html.find("[data-action='trademark-delete']").on("click", ev => this._deleteTrademark(ev));
    html.find("[data-action='trademark-name-edit']").on("change", ev => this._onTrademarkNameChange(ev));
    html.find("[data-action='trademark-memo']").on("click", ev => this._openTrademarkMemo(ev));
    html.find("[data-action='edge-add']").on("click", ev => this._addEdge(ev));
    html.find("[data-action='edge-delete']").on("click", ev => this._deleteEdge(ev));
    html.find("[data-action='edge-edit']").on("change", ev => this._onEdgeChange(ev));

    html.find("[data-action='item-add']").on("click", ev => this._addSimpleItem(ev));
    html.find("[data-action='item-delete']").on("click", ev => this._deleteItem(ev));
    html.find("[data-action='item-name-edit']").on("change", ev => this._onItemNameChange(ev));
    html.find("[data-action='item-memo']").on("click", ev => this._openItemMemo(ev));
    html.find("[data-action='injury-damage-set']").on("click", ev => this._onInjuryDamageSet(ev));

    html.find("[data-action='gear-create']").on("click", () => this._createGear());
    html.find("[data-action='gear-edit']").on("click", ev => this._editGear(ev));
    html.find("[data-action='gear-delete']").on("click", ev => this._deleteGear(ev));
    html.find("[data-action='gear-tag-add']").on("click", ev => this._addGearTag(ev));
    html.find("[data-action='gear-tag-delete']").on("click", ev => this._deleteGearTag(ev));
    html.find("[data-action='gear-tag-edit']").on("change", ev => this._editGearTag(ev));

    html.find("[data-action='toggle-trademark']").on("click", ev => this._toggleAccordion(ev, ".fu-trademark"));
    html.find("[data-action='toggle-gear']").on("click", ev => this._toggleAccordion(ev, ".fu-gear-row"));
    html.find("[data-action='portrait-lightbox']").on("contextmenu", ev => this._openPortraitLightbox(ev));
    html.find("[data-action='clear-custom']").on("click", () => this._clearCustom());
    html.find("[data-action='advance']").on("click", () => this._openAdvanceDialog());

    html.find("[data-action='xp-award']").on("click", ev => this._onXpAward(html));
    html.find("[data-action='xp-undo']").on("click", ev => this._onXpUndo());

    this._restoreAccordionState(html, this._accordionState);
  }

  _toggleAccordion(ev, selector) {
    ev.preventDefault();
    ev.stopPropagation();
    const container = ev.currentTarget.closest(selector);
    if (container) container.classList.toggle("expanded");
  }

  _getItemFromEvent(ev) {
    const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    return this.actor.items.get(id);
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

  async _openRollDialog() { new ActionRoller(this.actor).render(true); }

  async _onTrackSet(ev) {
    ev.preventDefault();
    const target = ev.currentTarget.dataset.target;
    const index  = Number(ev.currentTarget.dataset.index);
    const current = foundry.utils.getProperty(this.actor.system, `${target}.value`);
    await this.actor.update({ [`system.${target}.value`]: (current === index + 1) ? index : index + 1 });
  }

  async _onXpSet(ev) {
    ev.preventDefault();
    const index   = Number(ev.currentTarget.dataset.index);
    const current = Number(this.actor.system.xp) || 0;
    await this.actor.update({ "system.xp": (current === index + 1) ? index : index + 1 });
  }

  /* ---- Career XP ---- */

  async _onXpAward(html) {
    const checked = html.find(".fu-xp-criterion:checked").length;
    if (!checked) {
      ui.notifications.warn(game.i18n.localize("FU.XP.NoCriteriaChecked"));
      return;
    }
    const current = Number(this.actor.system.xp) || 0;
    const earned  = Number(this.actor.system.xpEarned) || 0;
    await this.actor.update({
      "system.xp":       current + checked,
      "system.xpEarned": earned  + checked
    });
    // Criteria checkboxes are transient — the sheet re-renders and resets them
    ui.notifications.info(game.i18n.format("FU.XP.Awarded", { n: checked }));
  }

  async _onXpUndo() {
    const log = foundry.utils.deepClone(this.actor.system.xpLog || []);
    if (!log.length) return;

    const last         = log[log.length - 1];
    const currentXp    = Number(this.actor.system.xp)      || 0;
    const currentSpent = Number(this.actor.system.xpSpent) || 0;

    log.pop();

    await this.actor.update({
      "system.xp":      currentXp + last.cost,
      "system.xpSpent": Math.max(0, currentSpent - last.cost),
      "system.xpLog":   log
    });

    ui.notifications.warn(game.i18n.format("FU.XP.Undone", { description: last.description }));
  }

  async _logXpSpend(description) {
    const log   = foundry.utils.deepClone(this.actor.system.xpLog || []);
    const spent = Number(this.actor.system.xpSpent) || 0;
    const d     = new Date();
    const date  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    log.push({ date, cost: 10, description });
    await this.actor.update({
      "system.xpSpent": spent + 10,
      "system.xpLog":   log
    });
  }

  /* ---- Trademarks ---- */

  async _addTrademark() {
    await Item.create(
      { name: game.i18n.localize("FU.NewTrademark") || "New Trademark", type: "trademark", system: { edges: [], memo: "" } },
      { parent: this.actor }
    );
  }

  async _deleteTrademark(ev) { await this._getItemFromEvent(ev)?.delete(); }

  async _onTrademarkNameChange(ev) {
    const value = ev.currentTarget.value?.trim() || "New Trademark";
    await this._getItemFromEvent(ev)?.update({ name: value });
  }

  async _openTrademarkMemo(ev) {
    const item = this._getItemFromEvent(ev);
    if (!item) return;
    item.sheet.render(true);
  }

  async _addEdge(ev) {
    const item = this._getItemFromEvent(ev);
    if (!item) return;
    const edges = foundry.utils.deepClone(item.system.edges || []);
    edges.push(game.i18n.localize("FU.NewEdge") || "New Edge");
    await item.update({ "system.edges": edges });
  }

  async _deleteEdge(ev) {
    const item = this._getItemFromEvent(ev);
    if (!item) return;
    const edges = foundry.utils.deepClone(item.system.edges || []);
    edges.splice(Number(ev.currentTarget.dataset.edge), 1);
    await item.update({ "system.edges": edges });
  }

  async _onEdgeChange(ev) {
    const item = this._getItemFromEvent(ev);
    if (!item) return;
    const ei    = Number(ev.currentTarget.dataset.edge);
    const edges = foundry.utils.deepClone(item.system.edges || []);
    if (ei < 0 || ei >= edges.length) return;
    edges[ei] = ev.currentTarget.value?.trim() || "New Edge";
    await item.update({ "system.edges": edges });
  }

  /* ---- Simple items ---- */

  async _addSimpleItem(ev) {
    const type = ev.currentTarget.dataset.type;
    if (!SIMPLE_ITEM_TYPES.includes(type)) return;
    const defaultNames = {
      flaw:      game.i18n.localize("FU.NewFlaw")      || "New Flaw",
      drive:     game.i18n.localize("FU.NewDrive")     || "New Drive",
      injury:    game.i18n.localize("FU.NewInjury")    || "New Injury",
      condition: game.i18n.localize("FU.NewCondition") || "New Condition",
      advantage: game.i18n.localize("FU.NewAdvantage") || "New Advantage",
      tie:       game.i18n.localize("FU.NewTie")       || "New Tie"
    };
    await Item.create({ name: defaultNames[type], type }, { parent: this.actor });
  }

  async _deleteItem(ev) { await this._getItemFromEvent(ev)?.delete(); }

  async _onItemNameChange(ev) {
    const value = ev.currentTarget.value?.trim();
    if (!value) return;
    await this._getItemFromEvent(ev)?.update({ name: value });
  }

  async _openItemMemo(ev) {
    const item = this._getItemFromEvent(ev);
    if (!item) return;
    item.sheet.render(true);
  }

  async _onInjuryDamageSet(ev) {
    const item = this._getItemFromEvent(ev);
    if (!item) return;
    const clicked = Number(ev.currentTarget.dataset.damage);
    const current = item.system.damage || 1;
    // Clicking the current value decrements by 1 (min 1), otherwise sets to clicked value
    const newDamage = (clicked === current && current > 1) ? current - 1 : clicked;
    await item.update({ "system.damage": newDamage });
  }

  /* ---- Gear ---- */

  async _createGear() {
    const ItemCls = foundry.documents?.Item ?? Item;
    const item = await ItemCls.create(
      { name: game.i18n.localize("FU.NewGear"), type: "gear" },
      { parent: this.actor }
    );
    item?.sheet?.render(true);
  }

  _editGear(ev)         { this._getItemFromEvent(ev)?.sheet?.render(true); }
  async _deleteGear(ev) { await this._getItemFromEvent(ev)?.delete(); }

  async _addGearTag(ev) {
    ev.preventDefault();
    const item = this._getItemFromEvent(ev);
    if (!item) return;
    const tags = normalizeGearTags(item.system?.tags);
    tags.push({ id: foundry.utils.randomID(), name: "" });
    await item.update({ "system.tags": tags });
    ev.currentTarget.closest(".fu-gear-row")?.classList.add("expanded");
  }

  async _deleteGearTag(ev) {
    ev.preventDefault();
    const item = this._getItemFromEvent(ev);
    if (!item) return;
    const tags = normalizeGearTags(item.system?.tags).filter(t => t.id !== ev.currentTarget.dataset.tagId);
    await item.update({ "system.tags": tags });
  }

  async _editGearTag(ev) {
    const item = this._getItemFromEvent(ev);
    if (!item) return;
    const tags = normalizeGearTags(item.system?.tags);
    const tag  = tags.find(t => t.id === ev.currentTarget.dataset.tagId);
    if (!tag) return;
    tag.name = ev.currentTarget.value;
    await item.update({ "system.tags": tags });
  }

  /* ---- Custom flag ---- */

  async _clearCustom() { await this.actor.update({ "system.custom": false }); }

  /* ---- Drag & Drop ---- */

  async _onDrop(event) {
    const TE   = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const data = TE.getDragEventData(event);
    if (data?.type !== "Item") return super._onDrop(event);

    let item;
    if (data.uuid) item = await fromUuid(data.uuid);
    if (!item) return super._onDrop(event);

    const allowedTypes = ["trademark","flaw","drive","injury","condition","gear","advantage","tie"];
    if (!allowedTypes.includes(item.type)) return;
    if (item.parent === this.actor) return super._onDrop(event);

    const limits = {
      trademark: this._maxTrademarks(),
      flaw: this._maxFlaws(),
      drive: this._maxDrives(),
      advantage: this._maxAdvantages(),
      tie: this._maxTies()
    };
    const count  = this.actor.items.filter(i => i.type === item.type).length;
    if (limits[item.type] !== undefined && count >= limits[item.type])
      ui.notifications.warn(`${item.name} added — character now exceeds the ${item.type} limit and is marked Custom.`);

    await Item.create(item.toObject(), { parent: this.actor });
  }

  /* ---- Advancement ---- */

  async _openAdvanceDialog() {
    if ((Number(this.actor.system.xp) || 0) < 10) {
      ui.notifications.warn(game.i18n.localize("FU.NotEnoughXP"));
      return;
    }
    const sys          = this.actor.system;
    const tmCount      = this.actor.items.filter(i => i.type === "trademark").length;
    const canTrademark = tmCount < this._maxTrademarks();
    const canGrit      = sys.grit < 6;
    const canSpirit    = sys.spirit < 6;

    const content = `
      <p>${game.i18n.localize("FU.AdvanceChoose")}</p>
      <div class="fu-advance-options">
        <label><input type="radio" name="choice" value="trademark" ${canTrademark ? "checked" : "disabled"}/> ${game.i18n.localize("FU.AdvanceTrademark")}</label>
        <label><input type="radio" name="choice" value="edge" ${canTrademark ? "" : "checked"}/> ${game.i18n.localize("FU.AdvanceEdge")}</label>
        <label><input type="radio" name="choice" value="grit" ${canGrit ? "" : "disabled"}/> ${game.i18n.localize("FU.AdvanceGrit")}</label>
        <label><input type="radio" name="choice" value="spirit" ${canSpirit ? "" : "disabled"}/> ${game.i18n.localize("FU.AdvanceSpirit")}</label>
      </div>`;

    new Dialog({
      title: game.i18n.localize("FU.Advance"),
      content,
      buttons: {
        confirm: { label: game.i18n.localize("FU.Confirm"), callback: async html => {
          await this._applyAdvancement(html.find("input[name='choice']:checked").val());
        }},
        cancel: { label: game.i18n.localize("FU.Cancel") }
      },
      default: "confirm"
    }).render(true);
  }

  async _applyAdvancement(choice) {
    const sys = this.actor.system;
    if (choice === "trademark") {
      if (this.actor.items.filter(i => i.type === "trademark").length >= this._maxTrademarks())
        return ui.notifications.warn(game.i18n.localize("FU.MaxTrademarks"));
      const tmName = game.i18n.localize("FU.NewTrademark") || "New Trademark";
      await Item.create(
        { name: tmName, type: "trademark", system: { edges: [], memo: "" } },
        { parent: this.actor }
      );
      await this._logXpSpend(`New Trademark — ${tmName}`);
      await this.actor.update({ "system.xp": 0 });
      ui.notifications.info(game.i18n.localize("FU.AdvanceApplied"));
    } else if (choice === "edge") {
      await this._openEdgeAdvanceDialog();
    } else if (choice === "grit") {
      if (sys.grit >= 6) return ui.notifications.warn(game.i18n.localize("FU.MaxStat"));
      const newGrit = sys.grit + 1;
      await this._logXpSpend(`Grit increased to ${newGrit}`);
      await this.actor.update({ "system.grit": newGrit, "system.xp": 0 });
      ui.notifications.info(game.i18n.localize("FU.AdvanceApplied"));
    } else if (choice === "spirit") {
      if (sys.spirit >= 6) return ui.notifications.warn(game.i18n.localize("FU.MaxStat"));
      const newSpirit = sys.spirit + 1;
      await this._logXpSpend(`Spirit increased to ${newSpirit}`);
      await this.actor.update({ "system.spirit": newSpirit, "system.xp": 0 });
      ui.notifications.info(game.i18n.localize("FU.AdvanceApplied"));
    }
  }

  async _openEdgeAdvanceDialog() {
    const trademarks = this.actor.items.filter(i => i.type === "trademark");
    if (!trademarks.length) {
      ui.notifications.warn(game.i18n.localize("FU.NeedTrademarkForEdge"));
      return;
    }
    const esc = s => String(s ?? "").replace(/[&<>"']/g,
      c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
    const options = trademarks.map((t, i) => {
      const label = t.name?.trim() || game.i18n.format("FU.EdgeAdvanceUnnamed", { n: i + 1 });
      return `<option value="${t.id}">${esc(label)}</option>`;
    }).join("");

    const content = `
      <form class="fu-edge-advance">
        <p>${game.i18n.localize("FU.EdgeAdvanceIntro")}</p>
        <div class="form-group">
          <label>${game.i18n.localize("FU.EdgeAdvanceTrademark")}</label>
          <select name="trademark">${options}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("FU.EdgeAdvanceName")}</label>
          <input type="text" name="edge" placeholder="${game.i18n.localize("FU.EdgePH")}" />
        </div>
      </form>`;

    return new Promise(resolve => {
      let resolved = false;
      const done = () => { if (!resolved) { resolved = true; resolve(); } };
      new Dialog({
        title: game.i18n.localize("FU.EdgeAdvanceTitle"),
        content,
        buttons: {
          confirm: { label: game.i18n.localize("FU.Confirm"), callback: async html => {
            const tid      = html.find("[name='trademark']").val();
            const edgeName = (html.find("[name='edge']").val() || "").trim() || "New Edge";
            const item     = this.actor.items.get(tid);
            if (!item) return done();
            const edges = foundry.utils.deepClone(item.system.edges || []);
            edges.push(edgeName);
            await item.update({ "system.edges": edges });
            const tmName = item.name?.trim() || game.i18n.localize("FU.NewTrademark") || "Trademark";
            await this._logXpSpend(`New Edge — ${edgeName} (${tmName})`);
            await this.actor.update({ "system.xp": 0 });
            ui.notifications.info(game.i18n.localize("FU.AdvanceApplied"));
            done();
          }},
          cancel: { label: game.i18n.localize("FU.Cancel"), callback: done }
        },
        default: "confirm",
        close: done
      }).render(true);
    });
  }
}
