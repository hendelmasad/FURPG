import { FURollDialog } from "./roll-dialog.mjs";
import { FURollSocket } from "./roll-socket.mjs";
import { normalizeGearTags } from "../helpers/gear.mjs";

export class ActionRoller extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "fu-action-roller",
      classes: ["freeform-universal", "fu-action-roller-app"],
      template: "systems/freeform-universal/templates/dialogs/action-roller.hbs",
      width: 560,
      height: "auto",
      resizable: true,
      popOut: true
    });
  }

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this._rollExecuted = false;
    this._initState();
  }

  get title() {
    return `${game.i18n.localize("FU.AR.Title")}: ${this.actor.name}`;
  }

  _initState() {
    const items = this.actor.items;
    this.state = {
      trademarks: items
        .filter(i => i.type === "trademark")
        .map(i => ({
          id: i.id,
          name: i.name || "",
          checked: false,
          edges: (i.system.edges || []).map(e => ({ name: e || "", checked: false }))
        })),
      flaws: items
        .filter(i => i.type === "flaw")
        .map(i => ({ id: i.id, name: i.name || "", checked: false })),
      gear: items
        .filter(i => i.type === "gear")
        .map(i => ({
          id: i.id,
          name: i.name || "",
          checked: false,
          tags: normalizeGearTags(i.system?.tags).map(t => ({
            id: t.id,
            name: t.name || "",
            action: false,
            danger: false
          }))
        })),
      injuries: items
        .filter(i => i.type === "injury")
        .map(i => ({ id: i.id, name: i.name || "", checked: false })),
      conditions: items
        .filter(i => i.type === "condition")
        .map(i => ({ id: i.id, name: i.name || "", checked: false })),
      danger: 0,
      favorable: 0,
      dramaSpent: 0,
      luck: 0
    };
  }

  getData() {
    const sys = this.actor.system;
    const drama = Number(sys.dramaPoints?.value) || 0;
    const checkedCount = this.state.trademarks.filter(t => t.checked).length;
    const canCheckMore = checkedCount < 2 && (checkedCount === 0 || drama > 0);

    const trademarks = this.state.trademarks.map((t, ti) => ({
      idx: ti,
      name: t.name || game.i18n.format("FU.EdgeAdvanceUnnamed", { n: ti + 1 }),
      checked: t.checked,
      disabled: !t.checked && !canCheckMore,
      expanded: t.checked,
      edges: t.edges.map((e, ei) => ({
        idx: ei,
        name: e.name || game.i18n.localize("FU.AR.UnnamedEdge"),
        checked: e.checked,
        disabled: !t.checked
      }))
    }));

    const simpleList = (arr, fallback) => arr.map((x, idx) => ({
      idx,
      name: x.name || game.i18n.localize(fallback),
      checked: x.checked
    }));

    const gear = this.state.gear.map((g, gi) => ({
      idx: gi,
      id: g.id,
      name: g.name || game.i18n.localize("FU.AR.UnnamedGear"),
      checked: g.checked,
      expanded: g.checked,
      tags: g.tags.map((t, ti) => ({
        idx: ti,
        id: t.id,
        name: t.name || game.i18n.localize("FU.AR.UnnamedTag"),
        action: t.action,
        danger: t.danger
      }))
    }));

    const pool = this._computePool();

    // A Little Luck can never declare more than the Drama Points on hand. Clamp the
    // stored value too, in case Drama dropped (e.g. a second Trademark) after entry.
    const luck = Math.min(Math.max(0, Number(this.state.luck) || 0), drama);
    this.state.luck = luck;

    return {
      actorName: this.actor.name,
      isGM: game.user.isGM,
      trademarks,
      flaws: simpleList(this.state.flaws, "FU.AR.UnnamedFlaw"),
      gear,
      injuries: simpleList(this.state.injuries, "FU.AR.UnnamedInjury"),
      conditions: simpleList(this.state.conditions, "FU.AR.UnnamedCondition"),
      danger: this.state.danger,
      favorable: this.state.favorable,
      luck,
      luckMax: drama,
      actionCount: pool.action,
      dangerCount: pool.danger,
      dramaCurrent: drama,
      checkedCount,
      hasTrademarks: trademarks.length > 0,
      hasFlaws: this.state.flaws.length > 0,
      hasGear: this.state.gear.length > 0,
      hasInjuries: this.state.injuries.length > 0,
      hasConditions: this.state.conditions.length > 0
    };
  }

  _computePool() {
    let action = 1;
    let danger = 0;
    for (const t of this.state.trademarks) {
      if (!t.checked) continue;
      action += 1;
      for (const e of t.edges) if (e.checked) action += 1;
    }
    for (const g of this.state.gear) {
      if (!g.checked) continue;
      // Gear name itself contributes 0 — only tag A/D selections add dice.
      for (const t of g.tags) {
        if (t.action) action += 1;
        if (t.danger) danger += 1;
      }
    }
    for (const f of this.state.flaws) if (f.checked) danger += 1;
    for (const i of this.state.injuries) if (i.checked) danger += 1;
    for (const c of this.state.conditions) if (c.checked) danger += 1;
    danger += Math.max(0, Number(this.state.danger) || 0);
    action += Math.max(0, Number(this.state.favorable) || 0);
    if (action < 1) action = 1;
    return { action, danger };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("[data-ar='trademark']").on("change", ev => this._onTrademarkToggle(ev));
    html.find("[data-ar='edge']").on("change", ev => this._onEdgeToggle(ev, html));
    html.find("[data-ar='flaw']").on("change", ev => this._onSimpleToggle(ev, "flaws", html));
    html.find("[data-ar='gear']").on("change", ev => this._onGearToggle(ev));
    html.find("[data-ar='gear-tag-a']").on("change", ev => this._onGearTagToggle(ev, "action", html));
    html.find("[data-ar='gear-tag-d']").on("change", ev => this._onGearTagToggle(ev, "danger", html));
    html.find("[data-ar='injury']").on("change", ev => this._onSimpleToggle(ev, "injuries", html));
    html.find("[data-ar='condition']").on("change", ev => this._onSimpleToggle(ev, "conditions", html));
    html.find("[data-ar='danger-mod']").on("input change", ev => this._onModChange(ev, "danger", html));
    html.find("[data-ar='favorable-mod']").on("input change", ev => this._onModChange(ev, "favorable", html));
    html.find("[data-ar='luck']").on("input change", ev => this._onLuckChange(ev));
    html.find("[data-ar='roll']").on("click", () => this._executeRoll());
  }

  async _onTrademarkToggle(ev) {
    const idx = Number(ev.currentTarget.dataset.index);
    const wantChecked = ev.currentTarget.checked;
    const tm = this.state.trademarks[idx];
    if (!tm) return;

    if (wantChecked) {
      const alreadyChecked = this.state.trademarks.filter(t => t.checked).length;
      if (alreadyChecked >= 2) {
        ev.currentTarget.checked = false;
        return;
      }
      if (alreadyChecked >= 1) {
        const drama = Number(this.actor.system.dramaPoints?.value) || 0;
        if (drama < 1) {
          ev.currentTarget.checked = false;
          ui.notifications.warn(game.i18n.localize("FU.AR.NoDramaForSecond"));
          return;
        }
        await this.actor.update({ "system.dramaPoints.value": drama - 1 });
        this.state.dramaSpent += 1;
      }
      tm.checked = true;
    } else {
      tm.checked = false;
      for (const e of tm.edges) e.checked = false;
      const nowChecked = this.state.trademarks.filter(t => t.checked).length;
      if (nowChecked < 2 && this.state.dramaSpent > 0) {
        const drama = Number(this.actor.system.dramaPoints?.value) || 0;
        await this.actor.update({ "system.dramaPoints.value": drama + 1 });
        this.state.dramaSpent -= 1;
      }
    }
    this.render(false);
  }

  _onEdgeToggle(ev, html) {
    const ti = Number(ev.currentTarget.dataset.trademark);
    const ei = Number(ev.currentTarget.dataset.edge);
    const tm = this.state.trademarks[ti];
    if (!tm || !tm.checked) {
      ev.currentTarget.checked = false;
      return;
    }
    if (!tm.edges[ei]) return;
    tm.edges[ei].checked = ev.currentTarget.checked;
    this._refreshSummary(html);
  }

  _onSimpleToggle(ev, listKey, html) {
    const idx = Number(ev.currentTarget.dataset.index);
    const entry = this.state[listKey]?.[idx];
    if (!entry) return;
    entry.checked = ev.currentTarget.checked;
    this._refreshSummary(html);
  }

  _onGearToggle(ev) {
    const idx = Number(ev.currentTarget.dataset.index);
    const g = this.state.gear[idx];
    if (!g) return;
    g.checked = ev.currentTarget.checked;
    if (!g.checked) {
      for (const t of g.tags) {
        t.action = false;
        t.danger = false;
      }
    }
    this.render(false);
  }

  _onGearTagToggle(ev, kind, html) {
    const gi = Number(ev.currentTarget.dataset.gear);
    const ti = Number(ev.currentTarget.dataset.tag);
    const g = this.state.gear[gi];
    if (!g || !g.checked) {
      ev.currentTarget.checked = false;
      return;
    }
    const tag = g.tags[ti];
    if (!tag) return;
    const checked = ev.currentTarget.checked;
    if (kind === "action") {
  tag.action = checked;
} else {
  tag.danger = checked;
}
    // Re-render to reflect mutual exclusivity in the sibling checkbox
    this.render(false);
    void html;
  }

  _onModChange(ev, key, html) {
    this.state[key] = Math.max(0, Number(ev.currentTarget.value) || 0);
    this._refreshSummary(html);
  }

  _onLuckChange(ev) {
    const drama = Number(this.actor.system.dramaPoints?.value) || 0;
    const v = Math.max(0, Math.min(drama, Math.floor(Number(ev.currentTarget.value) || 0)));
    this.state.luck = v;
    ev.currentTarget.value = v;
  }

  _refreshSummary(html) {
    const { action, danger } = this._computePool();
    html.find(".ar-action-count").text(action);
    html.find(".ar-danger-count").text(danger);
  }

  _buildBreakdown() {
    const breakdown = [];

    const tmItems = [];
    for (const t of this.state.trademarks) {
      if (!t.checked) continue;
      const eds = t.edges.filter(e => e.checked).map(e => e.name).filter(Boolean);
      let s = t.name || game.i18n.localize("FU.AR.UnnamedTrademark");
      if (eds.length) s += ` [${eds.join(", ")}]`;
      tmItems.push(s);
    }
    if (tmItems.length) breakdown.push({ label: game.i18n.localize("FU.Trademarks"), items: tmItems });

    const gearItems = [];
    for (const g of this.state.gear) {
      if (!g.checked) continue;
      const aTags = g.tags.filter(t => t.action).map(t => t.name).filter(Boolean);
      const dTags = g.tags.filter(t => t.danger).map(t => t.name).filter(Boolean);
      const parts = [];
      if (aTags.length) parts.push(`+A: ${aTags.join(", ")}`);
      if (dTags.length) parts.push(`+D: ${dTags.join(", ")}`);
      let s = g.name || game.i18n.localize("FU.AR.UnnamedGear");
      if (parts.length) s += ` [${parts.join("; ")}]`;
      gearItems.push(s);
    }
    if (gearItems.length) breakdown.push({ label: game.i18n.localize("FU.Gear"), items: gearItems });

    const flaws = this.state.flaws.filter(f => f.checked).map(f => f.name || game.i18n.localize("FU.AR.UnnamedFlaw"));
    if (flaws.length) breakdown.push({ label: game.i18n.localize("FU.Flaws"), items: flaws });

    const injuries = this.state.injuries.filter(i => i.checked).map(i => i.name || game.i18n.localize("FU.AR.UnnamedInjury"));
    if (injuries.length) breakdown.push({ label: game.i18n.localize("FU.Injuries"), items: injuries });

    const conditions = this.state.conditions.filter(c => c.checked).map(c => c.name || game.i18n.localize("FU.AR.UnnamedCondition"));
    if (conditions.length) breakdown.push({ label: game.i18n.localize("FU.Conditions"), items: conditions });

    const mods = [];
    if (this.state.favorable > 0) mods.push(`${game.i18n.localize("FU.AR.FavorableMods")} +${this.state.favorable}`);
    if (this.state.danger > 0) mods.push(`${game.i18n.localize("FU.AR.DangerMods")} +${this.state.danger}`);
    if (this.state.dramaSpent > 0) mods.push(game.i18n.format("FU.AR.DramaSpentLine", { n: this.state.dramaSpent }));
    if (mods.length) breakdown.push({ label: game.i18n.localize("FU.AR.ModsLabel"), items: mods });

    return breakdown;
  }

  async _executeRoll() {
    const { action, danger } = this._computePool();
    const breakdown = this._buildBreakdown();
    const drama = Number(this.actor.system.dramaPoints?.value) || 0;
    const luck = Math.min(Math.max(0, Number(this.state.luck) || 0), drama);

    // If the rolling user is a GM, skip confirmation and roll immediately.
    if (game.user.isGM) {
      this._rollExecuted = true;
      await this.close();
      await FURollDialog.execute({ actor: this.actor, action, danger, breakdown, luck });
      return;
    }

    // Find the first active GM (other than this user).
    const activeGM = game.users.find(u => u.isGM && u.active && u.id !== game.user.id);

    // If no GM online, roll immediately with a warning.
    if (!activeGM) {
      ui.notifications.warn(game.i18n.localize("FU.AR.NoGMOnline"));
      this._rollExecuted = true;
      await this.close();
      await FURollDialog.execute({ actor: this.actor, action, danger, breakdown, luck });
      return;
    }

    // Send to GM for confirmation. The Drama Point spent on a second Trademark
    // stays committed (the pool is live), so suppress the close-time refund.
    this._rollExecuted = true;
    await this.close();
    await FURollSocket.requestConfirmation({
      actor: this.actor,
      action,
      danger,
      breakdown,
      luck,
      // Full selection state so the GM review window can pre-populate.
      rollerState: foundry.utils.deepClone(this.state),
      targetGMId: activeGM.id
    });
  }

  async close(options = {}) {
    if (!this._rollExecuted && this.state.dramaSpent > 0) {
      const drama = Number(this.actor.system.dramaPoints?.value) || 0;
      await this.actor.update({ "system.dramaPoints.value": drama + this.state.dramaSpent });
      this.state.dramaSpent = 0;
    }
    return super.close(options);
  }
}
