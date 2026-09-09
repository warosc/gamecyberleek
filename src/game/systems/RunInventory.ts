import type { Equipment } from '../loot/Equipment';

export const INVENTORY_CAPACITY = 6;

export class RunInventory {
  private readonly items: Equipment[] = [];
  private activeWeapon?: Equipment;
  get contents() { return [...this.items]; }
  get count() { return this.items.length; }
  get full() { return this.items.length >= INVENTORY_CAPACITY; }
  get equippedWeapon() { return this.activeWeapon; }
  install(item: Equipment) {
    if (this.full) return false;
    this.items.push(item);
    return true;
  }
  equipWeapon(item: Equipment) {
    if (item.kind !== 'weapon') return { accepted: false, replaced: undefined };
    const replaced = this.activeWeapon;
    if (replaced) {
      const index = this.items.indexOf(replaced);
      if (index >= 0) this.items[index] = item;
      else if (!this.full) this.items.push(item);
      else return { accepted: false, replaced: undefined };
    } else {
      if (this.full) return { accepted: false, replaced: undefined };
      this.items.push(item);
    }
    this.activeWeapon = item;
    return { accepted: true, replaced };
  }
}
