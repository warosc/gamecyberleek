import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { SPECIAL_ABILITIES, type SpecialAbilityId } from '../abilities/SpecialAbilities';

/** Owns the special-ability buttons and their cooldown readouts on both layouts. */
export class AbilityBar {
  private readonly fills = new Map<SpecialAbilityId, Phaser.GameObjects.Rectangle>();
  private readonly cooldowns = new Map<SpecialAbilityId, Phaser.GameObjects.Text>();

  constructor(
    scene: Phaser.Scene,
    mobile: boolean,
    private readonly getCharge: (id: SpecialAbilityId) => number,
    onActivate: (id: SpecialAbilityId) => void,
  ) {
    if (mobile)
      scene.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 84, 430, 96, 0x04101c, 0.7)
        .setStrokeStyle(2, 0x21e6ff, 0.22)
        .setDepth(1);
    SPECIAL_ABILITIES.forEach((ability, index) => {
      const x = mobile ? GAME_WIDTH / 2 + (index - 1) * 120 : GAME_WIDTH - 300 + index * 104;
      const y = mobile ? GAME_HEIGHT - 86 : GAME_HEIGHT - 78;
      const width = mobile ? 108 : 94;
      const button = scene.add
        .rectangle(x, y, width, mobile ? 82 : 72, 0x081522, 0.96)
        .setStrokeStyle(3, ability.color, 0.8)
        .setInteractive({ useHandCursor: true });
      const fill = scene.add.rectangle(x - 43, y + 27, 86, 7, ability.color, 0.9).setOrigin(0, 0.5);
      const keyRadius = mobile ? 18 : 15;
      scene.add.circle(x - 31, y - 19, keyRadius, 0x06101d).setStrokeStyle(2, ability.color);
      scene.add
        .text(x - 31, y - 19, ability.key, {
          fontFamily: 'Arial Black',
          fontSize: '15px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      // Fit the name to the gap between the key badge and the button edge instead of a fixed
      // wrap width: word wrap cannot split a single long word, so "OVERDRIVE" ran over the
      // badge and past the button.
      const labelLeft = x - 31 + keyRadius + 4;
      const labelRight = x + width / 2 - 6;
      const labelWidth = labelRight - labelLeft;
      const label = scene.add
        .text(labelLeft + labelWidth / 2, y - 19, ability.name, {
          fontFamily: 'Arial Black',
          fontSize: '10px',
          color: '#eaffff',
          align: 'center',
          wordWrap: { width: labelWidth },
        })
        .setOrigin(0.5);
      if (label.width > labelWidth) label.setScale(labelWidth / label.width);
      const cooldownText = scene.add
        .text(x, y + 8, 'READY', {
          fontFamily: 'Arial Black',
          fontSize: '10px',
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
      this.fills.get(ability.id)!.width = 86 * charge;
      this.cooldowns
        .get(ability.id)!
        .setText(charge >= 1 ? 'READY' : `${Math.ceil((ability.cooldown * (1 - charge)) / 1000)}s`);
    }
  }
}
