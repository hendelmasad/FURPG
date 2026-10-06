import { ActionRoller } from "./action-roller.mjs";
import { FURollSocket } from "./roll-socket.mjs";

/**
 * GM review window for the roll confirmation workflow (Update 21).
 *
 * A full clone of the player's Action Roller, opened on the GM's client and
 * pre-populated with the player's selections. The GM may freely toggle anything
 * — Trademarks, Edges, Gear tags, Flaws, Injuries, Conditions, and the manual
 * modifiers — and the live pool recalculates exactly as it does for the player.
 *
 * On Confirm the final (possibly modified) pool is sent back to the player's
 * client to execute. On Cancel — or closing the window — the player is told the
 * roll was cancelled.
 *
 * Unlike the player's roller, this window NEVER touches the actor's Drama Points:
 * the player already paid for any second Trademark before sending the request.
 */
export class GMActionRoller extends ActionRoller {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "fu-gm-action-roller",
      classes: ["freeform-universal", "fu-action-roller-app", "fu-gm-action-roller-app"]
    });
  }

  constructor(actor, requestData, options = {}) {
    super(actor, options);
    this._requestData = requestData;   // the socket request from the player
    this._resolved = false;            // guards against double confirm/cancel
    // The player already paid for any second Trademark. Mark the roll as
    // executed so the base close() never touches the actor's Drama Points,
    // even though we carry the spent count through for the breakdown display.
    this._rollExecuted = true;
    this._prePopulateFromRequest(requestData);
  }

  get title() {
    return game.i18n.format("FU.AR.GMReviewTitle", { name: this.actor.name });
  }

  /**
   * Apply the player's serialized roller state onto our freshly-built state.
   * Matched by stable ids so a divergent item order between clients can't
   * mis-assign selections.
   */
  _prePopulateFromRequest(requestData) {
    const rs = requestData?.rollerState;
    if (!rs) return;

    for (const srcTm of rs.trademarks || []) {
      const tm = this.state.trademarks.find(t => t.id === srcTm.id);
      if (!tm) continue;
      tm.checked = !!srcTm.checked;
      (srcTm.edges || []).forEach((srcEdge, ei) => {
        if (tm.edges[ei]) tm.edges[ei].checked = !!srcEdge.checked;
      });
    }

    for (const srcG of rs.gear || []) {
      const g = this.state.gear.find(x => x.id === srcG.id);
      if (!g) continue;
      g.checked = !!srcG.checked;
      for (const srcTag of srcG.tags || []) {
        const tag = g.tags.find(t => t.id === srcTag.id);
        if (!tag) continue;
        tag.action = !!srcTag.action;
        tag.danger = !!srcTag.danger;
      }
    }

    const applySimple = (srcArr, destArr) => {
      for (const src of srcArr || []) {
        const d = destArr.find(x => x.id === src.id);
        if (d) d.checked = !!src.checked;
      }
    };
    applySimple(rs.flaws, this.state.flaws);
    applySimple(rs.injuries, this.state.injuries);
    applySimple(rs.conditions, this.state.conditions);

    this.state.danger = Math.max(0, Number(rs.danger) || 0);
    this.state.favorable = Math.max(0, Number(rs.favorable) || 0);

    // Carry the player's spent-Drama count so the "Spent N Drama Point" line
    // appears in the GM breakdown and the final chat card. This is display-only:
    // the GM window never refunds/charges Drama (guarded by _rollExecuted above).
    this.state.dramaSpent = Math.max(0, Number(rs.dramaSpent) || 0);
  }

  getData() {
    const data = super.getData();
    data.isGMReview = true;
    // The GM is the authority — every Trademark stays toggleable regardless of
    // the player's remaining Drama Points. Edges remain gated on their parent
    // Trademark being checked (handled by the base getData).
    for (const t of data.trademarks) t.disabled = false;
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-ar='cancel-roll']").on("click", () => this._cancelRoll());
  }

  /**
   * GM toggles a Trademark. Plain check/uncheck with no Drama Point side-effects
   * and no two-Trademark cap — the GM may build whatever pool they decide on.
   */
  async _onTrademarkToggle(ev) {
    const idx = Number(ev.currentTarget.dataset.index);
    const tm = this.state.trademarks[idx];
    if (!tm) return;
    tm.checked = ev.currentTarget.checked;
    if (!tm.checked) for (const e of tm.edges) e.checked = false;
    this.render(false);
  }

  /** Confirm: send the final pool back to the player to roll. */
  async _executeRoll() {
    const { action, danger } = this._computePool();
    const breakdown = this._buildBreakdown();
    this._resolved = true;
    FURollSocket.confirmFinalPool(this._requestData, { action, danger, breakdown });
    await this.close();
  }

  /** Cancel: tell the player the roll was cancelled. */
  async _cancelRoll() {
    this._resolved = true;
    FURollSocket.cancelRoll(this._requestData);
    await this.close();
  }

  /** Closing via the window X without a decision counts as a cancel. */
  async close(options = {}) {
    if (!this._resolved) {
      this._resolved = true;
      FURollSocket.cancelRoll(this._requestData);
    }
    return super.close(options);
  }
}
