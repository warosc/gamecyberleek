export const calculateDamage = (base: number, criticalChance: number, roll = Math.random()) => ({
  amount: Math.round(base * (roll < criticalChance ? 2 : 1)),
  critical: roll < criticalChance,
});
