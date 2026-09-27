import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { t, td } from '../i18n';
import type { Equipment } from '../loot/Equipment';
import type { BuildSynergy, combatRating } from '../systems/BuildProgression';
import { RewardChooser } from './RewardChooser';
import { hex } from './SceneWidgets';

type Rating = ReturnType<typeof combatRating>;

export interface InventoryActions {
  close: () => void;
  equip: (index: number) => void;
  recycle: (index: number) => void;
}

const kindLabel = (kind: Equipment['kind']) =>
  t(kind === 'weapon' ? 'loot.kind.weapon' : kind === 'armor' ? 'loot.kind.armor' : 'loot.kind.module');

/** The six-slot run inventory. Returns the modal parts; `ModalOverlay` owns their lifetime. */
export function buildInventoryPanel(
  scene: Phaser.Scene,
  items: Equipment[],
  activeWeapon: Equipment | undefined,
  synergy: BuildSynergy | undefined,
  rating: Rating,
  actions: InventoryActions,
) {
  const close = scene.add.text(GAME_WIDTH - 82, 50, t('inventory.close'), {
    fontFamily: 'Arial Black', fontSize: '14px', color: '#73ef62', backgroundColor: '#07111f', padding: { x: 14, y: 9 },
  }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
  close.on('pointerup', actions.close);
  const parts: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020711, 0.95),
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, Math.min(1120, GAME_WIDTH - 44), 650, 0x061323, 0.98)
      .setStrokeStyle(3, synergy?.color ?? 0x21e6ff, 0.8),
    scene.add.text(80, 42, t('inventory.title'), { fontFamily: 'Arial Black', fontSize: '30px', color: '#eaffff' }),
    scene.add.text(82, 82, t('inventory.rating', {
      damage: rating.damage, dps: rating.dps, cadence: rating.cadence, critical: rating.critical, armor: rating.armor, speed: rating.speed,
    }), { fontFamily: 'monospace', fontSize: '14px', color: '#9fd8e8' }),
    close,
  ];
  const synergyText = synergy
    ? t('inventory.synergyActive', { name: td(synergy.name), description: td(synergy.description) })
    : t('inventory.synergyHint');
  parts.push(scene.add.text(GAME_WIDTH / 2, 122, synergyText, {
    fontFamily: 'Arial Black', fontSize: '13px', color: synergy ? hex(synergy.color) : '#708b9b',
  }).setOrigin(0.5));

  for (let index = 0; index < 6; index++) {
    const item = items[index];
    const x = GAME_WIDTH / 2 + ((index % 3) - 1) * 350;
    const y = 245 + Math.floor(index / 3) * 215;
    const active = item === activeWeapon;
    const color = item?.color ?? 0x294252;
    parts.push(scene.add.rectangle(x, y, 316, 178, active ? 0x11344a : 0x0a1b2c, 1)
      .setStrokeStyle(active ? 4 : 2, active ? 0x73ef62 : color, active ? 1 : 0.65)
      .setName(`inventory-slot-${index}`));
    if (!item) {
      parts.push(scene.add.text(x, y, t('inventory.empty', { slot: index + 1 }), {
        fontFamily: 'monospace', fontSize: '14px', color: '#496474', align: 'center',
      }).setOrigin(0.5));
      continue;
    }
    parts.push(
      scene.add.text(x - 138, y - 73, t('inventory.itemHeader', { rarity: item.rarity, level: item.itemLevel }), {
        fontFamily: 'monospace', fontSize: '11px', color: hex(color),
      }),
      scene.add.text(x - 138, y - 48, td(item.name), {
        fontFamily: 'Arial Black', fontSize: '16px', color: '#eaffff', wordWrap: { width: 276 },
      }),
      scene.add.text(x - 138, y - 14, `${kindLabel(item.kind)}  ·  ${t('loot.power', { power: item.power })}\n${td(item.description)}`, {
        fontSize: '12px', color: '#a9bdc9', wordWrap: { width: 276 }, lineSpacing: 4,
      }),
    );
    if (item.kind === 'weapon') {
      const equip = scene.add.text(x - 138, y + 56, t(active ? 'inventory.equipped' : 'inventory.equip'), {
        fontFamily: 'Arial Black', fontSize: '12px', color: active ? '#73ef62' : '#21e6ff',
        backgroundColor: '#06101d', padding: { x: 11, y: 7 },
      });
      if (!active) equip.setInteractive({ useHandCursor: true }).on('pointerup', () => actions.equip(index));
      parts.push(equip);
    }
    if (!active) {
      const recycle = scene.add.text(x + 138, y + 56, t('loot.recycle'), {
        fontFamily: 'Arial Black', fontSize: '11px', color: '#ff9a65', backgroundColor: '#06101d', padding: { x: 10, y: 7 },
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      recycle.on('pointerup', () => actions.recycle(index));
      parts.push(recycle);
    }
  }
  parts.push(scene.add.text(GAME_WIDTH / 2, 672, t('inventory.footer'), {
    fontFamily: 'monospace', fontSize: '12px', color: '#7894a5',
  }).setOrigin(0.5));
  return parts;
}

/** Install-or-recycle choice for a fresh drop. The chooser is returned so the scene can dispose it. */
export function buildLootDecision(
  scene: Phaser.Scene,
  equipment: Equipment,
  count: number,
  full: boolean,
  activeWeapon: Equipment | undefined,
  resolve: (install: boolean) => void,
) {
  const color = hex(equipment.color);
  const parts: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020711, 0.93),
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 760, 550, 0x061323, 0.98).setStrokeStyle(3, equipment.color, 0.75),
    scene.add.text(GAME_WIDTH / 2, 105, t('loot.found'), {
      fontFamily: 'Arial Black', fontSize: '34px', color: '#ffffff',
    }).setOrigin(0.5),
    scene.add.text(GAME_WIDTH / 2, 148, t('loot.header', {
      rarity: equipment.rarity, level: equipment.itemLevel, power: equipment.power, kind: kindLabel(equipment.kind),
    }), { fontFamily: 'monospace', fontSize: '14px', color, letterSpacing: 3 }).setOrigin(0.5),
    scene.add.text(GAME_WIDTH / 2, 184, td(equipment.name), { fontFamily: 'Arial Black', fontSize: '25px', color }).setOrigin(0.5),
    scene.add.text(GAME_WIDTH / 2, 220, td(equipment.description), {
      fontSize: '16px', color: '#c7d9e2', align: 'center', wordWrap: { width: 620 },
    }).setOrigin(0.5),
    scene.add.text(GAME_WIDTH / 2, 254, t('loot.backpack', { count }), {
      fontFamily: 'Arial Black', fontSize: '13px', color: full ? '#ff476f' : '#8ba5b8', letterSpacing: 2,
    }).setOrigin(0.5),
  ];
  const replacing = equipment.kind === 'weapon' && activeWeapon !== undefined;
  if (equipment.kind === 'weapon') {
    parts.push(scene.add.text(GAME_WIDTH / 2, 286, activeWeapon
      ? t('loot.compare', { current: td(activeWeapon.name), currentPower: activeWeapon.power, next: td(equipment.name), nextPower: equipment.power })
      : t('loot.weaponSlotFree'),
    { fontFamily: 'monospace', fontSize: '13px', color: '#9eb8c8', align: 'center', lineSpacing: 7 }).setOrigin(0.5));
  }
  const canInstall = !full || replacing;
  const recycle = { accent: 0x73ef62, icon: '↻', name: t('loot.recycle'), effect: t('loot.recycleEffect') };
  const choices = !canInstall ? [{ ...recycle, footer: t('loot.backpackFull') }] : [
    {
      accent: equipment.color, icon: equipment.kind === 'weapon' ? '⚡' : '◆',
      name: t(replacing ? 'loot.replace' : 'loot.install'),
      effect: t(replacing ? 'loot.replaceEffect' : 'loot.installEffect'),
      footer: replacing ? t('loot.weaponSlot') : t('loot.space', { slot: count + 1 }),
    },
    { ...recycle, footer: t('loot.recovery') },
  ];
  const chooser = new RewardChooser(scene, index => resolve(canInstall && index === 0));
  parts.push(...chooser.build(choices, GAME_WIDTH / 2, 455));
  return { parts, chooser };
}

/** Transient toast for a collected item. Owns and destroys its own objects. */
export function showLootBanner(scene: Phaser.Scene, equipment: Equipment) {
  const color = hex(equipment.color);
  const panel = scene.add.rectangle(GAME_WIDTH / 2, 175, 560, 112, 0x06101d, 0.96).setStrokeStyle(4, equipment.color, 0.95);
  const rarity = scene.add.text(GAME_WIDTH / 2, 141, `${equipment.rarity}  //  ${kindLabel(equipment.kind)}`, {
    fontFamily: 'Arial Black', fontSize: '13px', color, letterSpacing: 3,
  }).setOrigin(0.5);
  const title = scene.add.text(GAME_WIDTH / 2, 170, td(equipment.name), {
    fontFamily: 'Arial Black', fontSize: '23px', color: '#ffffff',
  }).setOrigin(0.5);
  const description = scene.add.text(GAME_WIDTH / 2, 202, td(equipment.description), { fontSize: '14px', color: '#c7d9e2' }).setOrigin(0.5);
  const banner = scene.add.container(0, -35, [panel, rarity, title, description]).setDepth(130).setAlpha(0);
  scene.tweens.add({
    targets: banner, y: 0, alpha: 1, duration: 260, hold: 2300, yoyo: true, onComplete: () => banner.destroy(),
  });
}
