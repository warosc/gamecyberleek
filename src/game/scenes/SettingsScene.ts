import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { setLocale, t, type StringKey } from '../i18n';
import {
  LOCALE_OPTIONS, MOTION_OPTIONS, QUALITY_OPTIONS, cycle, type GameSettings,
} from '../progression/Settings';
import { exportProfileJson, importProfileJson, loadProfile, updateProfile, updateSettings } from '../systems/ProfileStore';
import { applyRuntimeSettings } from '../systems/RuntimeSettings';
import { AudioManager, setMusicLightweight } from '../managers/AudioManager';
import { detectQualityProfile } from '../config/QualityProfile';
import { UI, backToMenu, fitText, framePanel, panelButton, subMenuFrame, uiFont } from '../ui/SceneWidgets';

interface Row {
  label: StringKey;
  value: () => string;
  change: (step: 1 | -1) => void;
}

const volumeText = (value: number) => `${Math.round(value * 100)}%`;
const stepVolume = (value: number, step: 1 | -1) => Math.round(Math.min(1, Math.max(0, value + step * 0.1)) * 10) / 10;

/** Persistent accessibility, audio and display preferences, applied without a reload. */
export class SettingsScene extends Phaser.Scene {
  private audio?: AudioManager;
  constructor() { super('Settings'); }

  create() {
    this.game.canvas.dataset.scene = 'Settings';
    this.audio = new AudioManager(this);
    subMenuFrame(this, GAME_WIDTH, GAME_HEIGHT, t('settings.title'), t('settings.subtitle'), 0xd566ff);
    const settings = () => loadProfile().settings;
    const set = (patch: Partial<GameSettings>) => {
      const next = updateSettings(patch).settings;
      applyRuntimeSettings(next);
      setMusicLightweight(detectQualityProfile().tier === 'low');
      this.audio?.play('ui_confirm');
    };
    const rows: Row[] = [
      { label: 'settings.quality', value: () => t(`settings.quality.${settings().quality}`),
        change: step => set({ quality: cycle(QUALITY_OPTIONS, settings().quality, step) }) },
      { label: 'settings.motion', value: () => t(`settings.motion.${settings().motion}`),
        change: step => set({ motion: cycle(MOTION_OPTIONS, settings().motion, step) }) },
      { label: 'settings.master', value: () => volumeText(settings().masterVolume),
        change: step => set({ masterVolume: stepVolume(settings().masterVolume, step) }) },
      { label: 'settings.music', value: () => volumeText(settings().musicVolume),
        change: step => set({ musicVolume: stepVolume(settings().musicVolume, step) }) },
      { label: 'settings.sfx', value: () => volumeText(settings().sfxVolume),
        change: step => set({ sfxVolume: stepVolume(settings().sfxVolume, step) }) },
      { label: 'settings.shake', value: () => t(settings().screenShake ? 'common.on' : 'common.off'),
        change: () => set({ screenShake: !settings().screenShake }) },
      { label: 'settings.vibration', value: () => t(loadProfile().vibration ? 'common.on' : 'common.off'),
        change: () => { updateProfile({ vibration: !loadProfile().vibration }); this.audio?.play('ui_confirm'); } },
      { label: 'settings.language', value: () => t(`settings.locale.${settings().locale}`),
        change: step => {
          const locale = cycle(LOCALE_OPTIONS, settings().locale, step);
          set({ locale });
          setLocale(locale);
          this.scene.restart();
        } },
    ];

    // Centred on the logical width: phones in landscape are wider than the 1280 design width.
    const cx = GAME_WIDTH / 2;
    rows.forEach((row, index) => {
      const y = 158 + index * 55;
      framePanel(this, cx, y, 900, 48, UI.violet, { strokeAlpha: 0.28, band: 0.05, cut: 10, brackets: false });
      fitText(this.add.text(cx - 425, y, t(row.label), {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 15), color: UI.text,
      }).setOrigin(0, 0.5), 420);
      // The whole value cell is a forward tap target, which matters on a phone-sized canvas.
      const cell = this.add.rectangle(cx + 210, y, 240, 48, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      const value = this.add.text(cx + 210, y, row.value(), {
        fontFamily: 'Arial Black', fontSize: uiFont(this, 15), color: '#e59cff',
      }).setOrigin(0.5).setName(`setting-${row.label}`);
      const change = (step: 1 | -1) => () => { row.change(step); value.setText(row.value()); fitText(value, 220); };
      fitText(value, 220);
      cell.on('pointerup', change(1));
      panelButton(this, cx + 52, y, 76, 44, '<', UI.violet, change(-1), 18, { name: `setting-prev-${index}` });
      panelButton(this, cx + 368, y, 76, 44, '>', UI.violet, change(1), 18, { name: `setting-next-${index}` });
    });
    this.add.text(GAME_WIDTH / 2, 588, t('settings.restartHint'), {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 11), color: UI.muted, letterSpacing: 1,
    }).setOrigin(0.5);
    const status = this.add.text(cx, 682, '', {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 12), color: '#73ef62',
    }).setOrigin(0.5).setName('settings-backup-status');
    panelButton(this, cx - 310, 640, 270, 54, t('settings.export'), UI.cyan, () => this.exportSave(), 14, { name: 'settings-export' });
    panelButton(this, cx + 310, 640, 270, 54, t('settings.import'), UI.gold, () => this.importSave(status), 14, { name: 'settings-import' });
    backToMenu(this, GAME_WIDTH / 2, 640, t('common.back'));
    panelButton(this, cx + 380, 100, 180, 46, t('settings.cloud'), UI.cyan, () => this.scene.start('Cloud'), 15, { name: 'settings-cloud' });
  }

  /** Downloads the save as a file. The browser, not the game, decides where it goes. */
  private exportSave() {
    const url = URL.createObjectURL(new Blob([exportProfileJson()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `leek-ops-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.audio?.play('ui_confirm');
  }

  private importSave(status: Phaser.GameObjects.Text) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void file.text().then(text => {
        const profile = importProfileJson(text);
        if (!profile) {
          status.setText(t('settings.importFailed')).setColor('#ff476f');
          this.audio?.play('ui_deny');
          return;
        }
        applyRuntimeSettings(profile.settings);
        this.audio?.play('ui_confirm');
        // Restart so every row, and the language, reflects the restored save.
        this.scene.restart();
      });
    };
    input.click();
  }
}
