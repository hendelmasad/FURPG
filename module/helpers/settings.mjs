export function registerSettings() {
  game.settings.register("freeform-universal", "pressureEnabled", {
    name: "FU.Settings.PressureEnabled.Name",
    hint: "FU.Settings.PressureEnabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      const tracker = game.modules?.get("freeform-universal");
      if (globalThis.FU?.PressureTracker) {
        if (game.settings.get("freeform-universal", "pressureEnabled")) {
          globalThis.FU.PressureTracker.renderWidget();
        } else {
          globalThis.FU.PressureTracker.removeWidget();
        }
      }
    }
  });

  game.settings.register("freeform-universal", "pressureAutoIncrement", {
    name: "FU.Settings.PressureAuto.Name",
    hint: "FU.Settings.PressureAuto.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register("freeform-universal", "pressureValue", {
    scope: "world",
    config: false,
    type: Number,
    default: 0,
    onChange: () => {
      if (globalThis.FU?.PressureTracker) {
        globalThis.FU.PressureTracker.refresh();
      }
    }
  });

  game.settings.register("freeform-universal", "defaultThreatHits", {
    name: "FU.Settings.DefaultThreatHits.Name",
    hint: "FU.Settings.DefaultThreatHits.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 3,
    range: { min: 1, max: 20, step: 1 }
  });

  game.settings.register("freeform-universal", "maxTrademarks", {
    name: "Maximum Trademarks",
    hint: "Maximum number of Trademarks a character can have before being marked Custom. Default: 5.",
    scope: "world",
    config: true,
    type: Number,
    default: 5
  });

  game.settings.register("freeform-universal", "maxFlaws", {
    name: "Maximum Flaws",
    hint: "Maximum number of Flaws a character can have before being marked Custom. Default: 2.",
    scope: "world",
    config: true,
    type: Number,
    default: 2
  });

  game.settings.register("freeform-universal", "maxDrives", {
    name: "Maximum Drives",
    hint: "Maximum number of Drives a character can have before being marked Custom. Default: 1.",
    scope: "world",
    config: true,
    type: Number,
    default: 1
  });

  game.settings.register("freeform-universal", "maxAdvantages", {
    name: "FU.Settings.MaxAdvantages.Name",
    hint: "FU.Settings.MaxAdvantages.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 3
  });

  game.settings.register("freeform-universal", "maxTies", {
    name: "FU.Settings.MaxTies.Name",
    hint: "FU.Settings.MaxTies.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 2
  });

  game.settings.register("freeform-universal", "oracleMode", {
    name: "FU.Settings.OracleMode.Name",
    hint: "FU.Settings.OracleMode.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "four": "FU.Settings.OracleMode.Four",
      "six": "FU.Settings.OracleMode.Six"
    },
    default: "six"
  });
}
