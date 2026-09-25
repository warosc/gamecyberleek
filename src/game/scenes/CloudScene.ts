import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { t } from '../i18n';
import { onlineService } from '../online/OnlinePorts';
import { normalizeCode } from '../online/OperativeIdentity';
import {
  ensureOperative, loadProfile, renameOperative, restoreCloudProfile,
} from '../systems/ProfileStore';
import { applyRuntimeSettings } from '../systems/RuntimeSettings';
import { AudioManager } from '../managers/AudioManager';
import { backToMenu, panelButton, subMenuFrame } from '../ui/SceneWidgets';

/**
 * Cloud save and online identity. The operative code is the only key to a cloud save, so the
 * screen shows it plainly and offers to copy it; restoring on another device asks for it.
 */
export class CloudScene extends Phaser.Scene {
  private audio?: AudioManager;
  private status!: Phaser.GameObjects.Text;
  constructor() { super('Cloud'); }

  create() {
    this.game.canvas.dataset.scene = 'Cloud';
    this.audio = new AudioManager(this);
    const online = onlineService().online;
    subMenuFrame(this, GAME_WIDTH, GAME_HEIGHT, t('cloud.title'), t(online ? 'cloud.online' : 'cloud.offline'), 0x21e6ff);
    const cx = GAME_WIDTH / 2;
    const operative = ensureOperative();
    const label = { fontFamily: 'Arial Black', fontSize: '13px', color: '#7594a8', letterSpacing: 2 };

    this.add.text(cx - 420, 170, t('cloud.callsign'), label).setOrigin(0, 0.5);
    const callsign = this.add.text(cx - 420, 204, operative.callsign, {
      fontFamily: 'Arial Black', fontSize: '26px', color: '#73ef62',
    }).setOrigin(0, 0.5).setName('cloud-callsign');
    panelButton(this, cx + 300, 190, 240, 50, t('cloud.rename'), 0x73ef62, () => {
      const answer = window.prompt(t('cloud.renamePrompt'), loadProfile().operative?.callsign ?? '');
      if (answer === null) return;
      const saved = renameOperative(answer);
      if (!saved) return this.report(t('cloud.renameInvalid'), false);
      callsign.setText(saved);
      this.report(t('cloud.renamed'), true);
    }, 14).box.setName('cloud-rename');

    this.add.text(cx - 420, 270, t('cloud.code'), label).setOrigin(0, 0.5);
    this.add.text(cx - 420, 306, operative.code, {
      fontFamily: 'monospace', fontSize: '30px', color: '#ffc857', letterSpacing: 2,
    }).setOrigin(0, 0.5).setName('cloud-code');
    this.add.text(cx - 420, 342, t('cloud.codeHint'), { fontFamily: 'Arial', fontSize: '13px', color: '#a9bbc9' }).setOrigin(0, 0.5);
    panelButton(this, cx + 300, 300, 240, 50, t('cloud.copy'), 0xffc857, () => {
      void navigator.clipboard?.writeText(loadProfile().operative?.code ?? operative.code)
        .then(() => this.report(t('cloud.copied'), true))
        .catch(() => this.report(t('cloud.copyFailed'), false));
    }, 14).box.setName('cloud-copy');

    const upload = panelButton(this, cx - 160, 440, 280, 58, t('cloud.upload'), 0x21e6ff, () => void this.upload(), 15);
    upload.box.setName('cloud-upload');
    const restore = panelButton(this, cx + 160, 440, 280, 58, t('cloud.restore'), 0xd566ff, () => void this.restore(), 15);
    restore.box.setName('cloud-restore');
    if (!online) for (const button of [upload, restore]) {
      button.box.disableInteractive().setAlpha(0.4);
      button.text.setAlpha(0.4);
    }
    this.status = this.add.text(cx, 510, '', {
      fontFamily: 'Arial Black', fontSize: '14px', color: '#73ef62', align: 'center', wordWrap: { width: 860 },
    }).setOrigin(0.5).setName('cloud-status');
    this.add.text(cx, 566, t('cloud.autoNote'), {
      fontFamily: 'monospace', fontSize: '11px', color: '#7594a8', align: 'center', wordWrap: { width: 900 },
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
    } catch {
      this.report(t('cloud.failed'), false);
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
