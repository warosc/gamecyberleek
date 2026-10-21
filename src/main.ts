import Phaser from 'phaser';
import './style.css';
import { gameConfig } from './game/config/GameConfig';
import { installDevTelemetry, reportViewport } from './game/systems/DevTelemetry';
import { loadProfile } from './game/systems/ProfileStore';
import { applyRuntimeSettings } from './game/systems/RuntimeSettings';
import { installGamepadBridge } from './game/input/GamepadBridge';
import { setMusicLightweight } from './game/managers/AudioManager';
import { detectQualityProfile } from './game/config/QualityProfile';
import { OfflineOnlineService, setOnlineService } from './game/online/OnlinePorts';
import { RestOnlineService } from './game/online/RestOnlineService';
import { flushDailyRuns } from './game/online/OnlineSync';
import { onlineService } from './game/online/OnlinePorts';
import { ensureOperative } from './game/systems/ProfileStore';

installDevTelemetry();
// Before the game exists: quality, locale and mixer levels are read by the first scene.
applyRuntimeSettings(loadProfile().settings);
setMusicLightweight(detectQualityProfile().tier === 'low');
// With the online API configured (normally the same-origin `/api` the game's nginx forwards to
// PostgREST) the game uses it; otherwise the offline adapter serves this device's own daily
// board. Either way core play never waits on the network.
const onlineUrl = import.meta.env.VITE_ONLINE_URL as string | undefined;
setOnlineService(onlineUrl
  ? new RestOnlineService(onlineUrl, ensureOperative)
  : new OfflineOnlineService(() => loadProfile().daily));
// Scores a dropped connection left behind get another chance at startup.
void flushDailyRuns(onlineService());
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
