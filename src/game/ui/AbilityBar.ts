import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { SPECIAL_ABILITIES, type SpecialAbilityId } from '../abilities/SpecialAbilities';
import { t, td } from '../i18n';
import { hudFont, isCompactHud, touchLayout, type TouchCircle } from './HudLayout';
import { DISPLAY_FONT } from '../config/Fonts';
import { loadProfile } from '../systems/ProfileStore';
import { pulseHaptics } from '../systems/RuntimeSettings';

interface RoundButton {
  circle: TouchCircle;
  color: number;
  ring: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Graphics;
  seconds: Phaser.GameObjects.Text;
  lastCharge: number;
}

/**
 * Owns the special-ability buttons and their cooldown readouts on both layouts.
 *
 * Desktop keeps the Q/E/R cards in the bottom-right corner. On touch screens the powers are round
 * buttons arced around the dash pad (HudLayout.touchLayout) for the right thumb: they used to be a
 * bar in the bottom centre, out of reach of both thumbs. Each shows its charge as a ring and its
 * remaining seconds in the middle.
 */
export class AbilityBar {
  private readonly fills = new Map<SpecialAbilityId, Phaser.GameObjects.Rectangle>();
  private readonly cooldowns = new Map<SpecialAbilityId, Phaser.GameObjects.Text>();
  private readonly round = new Map<SpecialAbilityId, RoundButton>();
  private readonly fillWidth = 86;

  constructor(
    scene: Phaser.Scene,
    mobile: boolean,
    private readonly getCharge: (id: SpecialAbilityId) => number,
    onActivate: (id: SpecialAbilityId) => void,
    /** Effective cooldown: OVERCLOCK shortens it, so the base value would show the wrong seconds. */
    private readonly getCooldown: (id: SpecialAbilityId) => number = (id) =>
      SPECIAL_ABILITIES.find((ability) => ability.id === id)!.cooldown,
  ) {
    if (mobile) this.buildTouch(scene, onActivate);
    else this.buildDesktop(scene, onActivate);
  }

  private buildDesktop(scene: Phaser.Scene, onActivate: (id: SpecialAbilityId) => void) {
    const width = 94;
    const spacing = 104;
    SPECIAL_ABILITIES.forEach((ability, index) => {
      // The group's right edge stays 45px from the canvas edge.
      const x = GAME_WIDTH - 45 - width / 2 - (2 - index) * spacing;
      const y = GAME_HEIGHT - 78;
      const button = scene.add
        .rectangle(x, y, width, 72, 0x081522, 0.96)
        .setStrokeStyle(3, ability.color, 0.8)
        .setInteractive({ useHandCursor: true });
      const fill = scene.add
        .rectangle(x - this.fillWidth / 2, y + 27, this.fillWidth, 7, ability.color, 0.9)
        .setOrigin(0, 0.5);
      const keyX = x - 31;
      const rowY = y - 19;
      scene.add.circle(keyX, rowY, 15, 0x06101d).setStrokeStyle(2, ability.color);
      scene.add
        .text(keyX, rowY, ability.key, { fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(scene, 15), color: '#ffffff' })
        .setOrigin(0.5);
      // Fit the name to the gap between the key badge and the button edge: word wrap cannot split
      // a single long word, so "OVERDRIVE" ran over the badge and past the button.
      const labelLeft = keyX + 19;
      const labelWidth = x + width / 2 - 6 - labelLeft;
      const label = scene.add
        .text(labelLeft + labelWidth / 2, rowY, td(ability.name), {
          fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(scene, 10), color: '#eaffff',
          align: 'center', wordWrap: { width: labelWidth },
        })
        .setOrigin(0.5);
      if (label.width > labelWidth) label.setScale(labelWidth / label.width);
      const cooldownText = scene.add
        .text(x, y + 8, t('hud.ready'), { fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: hudFont(scene, 10), color: '#ffffff' })
        .setOrigin(0.5);
      button.on('pointerdown', () => onActivate(ability.id));
      this.fills.set(ability.id, fill);
      this.cooldowns.set(ability.id, cooldownText);
    });
  }

  private buildTouch(scene: Phaser.Scene, onActivate: (id: SpecialAbilityId) => void) {
    const layout = touchLayout(GAME_WIDTH, GAME_HEIGHT, isCompactHud(scene));
    SPECIAL_ABILITIES.forEach((ability, index) => {
      const circle = layout.abilities[index];
      const button = scene.add.circle(circle.x, circle.y, circle.r, 0x081522, 0.9)
        .setStrokeStyle(3, ability.color, 0.55).setInteractive().setDepth(61).setName(`touch-ability-${ability.id}`);
      const icon = scene.add.graphics({ x: circle.x, y: circle.y }).setDepth(62);
      drawAbilityIcon(icon, ability.id, circle.r * 0.46, ability.color);
      const ring = scene.add.graphics().setDepth(62);
      const seconds = scene.add.text(circle.x, circle.y, '', {
        fontFamily: DISPLAY_FONT, fontStyle: 'bold', fontSize: `${Math.round(circle.r * 0.62)}px`, color: '#ffffff',
        stroke: '#04101c', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(63);
      button.on('pointerdown', () => {
        onActivate(ability.id);
        if (loadProfile().vibration) pulseHaptics(12);
      });
      this.round.set(ability.id, { circle, color: ability.color, ring, icon, seconds, lastCharge: -1 });
    });
  }

  update() {
    for (const ability of SPECIAL_ABILITIES) {
      const charge = this.getCharge(ability.id);
      const button = this.round.get(ability.id);
      if (button) {
        this.updateRound(button, ability.id, charge);
        continue;
      }
      this.fills.get(ability.id)!.width = this.fillWidth * charge;
      this.cooldowns
        .get(ability.id)!
        .setText(charge >= 1 ? t('hud.ready') : `${Math.ceil((this.getCooldown(ability.id) * (1 - charge)) / 1000)}s`);
    }
  }

  private updateRound(button: RoundButton, id: SpecialAbilityId, charge: number) {
    // Redrawn only when the charge moved visibly: a ring per frame per button adds up on phones.
    if (Math.abs(charge - button.lastCharge) < 0.005 && !(charge >= 1 && button.lastCharge < 1)) return;
    button.lastCharge = charge;
    const ready = charge >= 1;
    const { x, y, r } = button.circle;
    button.ring.clear()
      .lineStyle(6, button.color, ready ? 1 : 0.85)
      .beginPath()
      .arc(x, y, r - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, charge), false)
      .strokePath();
    if (ready) button.ring.fillStyle(button.color, 0.16).fillCircle(x, y, r - 7);
    button.icon.setAlpha(ready ? 1 : 0.35);
    button.seconds.setText(ready ? '' : `${Math.ceil((this.getCooldown(id) * (1 - charge)) / 1000)}`);
  }
}

/** Vector icons, drawn rather than typed: symbol glyphs are missing from some phones' fonts. */
function drawAbilityIcon(graphics: Phaser.GameObjects.Graphics, id: SpecialAbilityId, size: number, color: number) {
  graphics.lineStyle(Math.max(3, size * 0.16), color, 1);
  if (id === 'nova') {
    graphics.strokeCircle(0, 0, size * 0.42);
    for (let ray = 0; ray < 8; ray++) {
      const angle = (Math.PI / 4) * ray;
      graphics.lineBetween(Math.cos(angle) * size * 0.62, Math.sin(angle) * size * 0.62, Math.cos(angle) * size, Math.sin(angle) * size);
    }
  } else if (id === 'shield') {
    const points = Array.from({ length: 6 }, (_, side) => {
      const angle = (Math.PI / 3) * side - Math.PI / 2;
      return new Phaser.Math.Vector2(Math.cos(angle) * size, Math.sin(angle) * size);
    });
    graphics.strokePoints(points, true);
    graphics.fillStyle(color, 0.35).fillPoints(points, true);
  } else {
    for (const offset of [-0.42, 0.22]) {
      graphics.beginPath()
        .moveTo((offset - 0.2) * size, -size * 0.7)
        .lineTo((offset + 0.35) * size, 0)
        .lineTo((offset - 0.2) * size, size * 0.7)
        .strokePath();
    }
  }
}
