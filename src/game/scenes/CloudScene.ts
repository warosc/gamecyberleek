import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { t } from '../i18n';
import { OnlineError, onlineService } from '../online/OnlinePorts';
import { normalizeCode } from '../online/OperativeIdentity';
import {
  ensureOperative, loadProfile, renameOperative, restoreCloudProfile,
} from '../systems/ProfileStore';
import { applyRuntimeSettings } from '../systems/RuntimeSettings';
import { AudioManager } from '../managers/AudioManager';
import { queueSceneArt } from '../config/SceneArt';
import { UI, backToMenu, fitText, framePanel, panelButton, subMenuFrame, uiFont } from '../ui/SceneWidgets';

/**
 * Cloud save and online identity. The operative code is the only key to a cloud save, so the
 * screen shows it plainly and offers to copy it; restoring on another device asks for it.
 */
export class CloudScene extends Phaser.Scene {
  private audio?: AudioManager;
  private status!: Phaser.GameObjects.Text;
  constructor() { super('Cloud'); }

  preload() {
    queueSceneArt(this, { backdrops: ['systems'] });
  }

  create() {
    this.game.canvas.dataset.scene = 'Cloud';
    this.audio = new AudioManager(this);
    const online = onlineService().online;
    subMenuFrame(this, GAME_WIDTH, GAME_HEIGHT, t('cloud.title'), t(online ? 'cloud.online' : 'cloud.offline'), 0x21e6ff, 'systems');
    const cx = GAME_WIDTH / 2;
    const operative = ensureOperative();
    const label = { fontFamily: 'Arial Black', fontSize: uiFont(this, 13), color: UI.muted, letterSpacing: 2 };

    // Identity card: callsign and code on the left, their actions on the right.
    framePanel(this, cx, 256, 960, 214, UI.cyan, { strokeAlpha: 0.4, band: 0.05, cut: 16 });
    this.add.text(cx - 440, 178, t('cloud.callsign'), label).setOrigin(0, 0.5);
    const callsign = this.add.text(cx - 440, 212, operative.callsign, {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 26), color: '#73ef62',
    }).setOrigin(0, 0.5).setName('cloud-callsign');
    panelButton(this, cx + 320, 196, 240, 52, t('cloud.rename'), UI.green, () => {
      const answer = window.prompt(t('cloud.renamePrompt'), loadProfile().operative?.callsign ?? '');
      if (answer === null) return;
      const saved = renameOperative(answer);
      if (!saved) return this.report(t('cloud.renameInvalid'), false);
      callsign.setText(saved);
      this.report(t('cloud.renamed'), true);
    }, 15, { name: 'cloud-rename' });

    this.add.text(cx - 440, 262, t('cloud.code'), label).setOrigin(0, 0.5);
    this.add.text(cx - 440, 298, operative.code, {
      fontFamily: 'monospace', fontSize: uiFont(this, 30), color: '#ffc857', letterSpacing: 2, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setName('cloud-code');
    fitText(this.add.text(cx - 440, 336, t('cloud.codeHint'), {
      fontFamily: 'Arial', fontSize: uiFont(this, 13), color: UI.body,
    }).setOrigin(0, 0.5), 620);
    panelButton(this, cx + 320, 300, 240, 52, t('cloud.copy'), UI.gold, () => {
      void navigator.clipboard?.writeText(loadProfile().operative?.code ?? operative.code)
        .then(() => this.report(t('cloud.copied'), true))
        .catch(() => this.report(t('cloud.copyFailed'), false));
    }, 15, { name: 'cloud-copy' });

    const upload = panelButton(this, cx - 165, 434, 300, 60, t('cloud.upload'), UI.cyan, () => void this.upload(), 16, { name: 'cloud-upload' });
    const restore = panelButton(this, cx + 165, 434, 300, 60, t('cloud.restore'), UI.violet, () => void this.restore(), 16, { name: 'cloud-restore' });
    if (!online) for (const button of [upload, restore]) button.setEnabled(false);
    this.status = this.add.text(cx, 504, '', {
      fontFamily: 'Arial Black', fontSize: uiFont(this, 14), color: '#73ef62', align: 'center', wordWrap: { width: 900 },
    }).setOrigin(0.5).setName('cloud-status');
    this.add.text(cx, 566, t('cloud.autoNote'), {
      fontFamily: 'Arial', fontSize: uiFont(this, 12), color: UI.muted, align: 'center', wordWrap: { width: 900 },
    }).setOrigin(0.5);
    backToMenu(this, cx, 640, t('common.back'));
  }

  private report(message: string, ok: boolean) {
    if (!this.sys.isActive()) return;
    this.status.setText(message).setColor(ok ? '#73ef62' : '#ff476f');
    this.audio?.play(ok ? 'ui_confirm' : 'ui_deny');
  }

  private async upload() {
    this.report(t('cloud.working'), true);
    try {
      await onlineService().uploadProfile(loadProfile());
      this.report(t('cloud.uploaded'), true);
    } catch (error) {
      if (error instanceof OnlineError && error.isConflict) {
        const info = await onlineService().cloudSaveInfo(ensureOperative().code).catch(() => undefined);
        this.report(t('cloud.conflict', { runs: info?.runs ?? '?' }), false);
      } else this.report(t('cloud.failed'), false);
    }
  }

  private async restore() {
    const answer = window.prompt(t('cloud.restorePrompt'));
    if (answer === null) return;
    const code = normalizeCode(answer);
    if (!code) return this.report(t('cloud.codeInvalid'), false);
    this.report(t('cloud.working'), true);
    try {
      const save = await onlineService().downloadProfile(code);
      if (!save) return this.report(t('cloud.notFound'), false);
      if (!window.confirm(t('cloud.restoreConfirm'))) return this.report('', true);
      const profile = restoreCloudProfile(save.profile, code, save.callsign);
      applyRuntimeSettings(profile.settings);
      this.scene.restart();
    } catch {
      this.report(t('cloud.failed'), false);
    }
  }
}
