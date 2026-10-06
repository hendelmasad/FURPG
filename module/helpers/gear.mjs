export function normalizeGearTags(raw) {
  if (Array.isArray(raw)) {
    return raw.map(t => {
      if (typeof t === "string") {
        return { id: foundry.utils.randomID(), name: t };
      }
      return {
        id: t?.id || foundry.utils.randomID(),
        name: typeof t?.name === "string" ? t.name : ""
      };
    });
  }
  if (typeof raw === "string") {
    if (!raw.trim()) return [];
    return raw
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({ id: foundry.utils.randomID(), name }));
  }
  return [];
}
