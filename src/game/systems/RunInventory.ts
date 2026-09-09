import type { Equipment } from '../loot/Equipment';

export const INVENTORY_CAPACITY = 6;

export class RunInventory {
  private readonly items: Equipment[] = [];
  get contents() { return [...this.items]; }
  get count() { return this.items.length; }
  get full() { return this.items.length >= INVENTORY_CAPACITY; }
  install(item: Equipment) {
    if (this.full) return false;
    this.items.push(item);
    return true;
  }
}
