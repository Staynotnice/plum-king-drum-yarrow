import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createAudio } from "@/game/audio";
import type { ControlsProbe, GameApi, GameHooks, HudTarget, Phase, TouchInput } from "@/game/types";

const EYE = 1.62;
const STEP = 1 / 60;
const MAG_SIZE = 18;
type GunId = "sidearm" | "hawser" | "keel" | "gale";
const GUNS: Record<
  GunId,
  {
    name: string;
    cost: number;
    mag: number;
    reserve: number;
    delay: number;
    dmg: number;
    hs: number;
    spread: number;
    pellets: number;
    reload: number;
    kick: number;
    spray: number;
  }
> = {
  sidearm: {
    name: "Salt Iron",
    cost: 0,
    mag: MAG_SIZE,
    reserve: 72,
    delay: 0.12,
    dmg: 30,
    hs: 52,
    spread: 0.011,
    pellets: 1,
    reload: 1.15,
    kick: 0.02,
    spray: 0.18,
  },
  hawser: {
    name: "Hawser 12",
    cost: 500,
    mag: 6,
    reserve: 30,
    delay: 0.55,
    dmg: 15,
    hs: 15,
    spread: 0.078,
    pellets: 6,
    reload: 1.8,
    kick: 0.052,
    spray: 0.42,
  },
  keel: {
    name: "Keel",
    cost: 1200,
    mag: 30,
    reserve: 120,
    delay: 0.078,
    dmg: 24,
    hs: 42,
    spread: 0.0045,
    pellets: 1,
    reload: 1.4,
    kick: 0.011,
    spray: 0.08,
  },
  gale: {
    name: "Gale",
    cost: 1800,
    mag: 24,
    reserve: 96,
    delay: 0.068,
    dmg: 17,
    hs: 30,
    spread: 0.015,
    pellets: 1,
    reload: 1.22,
    kick: 0.013,
    spray: 0.2,
  },
};
const BARGE_SCORE = 600;
const SAVE_KEY = "saltwatch-save";
const PLAYER_R = 0.38;

type Save = { v: 1; best: number; sens: number; muted: boolean };
type Solid = { minX: number; maxX: number; minZ: number; maxZ: number; off?: boolean };
type Enemy = {
  bull: boolean;
  alive: boolean;
  hp: number;
  speed: number;
  x: number;
  z: number;
  phaseAnim: number;
  attackCd: number;
  flash: number;
  hitR: number;
  dmg: number;
  group: THREE.Group;
  skin: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
  baseEmissive: THREE.Color;
  headEmissive: THREE.Color;
  hips: THREE.Group;
  chest: THREE.Group;
  shinL: THREE.Object3D;
  shinR: THREE.Object3D;
  limp: number;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  foreL: THREE.Object3D;
  foreR: THREE.Object3D;
};
type Bit = {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
};
type Tracer = { line: THREE.Line; life: number };
type Vial = { mesh: THREE.Mesh; x: number; z: number; alive: boolean; t: number };

function loadSave(): Save {
  const blank: Save = { v: 1, best: 0, sens: 1, muted: false };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return blank;
    const j = JSON.parse(raw) as Partial<Save>;
    if (j.v !== 1) return blank;
    return {
      v: 1,
      best: typeof j.best === "number" ? j.best : 0,
      sens: typeof j.sens === "number" ? Math.min(2, Math.max(0.5, j.sens)) : 1,
      muted: Boolean(j.muted),
    };
  } catch {
    return blank;
  }
}

function radial(x: number, y: number, dz = 0.16) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (!g) return new THREE.CanvasTexture(c);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,226,180,1)");
  grd.addColorStop(0.35, "rgba(232,160,74,0.55)");
  grd.addColorStop(1, "rgba(232,160,74,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function mountGame(
  canvas: HTMLCanvasElement,
  touch: TouchInput,
  hud: { current: HudTarget },
  hooks: GameHooks,
): GameApi {
  const save = loadSave();
  let best = save.best;
  let sensScale = save.sens;
  let muted = save.muted;
  const audio = createAudio();
  audio.setMuted(muted);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (err) {
    hooks.onError(err instanceof Error ? err.message : "WebGL is unavailable.");
    return {
      dispose() {},
      start() {},
      pause() {},
      resume() {},
      title() {},
      requestLock() {},
      setMuted() {},
      setSens() {},
    };
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.setClearColor(0x07110e, 1);
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07110e);
  scene.fog = new THREE.FogExp2(0x0c1a16, 0.018);
  const viewScene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(75, 1, 0.08, 180);
  const yawGroup = new THREE.Group();
  yawGroup.add(camera);
  scene.add(yawGroup);
  const viewCamera = new THREE.PerspectiveCamera(75, 1, 0.05, 12);

  const hemi = new THREE.HemisphereLight(0xd5e4f0, 0x2a4036, 2.4);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xe7f0f8, 16);
  moon.position.set(24, 36, 14);
  scene.add(moon);
  scene.add(new THREE.AmbientLight(0x243830, 0.85));

  const shotLight = new THREE.PointLight(0xffc48a, 0, 8, 2);
  shotLight.position.set(0, 0, -0.45);
  camera.add(shotLight);
  const beam = new THREE.SpotLight(0xffe2bc, 90, 26, 0.48, 0.4, 1.2);
  beam.position.set(0.05, -0.05, 0);
  const beamTarget = new THREE.Object3D();
  beamTarget.position.set(0, -0.12, -8);
  camera.add(beamTarget);
  beam.target = beamTarget;
  camera.add(beam);

  function trackGeo(g: THREE.BufferGeometry) {
    geos.add(g);
    return g;
  }
  function trackMat<T extends THREE.Material>(m: T) {
    mats.add(m);
    return m;
  }
  function addMesh(mesh: THREE.Mesh) {
    trackGeo(mesh.geometry);
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) mats.add(m);
    scene.add(mesh);
    return mesh;
  }

  const texes = new Set<THREE.Texture>();
  const loader = new THREE.TextureLoader();
  function surfaced(
    url: string,
    rx: number,
    ry: number,
    roughness: number,
    metalness: number,
    fallback: number,
    clearcoat = 0,
    keepTint = false,
  ) {
    const mat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: fallback,
        roughness,
        metalness,
        clearcoat,
        clearcoatRoughness: 0.45,
      }),
    );
    const map = loader.load(url, () => {
      if (!keepTint) mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
    });
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(rx, ry);
    map.anisotropy = 8;
    mat.map = map;
    texes.add(map);
    return mat;
  }

  const floorMat = surfaced("/textures/deck-wood.jpg", 10, 10, 0.68, 0.02, 0x6a5340, 0.1);
  const wallMat = surfaced("/textures/ship-plate.jpg", 2.4, 1.15, 0.52, 0.18, 0x8e9aa4);
  const pumpMat = surfaced("/textures/ship-plate.jpg", 1.5, 1.15, 0.48, 0.2, 0x7d8c96);
  const woodMat = surfaced("/textures/deck-wood.jpg", 2, 2, 0.64, 0.02, 0x5a4332, 0.06);
  const hullMat = surfaced("/textures/ship-plate.jpg", 1.8, 1.1, 0.5, 0.16, 0xb7aea4);
  const darkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1a201c, roughness: 0.62, metalness: 0.35 }));
  const brassMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xc4893a, roughness: 0.32, metalness: 0.78 }));
  const rustMat = surfaced("/textures/steel.jpg", 1, 1, 0.66, 0.16, 0xc45a3a, 0, true);
  pumpMat.emissive = new THREE.Color(0x1a2428);
  pumpMat.emissiveIntensity = 0.16;
  wallMat.emissive = new THREE.Color(0x161e22);
  wallMat.emissiveIntensity = 0.14;
  const saltMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 1, metalness: 0 }));
  const lampMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe8a04a, emissive: 0xe8a04a, emissiveIntensity: 1.1, roughness: 0.35 }),
  );
  const flashMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffe2b8 }));

  function painted(
    draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
    rough: number,
    metal: number,
  ) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const g = c.getContext("2d");
    if (g) draw(g, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    texes.add(tex);
    const mat = trackMat(
      new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: rough, metalness: metal }),
    );
    mat.emissive = new THREE.Color(0x1a1814);
    mat.emissiveIntensity = 0.22;
    return mat;
  }
  const caseMat = painted((g, w, h) => {
    g.fillStyle = "#1c2632";
    g.fillRect(0, 0, w, h);
    const cols = ["#e0b15e", "#3d7c98", "#8a4e78", "#a86a38", "#2c4458", "#d47858"];
    for (let i = 0; i < 42; i++) {
      g.globalAlpha = 0.5;
      g.fillStyle = cols[i % cols.length]!;
      g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 16 + Math.random() * 48, 8 + Math.random() * 24, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 0.65;
    g.strokeStyle = "#f0e2c4";
    g.lineWidth = 1;
    for (let i = 0; i < 28; i++) {
      const y = Math.random() * h;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + (Math.random() - 0.5) * 10);
      g.stroke();
    }
    g.globalAlpha = 1;
  }, 0.36, 0.74);
  const shotMat = painted((g, w, h) => {
    g.fillStyle = "#4a463f";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      g.strokeStyle = y % 6 === 0 ? "#2e2c28" : "#6a6458";
      g.globalAlpha = 0.55;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + Math.sin(y) * 2);
      g.stroke();
    }
    g.globalAlpha = 0.35;
    g.fillStyle = "#8a5a32";
    g.fillRect(0, h * 0.7, w, h * 0.3);
    g.globalAlpha = 1;
  }, 0.48, 0.55);
  const parkMat = painted((g, w, h) => {
    g.fillStyle = "#2a2c2a";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = i % 3 === 0 ? "#3e423c" : "#1a1c1a";
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.strokeStyle = "#8a8e86";
    g.globalAlpha = 0.35;
    for (let i = 0; i < 16; i++) {
      g.beginPath();
      g.moveTo(Math.random() * w, Math.random() * h);
      g.lineTo(Math.random() * w, Math.random() * h);
      g.stroke();
    }
    g.globalAlpha = 1;
  }, 0.72, 0.34);
  const nickelMat = painted((g, w, h) => {
    g.fillStyle = "#c5ccd0";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      g.strokeStyle = y % 4 === 0 ? "#9aa3a8" : "#e7eef2";
      g.globalAlpha = 0.7;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.globalAlpha = 0.3;
    g.fillStyle = "#6a5538";
    for (let i = 0; i < 8; i++) g.fillRect(Math.random() * w, Math.random() * h, 40, 3);
    g.globalAlpha = 1;
  }, 0.32, 0.82);
  const walnutMat = painted((g, w, h) => {
    g.fillStyle = "#6b3b1e";
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 5) {
      g.strokeStyle = x % 10 === 0 ? "#3d2412" : "#8a5530";
      g.globalAlpha = 0.8;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 8, h * 0.3, x - 6, h * 0.7, x + 4, h);
      g.stroke();
    }
    g.globalAlpha = 0.55;
    g.strokeStyle = "#24140c";
    g.lineWidth = 1.5;
    for (let i = -h; i < w + h; i += 16) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + h, h);
      g.moveTo(w - i, 0);
      g.lineTo(w - i - h, h);
      g.stroke();
    }
    g.globalAlpha = 1;
  }, 0.58, 0.06);
  const beadMat = painted((g, w, h) => {
    g.fillStyle = "#d9c7a4";
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 28) {
      g.fillStyle = "#b9a588";
      g.fillRect(x, 0, 3, h);
      g.fillStyle = "#efe2c8";
      g.fillRect(x + 3, 0, 2, h);
    }
    g.globalAlpha = 0.15;
    g.fillStyle = "#6a5840";
    for (let i = 0; i < 12; i++) g.fillRect(Math.random() * w, Math.random() * h, 30, 8);
    g.globalAlpha = 1;
  }, 0.78, 0.02);
  const blanketMat = painted((g, w, h) => {
    g.fillStyle = "#1c3358";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#e6d7b8";
    g.fillRect(0, h * 0.42, w, h * 0.12);
    g.globalAlpha = 0.25;
    g.strokeStyle = "#0e1c30";
    for (let y = 0; y < h; y += 6) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.globalAlpha = 1;
  }, 0.92, 0);
  const rugMat = painted((g, w, h) => {
    g.fillStyle = "#7a2a2a";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3a1414";
    g.fillRect(0, 0, w, 18);
    g.fillRect(0, h - 18, w, 18);
    g.fillRect(0, 0, 18, h);
    g.fillRect(w - 18, 0, 18, h);
    g.globalAlpha = 0.3;
    g.fillStyle = "#c47a6a";
    for (let i = 0; i < 20; i++) g.fillRect(20 + Math.random() * (w - 40), 20 + Math.random() * (h - 40), 28, 10);
    g.globalAlpha = 1;
  }, 0.95, 0);
  walnutMat.emissiveIntensity = 0.12;
  beadMat.emissiveIntensity = 0.18;
  blanketMat.emissiveIntensity = 0.12;

  function labelTexture(title: string, price: string) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#140e08";
      g.fillRect(0, 0, 512, 256);
      g.strokeStyle = "#e8a04a";
      g.lineWidth = 12;
      g.strokeRect(14, 14, 484, 228);
      g.fillStyle = "#f4efe4";
      g.font = "600 46px sans-serif";
      g.textAlign = "center";
      g.fillText(title, 256, 108);
      g.fillStyle = "#e8a04a";
      g.font = "700 62px sans-serif";
      g.fillText(price, 256, 186);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    texes.add(tex);
    return tex;
  }

  function buildFirearm(kind: GunId, metal: THREE.Material, wood: THREE.Material) {
    const root = new THREE.Group();
    const add = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0,
    ) => {
      const mesh = new THREE.Mesh(geo, mat);
      trackGeo(geo);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      root.add(mesh);
      return mesh;
    };
    const box = (w: number, h: number, d: number, rad = 0.008) =>
      new RoundedBoxGeometry(w, h, d, 2, Math.min(rad, w * 0.4, h * 0.4, d * 0.4));
    let muzzleZ = -0.26;
    if (kind === "sidearm") {
      add(box(0.05, 0.058, 0.2, 0.01), metal, 0, 0.02, -0.02);
      add(new THREE.CylinderGeometry(0.011, 0.013, 0.14, 12), metal, 0, 0.028, -0.16, -Math.PI / 2);
      add(box(0.04, 0.12, 0.05, 0.01), wood, 0, -0.07, 0.05, 0.32);
      add(new THREE.TorusGeometry(0.026, 0.004, 6, 12, Math.PI), metal, 0, -0.012, 0.01, 0, 0, Math.PI);
      muzzleZ = -0.25;
    } else if (kind === "hawser") {
      add(box(0.072, 0.082, 0.28, 0.012), metal, 0, 0.012, 0.02);
      add(new THREE.CylinderGeometry(0.016, 0.018, 0.64, 12), metal, 0, 0.03, -0.4, -Math.PI / 2);
      add(new THREE.CylinderGeometry(0.03, 0.032, 0.16, 12), wood, 0, 0.022, -0.2, -Math.PI / 2);
      add(box(0.058, 0.07, 0.3, 0.012), wood, 0, -0.008, 0.28, 0.16);
      add(box(0.042, 0.1, 0.046, 0.008), wood, 0, -0.06, 0.08, 0.4);
      muzzleZ = -0.74;
    } else if (kind === "gale") {
      add(box(0.048, 0.064, 0.2, 0.008), metal, 0, 0.02, -0.02);
      add(new THREE.CylinderGeometry(0.011, 0.012, 0.2, 12), metal, 0, 0.03, -0.2, -Math.PI / 2);
      add(box(0.028, 0.14, 0.04, 0.004), metal, 0, -0.08, 0.02);
      add(box(0.036, 0.1, 0.042, 0.008), wood, 0, -0.05, 0.07, 0.28);
      add(box(0.02, 0.04, 0.16, 0.004), metal, 0.03, 0.01, 0.16);
      muzzleZ = -0.32;
    } else {
      add(box(0.055, 0.068, 0.34, 0.01), metal, 0, 0.016, 0.02);
      add(new THREE.CylinderGeometry(0.012, 0.014, 0.52, 12), metal, 0, 0.032, -0.36, -Math.PI / 2);
      add(box(0.042, 0.046, 0.22, 0.008), wood, 0, 0.014, -0.14);
      add(box(0.032, 0.11, 0.04, 0.006), metal, 0, -0.06, 0.02);
      add(box(0.046, 0.06, 0.28, 0.01), wood, 0, 0.002, 0.3, 0.1);
      add(box(0.012, 0.035, 0.012, 0.002), metal, 0, 0.06, -0.58);
      muzzleZ = -0.64;
    }
    const flash = add(new THREE.SphereGeometry(kind === "hawser" ? 0.05 : 0.032, 8, 6), flashMat, 0, 0.03, muzzleZ);
    flash.visible = false;
    root.userData.flash = flash;
    return root;
  }

  const solids: Solid[] = [];
  const blockers: THREE.Object3D[] = [];

  function solidBox(
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    solid = false,
    radius = 0.08,
  ) {
    const rad = Math.max(0.01, Math.min(radius, w * 0.22, h * 0.22, d * 0.22));
    const mesh = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(w, h, d, 3, rad)), mat));
    mesh.position.set(cx, cy, cz);
    if (solid) {
      solids.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      blockers.push(mesh);
    }
    return mesh;
  }

  solidBox(0, -0.28, 0, 40, 0.56, 40, floorMat, false, 0.04);
  const railH = 1.05;
  const railY = railH / 2;
  const edge = 16.7;
  solidBox(-9.45, railY, -edge, 15.3, railH, 0.85, wallMat, true, 0.06);
  solidBox(9.45, railY, -edge, 15.3, railH, 0.85, wallMat, true, 0.06);
  const gateSolid: Solid = { minX: -1.7, maxX: 1.7, minZ: -edge - 0.42, maxZ: -edge + 0.42 };
  solids.push(gateSolid);
  solidBox(0, railY, edge, 34.2, railH, 0.85, wallMat, true, 0.06);
  solidBox(-edge, railY, 0, 0.85, railH, 34.2, wallMat, true, 0.06);
  solidBox(edge, railY, 0, 0.85, railH, 34.2, wallMat, true, 0.06);
  for (const [x, z] of [
    [-edge, -edge],
    [edge, -edge],
    [-edge, edge],
    [edge, edge],
  ] as const) {
    solidBox(x, 1.35, z, 0.7, 2.7, 0.7, pumpMat, false);
  }

  solidBox(0, 1.7, 0, 5.2, 3.4, 5.2, pumpMat, true, 0.28);
  solidBox(0, 3.5, 0, 5.7, 0.28, 5.7, darkMat, false);
  solidBox(0, 1.15, 2.68, 1.15, 2.15, 0.12, darkMat, false);
  solidBox(0, 2.35, 2.72, 0.55, 0.38, 0.08, lampMat, false);
  const chimney = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.5, 8), rustMat));
  chimney.position.set(-1.5, 4.3, -1.3);
  const tank = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.7, 12), brassMat));
  tank.position.set(4.5, 0.85, -1.1);
  solids.push({ minX: 3.5, maxX: 5.5, minZ: -2.1, maxZ: -0.1 });
  blockers.push(tank);
  const pipe = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 8), rustMat));
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(3.1, 1.15, -1.1);

  const crates: Array<[number, number, number]> = [
    [-7.2, 6.4, 1.25],
    [7.6, 4.4, 1.45],
    [-8.6, -2.2, 1.15],
    [6.3, -6.6, 1.35],
    [-3.6, -8.6, 1.05],
    [11.2, -1.2, 1.2],
    [-12.2, 8.6, 1.15],
    [4.2, 10.2, 1.25],
  ];
  for (const [x, z, s] of crates) {
    const h = 0.7 + s * 0.45;
    solidBox(x, h / 2, z, s, h, s * 0.85, woodMat, true, 0.07);
  }
  solidBox(5.6, 0.55, 10.2, 0.45, 1.1, 0.45, darkMat, true);
  solidBox(-5.6, 0.55, 10.2, 0.45, 1.1, 0.45, darkMat, true);

  for (const [x, z] of [
    [-6, 4],
    [8, -8],
    [-10, -7],
    [2, -5],
  ] as const) {
    const pile = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), saltMat));
    pile.position.set(x, 0.18, z);
    pile.scale.set(1.3, 0.35, 1);
  }

  const ring = addMesh(new THREE.Mesh(new THREE.RingGeometry(3.15, 3.42, 48), trackMat(new THREE.MeshBasicMaterial({ color: 0xe8a04a, transparent: true, opacity: 0.45, side: THREE.DoubleSide }))));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;

  const gateGroup = new THREE.Group();
  scene.add(gateGroup);
  const gateDoor = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(3.15, 1.7, 0.28, 3, 0.06)), wallMat);
  gateDoor.position.y = 0.95;
  gateGroup.add(gateDoor);
  gateGroup.position.set(0, 0, -edge);
  const plaqueCanvas = document.createElement("canvas");
  plaqueCanvas.width = 512;
  plaqueCanvas.height = 256;
  const plaqueG = plaqueCanvas.getContext("2d");
  if (plaqueG) {
    plaqueG.fillStyle = "#140e08";
    plaqueG.fillRect(0, 0, 512, 256);
    plaqueG.strokeStyle = "#e8a04a";
    plaqueG.lineWidth = 14;
    plaqueG.strokeRect(16, 16, 480, 224);
    plaqueG.fillStyle = "#f4efe4";
    plaqueG.font = "600 64px sans-serif";
    plaqueG.textAlign = "center";
    plaqueG.fillText("BARGE", 256, 110);
    plaqueG.fillStyle = "#e8a04a";
    plaqueG.font = "700 72px sans-serif";
    plaqueG.fillText("600 PTS", 256, 190);
  }
  const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
  plaqueTex.colorSpace = THREE.SRGBColorSpace;
  texes.add(plaqueTex);
  const plaque = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(1.5, 0.75)),
    trackMat(new THREE.MeshBasicMaterial({ map: plaqueTex })),
  );
  plaque.position.set(0, 1.15, 0.16);
  gateGroup.add(plaque);

  const pier = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(3.6, 0.22, 6.4, 3, 0.06)), woodMat));
  pier.position.set(0, 0.08, -20.2);
  const bollardMat = darkMat;
  for (const [bx, bz] of [
    [-1.15, -17.6],
    [1.15, -17.6],
    [-1.15, -22.6],
    [1.15, -22.6],
  ] as const) {
    const bollard = addMesh(new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 10)), bollardMat));
    bollard.position.set(bx, 0.4, bz);
  }

  const hull = addMesh(new THREE.Mesh(trackGeo(new THREE.SphereGeometry(1, 28, 18)), hullMat));
  hull.scale.set(3.15, 1.05, 6.1);
  hull.position.set(0, -0.35, -28.2);
  const bow = addMesh(new THREE.Mesh(trackGeo(new THREE.SphereGeometry(1, 20, 14)), hullMat));
  bow.scale.set(1.7, 0.72, 2.1);
  bow.position.set(0, -0.05, -33.4);
  const bargeDeck = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(5.6, 0.24, 10.4, 3, 0.08)), woodMat));
  bargeDeck.position.set(0, 0.2, -28.1);
  const cabinY = 1.05;
  const cabinWall = (cx: number, cz: number, w: number, d: number) => {
    const mesh = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(w, 1.65, d, 2, 0.05)), pumpMat));
    mesh.position.set(cx, cabinY, cz);
    return mesh;
  };
  cabinWall(-1.0, -29.35, 0.32, 2.9);
  cabinWall(1.0, -29.35, 0.32, 2.9);
  cabinWall(0, -30.7, 2.3, 0.28);
  const cabinRoof = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(2.7, 0.14, 3.2, 2, 0.04)), darkMat));
  cabinRoof.position.set(0, 1.9, -29.35);
  solids.push({ minX: -1.2, maxX: -0.8, minZ: -30.8, maxZ: -27.9 });
  solids.push({ minX: 0.8, maxX: 1.2, minZ: -30.8, maxZ: -27.9 });
  solids.push({ minX: -1.2, maxX: 1.2, minZ: -30.9, maxZ: -30.5 });
  const cabinWinMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x9fd4e0, emissive: 0x123038, emissiveIntensity: 0.4, roughness: 0.08, metalness: 0.1 }),
  );
  const cabinWin = addMesh(new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.1, 0.45)), cabinWinMat));
  cabinWin.position.set(0, 1.25, -30.52);
  const funnel = addMesh(new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.28, 0.34, 1.15, 12)), rustMat));
  funnel.position.set(-0.85, 2.45, -30.2);
  const wheel = addMesh(new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.28, 0.04, 8, 16)), brassMat));
  wheel.position.set(0, 1.2, -28.55);
  for (const side of [-2.55, 2.55]) {
    const rail = addMesh(new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 8.6, 8)), darkMat));
    rail.rotation.x = Math.PI / 2;
    rail.position.set(side, 0.85, -28);
    for (let i = 0; i < 5; i++) {
      const post = addMesh(new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.035, 0.04, 0.7, 6)), darkMat));
      post.position.set(side, 0.55, -24.2 - i * 1.9);
    }
  }
  const lockerMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe8a04a, emissive: 0xe8a04a, emissiveIntensity: 0.85, roughness: 0.35, metalness: 0.4 }),
  );
  const lockerMesh = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(0.42, 0.55, 0.32, 2, 0.04)), lockerMat));
  lockerMesh.position.set(0, 0.5, -29.15);
  const bargeLight = new THREE.PointLight(0xe8a04a, 18, 16, 2);
  bargeLight.position.set(0, 2.4, -28);
  scene.add(bargeLight);

  const aftDeck = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(8.8, 0.24, 10.4, 3, 0.06)), woodMat));
  aftDeck.position.set(0, 0.2, -36.6);
  const aftHull = addMesh(new THREE.Mesh(trackGeo(new THREE.SphereGeometry(1, 24, 16)), hullMat));
  aftHull.scale.set(4.6, 0.82, 5.5);
  aftHull.position.set(0, -0.42, -36.4);
  solidBox(-2.15, 1.25, -36.35, 2.3, 2.5, 0.28, wallMat, true, 0.05);
  solidBox(2.15, 1.25, -36.35, 2.3, 2.5, 0.28, wallMat, true, 0.05);
  solidBox(-3.4, 1.25, -38.85, 0.28, 2.5, 5.1, wallMat, true, 0.04);
  solidBox(3.4, 1.25, -38.85, 0.28, 2.5, 5.1, wallMat, true, 0.04);
  solidBox(0, 1.25, -41.25, 6.9, 2.5, 0.28, wallMat, true, 0.05);
  const armoryRoof = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(6.9, 0.16, 5.2, 2, 0.04)), darkMat));
  armoryRoof.position.set(0, 2.52, -38.85);
  const armoryLight = new THREE.PointLight(0xffe2c0, 40, 14, 2);
  armoryLight.position.set(0, 2.15, -38.7);
  scene.add(armoryLight);
  solidBox(-2.35, 0.4, -39.3, 0.7, 0.75, 0.7, woodMat, true, 0.06);
  for (const side of [-3.15, 3.15] as const) {
    const rail = addMesh(new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 8.2, 8)), darkMat));
    rail.rotation.x = Math.PI / 2;
    rail.position.set(side, 0.85, -36.4);
  }

  function mountGun(kind: GunId, x: number, y: number, z: number, rotY: number, title: string, price: string) {
    const board = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(1.45, 1.2, 0.08, 2, 0.02)), darkMat));
    board.position.set(x, y, z);
    board.rotation.y = rotY;
    blockers.push(board);
    const metal = kind === "keel" ? parkMat : kind === "hawser" ? shotMat : kind === "gale" ? nickelMat : caseMat;
    const model = buildFirearm(kind, metal, walnutMat);
    (model.userData.flash as THREE.Mesh).visible = false;
    model.scale.setScalar(1.35);
    model.position.set(0, 0.08, 0.14);
    model.rotation.y = Math.PI / 2;
    board.add(model);
    const sign = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(0.95, 0.46)),
      trackMat(new THREE.MeshBasicMaterial({ map: labelTexture(title, price) })),
    );
    sign.position.set(0, -0.68, 0.06);
    board.add(sign);
  }
  mountGun("hawser", 14.7, 1.5, 4.6, -Math.PI / 2, "HAWSER 12", "500");
  mountGun("keel", 0, 1.45, -40.82, 0, "KEEL", "1200");
  solids.push({ minX: 14.4, maxX: 15.15, minZ: 3.85, maxZ: 5.35 });

  const berthDeck = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(13.2, 0.24, 18.4, 3, 0.05)), woodMat));
  berthDeck.position.set(0, 0.18, -54.4);
  const berthHull = addMesh(new THREE.Mesh(trackGeo(new THREE.SphereGeometry(1, 22, 14)), hullMat));
  berthHull.scale.set(6.4, 0.7, 8.6);
  berthHull.position.set(0, -0.55, -54);
  const berthSolid: Solid = { minX: -0.95, maxX: 0.95, minZ: -47.95, maxZ: -47.45 };
  const bunkSolid: Solid = { minX: -4.3, maxX: 4.3, minZ: -55.15, maxZ: -54.7 };
  solids.push(berthSolid, bunkSolid);
  solidBox(-2.75, 1.25, -47.7, 3.3, 2.5, 0.28, hullMat, true, 0.04);
  solidBox(2.75, 1.25, -47.7, 3.3, 2.5, 0.28, hullMat, true, 0.04);
  solidBox(0, 4.15, -47.7, 8.9, 2.5, 0.28, hullMat, true, 0.04);
  solidBox(-4.5, 2.7, -54.05, 0.28, 5.4, 12.7, hullMat, true, 0.04);
  solidBox(4.5, 2.7, -54.05, 0.28, 5.4, 12.7, hullMat, true, 0.04);
  solidBox(0, 2.7, -60.4, 9, 5.4, 0.28, hullMat, true, 0.04);
  solidBox(1.35, 1.25, -54.15, 6.2, 2.5, 0.26, beadMat, true, 0.04);
  const loftSlab = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(8.7, 0.16, 6.2, 2, 0.03)), woodMat));
  loftSlab.position.set(0, 2.95, -57.3);
  const berthRoof = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(9.3, 0.18, 13.2, 2, 0.04)), darkMat));
  berthRoof.position.set(0, 5.5, -54.05);
  const berthDoor = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(1.7, 2.2, 0.12, 2, 0.03)), walnutMat));
  berthDoor.position.set(0, 1.15, -47.52);
  const bunkDoor = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(1.8, 2.05, 0.12, 2, 0.03)), walnutMat));
  bunkDoor.position.set(0, 4.05, -54.92);
  const berthSign = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(1.1, 0.48)),
    trackMat(new THREE.MeshBasicMaterial({ map: labelTexture("BERTH", "900") })),
  );
  berthSign.position.set(0, 2.15, -47.32);
  scene.add(berthSign);
  const bunkSign = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(1.1, 0.48)),
    trackMat(new THREE.MeshBasicMaterial({ map: labelTexture("BUNK", "1400") })),
  );
  bunkSign.position.set(-2.15, 4.55, -54.55);
  scene.add(bunkSign);
  for (let i = 0; i < 7; i++) {
    const rise = 0.28 + i * 0.4;
    addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(1.45, rise, 0.42, 1, 0.02)), woodMat)).position.set(
      -3.15,
      rise / 2,
      -51.2 - i * 0.42,
    );
  }
  const groundLight = new THREE.PointLight(0xffe2c0, 28, 12, 2);
  groundLight.position.set(1.2, 2.3, -50.5);
  scene.add(groundLight);
  const loftLight = new THREE.PointLight(0xffd7a8, 26, 10, 2);
  loftLight.position.set(0, 5.1, -57.4);
  scene.add(loftLight);
  solidBox(1.4, 0.75, -50.2, 1.4, 0.7, 0.8, beadMat, true, 0.05);
  const barrel = addMesh(new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.34, 0.7, 12)), walnutMat));
  barrel.position.set(-1.3, 0.45, -49.4);
  const rug = addMesh(new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(3.2, 4.2)), rugMat));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.2, 3.05, -57.6);
  for (const bx of [-2.15, 2.15]) {
    const frame = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(1.5, 0.28, 2.2, 2, 0.04)), woodMat));
    frame.position.set(bx, 3.2, -58.1);
    const mattress = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(1.35, 0.16, 2.0, 2, 0.04)), blanketMat));
    mattress.position.set(bx, 3.4, -58.1);
    const pillow = addMesh(new THREE.Mesh(trackGeo(new RoundedBoxGeometry(0.7, 0.12, 0.38, 2, 0.04)), beadMat));
    pillow.position.set(bx, 3.52, -57.25);
  }
  const porthole = addMesh(new THREE.Mesh(trackGeo(new THREE.CircleGeometry(0.32, 16)), cabinWinMat));
  porthole.position.set(-4.32, 4.15, -57.2);
  porthole.rotation.y = Math.PI / 2;
  mountGun("gale", 0, 4.25, -59.95, 0, "GALE", "1800");

  const waterUniforms = { uTime: { value: 0 } };
  const waterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0c4e56,
      roughness: 0.18,
      metalness: 0.22,
      transparent: true,
      opacity: 0.92,
    }),
  );
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader =
      "uniform float uTime;\nvarying vec2 vSaltUv;\n" +
      shader.vertexShader
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           float w1 = sin(position.x * 0.55 + uTime * 1.25);
           float w2 = cos(position.y * 0.4 - uTime * 0.9);
           float w3 = sin((position.x + position.y) * 1.2 + uTime * 1.7);
           transformed.z += w1 * 0.2 + w2 * 0.13 + w3 * 0.05;
           vSaltUv = position.xy;`,
        )
        .replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
           objectNormal.x += sin(position.x * 0.55 + uTime * 1.25) * 0.55;
           objectNormal.y += cos(position.y * 0.4 - uTime * 0.9) * 0.55;`,
        );
    shader.fragmentShader =
      "uniform float uTime;\nvarying vec2 vSaltUv;\n" +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         float ripple = sin(vSaltUv.x * 0.8 + uTime * 1.35) * cos(vSaltUv.y * 0.62 - uTime * 0.8);
         float crest = pow(max(0.0, ripple), 3.0);
         vec3 deep = vec3(0.012, 0.07, 0.09);
         vec3 shoal = vec3(0.04, 0.20, 0.22);
         diffuseColor.rgb = mix(deep, shoal, ripple * 0.5 + 0.5);
         diffuseColor.rgb += vec3(0.55, 0.75, 0.72) * crest * 0.4;`,
      );
  };
  waterMat.customProgramCacheKey = () => "salt-water-3";
  const water = addMesh(new THREE.Mesh(new THREE.PlaneGeometry(180, 180, 80, 80), waterMat));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.55;

  const moonMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xf3ecdf }));
  moonMat.fog = false;
  const moonMesh = addMesh(new THREE.Mesh(new THREE.SphereGeometry(5.5, 24, 16), moonMat));
  moonMesh.position.set(30, 26, -40);

  const starPositions = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.45;
    const r = 70 + Math.random() * 30;
    starPositions[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
    starPositions[i * 3 + 1] = Math.cos(phi) * r * 0.7 + 8;
    starPositions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
  }
  const starGeo = trackGeo(new THREE.BufferGeometry());
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMat = trackMat(new THREE.PointsMaterial({ color: 0xf4efe4, size: 0.55, sizeAttenuation: true }));
  starMat.fog = false;
  scene.add(new THREE.Points(starGeo, starMat));

  const lampLights: THREE.PointLight[] = [];
  const glowTex = glowTexture();
  function lamp(x: number, z: number, intensity: number) {
    solidBox(x, 1.5, z, 0.12, 3, 0.12, darkMat, false);
    solidBox(x, 3.05, z, 0.45, 0.18, 0.45, brassMat, false);
    const bulb = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lampMat));
    bulb.position.set(x, 3.02, z);
    const sprite = new THREE.Sprite(
      trackMat(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xe8a04a,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    sprite.position.set(x, 3.05, z);
    sprite.scale.set(2.4, 2.4, 1);
    scene.add(sprite);
    const light = new THREE.PointLight(0xe8a04a, intensity, 18, 2);
    light.position.set(x, 3, z);
    scene.add(light);
    lampLights.push(light);
  }
  lamp(11, 9, 70);
  lamp(-12, -7, 64);
  lamp(0, -13, 54);

  for (let i = 0; i < 8; i++) {
    const post = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), darkMat));
    const ang = (i / 8) * Math.PI * 2;
    post.position.set(Math.cos(ang) * 24, 0.4, Math.sin(ang) * 24);
  }

  viewScene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const viewKey = new THREE.DirectionalLight(0xfff2dd, 2.2);
  viewKey.position.set(1, 2, 1);
  viewScene.add(viewKey);
  const gun = new THREE.Group();
  const viewGuns: Record<GunId, THREE.Group> = {
    sidearm: buildFirearm("sidearm", caseMat, walnutMat),
    hawser: buildFirearm("hawser", shotMat, walnutMat),
    keel: buildFirearm("keel", parkMat, walnutMat),
    gale: buildFirearm("gale", nickelMat, walnutMat),
  };
  viewGuns.hawser.position.set(0.04, -0.04, 0.1);
  viewGuns.hawser.visible = false;
  viewGuns.keel.position.set(0.03, -0.03, 0.08);
  viewGuns.keel.visible = false;
  viewGuns.gale.position.set(0.02, -0.02, 0.04);
  viewGuns.gale.visible = false;
  for (const entry of Object.values(viewGuns)) gun.add(entry);
  const flashLight = new THREE.PointLight(0xffd7a1, 0, 1.6, 2);
  flashLight.position.set(0, 0.02, -0.7);
  gun.add(flashLight);
  gun.position.set(0.28, -0.24, -0.55);
  viewScene.add(gun);
  const knife = new THREE.Group();
  const blade = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(0.012, 0.028, 0.28, 2, 0.004)), nickelMat);
  blade.position.set(0, 0, -0.16);
  const handle = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(0.028, 0.04, 0.1, 2, 0.008)), walnutMat);
  handle.position.set(0, -0.01, 0.04);
  knife.add(blade, handle);
  knife.visible = false;
  viewScene.add(knife);

  const eyeMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffc56a }));
  const enemies: Enemy[] = [];

  function loadMap(url: string, rx: number, ry: number) {
    const wait: Array<() => void> = [];
    const map = loader.load(url, () => {
      for (const apply of wait) apply();
      wait.length = 0;
    });
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(rx, ry);
    map.anisotropy = 8;
    texes.add(map);
    return { map, wait };
  }
  const clothMap = loadMap("/textures/drifter-cloth.jpg", 1.2, 1.5);
  const zombieSkins = [
    loadMap("/textures/zombie-ash.jpg", 1.25, 2.05),
    loadMap("/textures/zombie-brine.jpg", 1.25, 2.05),
    loadMap("/textures/zombie-rust.jpg", 1.3, 2.05),
  ];
  const skinLooks = [
    { fallback: 0x6e756c, tint: 0xb7bdb4, emissive: 0x1a201c },
    { fallback: 0x5c6238, tint: 0xb4c096, emissive: 0x182010 },
    { fallback: 0x6a4034, tint: 0xc49a84, emissive: 0x24140e },
  ];

  function hanging(r: number, len: number) {
    const g = trackGeo(new THREE.CapsuleGeometry(r, len, 4, 8));
    g.translate(0, -(len * 0.5 + r), 0);
    return g;
  }
  const thighGeo = hanging(0.075, 0.32);
  const shinGeo = hanging(0.055, 0.32);
  const upperArmGeo = hanging(0.05, 0.26);
  const foreGeo = hanging(0.04, 0.24);
  const headGeo = trackGeo(new THREE.SphereGeometry(0.13, 16, 14));
  const neckGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8));
  const handGeo = trackGeo(new THREE.SphereGeometry(0.045, 8, 6));
  const eyeGeo = trackGeo(new THREE.SphereGeometry(0.02, 8, 6));
  const footGeo = trackGeo(new RoundedBoxGeometry(0.1, 0.06, 0.18, 2, 0.02));
  const pelvisGeo = trackGeo(new RoundedBoxGeometry(0.28, 0.16, 0.18, 2, 0.04));
  const chestGeo = trackGeo(new RoundedBoxGeometry(0.4, 0.42, 0.22, 3, 0.06));
  const shirtGeo = trackGeo(new RoundedBoxGeometry(0.42, 0.24, 0.2, 2, 0.04));
  const shortsGeo = trackGeo(new RoundedBoxGeometry(0.3, 0.18, 0.2, 2, 0.04));
  const ragMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3e362e,
      map: clothMap.map,
      roughness: 0.94,
      metalness: 0.02,
      emissive: 0x120e0c,
      emissiveIntensity: 0.16,
    }),
  );

  function makeEnemy(bull: boolean, variant: number): Enemy {
    const look = skinLooks[variant % 3]!;
    const skin = fleshMat(zombieSkins[variant % 3]!, look.fallback, look.emissive, bull ? 0.2 : 0.14, look.tint, 0.9);
    const headMat = skin;
    const id = enemies.length;
    const group = new THREE.Group();
    group.userData.eid = id;
    if (bull) group.scale.setScalar(1.12);
    const hips = new THREE.Group();
    hips.position.y = 0.94;
    group.add(hips);
    const pelvis = new THREE.Mesh(pelvisGeo, skin);
    pelvis.userData.eid = id;
    hips.add(pelvis);
    const shorts = new THREE.Mesh(shortsGeo, ragMat);
    shorts.position.y = -0.02;
    shorts.userData.eid = id;
    hips.add(shorts);
    const chest = new THREE.Group();
    chest.position.y = 0.18;
    hips.add(chest);
    const rib = new THREE.Mesh(chestGeo, skin);
    rib.position.y = 0.24;
    rib.userData.eid = id;
    chest.add(rib);
    const shirt = new THREE.Mesh(shirtGeo, ragMat);
    shirt.position.set(0, 0.16, 0.015);
    shirt.userData.eid = id;
    chest.add(shirt);
    const neck = new THREE.Mesh(neckGeo, skin);
    neck.position.y = 0.5;
    neck.userData.eid = id;
    chest.add(neck);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.66;
    head.scale.set(0.92, 1.08, 0.96);
    head.userData.head = true;
    head.userData.eid = id;
    chest.add(head);
    for (const sx of [-0.045, 0.045]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(sx, 0.02, 0.11);
      eye.userData.eid = id;
      head.add(eye);
    }
    const peg = (parent: THREE.Object3D, geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      parent.add(pivot);
      const mesh = new THREE.Mesh(geo, skin);
      mesh.userData.eid = id;
      pivot.add(mesh);
      return pivot;
    };
    const legL = peg(hips, thighGeo, -0.1, -0.02, 0);
    const legR = peg(hips, thighGeo, 0.1, -0.02, 0);
    const shinL = peg(legL, shinGeo, 0, -0.47, 0);
    const shinR = peg(legR, shinGeo, 0, -0.47, 0);
    for (const shin of [shinL, shinR]) {
      const foot = new THREE.Mesh(footGeo, skin);
      foot.position.set(0, -0.45, 0.04);
      foot.userData.eid = id;
      shin.add(foot);
    }
    const armL = peg(chest, upperArmGeo, -0.24, 0.38, 0);
    const armR = peg(chest, upperArmGeo, 0.24, 0.38, 0);
    const foreL = peg(armL, foreGeo, 0, -0.36, 0);
    const foreR = peg(armR, foreGeo, 0, -0.36, 0);
    for (const fore of [foreL, foreR]) {
      const hand = new THREE.Mesh(handGeo, skin);
      hand.position.set(0, -0.32, 0);
      hand.userData.eid = id;
      fore.add(hand);
    }
    group.visible = false;
    scene.add(group);
    const enemy: Enemy = {
      bull,
      alive: false,
      hp: bull ? 170 : 75,
      speed: bull ? 1.45 : 1.9,
      x: 0,
      z: 0,
      phaseAnim: variant,
      attackCd: 0,
      flash: 0,
      hitR: bull ? 0.58 : 0.42,
      dmg: bull ? 18 : 10,
      group,
      skin,
      headMat,
      baseEmissive: skin.emissive.clone(),
      headEmissive: headMat.emissive.clone(),
      hips,
      chest,
      limp: variant % 2 === 0 ? 1 : -1,
      legL,
      legR,
      shinL,
      shinR,
      armL,
      armR,
      foreL,
      foreR,
    };
    enemies.push(enemy);
    return enemy;
  }
  for (let i = 0; i < 12; i++) makeEnemy(false, i);
  for (let i = 0; i < 4; i++) makeEnemy(true, i);

  function fleshMat(
    slot: { map: THREE.Texture; wait: Array<() => void> },
    fallback: number,
    emissive: number,
    intensity: number,
    tint: number,
    roughness: number,
  ) {
    const mat = trackMat(
      new THREE.MeshStandardMaterial({
        color: fallback,
        map: slot.map,
        roughness,
        metalness: 0.02,
        emissive,
        emissiveIntensity: intensity,
      }),
    );
    const apply = () => {
      mat.color.setHex(tint);
      mat.needsUpdate = true;
    };
    if (slot.map.image) apply();
    else slot.wait.push(apply);
    return mat;
  }

  const bits: Bit[] = [];
  const bitGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.08, 0.08));
  for (let i = 0; i < 40; i++) {
    const mat = trackMat(new THREE.MeshBasicMaterial({ color: 0xf0c27a }));
    const mesh = new THREE.Mesh(bitGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    bits.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
  }

  const tracers: Tracer[] = [];
  for (let i = 0; i < 8; i++) {
    const geo = trackGeo(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = trackMat(new THREE.LineBasicMaterial({ color: 0xf2c27a, transparent: true, opacity: 0.9 }));
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }

  const vials: Vial[] = [];
  const vialGeo = trackGeo(new THREE.OctahedronGeometry(0.16, 0));
  const vialMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe8a04a, emissive: 0xe8a04a, emissiveIntensity: 0.8, roughness: 0.3 }),
  );
  for (let i = 0; i < 5; i++) {
    const mesh = new THREE.Mesh(vialGeo, vialMat);
    mesh.visible = false;
    scene.add(mesh);
    vials.push({ mesh, x: 0, z: 0, alive: false, t: Math.random() * 4 });
  }

  const player = { x: 0, z: 12, vx: 0, vz: 0 };
  let yaw = 0;
  let pitch = 0;
  let phase: Phase = "menu";
  let health = 100;
  let mag = GUNS.sidearm.mag;
  let reserve = GUNS.sidearm.reserve;
  let gunId: GunId = "sidearm";
  const owned: Record<GunId, boolean> = { sidearm: true, hawser: false, keel: false, gale: false };
  const ammo: Record<GunId, { mag: number; reserve: number }> = {
    sidearm: { mag: GUNS.sidearm.mag, reserve: GUNS.sidearm.reserve },
    hawser: { mag: GUNS.hawser.mag, reserve: GUNS.hawser.reserve },
    keel: { mag: GUNS.keel.mag, reserve: GUNS.keel.reserve },
    gale: { mag: GUNS.gale.mag, reserve: GUNS.gale.reserve },
  };
  const shops: Array<{ id: GunId; x: number; z: number }> = [
    { id: "hawser", x: 13.15, z: 4.6 },
    { id: "keel", x: 0, z: -39.15 },
    { id: "gale", x: 0, z: -58.4 },
  ];
  const doors: Array<{ id: "berth" | "bunk"; x: number; z: number; cost: number; name: string }> = [
    { id: "berth", x: 0, z: -46.7, cost: 900, name: "BERTH" },
    { id: "bunk", x: -2.6, z: -53.9, cost: 1400, name: "BUNK" },
  ];
  let score = 0;
  let wave = 0;
  let simTime = 0;
  let nextShot = 0;
  let reloading = false;
  let reloadDone = 0;
  let spray = 0;
  let kick = 0;
  let invuln = 0;
  let intermission = false;
  let clearAt = 0;
  let stepTime = 0;
  let bob = 0;
  let hurtVignette = 0;
  let shakeAmp = 0;
  let flashT = 0;
  let gunKick = 0;
  let swayX = 0;
  let swayY = 0;
  let lastLookX = 0;
  let lastLookY = 0;
  let menuT = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let attackMouse = false;
  let reloadEdge = false;
  let useEdge = false;
  let meleeEdge = false;
  let meleeT = 0;
  let nextMelee = 0;
  let bargeOpen = false;
  let gateT = 0;
  let berthOpen = false;
  let bunkOpen = false;
  let berthT = 0;
  let bunkT = 0;
  let deckLift = 0;
  let lockerTaken = false;
  let probeKeys: Set<string> | null = null;
  let probeAttack: boolean | null = null;
  const keys = new Set<string>();
  let prevPadReload = false;
  let prevPadPause = false;

  const raycaster = new THREE.Raycaster();
  const shotDir = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const side = new THREE.Vector3();
  const lift = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const live: THREE.Object3D[] = [];

  function persist() {
    const data: Save = { v: 1, best, sens: sensScale, muted };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* ignore quota */
    }
  }

  function noteScore() {
    if (score > best) {
      best = score;
      persist();
    }
    if (!bargeOpen && score >= BARGE_SCORE) openBarge();
  }

  function openBarge() {
    if (bargeOpen) return;
    bargeOpen = true;
    gateSolid.off = true;
    bargeLight.intensity = 70;
    announce("BARGE OPEN — BOW ROOM AHEAD");
    audio.wave();
    activate(1.3, -25.6, false, Math.max(wave, 2));
    activate(-1.3, -26.4, false, Math.max(wave, 2));
  }

  function setPhase(next: Phase) {
    phase = next;
    hooks.onPhase(next, { score, wave, best });
  }

  function held(code: string) {
    return probeKeys ? probeKeys.has(code) : keys.has(code);
  }

  function overlaps(x: number, z: number, r: number) {
    return solids.some((b) => !b.off && x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r);
  }

  function inWalkable(x: number, z: number) {
    if (Math.abs(x) <= 15.75 && Math.abs(z) <= 15.75) return true;
    if (Math.abs(x) <= 1.7 && z <= -15.55 && z >= -23.6) return true;
    if (Math.abs(x) <= 2.7 && z <= -22.8 && z >= -33.1) return true;
    if (Math.abs(x) <= 4.2 && z <= -31.15 && z >= -41.55) return true;
    if (Math.abs(x) <= 2.4 && z <= -41.2 && z >= -46.4) return true;
    if (Math.abs(x) <= 6.2 && z <= -45.6 && z >= -63.4) {
      const inHouse = Math.abs(x) <= 4.32 && z <= -47.5 && z >= -60.2;
      if (!inHouse) return true;
      if (!berthOpen) return false;
      if (z >= -54.0) return true;
      if (x <= -1.7 && x >= -4.2 && z >= -54.6) return true;
      if (bunkOpen) return true;
      return false;
    }
    return false;
  }

  function resolve(x: number, z: number, r: number, ox: number, oz: number) {
    for (let n = 0; n < 2; n++) {
      for (const b of solids) {
        if (b.off) continue;
        const minX = b.minX - r;
        const maxX = b.maxX + r;
        const minZ = b.minZ - r;
        const maxZ = b.maxZ + r;
        if (x > minX && x < maxX && z > minZ && z < maxZ) {
          const pl = x - minX;
          const pr = maxX - x;
          const pz0 = z - minZ;
          const pz1 = maxZ - z;
          const m = Math.min(pl, pr, pz0, pz1);
          if (m === pl) x = minX;
          else if (m === pr) x = maxX;
          else if (m === pz0) z = minZ;
          else z = maxZ;
        }
      }
    }
    if (!inWalkable(x, z)) {
      if (inWalkable(ox, z)) x = ox;
      else if (inWalkable(x, oz)) z = oz;
      else {
        x = ox;
        z = oz;
      }
    }
    return { x, z };
  }

  function announce(text: string) {
    const el = hud.current.banner;
    if (!el) return;
    el.textContent = text;
    el.classList.remove("banner-in");
    void el.offsetWidth;
    el.classList.add("banner-in");
  }

  function spawnBits(x: number, y: number, z: number, n: number, color: number, speed: number) {
    let left = n;
    for (const b of bits) {
      if (left <= 0) break;
      if (b.life > 0) continue;
      b.life = b.max = 0.28 + Math.random() * 0.25;
      b.mesh.visible = true;
      b.mesh.position.set(x, y, z);
      (b.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      b.vx = (Math.random() - 0.5) * speed;
      b.vy = Math.random() * speed * 0.8;
      b.vz = (Math.random() - 0.5) * speed;
      left--;
    }
  }

  function spawnTracer(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const t = tracers.find((tr) => tr.life <= 0);
    if (!t) return;
    const attr = t.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.setXYZ(0, x0, y0, z0);
    attr.setXYZ(1, x1, y1, z1);
    attr.needsUpdate = true;
    t.life = 0.06;
    t.line.visible = true;
    (t.line.material as THREE.LineBasicMaterial).opacity = 0.95;
  }

  function dropVial(x: number, z: number) {
    const v = vials.find((item) => !item.alive);
    if (!v) return;
    v.alive = true;
    v.x = x;
    v.z = z;
    v.mesh.visible = true;
    v.mesh.position.set(x, 0.7, z);
  }

  function deactivate(en: Enemy) {
    en.alive = false;
    en.group.visible = false;
    en.group.position.y = -30;
  }

  function activate(x: number, z: number, bull: boolean, waveN: number) {
    const en = enemies.find((e) => !e.alive && e.bull === bull) ?? enemies.find((e) => !e.alive);
    if (!en) return;
    en.alive = true;
    en.bull = bull;
    en.x = x;
    en.z = z;
    en.hp = (bull ? 150 : 68) + (waveN - 1) * (bull ? 16 : 8);
    en.speed = (bull ? 1.65 : 2.25) + Math.min(waveN, 8) * 0.09;
    en.dmg = bull ? 18 : 10;
    en.attackCd = 0.4;
    en.flash = 0;
    en.phaseAnim = Math.random() * 6;
    en.skin.emissive.copy(en.baseEmissive);
    en.headMat.emissive.copy(en.headEmissive);
    en.skin.emissiveIntensity = en.bull ? 0.26 : 0.16;
    en.headMat.emissiveIntensity = 0.1;
    en.group.visible = true;
    en.group.position.set(x, 0, z);
  }

  function aliveCount() {
    let n = 0;
    for (const e of enemies) if (e.alive) n++;
    return n;
  }

  function spawnWave(n: number) {
    wave = n;
    intermission = false;
    const count = Math.min(3 + n, 12);
    const bulls = n > 1 && n % 3 === 0 ? 1 : 0;
    for (let i = 0; i < count; i++) {
      let x = 0;
      let z = 6;
      if (!(n === 1 && i === 0)) {
        let placed = false;
        for (let k = 0; k < 12; k++) {
          const ang = (i * 2.4 + n * 0.7 + k * 0.55) % (Math.PI * 2);
          const rad = 10.5 + (k % 4) * 1.1;
          x = Math.cos(ang) * rad;
          z = Math.sin(ang) * rad;
          if (!overlaps(x, z, 0.7) && Math.hypot(x - player.x, z - player.z) > 5.5) {
            placed = true;
            break;
          }
        }
        if (!placed) {
          x = (i % 2 === 0 ? -1 : 1) * 8;
          z = -10;
        }
      }
      activate(x, z, i < bulls, n);
    }
    announce(`WAVE ${n}`);
    audio.wave();
    hooks.onPhase(phase, { score, wave, best });
  }

  function reset() {
    player.x = 0;
    player.z = 12;
    player.vx = 0;
    player.vz = 0;
    yaw = 0;
    pitch = 0;
    health = 100;
    mag = GUNS.sidearm.mag;
    reserve = GUNS.sidearm.reserve;
    gunId = "sidearm";
    owned.hawser = false;
    owned.keel = false;
    owned.gale = false;
    ammo.sidearm.mag = GUNS.sidearm.mag;
    ammo.sidearm.reserve = GUNS.sidearm.reserve;
    ammo.hawser.mag = GUNS.hawser.mag;
    ammo.hawser.reserve = GUNS.hawser.reserve;
    ammo.keel.mag = GUNS.keel.mag;
    ammo.keel.reserve = GUNS.keel.reserve;
    ammo.gale.mag = GUNS.gale.mag;
    ammo.gale.reserve = GUNS.gale.reserve;
    viewGuns.sidearm.visible = true;
    viewGuns.hawser.visible = false;
    viewGuns.keel.visible = false;
    viewGuns.gale.visible = false;
    berthOpen = false;
    bunkOpen = false;
    berthT = 0;
    bunkT = 0;
    deckLift = 0;
    berthSolid.off = false;
    bunkSolid.off = false;
    berthDoor.position.x = 0;
    bunkDoor.position.x = 0;
    meleeT = 0;
    score = 0;
    wave = 0;
    simTime = 0;
    nextShot = 0;
    reloading = false;
    spray = 0;
    kick = 0;
    invuln = 0;
    intermission = false;
    stepTime = 0;
    bob = 0;
    hurtVignette = 0;
    shakeAmp = 0;
    flashT = 0;
    reloadEdge = false;
    touch.reload = false;
    bargeOpen = false;
    gateT = 0;
    gateGroup.position.x = 0;
    gateSolid.off = false;
    lockerTaken = false;
    lockerMesh.visible = true;
    bargeLight.intensity = 18;
    for (const e of enemies) deactivate(e);
    for (const v of vials) {
      v.alive = false;
      v.mesh.visible = false;
    }
  }

  function die() {
    if (phase !== "playing") return;
    noteScore();
    setPhase("dead");
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }

  function hurt(amount: number) {
    if (invuln > 0 || phase !== "playing") return;
    health = Math.max(0, health - amount);
    invuln = 0.42;
    hurtVignette = 1;
    shakeAmp = Math.min(1, shakeAmp + 0.65);
    audio.hurt();
    if (health <= 0) die();
  }

  function damageEnemy(en: Enemy, headshot: boolean, dirX: number, dirZ: number, point: THREE.Vector3, amount: number) {
    en.hp -= amount;
    en.flash = 0.07;
    en.skin.emissive.setHex(0xfff1d4);
    en.headMat.emissive.setHex(0xfff1d4);
    en.skin.emissiveIntensity = 1.5;
    en.headMat.emissiveIntensity = 1.5;
    en.x += dirX * 0.28;
    en.z += dirZ * 0.28;
    audio.hit();
    shakeAmp = Math.min(1, shakeAmp + 0.18);
    const mark = hud.current.crosshair;
    if (mark) {
      mark.classList.add("is-hit");
      window.setTimeout(() => mark.classList.remove("is-hit"), 80);
    }
    spawnBits(point.x, point.y, point.z, 4, 0xf2c98a, 3.5);
    if (en.hp <= 0) {
      score += en.bull ? 250 : 100;
      if (headshot) score += 50;
      noteScore();
      audio.kill();
      spawnBits(en.x, 1.1, en.z, 12, en.bull ? 0xd2583a : 0xe8a04a, 6);
      if (health < 100 && Math.random() < 0.42) dropVial(en.x, en.z);
      reserve = Math.min(GUNS[gunId].reserve * 2, reserve + (gunId === "hawser" ? 2 : 6));
      deactivate(en);
      if (aliveCount() === 0 && phase === "playing") {
        intermission = true;
        clearAt = simTime + 2.15;
        score += 40 * wave;
        noteScore();
        announce("DECK CLEAR");
      }
    }
  }

  function syncAim() {
    yawGroup.position.set(player.x, 0, player.z);
    yawGroup.rotation.set(0, yaw, 0);
    camera.position.set(0, EYE + deckLift, 0);
    camera.rotation.set(pitch, 0, 0);
  }

  function equip(id: GunId, quiet = false) {
    if (!owned[id]) {
      announce(`NEED ${GUNS[id].cost}`);
      return;
    }
    if (gunId !== id) {
      ammo[gunId].mag = mag;
      ammo[gunId].reserve = reserve;
      gunId = id;
      mag = ammo[id].mag;
      reserve = ammo[id].reserve;
      reloading = false;
    }
    viewGuns.sidearm.visible = id === "sidearm";
    viewGuns.hawser.visible = id === "hawser";
    viewGuns.keel.visible = id === "keel";
    viewGuns.gale.visible = id === "gale";
    if (!quiet) announce(GUNS[id].name.toUpperCase());
  }

  function nearestShop() {
    let found: (typeof shops)[number] | null = null;
    let best = 2.2;
    for (const shop of shops) {
      const d = Math.hypot(player.x - shop.x, player.z - shop.z);
      if (d < best) {
        best = d;
        found = shop;
      }
    }
    return found;
  }

  function nearestDoor() {
    let found: (typeof doors)[number] | null = null;
    let best = 2.15;
    for (const door of doors) {
      const open = door.id === "berth" ? berthOpen : bunkOpen;
      if (open) continue;
      const d = Math.hypot(player.x - door.x, player.z - door.z);
      if (d < best) {
        best = d;
        found = door;
      }
    }
    return found;
  }

  function tryBuy() {
    if (phase !== "playing") return;
    const door = nearestDoor();
    if (door) {
      if (score < door.cost) {
        announce(`NEED ${door.cost}`);
        return;
      }
      score -= door.cost;
      if (door.id === "berth") {
        berthOpen = true;
        berthSolid.off = true;
      } else {
        bunkOpen = true;
        bunkSolid.off = true;
      }
      announce(`${door.name} OPEN`);
      audio.pickup();
      noteScore();
      return;
    }
    const shop = nearestShop();
    if (!shop) return;
    const g = GUNS[shop.id];
    if (!owned[shop.id]) {
      if (score < g.cost) {
        announce(`NEED ${g.cost}`);
        return;
      }
      score -= g.cost;
      owned[shop.id] = true;
      ammo[shop.id].mag = g.mag;
      ammo[shop.id].reserve = g.reserve;
      equip(shop.id, true);
      announce(`${g.name.toUpperCase()} BOUGHT`);
      audio.pickup();
    } else {
      const cost = Math.max(80, Math.round(g.cost * 0.35));
      if (score < cost) {
        announce(`NEED ${cost}`);
        return;
      }
      score -= cost;
      if (gunId !== shop.id) equip(shop.id, true);
      mag = g.mag;
      reserve = g.reserve;
      ammo[shop.id].mag = mag;
      ammo[shop.id].reserve = reserve;
      announce("AMMO");
      audio.pickup();
    }
    noteScore();
  }

  const meleeHit = new THREE.Vector3();
  function tryMelee() {
    if (phase !== "playing" || simTime < nextMelee) return;
    nextMelee = simTime + 0.58;
    meleeT = 0.32;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    audio.hit();
    for (const en of enemies) {
      if (!en.alive) continue;
      const dx = en.x - player.x;
      const dz = en.z - player.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2.15 || dist < 0.001) continue;
      if ((dx * fx + dz * fz) / dist < 0.2) continue;
      meleeHit.set(en.x, 1.15 + deckLift, en.z);
      damageEnemy(en, false, fx, fz, meleeHit, en.bull ? 40 : 55);
    }
  }

  function deckHeight(x: number, z: number) {
    if (!berthOpen) return 0;
    if (x <= -1.7 && x >= -4.2 && z < -51.05 && z > -54.65) {
      return Math.max(0, Math.min(1, (-51.05 - z) / 3.4)) * 2.85;
    }
    if (bunkOpen && z < -54.15 && Math.abs(x) < 4.35) return 2.85;
    return 0;
  }

  function fire() {
    const gunSpec = GUNS[gunId];
    syncAim();
    camera.getWorldDirection(shotDir);
    side.crossVectors(shotDir, up).normalize();
    lift.crossVectors(side, shotDir).normalize();
    camera.getWorldPosition(camPos);
    const base = shotDir.clone();
    let tracerEnd = camPos.clone().addScaledVector(base, gunSpec.pellets > 1 ? 16 : 42);
    for (let pellet = 0; pellet < gunSpec.pellets; pellet++) {
      const dir = base.clone();
      dir.addScaledVector(side, (Math.random() - 0.5) * gunSpec.spread * 2);
      dir.addScaledVector(lift, (Math.random() - 0.5) * gunSpec.spread * 2);
      dir.normalize();
      raycaster.set(camPos, dir);
      raycaster.far = gunSpec.pellets > 1 ? 22 : 72;
      live.length = 0;
      for (const e of enemies) if (e.alive) live.push(e.group);
      const enemyHits = raycaster.intersectObjects(live, true);
      const worldHits = raycaster.intersectObjects(blockers, false);
      const eh = enemyHits[0];
      const wh = worldHits[0];
      let end = camPos.clone().addScaledVector(dir, raycaster.far * 0.65);
      if (eh && (!wh || eh.distance <= wh.distance)) {
        let obj: THREE.Object3D | null = eh.object;
        let eid = -1;
        let headshot = false;
        while (obj) {
          if (obj.userData.head) headshot = true;
          if (typeof obj.userData.eid === "number") eid = obj.userData.eid as number;
          obj = obj.parent;
        }
        const en = enemies[eid];
        if (en?.alive) {
          const flat = Math.hypot(dir.x, dir.z) || 1;
          damageEnemy(en, headshot, dir.x / flat, dir.z / flat, eh.point, headshot ? gunSpec.hs : gunSpec.dmg);
          end = eh.point;
        }
      } else if (wh) {
        spawnBits(wh.point.x, wh.point.y, wh.point.z, 3, 0xd9d2c3, 2.4);
        end = wh.point;
      }
      if (pellet === 0 || end.distanceTo(camPos) < tracerEnd.distanceTo(camPos)) tracerEnd = end;
    }
    spawnTracer(camPos.x, camPos.y, camPos.z, tracerEnd.x, tracerEnd.y, tracerEnd.z);
    pitch = Math.min(1.35, pitch + gunSpec.kick);
    kick += gunSpec.kick;
    yaw += (Math.random() - 0.5) * 0.008;
    spray = Math.min(1, spray + gunSpec.spray);
    flashT = 0.045;
    gunKick = 1;
    shotLight.intensity = gunSpec.pellets > 1 ? 14 : 9;
    audio.shot();
  }

  function tryReload() {
    const gunSpec = GUNS[gunId];
    if (reloading || mag >= gunSpec.mag || reserve <= 0 || phase !== "playing") return;
    reloading = true;
    reloadDone = simTime + gunSpec.reload;
    audio.reload();
  }

  function pollPad() {
    const pads = navigator.getGamepads?.();
    if (!pads) return { mx: 0, my: 0, lx: 0, ly: 0, attack: false, reload: false, sprint: false, pause: false };
    let mx = 0;
    let my = 0;
    let lx = 0;
    let ly = 0;
    let attack = false;
    let reload = false;
    let sprint = false;
    let pause = false;
    for (const pad of pads) {
      if (!pad) continue;
      const left = radial(pad.axes[0] ?? 0, pad.axes[1] ?? 0, 0.18);
      const right = radial(pad.axes[2] ?? 0, pad.axes[3] ?? 0, 0.16);
      mx += left.x;
      my += -left.y;
      lx += right.x;
      ly += right.y;
      if ((pad.buttons[7]?.pressed ?? false) || (pad.buttons[7]?.value ?? 0) > 0.45) attack = true;
      if (pad.buttons[6]?.pressed) attack = true;
      if (pad.buttons[2]?.pressed) reload = true;
      if (pad.buttons[10]?.pressed || pad.buttons[1]?.pressed) sprint = true;
      if (pad.buttons[9]?.pressed) pause = true;
    }
    return { mx, my, lx, ly, attack, reload, sprint, pause };
  }

  function simulate(dt: number) {
    simTime += dt;
    waterUniforms.uTime.value += dt;
    invuln = Math.max(0, invuln - dt);
    hurtVignette *= Math.exp(-3.2 * dt);
    const kickNext = kick * Math.exp(-10 * dt);
    pitch -= kick - kickNext;
    kick = kickNext;
    spray *= Math.exp(-2.6 * dt);
    pitch = Math.max(-1.45, Math.min(1.45, pitch));

    if (phase !== "playing") return;

    const pad = pollPad();
    if (pad.reload && !prevPadReload) reloadEdge = true;
    prevPadReload = pad.reload;
    if (pad.pause && !prevPadPause) {
      setPhase("paused");
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      return;
    }
    prevPadPause = pad.pause;

    yaw -= pad.lx * 2.2 * dt * sensScale;
    pitch -= pad.ly * 1.7 * dt * sensScale;
    pitch = Math.max(-1.45, Math.min(1.45, pitch));

    let mx = (held("KeyD") || held("ArrowRight") ? 1 : 0) - (held("KeyA") || held("ArrowLeft") ? 1 : 0);
    let my = (held("KeyW") || held("ArrowUp") ? 1 : 0) - (held("KeyS") || held("ArrowDown") ? 1 : 0);
    mx += touch.moveX + pad.mx;
    my += touch.moveY + pad.my;
    const wishMag = Math.hypot(mx, my);
    if (wishMag > 1) {
      mx /= wishMag;
      my /= wishMag;
    }
    const sprint =
      held("ShiftLeft") || held("ShiftRight") || pad.sprint || Math.hypot(touch.moveX, touch.moveY) > 0.92;
    const maxSpeed = sprint ? 8.25 : 5.05;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const wishX = (fx * my + rx * mx) * maxSpeed;
    const wishZ = (fz * my + rz * mx) * maxSpeed;
    const accel = wishMag > 0.08 ? 36 : 18;
    const dv = accel * dt;
    player.vx += Math.max(-dv, Math.min(dv, wishX - player.vx));
    player.vz += Math.max(-dv, Math.min(dv, wishZ - player.vz));
    if (wishMag <= 0.08) {
      const damp = Math.exp(-10 * dt);
      player.vx *= damp;
      player.vz *= damp;
    }
    const moved = resolve(player.x + player.vx * dt, player.z + player.vz * dt, PLAYER_R, player.x, player.z);
    player.x = moved.x;
    player.z = moved.z;
    const liftGoal = deckHeight(player.x, player.z);
    deckLift += (liftGoal - deckLift) * (1 - Math.exp(-7 * dt));

    const speed = Math.hypot(player.vx, player.vz);
    if (speed > 1.4) {
      stepTime -= dt;
      if (stepTime <= 0) {
        stepTime = sprint ? 0.34 : 0.46;
        audio.step();
      }
      bob += dt * speed * 1.35;
    }

    if (reloadEdge || touch.reload) {
      reloadEdge = false;
      touch.reload = false;
      tryReload();
    }
    if (useEdge || touch.use) {
      useEdge = false;
      touch.use = false;
      tryBuy();
    }
    if (meleeEdge || touch.melee) {
      meleeEdge = false;
      touch.melee = false;
      tryMelee();
    }
    if (reloading && simTime >= reloadDone) {
      const need = GUNS[gunId].mag - mag;
      const take = Math.min(need, reserve);
      mag += take;
      reserve -= take;
      reloading = false;
    }

    const attacking =
      (probeAttack !== null ? probeAttack : attackMouse || touch.attack || pad.attack) ||
      held("Space");
    if (attacking && simTime >= nextShot) {
      if (reloading) nextShot = simTime + 0.05;
      else if (mag <= 0) {
        audio.dry();
        nextShot = simTime + 0.22;
      } else {
        mag -= 1;
        nextShot = simTime + GUNS[gunId].delay;
        fire();
      }
    }

    for (const en of enemies) {
      if (!en.alive) continue;
      if (en.flash > 0) {
        en.flash -= dt;
        if (en.flash <= 0) {
          en.skin.emissive.copy(en.baseEmissive);
          en.headMat.emissive.copy(en.headEmissive);
          en.skin.emissiveIntensity = en.bull ? 0.2 : 0.14;
          en.headMat.emissiveIntensity = en.bull ? 0.2 : 0.14;
        }
      }
      const dx = player.x - en.x;
      const dz = player.z - en.z;
      const dist = Math.hypot(dx, dz) || 0.0001;
      const stepX = (dx / dist) * en.speed * dt;
      const stepZ = (dz / dist) * en.speed * dt;
      const next = resolve(en.x + stepX, en.z + stepZ, en.hitR, en.x, en.z);
      en.x = next.x;
      en.z = next.z;
      en.phaseAnim += dt * en.speed * 4.6;
      const stride = Math.sin(en.phaseAnim);
      const swing = Math.cos(en.phaseAnim);
      const badRight = en.limp > 0;
      en.legL.rotation.x = stride * (badRight ? 0.98 : 0.28);
      en.legR.rotation.x = -stride * (badRight ? 0.24 : 0.98) + (badRight ? 0.2 : 0);
      en.shinL.rotation.x = Math.max(0, -stride) * (badRight ? 1.3 : 0.35);
      en.shinR.rotation.x = Math.max(0, stride) * (badRight ? 0.22 : 1.3) + (badRight ? 0.58 : 0);
      en.armL.rotation.x = -stride * (badRight ? 0.8 : 0.22) + 0.1;
      en.armR.rotation.x = stride * (badRight ? 0.16 : 0.8) + (badRight ? 0.42 : 0.1);
      en.armL.rotation.z = 0.08 + stride * 0.05;
      en.armR.rotation.z = -0.08 - stride * 0.05;
      en.foreL.rotation.x = 0.22 + Math.max(0, -en.armL.rotation.x) * 0.85;
      en.foreR.rotation.x = 0.22 + Math.max(0, -en.armR.rotation.x) * 0.85;
      en.hips.rotation.y = stride * 0.18;
      en.hips.rotation.z = en.limp * 0.16 + swing * 0.035;
      en.hips.rotation.x = 0.12;
      en.chest.rotation.y = -stride * 0.24;
      en.chest.rotation.x = Math.abs(stride) * 0.04;
      const hop = Math.abs(swing) * (badRight ? 0.035 : 0.05);
      en.group.position.set(en.x, deckHeight(en.x, en.z) + hop, en.z);
      en.group.rotation.y = Math.atan2(dx, dz);
      if (dist < 1.15 + en.hitR) {
        en.attackCd -= dt;
        if (en.attackCd <= 0) {
          en.attackCd = en.bull ? 0.85 : 0.68;
          hurt(en.dmg);
          if (phase !== "playing") return;
        }
      }
    }

    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      if (!a?.alive) continue;
      for (let j = i + 1; j < enemies.length; j++) {
        const b = enemies[j];
        if (!b?.alive) continue;
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const d = Math.hypot(dx, dz);
        const min = a.hitR + b.hitR;
        if (d > 0.0001 && d < min) {
          const push = (min - d) * 0.5;
          a.x += (dx / d) * push;
          a.z += (dz / d) * push;
          b.x -= (dx / d) * push;
          b.z -= (dz / d) * push;
        }
      }
    }

    for (const v of vials) {
      if (!v.alive) continue;
      v.t += dt;
      v.mesh.position.set(v.x, 0.65 + Math.sin(v.t * 3) * 0.1, v.z);
      v.mesh.rotation.y += dt * 1.6;
      if (Math.hypot(player.x - v.x, player.z - v.z) < 1.15) {
        health = Math.min(100, health + 28);
        v.alive = false;
        v.mesh.visible = false;
        audio.pickup();
      }
    }

    if (bargeOpen && !lockerTaken && Math.hypot(player.x, player.z + 29.15) < 1.15) {
      lockerTaken = true;
      lockerMesh.visible = false;
      health = Math.min(100, health + 45);
      reserve = GUNS[gunId].reserve;
      mag = GUNS[gunId].mag;
      ammo[gunId].mag = mag;
      ammo[gunId].reserve = reserve;
      audio.pickup();
      announce("LOCKER OPEN");
    }

    if (intermission && simTime >= clearAt && phase === "playing") spawnWave(wave + 1);

    for (const b of bits) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.mesh.visible = false;
        continue;
      }
      b.vy -= 14 * dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      const s = Math.max(0.15, b.life / b.max);
      b.mesh.scale.setScalar(s);
    }
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) t.line.visible = false;
      else (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / 0.06);
    }
  }

  function paintHud() {
    const h = hud.current;
    const scoreText = String(score);
    if (h.score && h.score.textContent !== scoreText) h.score.textContent = scoreText;
    if (h.barge) {
      const bargeText = bargeOpen ? "Bow room open" : `${Math.max(0, BARGE_SCORE - score)} to the barge`;
      if (h.barge.textContent !== bargeText) h.barge.textContent = bargeText;
    }
    if (h.weapon) {
      const name = GUNS[gunId].name;
      if (h.weapon.textContent !== name) h.weapon.textContent = name;
    }
    const waveText = wave > 0 ? String(wave) : "–";
    if (h.wave && h.wave.textContent !== waveText) h.wave.textContent = waveText;
    const left = String(aliveCount());
    if (h.enemies && h.enemies.textContent !== left) h.enemies.textContent = left;
    if (h.healthBar) h.healthBar.style.transform = `scaleX(${Math.max(0, health) / 100})`;
    const hp = String(Math.ceil(health));
    if (h.healthNum && h.healthNum.textContent !== hp) h.healthNum.textContent = hp;
    if (h.mag) {
      const m = String(mag);
      if (h.mag.textContent !== m) h.mag.textContent = m;
      h.mag.style.color = mag === 0 ? "var(--color-accent)" : "var(--color-fg)";
    }
    if (h.reserve) {
      const r = String(reserve);
      if (h.reserve.textContent !== r) h.reserve.textContent = r;
    }
    if (h.reloadLabel) {
      const text = reloading ? "RELOADING" : mag === 0 ? "EMPTY" : "";
      if (h.reloadLabel.textContent !== text) h.reloadLabel.textContent = text;
    }
    if (h.crosshair) h.crosshair.style.setProperty("--gap", `${5 + spray * 18}px`);
    if (h.prompt) {
      const door = phase === "playing" ? nearestDoor() : null;
      const shop = phase === "playing" && !door ? nearestShop() : null;
      let text = "";
      if (door) text = `F  BUY ${door.name}  ${door.cost}`;
      else if (shop) {
        const g = GUNS[shop.id];
        text = owned[shop.id]
          ? `F  AMMO  ${Math.max(80, Math.round(g.cost * 0.35))}`
          : `F  BUY ${g.name.toUpperCase()}  ${g.cost}`;
      }
      if (h.prompt.textContent !== text) h.prompt.textContent = text;
    }
    if (h.vignette) {
      const o = Math.min(0.85, hurtVignette * 0.75 + (1 - health / 100) * 0.38);
      h.vignette.style.opacity = phase === "playing" || phase === "dead" ? String(o) : "0";
    }
  }

  function renderFrame(dt: number) {
    const gateGoal = bargeOpen ? 1 : 0;
    gateT += (gateGoal - gateT) * (1 - Math.exp(-3.5 * dt));
    gateGroup.position.x = gateT * 3.6;
    berthT += ((berthOpen ? 1 : 0) - berthT) * (1 - Math.exp(-3.2 * dt));
    bunkT += ((bunkOpen ? 1 : 0) - bunkT) * (1 - Math.exp(-3.2 * dt));
    berthDoor.position.x = berthT * 1.9;
    bunkDoor.position.x = bunkT * 2.1;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const portrait = w < h;
    const baseFov = portrait ? 78 : 74;
    const speed = Math.hypot(player.vx, player.vz);
    const sprinting = speed > 6.2 && phase === "playing";
    const targetFov = baseFov + (sprinting ? 4 : 0);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-6 * dt));
      camera.updateProjectionMatrix();
      viewCamera.fov = camera.fov;
      viewCamera.updateProjectionMatrix();
    }

    if (phase === "menu") {
      menuT += reduceMotion ? 0 : dt;
      const mx = reduceMotion ? 6 : 6 + Math.sin(menuT * 0.18) * 2;
      const mz = reduceMotion ? 14 : 13.6 + Math.cos(menuT * 0.14) * 1.1;
      const eyeY = 5.6;
      const dx = -mx;
      const dz = -mz;
      const horiz = Math.hypot(dx, dz) || 1;
      yawGroup.position.set(mx, 0, mz);
      yawGroup.rotation.set(0, Math.atan2(-dx, -dz), 0);
      camera.position.set(0, eyeY, 0);
      camera.rotation.set(Math.atan2(1.5 - eyeY, horiz), 0, 0);
      gun.visible = false;
    } else {
      const bobAmp = reduceMotion || phase !== "playing" ? 0 : Math.min(1, speed / 5);
      const bobY = Math.sin(bob * 2.1) * 0.04 * bobAmp;
      const bobX = Math.cos(bob) * 0.022 * bobAmp;
      const shake = reduceMotion ? shakeAmp * 0.2 : shakeAmp;
      const sy = (Math.random() - 0.5) * 0.02 * shake;
      const sx = (Math.random() - 0.5) * 0.016 * shake;
      shakeAmp *= Math.exp(-6 * dt);
      yawGroup.position.set(player.x, 0, player.z);
      yawGroup.rotation.set(0, yaw + sx * 0.4, 0);
      camera.position.set(bobX, EYE + deckLift + bobY, 0);
      camera.rotation.set(pitch + sy, 0, sx);
      gun.visible = true;
      const k = 1 - Math.exp(-10 * dt);
      swayX += (THREE.MathUtils.clamp(-lastLookX * 0.0012, -0.08, 0.08) - swayX) * k;
      swayY += (THREE.MathUtils.clamp(lastLookY * 0.0008, -0.05, 0.05) - swayY) * k;
      gunKick *= Math.exp(-12 * dt);
      const dip = reloading ? 0.32 : 0;
      gun.position.set(0.28 + swayX + bobX * 0.6, -0.24 + swayY + bobY * 0.5 - dip * 0.15 - (meleeT > 0 ? 0.28 : 0), -0.55 - gunKick * 0.07);
      gun.rotation.set(gunKick * 0.06 + dip, swayX * 0.4, -swayX * 0.6);
      meleeT = Math.max(0, meleeT - dt);
      const swingU = meleeT > 0 ? 1 - meleeT / 0.32 : 0;
      knife.visible = meleeT > 0;
      knife.position.set(0.12 + swingU * 0.2, -0.16 + Math.sin(swingU * Math.PI) * 0.14, -0.42 - swingU * 0.18);
      knife.rotation.set(-1.15 + swingU * 2.1, -0.35, 0.55 - swingU * 1.5);
      for (const key of ["sidearm", "hawser", "keel", "gale"] as const) {
        const muzzle = viewGuns[key].userData.flash as THREE.Mesh;
        muzzle.visible = key === gunId && flashT > 0;
      }
      flashLight.intensity = flashT > 0 ? 8 : 0;
      flashT = Math.max(0, flashT - dt);
      shotLight.intensity *= Math.exp(-16 * dt);
    }

    for (let i = 0; i < lampLights.length; i++) {
      const light = lampLights[i];
      if (!light) continue;
      const base = i === 2 ? 54 : 68;
      light.intensity = base + Math.sin(menuT * 9 + i) * 3 + Math.sin(menuT * 23 + i * 2) * 1.5;
    }
    if (phase !== "menu") menuT += dt;

    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(viewScene, viewCamera);
    paintHud();
  }

  let acc = 0;
  let last = performance.now();
  let raf = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (phase === "playing") {
      const lookSensMouse = 0.00215 * sensScale;
      const lookSensTouch = 0.0064 * sensScale;
      yaw -= mouseDX * lookSensMouse + touch.lookX * lookSensTouch;
      pitch -= mouseDY * lookSensMouse + touch.lookY * lookSensTouch;
      pitch = Math.max(-1.45, Math.min(1.45, pitch));
      lastLookX = mouseDX + touch.lookX;
      lastLookY = mouseDY + touch.lookY;
    } else {
      lastLookX = 0;
      lastLookY = 0;
    }
    mouseDX = 0;
    mouseDY = 0;
    touch.lookX = 0;
    touch.lookY = 0;

    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      simulate(STEP);
      acc -= STEP;
      steps++;
    }
    renderFrame(dt);
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const hgt = canvas.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, w < 900 ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
    viewCamera.aspect = w / hgt;
    viewCamera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  const ac = new AbortController();
  const opt: AddEventListenerOptions = { signal: ac.signal };
  const GAME = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ShiftLeft",
    "ShiftRight",
    "Space",
  ]);
  window.addEventListener(
    "keydown",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (GAME.has(e.code)) e.preventDefault();
      if (e.code === "Escape") e.preventDefault();
      keys.add(e.code);
      if (e.repeat) return;
      if (e.code === "KeyR") reloadEdge = true;
      if (e.code === "KeyF") useEdge = true;
      if (e.code === "KeyV") meleeEdge = true;
      if (e.code === "Digit1") equip("sidearm");
      if (e.code === "Digit2") equip("hawser");
      if (e.code === "Digit3") equip("keel");
      if (e.code === "Digit4") equip("gale");
      if (e.code === "Escape") {
        if (phase === "playing") {
          setPhase("paused");
          if (document.pointerLockElement === canvas) document.exitPointerLock();
        }
      }
    },
    opt,
  );
  window.addEventListener("keyup", (e) => keys.delete(e.code), opt);
  window.addEventListener(
    "blur",
    () => {
      keys.clear();
      attackMouse = false;
    },
    opt,
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "visible") audio.resume();
      else {
        keys.clear();
        attackMouse = false;
      }
    },
    opt,
  );
  window.addEventListener(
    "mousemove",
    (e) => {
      if (document.pointerLockElement !== canvas) return;
      mouseDX += e.movementX;
      mouseDY += e.movementY;
    },
    opt,
  );
  window.addEventListener(
    "mousedown",
    (e) => {
      if (e.button !== 0) return;
      if (document.pointerLockElement === canvas) attackMouse = true;
    },
    opt,
  );
  window.addEventListener(
    "mouseup",
    (e) => {
      if (e.button === 0) attackMouse = false;
    },
    opt,
  );
  document.addEventListener(
    "pointerlockchange",
    () => {
      if (document.pointerLockElement !== canvas) attackMouse = false;
    },
    opt,
  );
  canvas.addEventListener("contextmenu", (e) => e.preventDefault(), opt);

  function tryLock() {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (coarse && !fine) return;
    const lock = canvas.requestPointerLock.bind(canvas) as (options?: { unadjustedMovement?: boolean }) => void | Promise<void>;
    try {
      const ret = lock({ unadjustedMovement: true });
      if (ret && typeof (ret as Promise<void>).then === "function") {
        void (ret as Promise<void>).catch(() => {
          try {
            canvas.requestPointerLock();
          } catch {
            /* mobile / denied */
          }
        });
      }
    } catch {
      try {
        canvas.requestPointerLock();
      } catch {
        /* ignore */
      }
    }
  }

  const qa = import.meta.env.DEV || new URLSearchParams(window.location.search).has("qa");
  if (qa) {
    const probe: ControlsProbe = {
      getYaw: () => yaw,
      getSpeed: () => Math.hypot(player.vx, player.vz),
      getPos: () => ({ x: player.x, y: 0, z: player.z }),
      setKeys: (codes) => {
        probeKeys = codes.length ? new Set(codes) : null;
      },
      setAttack: (on) => {
        probeAttack = on ? true : null;
      },
      getMag: () => mag,
      getPhase: () => phase,
      setScore: (n: number) => {
        score = n;
        if (!bargeOpen && score >= BARGE_SCORE) openBarge();
      },
      setPos: (x: number, z: number) => {
        player.x = x;
        player.z = z;
        player.vx = 0;
        player.vz = 0;
      },
      setYaw: (next: number) => {
        yaw = next;
        pitch = 0;
      },
    };
    window.__controlsTest = probe;
  }
  window.__saltReady = true;
  hooks.onReady({ best, muted, sens: sensScale });
  hooks.onPhase("menu", { score: 0, wave: 0, best });
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ac.abort();
      ro.disconnect();
      audio.close();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of texes) t.dispose();
      glowTex.dispose();
      renderer.dispose();
      delete window.__controlsTest;
      delete window.__saltReady;
    },
    start() {
      audio.unlock();
      if (phase === "playing") return;
      reset();
      setPhase("playing");
      spawnWave(1);
      tryLock();
    },
    pause() {
      if (phase !== "playing") return;
      setPhase("paused");
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    },
    resume() {
      if (phase !== "paused") return;
      audio.resume();
      setPhase("playing");
      tryLock();
    },
    title() {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      reset();
      setPhase("menu");
    },
    requestLock() {
      if (phase === "playing") tryLock();
    },
    setMuted(next) {
      muted = next;
      audio.setMuted(next);
      persist();
    },
    setSens(next) {
      sensScale = Math.min(2, Math.max(0.5, next));
      persist();
    },
  };
}
