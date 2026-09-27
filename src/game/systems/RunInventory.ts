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
    if (replaced && this.full) {
      const index = this.items.indexOf(replaced);
      if (index >= 0) this.items[index] = item;
      else return { accepted: false, replaced: undefined };
    } else {
      this.items.push(item);
    }
    this.activeWeapon = item;
    return { accepted: true, replaced };
  }
  activateWeapon(index: number) {
    const item = this.items[index];
    if (!item || item.kind !== 'weapon' || item === this.activeWeapon)
      return { accepted: false, previous: this.activeWeapon, current: undefined };
    const previous = this.activeWeapon;
    this.activeWeapon = item;
    return { accepted: true, previous, current: item };
  }
  recycle(index: number) {
    const item = this.items[index];
    if (!item || item === this.activeWeapon) return undefined;
    this.items.splice(index, 1);
    return item;
  }
}
