import Phaser from 'phaser';
import './style.css';
import { gameConfig } from './game/config/GameConfig';
import { installDevTelemetry, reportViewport } from './game/systems/DevTelemetry';
import { loadProfile } from './game/systems/ProfileStore';
import { applyRuntimeSettings } from './game/systems/RuntimeSettings';
import { installGamepadBridge } from './game/input/GamepadBridge';
import { OfflineOnlineService, setOnlineService } from './game/online/OnlinePorts';

installDevTelemetry();
// Before the game exists: quality, locale and mixer levels are read by the first scene.
applyRuntimeSettings(loadProfile().settings);
// No backend is configured: the offline adapter serves this device's own daily board.
setOnlineService(new OfflineOnlineService(() => loadProfile().daily));
const game = new Phaser.Game(gameConfig);
installGamepadBridge(game);

// Measure how much of the screen the canvas covers, on boot and after every rotation.
setTimeout(() => reportViewport('boot'), 1500);
let viewportReport: ReturnType<typeof setTimeout>;
window.addEventListener('resize', () => {
  clearTimeout(viewportReport);
  viewportReport = setTimeout(() => reportViewport('resize'), 400);
});

if ('serviceWorker' in navigator && import.meta.env.PROD)
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((registration) => registration.update());
  });
