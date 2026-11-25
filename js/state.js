import * as THREE from 'three';
import { CONFIG, WEAPONS } from './config.js';

/* ---------------- Spieler ---------------- */
export const player = {
  pos: new THREE.Vector3(0, 0, 8), vel: new THREE.Vector3(), yaw: 0, pitch: 0, vy: 0, onGround: true,
  hp: CONFIG.playerMaxHp, kills: 0, dead: false, weapon: 0, fireCd: 0, reloadT: 0, reloading: false, recoilKick: 0, bob: 0,
  ammo: WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve })), shake: 0,
};


export const S = { running: false, paused: false, editMode: false, won: false, autoFire: false, killsTotal: 0, bodyModel: null }; // geteilter, veraenderlicher Spielzustand
