export type ObjectiveMetric = 'kills' | 'shards' | 'devices';

export interface SectorObjectiveDefinition {
  id: string;
  title: string;
  brief: string;
  metric: ObjectiveMetric;
  target: number;
  deadlineMs: number;
  reward: string;
  color: number;
}

export interface SectorObjectiveState extends SectorObjectiveDefinition {
  progress: number;
  status: 'active' | 'complete' | 'failed';
}

export const SECTOR_OBJECTIVES: readonly SectorObjectiveDefinition[] = [
  { id: 'lab-purge', title: 'PURGA DE MUESTRAS', brief: 'Elimina 18 amenazas antes de 01:30',
    metric: 'kills', target: 18, deadlineMs: 90000, reward: '+6 daño y alijo de equipo', color: 0x21e6ff },
  { id: 'bio-harvest', title: 'COSECHA DE BIO-DATOS', brief: 'Absorbe 22 fragmentos antes de 01:45',
    metric: 'shards', target: 22, deadlineMs: 105000, reward: '+20% experiencia y alijo', color: 0x73ef62 },
  { id: 'cryo-control', title: 'CONTROL DEL REACTOR', brief: 'Activa 2 dispositivos antes de 02:15',
    metric: 'devices', target: 2, deadlineMs: 135000, reward: '+18 HP máximo y alijo', color: 0x76a9ff },
] as const;

export class SectorObjectiveSystem {
  private state: SectorObjectiveState;
  constructor(sector: number, private readonly onChange: (state: SectorObjectiveState) => void,
    private readonly onComplete: (state: SectorObjectiveState) => void) {
    this.state = { ...SECTOR_OBJECTIVES[Math.min(Math.max(sector, 0), 2)], progress: 0, status: 'active' };
  }
  get snapshot() { return { ...this.state }; }
  update(time: number) {
    if (this.state.status === 'active' && time > this.state.deadlineMs) {
      this.state.status = 'failed';
      this.onChange(this.snapshot);
    }
  }
  record(metric: ObjectiveMetric) {
    if (this.state.status !== 'active' || metric !== this.state.metric) return false;
    this.state.progress = Math.min(this.state.target, this.state.progress + 1);
    if (this.state.progress >= this.state.target) {
      this.state.status = 'complete';
      this.onComplete(this.snapshot);
    }
    this.onChange(this.snapshot);
    return true;
  }
}
