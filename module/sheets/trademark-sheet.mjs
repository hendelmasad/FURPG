export class FUTrademarkSheet extends foundry.appv1.sheets.ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["freeform-universal", "sheet", "item", "trademark"],
      template: "systems/freeform-universal/templates/item/trademark-sheet.hbs",
      width: 460,
      height: 540,
      resizable: true
    });
  }

  async getData(options) {
    const context = await super.getData(options);
    context.system = this.item.toObject(false).system;
    context.edges = Array.isArray(context.system.edges) ? context.system.edges : [];
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    context.enrichedMemo = await TE.enrichHTML(context.system.memo || "", {
      secrets: this.item.isOwner,
      relativeTo: this.item
    });
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find("[data-action='edge-add']").on("click", () => this._addEdge());
    html.find("[data-action='edge-delete']").on("click", ev => this._deleteEdge(ev));
    html.find("[data-action='edge-edit']").on("change", ev => this._editEdge(ev));
  }

  async _addEdge() {
    const edges = foundry.utils.deepClone(this.item.system.edges || []);
    edges.push("");
    await this.item.update({ "system.edges": edges });
  }

  async _deleteEdge(ev) {
    ev.preventDefault();
    const ei = Number(ev.currentTarget.dataset.edge);
    const edges = foundry.utils.deepClone(this.item.system.edges || []);
    edges.splice(ei, 1);
    await this.item.update({ "system.edges": edges });
  }

  async _editEdge(ev) {
    const ei = Number(ev.currentTarget.dataset.edge);
    const edges = foundry.utils.deepClone(this.item.system.edges || []);
    if (ei < 0 || ei >= edges.length) return;
    edges[ei] = ev.currentTarget.value;
    await this.item.update({ "system.edges": edges });
  }
}
