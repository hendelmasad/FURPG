import { FURollDialog } from "./roll-dialog.mjs";

const SOCKET_NAME = "system.freeform-universal";

/**
 * GM Roll Confirmation workflow.
 *
 * Player builds a pool in the Action Roller, then instead of rolling directly the
 * pool data is shipped to the first active GM via Foundry's socket. The GM reviews
 * it (and may add Danger / Favorable dice), then confirms or cancels. On confirm,
 * the (possibly modified) pool is shipped back to the *player's* client, which is
 * the client that actually evaluates the roll and posts to chat — so authorship,
 * Dice So Nice animation, and speaker all behave exactly as a normal player roll.
 *
 * Message types (see Update 20 spec):
 *   requestRollConfirmation  player -> GM
 *   rollConfirmed            GM -> player
 *   rollCancelled            GM -> player
 */
export class FURollSocket {
  /**
   * Pending confirmation requests keyed by requestId, held on the *player's*
   * client. The socket round-trip does not carry the live Actor document, so we
   * stash it here and look it up again when the GM responds.
   */
  static _pending = {};

  /** Emit a payload over the system socket. */
  static _emit(data) {
    game.socket.emit(SOCKET_NAME, data);
  }

  /**
   * Dispatch an incoming socket message. Each branch first checks that *this*
   * client is the intended recipient, since socket messages broadcast to every
   * connected client except the sender.
   */
  static handle(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case "requestRollConfirmation":
        if (game.user.id !== data.targetGMId) return;
        this.openGMReview(data);
        break;

      case "rollConfirmed":
        if (game.user.id !== data.userId) return;
        this._onRollConfirmed(data);
        break;

      case "rollCancelled":
        if (game.user.id !== data.userId) return;
        this._onRollCancelled(data);
        break;
    }
  }

  /* -------------------------------------------- */
  /*  Player side                                 */
  /* -------------------------------------------- */

  /**
   * Send a built pool to a GM for confirmation and show the waiting indicator.
   * Called from ActionRoller._executeRoll() once a target GM has been resolved.
   */
  static async requestConfirmation({ actor, action, danger, breakdown, luck = 0, rollerState, targetGMId }) {
    const requestId = foundry.utils.randomID();
    this._pending[requestId] = { actor };

    this.showWaiting(requestId);

    this._emit({
      type: "requestRollConfirmation",
      requestId,
      userId: game.user.id,
      actorId: actor.id,
      actorName: actor.name,
      actorImg: actor.img,
      action,
      danger,
      breakdown,
      luck,
      rollerState,
      targetGMId
    });
  }

  /** GM approved the roll — execute it here on the player's client. */
  static async _onRollConfirmed(data) {
    this.hideWaiting();
    const pending = this._pending[data.requestId];
    delete this._pending[data.requestId];

    // Fall back to the actor collection if the pending entry was lost (e.g. reload).
    const actor = pending?.actor ?? (data.actorId ? game.actors.get(data.actorId) : null);

    await FURollDialog.execute({
      actor,
      action: data.action,
      danger: data.danger,
      breakdown: data.breakdown,
      luck: data.luck || 0
    });
  }

  /** GM cancelled the roll — update the waiting indicator then let it fade. */
  static _onRollCancelled(data) {
    delete this._pending[data.requestId];
    this.hideWaiting(game.i18n.localize("FU.AR.RollCancelled"));
  }

  /* -------------------------------------------- */
  /*  Player waiting indicator                    */
  /* -------------------------------------------- */

  static showWaiting(requestId) {
    const existing = document.getElementById("fu-roll-waiting");
    if (existing) existing.remove();

    const el = document.createElement("div");
    el.id = "fu-roll-waiting";
    el.className = "fu-roll-waiting";
    el.dataset.requestId = requestId;
    el.innerHTML = `
      <div class="fu-roll-waiting-inner">
        <i class="fas fa-hourglass-half fu-roll-waiting-icon"></i>
        <span>${game.i18n.localize("FU.AR.WaitingForGM")}</span>
      </div>
    `;
    document.body.appendChild(el);
  }

  static hideWaiting(message = null) {
    const el = document.getElementById("fu-roll-waiting");
    if (!el) return;
    if (message) {
      el.querySelector("span").textContent = message;
      el.querySelector("i").className = "fas fa-times-circle fu-roll-waiting-icon fu-roll-cancelled";
      setTimeout(() => el.remove(), 3000);
    } else {
      el.remove();
    }
  }

  /* -------------------------------------------- */
  /*  GM side                                     */
  /* -------------------------------------------- */

  /**
   * Open the full GM review window — a clone of the player's Action Roller,
   * pre-populated with their selections and fully editable by the GM.
   */
  static async openGMReview(data) {
    const actor = game.actors.get(data.actorId);
    if (!actor) {
      ui.notifications.error(game.i18n.localize("FU.AR.GMReviewNoActor"));
      this.cancelRoll(data);
      return;
    }
    // Lazy import to avoid a static cycle: gm-action-roller subclasses
    // ActionRoller, which imports this module. Resolved from cache at runtime.
    const { GMActionRoller } = await import("./gm-action-roller.mjs");
    new GMActionRoller(actor, data).render(true);
  }

  /** GM confirmed: ship the final (GM-modified) pool back to the player. */
  static confirmFinalPool(data, { action, danger, breakdown }) {
    this._emit({
      type: "rollConfirmed",
      requestId: data.requestId,
      userId: data.userId,
      actorId: data.actorId,
      action,
      danger,
      breakdown,
      // A Little Luck was declared by the player and is resolved on their client
      // when the roll executes; carry it through the GM round-trip unchanged.
      luck: data.luck || 0
    });
  }

  /** GM cancelled: tell the player. */
  static cancelRoll(data) {
    this._emit({
      type: "rollCancelled",
      requestId: data.requestId,
      userId: data.userId
    });
  }
}
