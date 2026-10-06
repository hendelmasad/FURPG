/**
 * Base sheet for the simple single-field FU item types
 * (flaw, drive, injury, condition). Each is just a named document with an
 * optional description; the document `name` is the editable field.
 */
export class FUSimpleItemSheet extends foundry.appv1.sheets.ItemSheet {
  /** Whether this item type shows a rich text Description section. */
  static get hasDescription() { return false; }

  static get defaultOptions() {
    const opts = foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["freeform-universal", "sheet", "item", "fu-simple-item"],
      template: "systems/freeform-universal/templates/item/simple-item-sheet.hbs",
      width: 420,
      height: "auto"
    });
    if (this.hasDescription) {
      opts.height = 460;
      opts.resizable = true;
    }
    return opts;
  }

  async getData(options) {
    const context = await super.getData(options);
    context.system = this.item.toObject(false).system;
    context.hasDescription = this.constructor.hasDescription;
    if (context.hasDescription) {
      const TE = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
      context.enrichedDescription = await TE.enrichHTML(context.system.description || "", {
        secrets: this.item.isOwner,
        relativeTo: this.item
      });
    }
    return context;
  }
}

export class FUFlawSheet extends FUSimpleItemSheet { static get hasDescription() { return true; } }
export class FUDriveSheet extends FUSimpleItemSheet { static get hasDescription() { return true; } }
export class FUInjurySheet extends FUSimpleItemSheet {}
export class FUConditionSheet extends FUSimpleItemSheet {}
