import { FUSimpleItemSheet } from "./simple-item-sheet.mjs";

/**
 * Advantage item sheet — a Trademark-tied special ability (a spell, a piece of
 * tech, a knack). Name lives in the document name; the body is a ProseMirror
 * rich-text description, same pattern as the Trademark memo and Gear description.
 */
export class FUAdvantageSheet extends FUSimpleItemSheet {
  static get hasDescription() { return true; }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["freeform-universal", "sheet", "item", "fu-simple-item", "fu-advantage"],
      template: "systems/freeform-universal/templates/item/advantage-sheet.hbs",
      width: 460,
      height: 460,
      resizable: true
    });
  }
}
