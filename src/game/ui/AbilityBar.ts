import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { SPECIAL_ABILITIES, type SpecialAbilityId } from '../abilities/SpecialAbilities';
import { t, td } from '../i18n';
import { hudFont, isCompactHud } from './HudLayout';
import { DISPLAY_FONT } from '../config/Fonts';

/** Owns the special-ability buttons and their cooldown readouts on both layouts. */
export class AbilityBar {
  private readonly fills = new Map<SpecialAbilityId, Phaser.GameObjects.Rectangle>();
  private readonly cooldowns = new Map<SpecialAbilityId, Phaser.GameObjects.Text>();
  private readonly fillWidth: number;

  constructor(
    scene: Phaser.Scene,
    mobile: boolean,
    private readonly getCharge: (id: SpecialAbilityId) => number,
    onActivate: (id: SpecialAbilityId) => void,
    /** Effective cooldown: OVERCLOCK shortens it, so the base value would show the wrong seconds. */
    private readonly getCooldown: (id: SpecialAbilityId) => number = (id) =>
      SPECIAL_ABILITIES.find((ability) => ability.id === id)!.cooldown,
  ) {
    // Phone-sized type: at 22px "OVERDRIVE" is ~133px, so the 108px buttons scaled their names
    // down to about 4 CSS px. The compact buttons are 190 wide; the bottom centre has the room
    // (the move stick ends near 190 and the dash pad starts 271 from the right edge).
    const compact = isCompactHud(scene);
    const width = compact ? 190 : mobile ? 108 : 94;
    const height = compact ? 90 : mobile ? 82 : 72;
    const spacing = compact ? width + 14 : mobile ? 120 : 104;
    this.fillWidth = compact ? width - 24 : 86;
    if (mobile)
      scene.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 84, compact ? 3 * width + 2 * (spacing - width) + 42 : 430, compact ? 100 : 96, 0x04101c, 0.7)
        .setStrokeStyle(2, 0x21e6ff, 0.22)
        // Behind the buttons: at depth 1 this 70 % backdrop sat on top of them, so ready powers
        // looked greyed out on every phone.
        .setDepth(-1);
    SPECIAL_ABILITIES.forEach((ability, index) => {
      // Desktop keeps the group's right edge 45px from the canvas edge whatever the button width.
      const x = mobile ? GAME_WIDTH / 2 + (index - 1) * spacing : GAME_WIDTH - 45 - width / 2 - (2 - index) * spacing;
      const y = mobile || compact ? GAME_HEIGHT - 86 : GAME_HEIGHT - 78;
      const button = scene.add
        .rectangle(x, y, width, height, 0x081522, 0.96)
        .setStrokeStyle(3, ability.color, 0.8)
        .setInteractive({ useHandCursor: true });
      const fill = scene.add
        .rectangle(x - this.fillWidth / 2, y + (compact ? 34 : 27), this.fillWidth, 7, ability.color, 0.9)
        .setOrigin(0, 0.5);
      const keyRadius = mobile || compact ? 18 : 15;
      const keyX = compact ? x - width / 2 + 26 : x - 31;
      const rowY = compact ? y - 22 : y - 19;
      scene.add.circle(keyX, rowY, keyRadius, 0x06101d).setStrokeStyle(2, ability.color);
      scene.add
        .text(keyX, rowY, ability.key, {
          fontFamily: DISPLAY_FONT, fontStyle: 'bold',
          fontSize: hudFont(scene, 15),
          color: '#ffffff',
        })
        .setOrigin(0.5);
      // Fit the name to the gap between the key badge and the button edge instead of a fixed
      // wrap width: word wrap cannot split a single long word, so "OVERDRIVE" ran over the
      // badge and past the button.
      const labelLeft = keyX + keyRadius + 4;
      const labelRight = x + width / 2 - 6;
      const labelWidth = labelRight - labelLeft;
      const label = scene.add
        .text(labelLeft + labelWidth / 2, rowY, td(ability.name), {
          fontFamily: DISPLAY_FONT, fontStyle: 'bold',
          fontSize: hudFont(scene, 10),
          color: '#eaffff',
          align: 'center',
          wordWrap: { width: labelWidth },
        })
        .setOrigin(0.5);
      if (label.width > labelWidth) label.setScale(labelWidth / label.width);
      const cooldownText = scene.add
        .text(x, y + (compact ? 12 : 8), t('hud.ready'), {
          fontFamily: DISPLAY_FONT, fontStyle: 'bold',
          fontSize: hudFont(scene, 10),
          color: '#ffffff',
        })
        .setOrigin(0.5);
      button.on('pointerdown', () => onActivate(ability.id));
      this.fills.set(ability.id, fill);
      this.cooldowns.set(ability.id, cooldownText);
    });
  }

  update() {
    for (const ability of SPECIAL_ABILITIES) {
      const charge = this.getCharge(ability.id);
      this.fills.get(ability.id)!.width = this.fillWidth * charge;
      this.cooldowns
        .get(ability.id)!
        .setText(charge >= 1 ? t('hud.ready') : `${Math.ceil((this.getCooldown(ability.id) * (1 - charge)) / 1000)}s`);
    }
  }
}
