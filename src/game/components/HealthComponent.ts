export class HealthComponent {
  current: number;
  constructor(public max: number) {
    this.current = max;
  }
  damage(amount: number) {
    const dealt = Math.min(this.current, Math.max(0, amount));
    this.current -= dealt;
    return dealt;
  }
  heal(amount: number) {
    this.current = Math.min(this.max, this.current + amount);
  }
  get dead() {
    return this.current <= 0;
  }
}
