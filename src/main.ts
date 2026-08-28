import Phaser from 'phaser';
import './style.css';
import { gameConfig } from './game/config/GameConfig';
import { installDevTelemetry } from './game/systems/DevTelemetry';

installDevTelemetry();
new Phaser.Game(gameConfig);

if ('serviceWorker' in navigator && import.meta.env.PROD)
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
