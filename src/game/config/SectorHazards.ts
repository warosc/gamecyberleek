export const SECTOR_HAZARDS = [
  { title: 'DESCARGA DE RED', brief: 'SAL DE LOS EJES MARCADOS', color: 0x21e6ff, damage: 12 },
  { title: 'FLORACIÓN TÓXICA', brief: 'ABANDONA EL ÁREA CONTAMINADA', color: 0x73ef62, damage: 14 },
  { title: 'FRACTURA CRIO', brief: 'CRUZA LAS GRIETAS DE HIELO', color: 0x76a9ff, damage: 16 },
] as const;

export const HAZARD_FIRST_MS = 22000;
export const HAZARD_INTERVAL_MS = 26000;
export const HAZARD_LEAD_MS = 1200;

export function sectorHazardHits(sector: number, player: { x: number; y: number }, origin: { x: number; y: number }) {
  if (sector === 0) return Math.abs(player.x - origin.x) < 42 || Math.abs(player.y - origin.y) < 42;
  if (sector === 1) return (player.x - origin.x) ** 2 + (player.y - origin.y) ** 2 < 145 ** 2;
  return Math.abs(player.x - origin.x) < 48 || Math.abs(player.x - origin.x - 150) < 48 ||
    Math.abs(player.x - origin.x + 150) < 48;
}
