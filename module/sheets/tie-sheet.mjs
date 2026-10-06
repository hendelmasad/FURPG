import { FUSimpleItemSheet } from "./simple-item-sheet.mjs";

/**
 * Tie item sheet — an important relationship ("My mentor, Professor Aldous
 * Crane"). The relationship itself is the document name; the body is a
 * ProseMirror description of its nature, obligations and history.
 */
export class FUTieSheet extends FUSimpleItemSheet {
  static get hasDescription() { return true; }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["freeform-universal", "sheet", "item", "fu-simple-item", "fu-tie"],
      template: "systems/freeform-universal/templates/item/tie-sheet.hbs",
      width: 460,
      height: 460,
      resizable: true
    });
  }
}
