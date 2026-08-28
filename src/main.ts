import Phaser from 'phaser';
import './style.css';
import { gameConfig } from './game/config/GameConfig';
import { installDevTelemetry, reportViewport } from './game/systems/DevTelemetry';

installDevTelemetry();
new Phaser.Game(gameConfig);

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
