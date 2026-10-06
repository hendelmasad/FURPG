import { normalizeGearTags } from "../helpers/gear.mjs";

export class FUGearSheet extends foundry.appv1.sheets.ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["freeform-universal", "sheet", "item", "gear"],
      template: "systems/freeform-universal/templates/item/gear-sheet.hbs",
      width: 460,
      height: 480,
      resizable: true
    });
  }

  async getData(options) {
    const context = await super.getData(options);
    context.system = this.item.toObject(false).system;
    context.tags = normalizeGearTags(context.system.tags);
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    context.enrichedDescription = await TE.enrichHTML(context.system.description || "", {
      secrets: this.item.isOwner,
      relativeTo: this.item
    });
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find("[data-action='gear-tag-add']").on("click", () => this._addTag());
    html.find("[data-action='gear-tag-delete']").on("click", ev => this._deleteTag(ev));
    html.find("[data-action='gear-tag-edit']").on("change", ev => this._editTag(ev));
  }

  async _addTag() {
    const tags = normalizeGearTags(this.item.system?.tags);
    tags.push({ id: foundry.utils.randomID(), name: "" });
    await this.item.update({ "system.tags": tags });
  }

  async _deleteTag(ev) {
    ev.preventDefault();
    const tagId = ev.currentTarget.dataset.tagId;
    const tags = normalizeGearTags(this.item.system?.tags).filter(t => t.id !== tagId);
    await this.item.update({ "system.tags": tags });
  }

  async _editTag(ev) {
    const tagId = ev.currentTarget.dataset.tagId;
    const tags = normalizeGearTags(this.item.system?.tags);
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;
    tag.name = ev.currentTarget.value;
    await this.item.update({ "system.tags": tags });
  }
}
