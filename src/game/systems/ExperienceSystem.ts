export const xpForLevel = (level: number) => Math.floor(40 * Math.pow(1.28, level - 1));
export class ExperienceSystem {
  level = 1;
  xp = 0;
  add(amount: number) {
    this.xp += amount;
    let levels = 0;
    while (this.xp >= xpForLevel(this.level)) {
      this.xp -= xpForLevel(this.level);
      this.level++;
      levels++;
    }
    return levels;
  }
}
