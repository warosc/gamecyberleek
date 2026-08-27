import Phaser from 'phaser';
import './style.css';
import { gameConfig } from './game/config/GameConfig';
new Phaser.Game(gameConfig);

if ('serviceWorker' in navigator && import.meta.env.PROD)
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
