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

      sys.hits.max = grit;
      sys.hits.value = clampInt(sys.hits.value, 0, grit);

      sys.dramaPoints.max = spirit;
      sys.dramaPoints.value = clampInt(sys.dramaPoints.value, 0, spirit);

      const injuryCount = this.items.filter(i => i.type === "injury").length;
      sys.injuryCount = injuryCount;
      sys.injuryMax = grit;
      sys.dying = sys.dying || { active: false, expiresIn: 3 };
      sys.dying.active = injuryCount > grit;
    } else if (this.type === "threat") {
      sys.dangerRating = clampInt(sys.dangerRating, 0, 5);
      sys.hits.max = Math.max(0, Number(sys.hits.max) || 0);
      sys.hits.value = clampInt(sys.hits.value, 0, sys.hits.max);
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
