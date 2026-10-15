export class FUActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
    const sys = this.system;
    if (this.type === "character") {
      const grit = clampInt(sys.grit, 1, 6);
      const spirit = clampInt(sys.spirit, 1, 6);
      sys.grit = grit;
      sys.spirit = spirit;
      sys.xp = clampInt(sys.xp, 0, 10);

      // Max is derived from grit/spirit; value may exceed max (temporary bonuses earned in play)
      sys.hits.max = grit;
      sys.hits.value = Math.max(0, Math.floor(Number(sys.hits.value) || 0));

      sys.dramaPoints.max = spirit;
      sys.dramaPoints.value = Math.max(0, Math.floor(Number(sys.dramaPoints.value) || 0));

      const injuryCount = this.items.filter(i => i.type === "injury").length;
      sys.injuryCount = injuryCount;
      sys.injuryMax = grit;
      sys.dying = sys.dying || { active: false, expiresIn: 3 };
      sys.dying.active = injuryCount > grit;
    } else if (this.type === "threat") {
      sys.dangerRating = clampInt(sys.dangerRating, 0, 5);
      sys.hits.max = Math.max(0, Number(sys.hits.max) || 0);
      sys.hits.value = Math.max(0, Math.floor(Number(sys.hits.value) || 0));
    }
  }
}

function clampInt(v, min, max) {
  let n = Math.floor(Number(v));
  if (Number.isNaN(n)) n = min;
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
}
