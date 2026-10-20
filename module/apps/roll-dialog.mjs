import { PressureTracker } from "./pressure-tracker.mjs";

// FU 2e six-outcome Oracle
const ORACLE_SIX = {
  6: { key: "yesAnd", label: "FU.Oracle.YesAnd" },
  5: { key: "yes",    label: "FU.Oracle.Yes" },
  4: { key: "yesBut", label: "FU.Oracle.YesBut" },
  3: { key: "noBut",  label: "FU.Oracle.NoBut" },
  2: { key: "no",     label: "FU.Oracle.No" },
  1: { key: "noAnd",  label: "FU.Oracle.NoAnd" }
};

// Action Tales four-band Oracle
function getFourBandResult(highest) {
  if (highest === 6) return { key: "complete", label: "FU.Oracle.Complete" };
  if (highest >= 4)  return { key: "partial",  label: "FU.Oracle.Partial" };
  return               { key: "failure",  label: "FU.Oracle.Failure" };
}

/**
 * Returns the Oracle result for the given highest remaining Action Die,
 * branching on the "oracleMode" world setting ("six" or "four").
 * Defaults to "four" if the setting is somehow unavailable.
 */
function getOracleResult(highest) {
  const mode = game.settings.get("freeform-universal", "oracleMode") ?? "four";
  if (mode === "six") {
    return ORACLE_SIX[highest];
  }
  return getFourBandResult(highest);
}

/**
 * A Little Luck — post-roll, pre-cancellation nudge dialog.
 *
 * Shows both the Action and Danger pools as adjustable dice. Each click on a
 * die's +/- button spends one of the player's declared luck points to move
 * that die's result by one pip (clamped 1-6). The player can spend points
 * across as many dice, in either pool, as they like, until the budget runs
 * out or they confirm early with points unspent.
 *
 * Resolves to the number of luck points actually spent (so the chat
 * breakdown only reports real spend, not the declared maximum).
 */
export function promptALittleLuck({ actionValues, dangerValues, budget }) {
  return new Promise(resolve => {
    const state = {
      action: actionValues.slice(),
      danger: dangerValues.slice(),
      spent: 0
    };

    const renderDie = (pool, idx, value) => `
      <div class="fu-luck-die" data-pool="${pool}" data-idx="${idx}">
        <button type="button" class="fu-luck-btn" data-dir="down" data-pool="${pool}" data-idx="${idx}" ${value <= 1 ? "disabled" : ""}>-</button>
        <span class="fu-luck-val">${value}</span>
        <button type="button" class="fu-luck-btn" data-dir="up" data-pool="${pool}" data-idx="${idx}" ${value >= 6 ? "disabled" : ""}>+</button>
      </div>`;

    const renderContent = () => `
      <div class="fu-luck-dialog">
        <p class="fu-luck-hint">${game.i18n.localize("FU.AR.ALittleLuckHint")}</p>
        <p class="fu-luck-budget">${game.i18n.localize("FU.DramaPoints")}:
          <span class="fu-luck-remaining">${budget - state.spent}</span> / ${budget}
        </p>
        <p class="fu-luck-pool-label">${game.i18n.localize("FU.ActionDice")}</p>
        <div class="fu-luck-dice fu-luck-action">
          ${state.action.map((v, i) => renderDie("action", i, v)).join("")}
        </div>
        <p class="fu-luck-pool-label">${game.i18n.localize("FU.DangerDice")}</p>
        <div class="fu-luck-dice fu-luck-danger">
          ${state.danger.length ? state.danger.map((v, i) => renderDie("danger", i, v)).join("") : `<p class="ar-empty">—</p>`}
        </div>
      </div>`;

    const dlg = new Dialog({
      title: game.i18n.localize("FU.AR.ALittleLuck"),
      content: renderContent(),
      buttons: {
        confirm: {
          label: game.i18n.localize("FU.Confirm"),
          callback: () => resolve({ action: state.action, danger: state.danger, spent: state.spent })
        }
      },
      default: "confirm",
      render: html => {
        const refresh = () => {
          html.find(".fu-luck-dialog").replaceWith(renderContent());
          bind();
        };
        const bind = () => {
          html.find(".fu-luck-btn").off("click").on("click", ev => {
            if (state.spent >= budget) return;
            const dir  = ev.currentTarget.dataset.dir;
            const pool = ev.currentTarget.dataset.pool;
            const idx  = Number(ev.currentTarget.dataset.idx);
            const arr  = state[pool];
            if (!arr || arr[idx] === undefined) return;
            const delta = dir === "up" ? 1 : -1;
            const next  = arr[idx] + delta;
            if (next < 1 || next > 6) return;
            arr[idx] = next;
            state.spent += 1;
            refresh();
          });
        };
        bind();
      },
      close: () => resolve({ action: state.action, danger: state.danger, spent: state.spent })
    });
    dlg.render(true);
  });
}

export class FURollDialog extends Dialog {
  static open({ actor = null, action = 1, danger = 0 } = {}) {
    const content = `
      <form class="fu-roll-dialog">
        <div class="form-group">
          <label>${game.i18n.localize("FU.ActionDice")}</label>
          <input type="number" name="action" value="${action}" min="1" step="1" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("FU.DangerDice")}</label>
          <input type="number" name="danger" value="${danger}" min="0" step="1" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("FU.RollFlavor")}</label>
          <input type="text" name="flavor" value="" placeholder="${game.i18n.localize("FU.RollFlavorPH")}" />
        </div>
      </form>
    `;

    new Dialog({
      title: game.i18n.localize("FU.RollTitle"),
      content,
      buttons: {
        roll: {
          label: game.i18n.localize("FU.Roll"),
          callback: async html => {
            const a = Math.max(1, parseInt(html.find("[name='action']").val()) || 1);
            const d = Math.max(0, parseInt(html.find("[name='danger']").val()) || 0);
            const flavor = html.find("[name='flavor']").val() || "";
            await FURollDialog.execute({ actor, action: a, danger: d, flavor });
          }
        },
        cancel: { label: game.i18n.localize("FU.Cancel") }
      },
      default: "roll"
    }).render(true);
  }

  /**
   * Tag every dice term in a Roll with a Dice So Nice colorset name. DSN's appearance
   * resolver reads `term.options.colorset` first when deciding how to render a throw,
   * so this is how we colour the Action pool vs the Danger pool differently.
   */
  static _applyColorset(roll, colorset) {
    for (const term of roll.dice) {
      term.options ??= {};
      term.options.colorset = colorset;
    }
  }

  static async execute({ actor = null, action = 1, danger = 0, flavor = "", breakdown = null }) {
    // Two separate Roll objects so Dice So Nice can colour Action vs Danger dice distinctly.
    const actionRoll = new Roll(`${action}d6`);
    await actionRoll.evaluate({ async: true });

    let dangerRoll = null;
    if (danger > 0) {
      dangerRoll = new Roll(`${danger}d6`);
      await dangerRoll.evaluate({ async: true });
    }

    const actionResults = actionRoll.dice[0].results.map(r => r.result);
    const dangerResults = dangerRoll ? dangerRoll.dice[0].results.map(r => r.result) : [];

    const actionRolls = actionResults.map(v => ({ value: v, cancelled: false }));
    const dangerRolls = dangerResults.map(v => ({ value: v, cancelled: false }));

    // Each danger die cancels one action die of the same face value
    for (const dd of dangerRolls) {
      const matchIdx = actionRolls.findIndex(ar => !ar.cancelled && ar.value === dd.value);
      if (matchIdx !== -1) {
        actionRolls[matchIdx].cancelled = true;
        dd.cancelled = true;
      }
    }

    const remaining = actionRolls.filter(a => !a.cancelled).map(a => a.value);
    let outcome, oracleLabel, boons = 0, botch = false;

    if (remaining.length === 0) {
      // All action dice cancelled — Botch (same in both Oracle modes)
      botch = true;
      outcome = 0;
      oracleLabel = game.i18n.localize("FU.Oracle.Botch");
    } else {
      const onlyOnes = remaining.every(v => v === 1);
      if (onlyOnes) {
        // Only 1s remaining — Botch (same in both Oracle modes)
        botch = true;
        outcome = 0;
        oracleLabel = game.i18n.localize("FU.Oracle.Botch");
      } else {
        const highest = Math.max(...remaining);
        outcome = highest;
        const oracle = getOracleResult(highest);
        oracleLabel = game.i18n.localize(oracle.label);
        // Boons: each extra 6 beyond the first. Core FU 2e mechanic (p.25),
        // applies identically regardless of Oracle mode.
        if (highest === 6) {
          const sixes = remaining.filter(v => v === 6).length;
          boons = Math.max(0, sixes - 1);
        }
      }
    }

    // Pressure auto-increment: count uncancelled danger dice showing 6
    if (game.settings.get("freeform-universal", "pressureEnabled")
        && game.settings.get("freeform-universal", "pressureAutoIncrement")) {
      const dangerSixes = dangerRolls.filter(d => !d.cancelled && d.value === 6).length;
      if (dangerSixes > 0) await PressureTracker.add(dangerSixes);
    }

    const fullBreakdown = Array.isArray(breakdown) ? breakdown.slice() : [];

    // Determine if the current user can spend Drama Points on this roll:
    // - GMs can always see the buttons
    // - Players see them only for their own actors
    const actorOwnerId = actor ? Object.entries(actor.ownership ?? {}).find(([, lvl]) => lvl >= 3 && game.users.get(_k => _k === _))?.[0] : null;
    const isOwner = actor ? (game.user.isGM || actor.isOwner) : game.user.isGM;

    const rendered = await renderTemplate("systems/freeform-universal/templates/chat/roll-result.hbs", {
      flavor,
      actorName: actor?.name || "",
      actionRolls,
      dangerRolls,
      remaining,
      botch,
      outcome,
      oracleLabel,
      boons,
      hasBoons: boons > 0,
      breakdown: fullBreakdown.length ? fullBreakdown : null,
      actionTotal: action,
      dangerTotal: danger,
      canSpend: isOwner
    });

    // Dice So Nice: show each pool with its own colorset. Note the dice shown here
    // reflect the ORIGINAL roll, not luck-adjusted values — DSN animates the physical
    // throw, while the breakdown/oracle above reflect the final adjusted result.
    const dsnActive = !!game.modules.get("dice-so-nice")?.active && !!game.dice3d;
    if (dsnActive) {
      const registry = game.dice3d.exports?.COLORSETS ?? {};
      const haveAction = "fu-action" in registry;
      const haveDanger = "fu-danger" in registry;
      if (!haveAction || !haveDanger) {
        console.warn("FU | Expected colorsets missing from DSN registry. Present fu-* keys:",
          Object.keys(registry).filter(k => k.startsWith("fu-")));
      }

      FURollDialog._applyColorset(actionRoll, "fu-action");
      if (dangerRoll) FURollDialog._applyColorset(dangerRoll, "fu-danger");

      console.log(`FU | Showing rolls via DSN — action=${action}d6 (fu-action), danger=${danger}d6 (fu-danger)`);

      const showPromises = [
        game.dice3d.showForRoll(actionRoll, game.user, true)
      ];
      if (dangerRoll) {
        showPromises.push(
          game.dice3d.showForRoll(dangerRoll, game.user, true)
        );
      }
      await Promise.all(showPromises);
    }

    // Store raw roll data in flags so post-roll buttons can re-run or apply luck
    const rollFlags = {
      actorId: actor?.id ?? null,
      action,
      danger,
      flavor,
      breakdown: fullBreakdown.length ? fullBreakdown : null,
      // Raw (pre-cancellation) results so A Little Luck can nudge them
      actionResults,
      dangerResults
    };

    const chatData = {
      type: "base",
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: rendered,
      sound: dsnActive ? null : CONFIG.sounds.dice,
      flags: { "freeform-universal": rollFlags }
    };
    await ChatMessage.create(chatData);
  }
}
