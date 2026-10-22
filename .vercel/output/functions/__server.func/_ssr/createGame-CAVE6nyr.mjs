import { A as RepeatWrapping, B as Vector3, C as OctahedronGeometry, D as Points, E as PointLight, F as SpotLight, I as Sprite, L as SpriteMaterial, M as SRGBColorSpace, N as Scene, O as PointsMaterial, P as SphereGeometry, R as TextureLoader, S as Object3D, T as PlaneGeometry, _ as MathUtils, a as BufferAttribute, b as MeshPhysicalMaterial, c as CapsuleGeometry, d as DirectionalLight, f as FogExp2, g as LineBasicMaterial, h as Line, i as BoxGeometry, j as RingGeometry, k as Raycaster, l as Color, m as HemisphereLight, n as WebGLRenderer, o as BufferGeometry, p as Group, r as AmbientLight, s as CanvasTexture, t as RoundedBoxGeometry, u as CylinderGeometry, v as Mesh, w as PerspectiveCamera, x as MeshStandardMaterial, y as MeshBasicMaterial, z as TorusGeometry } from "../_libs/three.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/createGame-CAVE6nyr.js
function createAudio() {
	let ctx = null;
	let master = null;
	let sfx = null;
	let music = null;
	let noise = null;
	let muted = false;
	const drones = [];
	function ensure() {
		if (ctx) return ctx;
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return null;
		ctx = new AC({ latencyHint: "interactive" });
		master = ctx.createGain();
		sfx = ctx.createGain();
		music = ctx.createGain();
		master.gain.value = muted ? 0 : .9;
		sfx.gain.value = .85;
		music.gain.value = .5;
		sfx.connect(master);
		music.connect(master);
		master.connect(ctx.destination);
		const len = Math.floor(ctx.sampleRate * .25);
		noise = ctx.createBuffer(1, len, ctx.sampleRate);
		const data = noise.getChannelData(0);
		let last = 0;
		for (let i = 0; i < len; i++) {
			const white = Math.random() * 2 - 1;
			last = last * .65 + white * .35;
			data[i] = last;
		}
		return ctx;
	}
	function startDrone() {
		if (!ctx || !music || drones.length) return;
		const filter = ctx.createBiquadFilter();
		filter.type = "lowpass";
		filter.frequency.value = 220;
		const gain = ctx.createGain();
		gain.gain.value = .045;
		filter.connect(gain);
		gain.connect(music);
		for (const freq of [
			49,
			73.5,
			98
		]) {
			const o = ctx.createOscillator();
			o.type = "sine";
			o.frequency.value = freq;
			o.connect(filter);
			o.start();
			drones.push(o);
		}
	}
	function burst(freq, q, dur, gain, rate = 1) {
		if (!ctx || !sfx || !noise) return;
		const src = ctx.createBufferSource();
		src.buffer = noise;
		src.playbackRate.value = rate;
		const filter = ctx.createBiquadFilter();
		filter.type = "bandpass";
		filter.frequency.value = freq;
		filter.Q.value = q;
		const g = ctx.createGain();
		const t = ctx.currentTime;
		g.gain.setValueAtTime(gain, t);
		g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
		src.connect(filter);
		filter.connect(g);
		g.connect(sfx);
		src.start();
		src.stop(t + dur + .02);
		src.onended = () => {
			src.disconnect();
			filter.disconnect();
			g.disconnect();
		};
	}
	function tone(freq, dur, type, gain, delay = 0, slide = 0) {
		if (!ctx || !sfx) return;
		const t = ctx.currentTime + delay;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type;
		o.frequency.setValueAtTime(freq, t);
		if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
		g.gain.setValueAtTime(1e-4, t);
		g.gain.exponentialRampToValueAtTime(gain, t + .008);
		g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
		o.connect(g);
		g.connect(sfx);
		o.start(t);
		o.stop(t + dur + .02);
		o.onended = () => {
			o.disconnect();
			g.disconnect();
		};
	}
	return {
		unlock() {
			const c = ensure();
			if (!c) return;
			if (c.state === "suspended") c.resume();
			startDrone();
		},
		resume() {
			if (ctx && ctx.state === "suspended") ctx.resume();
		},
		setMuted(next) {
			muted = next;
			if (!ctx || !master) return;
			master.gain.setTargetAtTime(next ? 0 : .9, ctx.currentTime, .02);
		},
		shot() {
			burst(1400 + Math.random() * 400, .7, .09, .55, .9 + Math.random() * .2);
			tone(170 + Math.random() * 30, .07, "triangle", .22, 0, -80);
			tone(680, .04, "square", .05);
		},
		dry() {
			tone(220, .04, "square", .06);
		},
		hit() {
			tone(1480 + Math.random() * 200, .05, "square", .07);
			burst(2400, 2, .04, .12, 1.2);
		},
		hurt() {
			burst(180, .6, .18, .4, .7);
			tone(90, .16, "sine", .2, 0, -40);
		},
		kill() {
			tone(420, .12, "triangle", .1, 0, -180);
			burst(600, .8, .12, .2);
		},
		reload() {
			tone(540, .04, "square", .05, 0);
			tone(320, .05, "triangle", .06, .12);
			tone(180, .08, "sine", .08, .42, -40);
		},
		wave() {
			tone(392, .14, "sine", .08, 0);
			tone(523, .18, "sine", .07, .12);
		},
		pickup() {
			tone(660, .08, "sine", .07, 0);
			tone(880, .1, "sine", .06, .07);
		},
		step() {
			burst(240 + Math.random() * 80, .8, .04, .08, .85 + Math.random() * .3);
		},
		close() {
			for (const o of drones) try {
				o.stop();
				o.disconnect();
			} catch {}
			drones.length = 0;
			if (ctx) ctx.close();
			ctx = null;
		}
	};
}
var EYE = 1.62;
var STEP = 1 / 60;
var MAG_SIZE = 18;
var BARGE_SCORE = 600;
var SAVE_KEY = "saltwatch-save";
var PLAYER_R = .38;
function loadSave() {
	const blank = {
		v: 1,
		best: 0,
		sens: 1,
		muted: false
	};
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return blank;
		const j = JSON.parse(raw);
		if (j.v !== 1) return blank;
		return {
			v: 1,
			best: typeof j.best === "number" ? j.best : 0,
			sens: typeof j.sens === "number" ? Math.min(2, Math.max(.5, j.sens)) : 1,
			muted: Boolean(j.muted)
		};
	} catch {
		return blank;
	}
}
function radial(x, y, dz = .16) {
	const m = Math.hypot(x, y);
	if (m < dz) return {
		x: 0,
		y: 0
	};
	const scale = (m - dz) / (1 - dz) / m;
	return {
		x: x * scale,
		y: y * scale
	};
}
function glowTexture() {
	const c = document.createElement("canvas");
	c.width = 64;
	c.height = 64;
	const g = c.getContext("2d");
	if (!g) return new CanvasTexture(c);
	const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	grd.addColorStop(0, "rgba(255,226,180,1)");
	grd.addColorStop(.35, "rgba(232,160,74,0.55)");
	grd.addColorStop(1, "rgba(232,160,74,0)");
	g.fillStyle = grd;
	g.fillRect(0, 0, 64, 64);
	const t = new CanvasTexture(c);
	t.colorSpace = SRGBColorSpace;
	return t;
}
function mountGame(canvas, touch, hud, hooks) {
	const save = loadSave();
	let best = save.best;
	let sensScale = save.sens;
	let muted = save.muted;
	const audio = createAudio();
	audio.setMuted(muted);
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const geos = /* @__PURE__ */ new Set();
	const mats = /* @__PURE__ */ new Set();
	let renderer;
	try {
		renderer = new WebGLRenderer({
			canvas,
			antialias: true,
			alpha: false,
			powerPreference: "high-performance"
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
			setSens() {}
		};
	}
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.toneMapping = 4;
	renderer.toneMappingExposure = 1.35;
	renderer.setClearColor(463118, 1);
	renderer.autoClear = false;
	const scene = new Scene();
	scene.background = new Color(463118);
	scene.fog = new FogExp2(793110, .018);
	const viewScene = new Scene();
	const camera = new PerspectiveCamera(75, 1, .08, 180);
	const yawGroup = new Group();
	yawGroup.add(camera);
	scene.add(yawGroup);
	const viewCamera = new PerspectiveCamera(75, 1, .05, 12);
	const hemi = new HemisphereLight(14017776, 2768950, 2.4);
	scene.add(hemi);
	const moon = new DirectionalLight(15200504, 16);
	moon.position.set(24, 36, 14);
	scene.add(moon);
	scene.add(new AmbientLight(2373680, .85));
	const shotLight = new PointLight(16761994, 0, 8, 2);
	shotLight.position.set(0, 0, -.45);
	camera.add(shotLight);
	const beam = new SpotLight(16769724, 90, 26, .48, .4, 1.2);
	beam.position.set(.05, -.05, 0);
	const beamTarget = new Object3D();
	beamTarget.position.set(0, -.12, -8);
	camera.add(beamTarget);
	beam.target = beamTarget;
	camera.add(beam);
	function trackGeo(g) {
		geos.add(g);
		return g;
	}
	function trackMat(m) {
		mats.add(m);
		return m;
	}
	function addMesh(mesh) {
		trackGeo(mesh.geometry);
		const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const m of list) mats.add(m);
		scene.add(mesh);
		return mesh;
	}
	const texes = /* @__PURE__ */ new Set();
	const loader = new TextureLoader();
	function surfaced(url, rx, ry, roughness, metalness, fallback, clearcoat = 0, keepTint = false) {
		const mat = trackMat(new MeshPhysicalMaterial({
			color: fallback,
			roughness,
			metalness,
			clearcoat,
			clearcoatRoughness: .45
		}));
		const map = loader.load(url, () => {
			if (!keepTint) mat.color.setHex(16777215);
			mat.needsUpdate = true;
		});
		map.colorSpace = SRGBColorSpace;
		map.wrapS = map.wrapT = RepeatWrapping;
		map.repeat.set(rx, ry);
		map.anisotropy = 8;
		mat.map = map;
		texes.add(map);
		return mat;
	}
	const floorMat = surfaced("/textures/salt.jpg", 5, 5, .72, .02, 7236194, .18);
	const wallMat = surfaced("/textures/steel.jpg", 3, 1, .58, .16, 3948604);
	const pumpMat = surfaced("/textures/steel.jpg", 1.4, 1.1, .52, .18, 2897971);
	const woodMat = surfaced("/textures/wood.jpg", 2, 2, .62, .02, 4864044, .08);
	const hullMat = surfaced("/textures/steel.jpg", 2, 1.2, .5, .2, 11889234, .05, true);
	const darkMat = trackMat(new MeshStandardMaterial({
		color: 1712156,
		roughness: .62,
		metalness: .35
	}));
	const brassMat = trackMat(new MeshStandardMaterial({
		color: 12880186,
		roughness: .32,
		metalness: .78
	}));
	const rustMat = surfaced("/textures/steel.jpg", 1, 1, .66, .16, 12868154, 0, true);
	pumpMat.emissive = new Color(2371628);
	pumpMat.emissiveIntensity = .35;
	wallMat.emissive = new Color(1845284);
	wallMat.emissiveIntensity = .28;
	const saltMat = trackMat(new MeshStandardMaterial({
		color: 14275267,
		roughness: 1,
		metalness: 0
	}));
	const lampMat = trackMat(new MeshStandardMaterial({
		color: 15245386,
		emissive: 15245386,
		emissiveIntensity: 1.1,
		roughness: .35
	}));
	const solids = [];
	const blockers = [];
	function solidBox(cx, cy, cz, w, h, d, mat, solid = false, radius = .08) {
		const rad = Math.max(.01, Math.min(radius, w * .22, h * .22, d * .22));
		const mesh = addMesh(new Mesh(trackGeo(new RoundedBoxGeometry(w, h, d, 3, rad)), mat));
		mesh.position.set(cx, cy, cz);
		if (solid) {
			solids.push({
				minX: cx - w / 2,
				maxX: cx + w / 2,
				minZ: cz - d / 2,
				maxZ: cz + d / 2
			});
			blockers.push(mesh);
		}
		return mesh;
	}
	solidBox(0, -.28, 0, 40, .56, 40, floorMat, false, .04);
	const railH = 1.05;
	const railY = railH / 2;
	const edge = 16.7;
	solidBox(-9.45, railY, -16.7, 15.3, railH, .85, wallMat, true, .06);
	solidBox(9.45, railY, -16.7, 15.3, railH, .85, wallMat, true, .06);
	const gateSolid = {
		minX: -1.7,
		maxX: 1.7,
		minZ: -17.12,
		maxZ: -16.7 + .42
	};
	solids.push(gateSolid);
	solidBox(0, railY, edge, 34.2, railH, .85, wallMat, true, .06);
	solidBox(-16.7, railY, 0, .85, railH, 34.2, wallMat, true, .06);
	solidBox(edge, railY, 0, .85, railH, 34.2, wallMat, true, .06);
	for (const [x, z] of [
		[-16.7, -16.7],
		[edge, -16.7],
		[-16.7, edge],
		[edge, edge]
	]) solidBox(x, 1.35, z, .7, 2.7, .7, pumpMat, false);
	solidBox(0, 1.7, 0, 5.2, 3.4, 5.2, pumpMat, true, .28);
	solidBox(0, 3.5, 0, 5.7, .28, 5.7, darkMat, false);
	solidBox(0, 1.15, 2.68, 1.15, 2.15, .12, darkMat, false);
	solidBox(0, 2.35, 2.72, .55, .38, .08, lampMat, false);
	addMesh(new Mesh(new CylinderGeometry(.28, .34, 1.5, 8), rustMat)).position.set(-1.5, 4.3, -1.3);
	const tank = addMesh(new Mesh(new CylinderGeometry(.95, .95, 1.7, 12), brassMat));
	tank.position.set(4.5, .85, -1.1);
	solids.push({
		minX: 3.5,
		maxX: 5.5,
		minZ: -2.1,
		maxZ: -.1
	});
	blockers.push(tank);
	const pipe = addMesh(new Mesh(new CylinderGeometry(.16, .16, 2.2, 8), rustMat));
	pipe.rotation.z = Math.PI / 2;
	pipe.position.set(3.1, 1.15, -1.1);
	for (const [x, z, s] of [
		[
			-7.2,
			6.4,
			1.25
		],
		[
			7.6,
			4.4,
			1.45
		],
		[
			-8.6,
			-2.2,
			1.15
		],
		[
			6.3,
			-6.6,
			1.35
		],
		[
			-3.6,
			-8.6,
			1.05
		],
		[
			11.2,
			-1.2,
			1.2
		],
		[
			-12.2,
			8.6,
			1.15
		],
		[
			4.2,
			10.2,
			1.25
		]
	]) {
		const h = .7 + s * .45;
		solidBox(x, h / 2, z, s, h, s * .85, woodMat, true, .07);
	}
	solidBox(5.6, .55, 10.2, .45, 1.1, .45, darkMat, true);
	solidBox(-5.6, .55, 10.2, .45, 1.1, .45, darkMat, true);
	for (const [x, z] of [
		[-6, 4],
		[8, -8],
		[-10, -7],
		[2, -5]
	]) {
		const pile = addMesh(new Mesh(new SphereGeometry(.55, 8, 6), saltMat));
		pile.position.set(x, .18, z);
		pile.scale.set(1.3, .35, 1);
	}
	const ring = addMesh(new Mesh(new RingGeometry(3.15, 3.42, 48), trackMat(new MeshBasicMaterial({
		color: 15245386,
		transparent: true,
		opacity: .45,
		side: 2
	}))));
	ring.rotation.x = -Math.PI / 2;
	ring.position.y = .03;
	const gateGroup = new Group();
	scene.add(gateGroup);
	const gateDoor = new Mesh(trackGeo(new RoundedBoxGeometry(3.15, 1.7, .28, 3, .06)), wallMat);
	gateDoor.position.y = .95;
	gateGroup.add(gateDoor);
	gateGroup.position.set(0, 0, -16.7);
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
	const plaqueTex = new CanvasTexture(plaqueCanvas);
	plaqueTex.colorSpace = SRGBColorSpace;
	texes.add(plaqueTex);
	const plaque = new Mesh(trackGeo(new PlaneGeometry(1.5, .75)), trackMat(new MeshBasicMaterial({ map: plaqueTex })));
	plaque.position.set(0, 1.15, .16);
	gateGroup.add(plaque);
	addMesh(new Mesh(trackGeo(new RoundedBoxGeometry(2.7, .22, 6.4, 3, .06)), woodMat)).position.set(0, .08, -20.2);
	const bollardMat = darkMat;
	for (const [bx, bz] of [
		[-1.15, -17.6],
		[1.15, -17.6],
		[-1.15, -22.6],
		[1.15, -22.6]
	]) addMesh(new Mesh(trackGeo(new CylinderGeometry(.1, .12, .7, 10)), bollardMat)).position.set(bx, .4, bz);
	const hull = addMesh(new Mesh(trackGeo(new SphereGeometry(1, 28, 18)), hullMat));
	hull.scale.set(3.15, 1.05, 6.1);
	hull.position.set(0, -.35, -28.2);
	const bow = addMesh(new Mesh(trackGeo(new SphereGeometry(1, 20, 14)), hullMat));
	bow.scale.set(1.7, .72, 2.1);
	bow.position.set(0, -.05, -33.4);
	addMesh(new Mesh(trackGeo(new RoundedBoxGeometry(5.6, .24, 10.4, 3, .08)), woodMat)).position.set(0, .2, -28.1);
	const cabinY = 1.05;
	const cabinWall = (cx, cz, w, d) => {
		const mesh = addMesh(new Mesh(trackGeo(new RoundedBoxGeometry(w, 1.65, d, 2, .05)), pumpMat));
		mesh.position.set(cx, cabinY, cz);
		return mesh;
	};
	cabinWall(-1, -29.35, .32, 2.9);
	cabinWall(1, -29.35, .32, 2.9);
	cabinWall(0, -30.7, 2.3, .28);
	addMesh(new Mesh(trackGeo(new RoundedBoxGeometry(2.7, .14, 3.2, 2, .04)), darkMat)).position.set(0, 1.9, -29.35);
	solids.push({
		minX: -1.2,
		maxX: -.8,
		minZ: -30.8,
		maxZ: -27.9
	});
	solids.push({
		minX: .8,
		maxX: 1.2,
		minZ: -30.8,
		maxZ: -27.9
	});
	solids.push({
		minX: -1.2,
		maxX: 1.2,
		minZ: -30.9,
		maxZ: -30.5
	});
	const cabinWinMat = trackMat(new MeshStandardMaterial({
		color: 10474720,
		emissive: 1191992,
		emissiveIntensity: .4,
		roughness: .08,
		metalness: .1
	}));
	addMesh(new Mesh(trackGeo(new PlaneGeometry(1.1, .45)), cabinWinMat)).position.set(0, 1.25, -30.52);
	addMesh(new Mesh(trackGeo(new CylinderGeometry(.28, .34, 1.15, 12)), rustMat)).position.set(-.85, 2.45, -30.2);
	addMesh(new Mesh(trackGeo(new TorusGeometry(.28, .04, 8, 16)), brassMat)).position.set(0, 1.2, -28.55);
	for (const side of [-2.55, 2.55]) {
		const rail = addMesh(new Mesh(trackGeo(new CylinderGeometry(.04, .04, 8.6, 8)), darkMat));
		rail.rotation.x = Math.PI / 2;
		rail.position.set(side, .85, -28);
		for (let i = 0; i < 5; i++) addMesh(new Mesh(trackGeo(new CylinderGeometry(.035, .04, .7, 6)), darkMat)).position.set(side, .55, -24.2 - i * 1.9);
	}
	const lockerMat = trackMat(new MeshStandardMaterial({
		color: 15245386,
		emissive: 15245386,
		emissiveIntensity: .85,
		roughness: .35,
		metalness: .4
	}));
	const lockerMesh = addMesh(new Mesh(trackGeo(new RoundedBoxGeometry(.42, .55, .32, 2, .04)), lockerMat));
	lockerMesh.position.set(0, .5, -29.15);
	const bargeLight = new PointLight(15245386, 18, 16, 2);
	bargeLight.position.set(0, 2.4, -28);
	scene.add(bargeLight);
	const waterUniforms = { uTime: { value: 0 } };
	const waterMat = trackMat(new MeshStandardMaterial({
		color: 932920,
		roughness: .18,
		metalness: .62,
		transparent: true,
		opacity: .94
	}));
	waterMat.onBeforeCompile = (shader) => {
		shader.uniforms.uTime = waterUniforms.uTime;
		shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
         transformed.z += sin(position.x * 0.42 + uTime) * 0.08 + cos(position.y * 0.3 + uTime * 0.8) * 0.05;`);
	};
	waterMat.customProgramCacheKey = () => "salt-water";
	const water = addMesh(new Mesh(new PlaneGeometry(180, 180, 48, 48), waterMat));
	water.rotation.x = -Math.PI / 2;
	water.position.y = -.55;
	const moonMat = trackMat(new MeshBasicMaterial({ color: 15985887 }));
	moonMat.fog = false;
	addMesh(new Mesh(new SphereGeometry(5.5, 24, 16), moonMat)).position.set(30, 26, -40);
	const starPositions = /* @__PURE__ */ new Float32Array(540);
	for (let i = 0; i < 180; i++) {
		const theta = Math.random() * Math.PI * 2;
		const phi = Math.random() * Math.PI * .45;
		const r = 70 + Math.random() * 30;
		starPositions[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
		starPositions[i * 3 + 1] = Math.cos(phi) * r * .7 + 8;
		starPositions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
	}
	const starGeo = trackGeo(new BufferGeometry());
	starGeo.setAttribute("position", new BufferAttribute(starPositions, 3));
	const starMat = trackMat(new PointsMaterial({
		color: 16052196,
		size: .55,
		sizeAttenuation: true
	}));
	starMat.fog = false;
	scene.add(new Points(starGeo, starMat));
	const lampLights = [];
	const glowTex = glowTexture();
	function lamp(x, z, intensity) {
		solidBox(x, 1.5, z, .12, 3, .12, darkMat, false);
		solidBox(x, 3.05, z, .45, .18, .45, brassMat, false);
		addMesh(new Mesh(new SphereGeometry(.12, 10, 8), lampMat)).position.set(x, 3.02, z);
		const sprite = new Sprite(trackMat(new SpriteMaterial({
			map: glowTex,
			color: 15245386,
			transparent: true,
			blending: 2,
			depthWrite: false
		})));
		sprite.position.set(x, 3.05, z);
		sprite.scale.set(2.4, 2.4, 1);
		scene.add(sprite);
		const light = new PointLight(15245386, intensity, 18, 2);
		light.position.set(x, 3, z);
		scene.add(light);
		lampLights.push(light);
	}
	lamp(11, 9, 70);
	lamp(-12, -7, 64);
	lamp(0, -13, 54);
	for (let i = 0; i < 8; i++) {
		const post = addMesh(new Mesh(new CylinderGeometry(.08, .1, 2.2, 6), darkMat));
		const ang = i / 8 * Math.PI * 2;
		post.position.set(Math.cos(ang) * 24, .4, Math.sin(ang) * 24);
	}
	viewScene.add(new AmbientLight(16777215, .7));
	const viewKey = new DirectionalLight(16773853, 2.2);
	viewKey.position.set(1, 2, 1);
	viewScene.add(viewKey);
	const gun = new Group();
	const gunMetal = trackMat(new MeshStandardMaterial({
		color: 2765616,
		roughness: .42,
		metalness: .74
	}));
	const gunDark = trackMat(new MeshStandardMaterial({
		color: 1316886,
		roughness: .62,
		metalness: .4
	}));
	const gunBrass = trackMat(new MeshStandardMaterial({
		color: 12880186,
		roughness: .34,
		metalness: .8
	}));
	const gunGlass = trackMat(new MeshStandardMaterial({
		color: 15245386,
		emissive: 15245386,
		emissiveIntensity: .9,
		roughness: .2
	}));
	function gunPart(geo, mat, x, y, z, rx = 0) {
		const m = new Mesh(geo, mat);
		trackGeo(geo);
		m.position.set(x, y, z);
		m.rotation.x = rx;
		gun.add(m);
		return m;
	}
	gunPart(new CapsuleGeometry(.038, .28, 4, 8), gunMetal, 0, .01, -.04);
	gunPart(new CylinderGeometry(.018, .022, .5, 10), gunDark, 0, .028, -.38, -Math.PI / 2);
	gunPart(new CapsuleGeometry(.032, .12, 3, 8), gunDark, 0, -.01, .2);
	gunPart(new CapsuleGeometry(.028, .08, 3, 6), gunDark, 0, -.11, .06);
	gunPart(new CylinderGeometry(.028, .028, .07, 10), gunBrass, 0, -.06, -.12, Math.PI / 2);
	gunPart(new SphereGeometry(.026, 12, 10), gunGlass, 0, -.065, -.12);
	gunPart(new BoxGeometry(.01, .028, .01), gunBrass, 0, .055, -.16);
	gunPart(new CapsuleGeometry(.02, .06, 3, 6), gunMetal, 0, -.07, -.02);
	const flashMesh = gunPart(new SphereGeometry(.045, 8, 8), trackMat(new MeshBasicMaterial({ color: 16769720 })), 0, .02, -.64);
	flashMesh.visible = false;
	const flashLight = new PointLight(16766881, 0, 1.6, 2);
	flashLight.position.set(0, .02, -.64);
	gun.add(flashLight);
	gun.position.set(.28, -.24, -.55);
	viewScene.add(gun);
	const eyeMat = trackMat(new MeshBasicMaterial({ color: 16762218 }));
	const enemies = [];
	function makeEnemy(bull) {
		const skin = trackMat(new MeshStandardMaterial({
			color: bull ? 9259576 : 13219746,
			roughness: .78,
			metalness: .04,
			emissive: bull ? 5905426 : 3811864,
			emissiveIntensity: bull ? .7 : .45
		}));
		const group = new Group();
		group.userData.eid = enemies.length;
		const torso = new Mesh(trackGeo(new CapsuleGeometry(bull ? .28 : .19, bull ? .5 : .38, 6, 12)), skin);
		torso.position.y = bull ? 1.22 : 1.1;
		torso.userData.eid = enemies.length;
		group.add(torso);
		const head = new Mesh(trackGeo(new SphereGeometry(bull ? .2 : .15, 16, 12)), skin);
		head.position.y = bull ? 1.82 : 1.58;
		head.userData.head = true;
		head.userData.eid = enemies.length;
		group.add(head);
		const eye = new Mesh(trackGeo(new CapsuleGeometry(.025, bull ? .14 : .09, 4, 8)), eyeMat);
		eye.rotation.z = Math.PI / 2;
		eye.position.set(0, head.position.y + .02, bull ? .16 : .12);
		eye.userData.eid = enemies.length;
		group.add(eye);
		const legGeo = trackGeo(new CapsuleGeometry(bull ? .07 : .055, .34, 4, 8));
		legGeo.translate(0, -.26, 0);
		const legL = new Mesh(legGeo, skin);
		const legR = new Mesh(legGeo, skin);
		legL.position.set(bull ? -.14 : -.1, .78, 0);
		legR.position.set(bull ? .14 : .1, .78, 0);
		legL.userData.eid = enemies.length;
		legR.userData.eid = enemies.length;
		group.add(legL, legR);
		const armGeo = trackGeo(new CapsuleGeometry(.045, .28, 4, 8));
		armGeo.translate(0, -.2, 0);
		const armL = new Mesh(armGeo, skin);
		const armR = new Mesh(armGeo, skin);
		armL.position.set(bull ? -.38 : -.28, 1.28, 0);
		armR.position.set(bull ? .38 : .28, 1.28, 0);
		armL.userData.eid = enemies.length;
		armR.userData.eid = enemies.length;
		group.add(armL, armR);
		group.visible = false;
		scene.add(group);
		const enemy = {
			bull,
			alive: false,
			hp: bull ? 160 : 70,
			speed: bull ? 1.75 : 2.4,
			x: 0,
			z: 0,
			phaseAnim: 0,
			attackCd: 0,
			flash: 0,
			hitR: bull ? .55 : .4,
			dmg: bull ? 18 : 10,
			group,
			skin,
			baseEmissive: skin.emissive.clone(),
			legL,
			legR,
			armL,
			armR
		};
		enemies.push(enemy);
		return enemy;
	}
	for (let i = 0; i < 12; i++) makeEnemy(false);
	for (let i = 0; i < 4; i++) makeEnemy(true);
	const bits = [];
	const bitGeo = trackGeo(new BoxGeometry(.08, .08, .08));
	for (let i = 0; i < 40; i++) {
		const mat = trackMat(new MeshBasicMaterial({ color: 15778426 }));
		const mesh = new Mesh(bitGeo, mat);
		mesh.visible = false;
		scene.add(mesh);
		bits.push({
			mesh,
			vx: 0,
			vy: 0,
			vz: 0,
			life: 0,
			max: 1
		});
	}
	const tracers = [];
	for (let i = 0; i < 8; i++) {
		const geo = trackGeo(new BufferGeometry());
		geo.setAttribute("position", new BufferAttribute(/* @__PURE__ */ new Float32Array(6), 3));
		const mat = trackMat(new LineBasicMaterial({
			color: 15909498,
			transparent: true,
			opacity: .9
		}));
		const line = new Line(geo, mat);
		line.frustumCulled = false;
		line.visible = false;
		scene.add(line);
		tracers.push({
			line,
			life: 0
		});
	}
	const vials = [];
	const vialGeo = trackGeo(new OctahedronGeometry(.16, 0));
	const vialMat = trackMat(new MeshStandardMaterial({
		color: 15245386,
		emissive: 15245386,
		emissiveIntensity: .8,
		roughness: .3
	}));
	for (let i = 0; i < 5; i++) {
		const mesh = new Mesh(vialGeo, vialMat);
		mesh.visible = false;
		scene.add(mesh);
		vials.push({
			mesh,
			x: 0,
			z: 0,
			alive: false,
			t: Math.random() * 4
		});
	}
	const player = {
		x: 0,
		z: 12,
		vx: 0,
		vz: 0
	};
	let yaw = 0;
	let pitch = 0;
	let phase = "menu";
	let health = 100;
	let mag = MAG_SIZE;
	let reserve = 72;
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
	let bargeOpen = false;
	let gateT = 0;
	let lockerTaken = false;
	let probeKeys = null;
	let probeAttack = null;
	const keys = /* @__PURE__ */ new Set();
	let prevPadReload = false;
	let prevPadPause = false;
	const raycaster = new Raycaster();
	const shotDir = new Vector3();
	const camPos = new Vector3();
	const side = new Vector3();
	const lift = new Vector3();
	const up = new Vector3(0, 1, 0);
	const live = [];
	function persist() {
		const data = {
			v: 1,
			best,
			sens: sensScale,
			muted
		};
		try {
			localStorage.setItem(SAVE_KEY, JSON.stringify(data));
		} catch {}
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
		announce("THE BARGE IS OPEN");
		audio.wave();
		activate(1.3, -25.6, false, Math.max(wave, 2));
		activate(-1.3, -26.4, false, Math.max(wave, 2));
	}
	function setPhase(next) {
		phase = next;
		hooks.onPhase(next, {
			score,
			wave,
			best
		});
	}
	function held(code) {
		return probeKeys ? probeKeys.has(code) : keys.has(code);
	}
	function overlaps(x, z, r) {
		return solids.some((b) => !b.off && x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r);
	}
	function inWalkable(x, z) {
		if (Math.abs(x) <= 15.75 && Math.abs(z) <= 15.75) return true;
		if (Math.abs(x) <= 1.35 && z <= -15.55 && z >= -23.6) return true;
		if (Math.abs(x) <= 2.7 && z <= -22.8 && z >= -33.1) return true;
		return false;
	}
	function resolve(x, z, r, ox, oz) {
		for (let n = 0; n < 2; n++) for (const b of solids) {
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
		if (!inWalkable(x, z)) {
			if (inWalkable(ox, z)) x = ox;
			else if (inWalkable(x, oz)) z = oz;
			else {
				x = ox;
				z = oz;
			}
		}
		return {
			x,
			z
		};
	}
	function announce(text) {
		const el = hud.current.banner;
		if (!el) return;
		el.textContent = text;
		el.classList.remove("banner-in");
		el.offsetWidth;
		el.classList.add("banner-in");
	}
	function spawnBits(x, y, z, n, color, speed) {
		let left = n;
		for (const b of bits) {
			if (left <= 0) break;
			if (b.life > 0) continue;
			b.life = b.max = .28 + Math.random() * .25;
			b.mesh.visible = true;
			b.mesh.position.set(x, y, z);
			b.mesh.material.color.setHex(color);
			b.vx = (Math.random() - .5) * speed;
			b.vy = Math.random() * speed * .8;
			b.vz = (Math.random() - .5) * speed;
			left--;
		}
	}
	function spawnTracer(x0, y0, z0, x1, y1, z1) {
		const t = tracers.find((tr) => tr.life <= 0);
		if (!t) return;
		const attr = t.line.geometry.getAttribute("position");
		attr.setXYZ(0, x0, y0, z0);
		attr.setXYZ(1, x1, y1, z1);
		attr.needsUpdate = true;
		t.life = .06;
		t.line.visible = true;
		t.line.material.opacity = .95;
	}
	function dropVial(x, z) {
		const v = vials.find((item) => !item.alive);
		if (!v) return;
		v.alive = true;
		v.x = x;
		v.z = z;
		v.mesh.visible = true;
		v.mesh.position.set(x, .7, z);
	}
	function deactivate(en) {
		en.alive = false;
		en.group.visible = false;
		en.group.position.y = -30;
	}
	function activate(x, z, bull, waveN) {
		const en = enemies.find((e) => !e.alive && e.bull === bull) ?? enemies.find((e) => !e.alive);
		if (!en) return;
		en.alive = true;
		en.bull = bull;
		en.x = x;
		en.z = z;
		en.hp = (bull ? 150 : 68) + (waveN - 1) * (bull ? 16 : 8);
		en.speed = (bull ? 1.65 : 2.25) + Math.min(waveN, 8) * .09;
		en.dmg = bull ? 18 : 10;
		en.attackCd = .4;
		en.flash = 0;
		en.phaseAnim = Math.random() * 6;
		en.skin.emissive.copy(en.baseEmissive);
		en.skin.emissiveIntensity = .55;
		en.group.visible = true;
		en.group.position.set(x, 0, z);
	}
	function aliveCount() {
		let n = 0;
		for (const e of enemies) if (e.alive) n++;
		return n;
	}
	function spawnWave(n) {
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
					const ang = (i * 2.4 + n * .7 + k * .55) % (Math.PI * 2);
					const rad = 10.5 + k % 4 * 1.1;
					x = Math.cos(ang) * rad;
					z = Math.sin(ang) * rad;
					if (!overlaps(x, z, .7) && Math.hypot(x - player.x, z - player.z) > 5.5) {
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
		hooks.onPhase(phase, {
			score,
			wave,
			best
		});
	}
	function reset() {
		player.x = 0;
		player.z = 12;
		player.vx = 0;
		player.vz = 0;
		yaw = 0;
		pitch = 0;
		health = 100;
		mag = MAG_SIZE;
		reserve = 72;
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
	function hurt(amount) {
		if (invuln > 0 || phase !== "playing") return;
		health = Math.max(0, health - amount);
		invuln = .42;
		hurtVignette = 1;
		shakeAmp = Math.min(1, shakeAmp + .65);
		audio.hurt();
		if (health <= 0) die();
	}
	function damageEnemy(en, headshot, dirX, dirZ, point) {
		en.hp -= headshot ? 48 : 28;
		en.flash = .07;
		en.skin.emissive.setHex(16773588);
		en.skin.emissiveIntensity = 1.5;
		en.x += dirX * .28;
		en.z += dirZ * .28;
		audio.hit();
		shakeAmp = Math.min(1, shakeAmp + .18);
		const mark = hud.current.crosshair;
		if (mark) {
			mark.classList.add("is-hit");
			window.setTimeout(() => mark.classList.remove("is-hit"), 80);
		}
		spawnBits(point.x, point.y, point.z, 4, 15911306, 3.5);
		if (en.hp <= 0) {
			score += en.bull ? 250 : 100;
			if (headshot) score += 50;
			noteScore();
			audio.kill();
			spawnBits(en.x, 1.1, en.z, 12, en.bull ? 13785146 : 15245386, 6);
			if (health < 100 && Math.random() < .42) dropVial(en.x, en.z);
			reserve = Math.min(132, reserve + 8);
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
		camera.position.set(0, EYE, 0);
		camera.rotation.set(pitch, 0, 0);
	}
	function fire() {
		syncAim();
		camera.getWorldDirection(shotDir);
		side.crossVectors(shotDir, up).normalize();
		lift.crossVectors(side, shotDir).normalize();
		const spread = .002 + spray * .02;
		shotDir.addScaledVector(side, (Math.random() - .5) * spread * 2);
		shotDir.addScaledVector(lift, (Math.random() - .5) * spread * 2);
		shotDir.normalize();
		camera.getWorldPosition(camPos);
		raycaster.set(camPos, shotDir);
		raycaster.far = 70;
		live.length = 0;
		for (const e of enemies) if (e.alive) live.push(e.group);
		const enemyHits = raycaster.intersectObjects(live, true);
		const worldHits = raycaster.intersectObjects(blockers, false);
		const eh = enemyHits[0];
		const wh = worldHits[0];
		let end = camPos.clone().addScaledVector(shotDir, 40);
		if (eh && (!wh || eh.distance <= wh.distance)) {
			let obj = eh.object;
			let eid = -1;
			let headshot = false;
			while (obj) {
				if (obj.userData.head) headshot = true;
				if (typeof obj.userData.eid === "number") eid = obj.userData.eid;
				obj = obj.parent;
			}
			const en = enemies[eid];
			if (en?.alive) {
				const flat = Math.hypot(shotDir.x, shotDir.z) || 1;
				damageEnemy(en, headshot, shotDir.x / flat, shotDir.z / flat, eh.point);
				end = eh.point;
			}
		} else if (wh) {
			spawnBits(wh.point.x, wh.point.y, wh.point.z, 3, 14275267, 2.4);
			end = wh.point;
		}
		spawnTracer(camPos.x, camPos.y, camPos.z, end.x, end.y, end.z);
		const add = .018;
		pitch = Math.min(1.35, pitch + add);
		kick += add;
		yaw += (Math.random() - .5) * .008;
		spray = Math.min(1, spray + .22);
		flashT = .045;
		gunKick = 1;
		shotLight.intensity = 9;
		audio.shot();
	}
	function tryReload() {
		if (reloading || mag >= MAG_SIZE || reserve <= 0 || phase !== "playing") return;
		reloading = true;
		reloadDone = simTime + 1.15;
		audio.reload();
	}
	function pollPad() {
		const pads = navigator.getGamepads?.();
		if (!pads) return {
			mx: 0,
			my: 0,
			lx: 0,
			ly: 0,
			attack: false,
			reload: false,
			sprint: false,
			pause: false
		};
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
			const left = radial(pad.axes[0] ?? 0, pad.axes[1] ?? 0, .18);
			const right = radial(pad.axes[2] ?? 0, pad.axes[3] ?? 0, .16);
			mx += left.x;
			my += -left.y;
			lx += right.x;
			ly += right.y;
			if ((pad.buttons[7]?.pressed ?? false) || (pad.buttons[7]?.value ?? 0) > .45) attack = true;
			if (pad.buttons[6]?.pressed) attack = true;
			if (pad.buttons[2]?.pressed) reload = true;
			if (pad.buttons[10]?.pressed || pad.buttons[1]?.pressed) sprint = true;
			if (pad.buttons[9]?.pressed) pause = true;
		}
		return {
			mx,
			my,
			lx,
			ly,
			attack,
			reload,
			sprint,
			pause
		};
	}
	function simulate(dt) {
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
		const sprint = held("ShiftLeft") || held("ShiftRight") || pad.sprint || Math.hypot(touch.moveX, touch.moveY) > .92;
		const maxSpeed = sprint ? 8.25 : 5.05;
		const fx = -Math.sin(yaw);
		const fz = -Math.cos(yaw);
		const rx = Math.cos(yaw);
		const rz = -Math.sin(yaw);
		const wishX = (fx * my + rx * mx) * maxSpeed;
		const wishZ = (fz * my + rz * mx) * maxSpeed;
		const dv = (wishMag > .08 ? 36 : 18) * dt;
		player.vx += Math.max(-dv, Math.min(dv, wishX - player.vx));
		player.vz += Math.max(-dv, Math.min(dv, wishZ - player.vz));
		if (wishMag <= .08) {
			const damp = Math.exp(-10 * dt);
			player.vx *= damp;
			player.vz *= damp;
		}
		const moved = resolve(player.x + player.vx * dt, player.z + player.vz * dt, PLAYER_R, player.x, player.z);
		player.x = moved.x;
		player.z = moved.z;
		const speed = Math.hypot(player.vx, player.vz);
		if (speed > 1.4) {
			stepTime -= dt;
			if (stepTime <= 0) {
				stepTime = sprint ? .34 : .46;
				audio.step();
			}
			bob += dt * speed * 1.35;
		}
		if (reloadEdge || touch.reload) {
			reloadEdge = false;
			touch.reload = false;
			tryReload();
		}
		if (reloading && simTime >= reloadDone) {
			const need = MAG_SIZE - mag;
			const take = Math.min(need, reserve);
			mag += take;
			reserve -= take;
			reloading = false;
		}
		if (((probeAttack !== null ? probeAttack : attackMouse || touch.attack || pad.attack) || held("Space")) && simTime >= nextShot) {
			if (reloading) nextShot = simTime + .05;
			else if (mag <= 0) {
				audio.dry();
				nextShot = simTime + .22;
			} else {
				mag -= 1;
				nextShot = simTime + .105;
				fire();
			}
		}
		for (const en of enemies) {
			if (!en.alive) continue;
			if (en.flash > 0) {
				en.flash -= dt;
				if (en.flash <= 0) {
					en.skin.emissive.copy(en.baseEmissive);
					en.skin.emissiveIntensity = .55;
				}
			}
			const dx = player.x - en.x;
			const dz = player.z - en.z;
			const dist = Math.hypot(dx, dz) || 1e-4;
			const stepX = dx / dist * en.speed * dt;
			const stepZ = dz / dist * en.speed * dt;
			const next = resolve(en.x + stepX, en.z + stepZ, en.hitR, en.x, en.z);
			en.x = next.x;
			en.z = next.z;
			en.phaseAnim += dt * en.speed * 5.5;
			en.group.position.set(en.x, 0, en.z);
			en.group.rotation.y = Math.atan2(dx, dz);
			en.legL.rotation.x = Math.sin(en.phaseAnim) * .7;
			en.legR.rotation.x = Math.sin(en.phaseAnim + Math.PI) * .7;
			en.armL.rotation.x = Math.sin(en.phaseAnim + Math.PI) * .45;
			en.armR.rotation.x = Math.sin(en.phaseAnim) * .45;
			if (dist < 1.15 + en.hitR) {
				en.attackCd -= dt;
				if (en.attackCd <= 0) {
					en.attackCd = en.bull ? .85 : .68;
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
				if (d > 1e-4 && d < min) {
					const push = (min - d) * .5;
					a.x += dx / d * push;
					a.z += dz / d * push;
					b.x -= dx / d * push;
					b.z -= dz / d * push;
				}
			}
		}
		for (const v of vials) {
			if (!v.alive) continue;
			v.t += dt;
			v.mesh.position.set(v.x, .65 + Math.sin(v.t * 3) * .1, v.z);
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
			reserve = Math.min(132, reserve + 36);
			mag = MAG_SIZE;
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
			const s = Math.max(.15, b.life / b.max);
			b.mesh.scale.setScalar(s);
		}
		for (const t of tracers) {
			if (t.life <= 0) continue;
			t.life -= dt;
			if (t.life <= 0) t.line.visible = false;
			else t.line.material.opacity = Math.max(0, t.life / .06);
		}
	}
	function paintHud() {
		const h = hud.current;
		const scoreText = String(score);
		if (h.score && h.score.textContent !== scoreText) h.score.textContent = scoreText;
		if (h.barge) {
			const bargeText = bargeOpen ? "Barge open" : `${Math.max(0, BARGE_SCORE - score)} to the barge`;
			if (h.barge.textContent !== bargeText) h.barge.textContent = bargeText;
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
		if (h.vignette) {
			const o = Math.min(.85, hurtVignette * .75 + (1 - health / 100) * .38);
			h.vignette.style.opacity = phase === "playing" || phase === "dead" ? String(o) : "0";
		}
	}
	function renderFrame(dt) {
		gateT += ((bargeOpen ? 1 : 0) - gateT) * (1 - Math.exp(-3.5 * dt));
		gateGroup.position.x = gateT * 3.6;
		const baseFov = (canvas.clientWidth || 1) < (canvas.clientHeight || 1) ? 78 : 74;
		const speed = Math.hypot(player.vx, player.vz);
		const targetFov = baseFov + (speed > 6.2 && phase === "playing" ? 4 : 0);
		if (Math.abs(camera.fov - targetFov) > .05) {
			camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-6 * dt));
			camera.updateProjectionMatrix();
			viewCamera.fov = camera.fov;
			viewCamera.updateProjectionMatrix();
		}
		if (phase === "menu") {
			menuT += reduceMotion ? 0 : dt;
			const mx = reduceMotion ? 6 : 6 + Math.sin(menuT * .18) * 2;
			const mz = reduceMotion ? 14 : 13.6 + Math.cos(menuT * .14) * 1.1;
			const eyeY = 5.6;
			const dx = -mx;
			const dz = -mz;
			const horiz = Math.hypot(dx, dz) || 1;
			yawGroup.position.set(mx, 0, mz);
			yawGroup.rotation.set(0, Math.atan2(-dx, -dz), 0);
			camera.position.set(0, eyeY, 0);
			camera.rotation.set(Math.atan2(-4.1, horiz), 0, 0);
			gun.visible = false;
		} else {
			const bobAmp = reduceMotion || phase !== "playing" ? 0 : Math.min(1, speed / 5);
			const bobY = Math.sin(bob * 2.1) * .04 * bobAmp;
			const bobX = Math.cos(bob) * .022 * bobAmp;
			const shake = reduceMotion ? shakeAmp * .2 : shakeAmp;
			const sy = (Math.random() - .5) * .02 * shake;
			const sx = (Math.random() - .5) * .016 * shake;
			shakeAmp *= Math.exp(-6 * dt);
			yawGroup.position.set(player.x, 0, player.z);
			yawGroup.rotation.set(0, yaw + sx * .4, 0);
			camera.position.set(bobX, EYE + bobY, 0);
			camera.rotation.set(pitch + sy, 0, sx);
			gun.visible = true;
			const k = 1 - Math.exp(-10 * dt);
			swayX += (MathUtils.clamp(-lastLookX * .0012, -.08, .08) - swayX) * k;
			swayY += (MathUtils.clamp(lastLookY * 8e-4, -.05, .05) - swayY) * k;
			gunKick *= Math.exp(-12 * dt);
			const dip = reloading ? .32 : 0;
			gun.position.set(.28 + swayX + bobX * .6, -.24 + swayY + bobY * .5 - dip * .15, -.55 - gunKick * .07);
			gun.rotation.set(gunKick * .06 + dip, swayX * .4, -swayX * .6);
			flashMesh.visible = flashT > 0;
			flashLight.intensity = flashT > 0 ? 8 : 0;
			flashT = Math.max(0, flashT - dt);
			shotLight.intensity *= Math.exp(-16 * dt);
		}
		for (let i = 0; i < lampLights.length; i++) {
			const light = lampLights[i];
			if (!light) continue;
			light.intensity = (i === 2 ? 54 : 68) + Math.sin(menuT * 9 + i) * 3 + Math.sin(menuT * 23 + i * 2) * 1.5;
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
	function frame(now) {
		raf = requestAnimationFrame(frame);
		let dt = (now - last) / 1e3;
		last = now;
		if (dt > .05) dt = .05;
		if (phase === "playing") {
			const lookSensMouse = .00215 * sensScale;
			const lookSensTouch = .0064 * sensScale;
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
	const opt = { signal: ac.signal };
	const GAME = /* @__PURE__ */ new Set([
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
		"Space"
	]);
	window.addEventListener("keydown", (e) => {
		const target = e.target;
		if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
		if (GAME.has(e.code)) e.preventDefault();
		if (e.code === "Escape") e.preventDefault();
		keys.add(e.code);
		if (e.repeat) return;
		if (e.code === "KeyR") reloadEdge = true;
		if (e.code === "Escape") {
			if (phase === "playing") {
				setPhase("paused");
				if (document.pointerLockElement === canvas) document.exitPointerLock();
			}
		}
	}, opt);
	window.addEventListener("keyup", (e) => keys.delete(e.code), opt);
	window.addEventListener("blur", () => {
		keys.clear();
		attackMouse = false;
	}, opt);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") audio.resume();
		else {
			keys.clear();
			attackMouse = false;
		}
	}, opt);
	window.addEventListener("mousemove", (e) => {
		if (document.pointerLockElement !== canvas) return;
		mouseDX += e.movementX;
		mouseDY += e.movementY;
	}, opt);
	window.addEventListener("mousedown", (e) => {
		if (e.button !== 0) return;
		if (document.pointerLockElement === canvas) attackMouse = true;
	}, opt);
	window.addEventListener("mouseup", (e) => {
		if (e.button === 0) attackMouse = false;
	}, opt);
	document.addEventListener("pointerlockchange", () => {
		if (document.pointerLockElement !== canvas) attackMouse = false;
	}, opt);
	canvas.addEventListener("contextmenu", (e) => e.preventDefault(), opt);
	function tryLock() {
		const coarse = window.matchMedia("(pointer: coarse)").matches;
		const fine = window.matchMedia("(pointer: fine)").matches;
		if (coarse && !fine) return;
		const lock = canvas.requestPointerLock.bind(canvas);
		try {
			const ret = lock({ unadjustedMovement: true });
			if (ret && typeof ret.then === "function") ret.catch(() => {
				try {
					canvas.requestPointerLock();
				} catch {}
			});
		} catch {
			try {
				canvas.requestPointerLock();
			} catch {}
		}
	}
	if (new URLSearchParams(window.location.search).has("qa")) window.__controlsTest = {
		getYaw: () => yaw,
		getSpeed: () => Math.hypot(player.vx, player.vz),
		getPos: () => ({
			x: player.x,
			y: 0,
			z: player.z
		}),
		setKeys: (codes) => {
			probeKeys = codes.length ? new Set(codes) : null;
		},
		setAttack: (on) => {
			probeAttack = on ? true : null;
		},
		getMag: () => mag,
		getPhase: () => phase,
		setScore: (n) => {
			score = n;
			if (!bargeOpen && score >= BARGE_SCORE) openBarge();
		},
		setPos: (x, z) => {
			player.x = x;
			player.z = z;
			player.vx = 0;
			player.vz = 0;
		}
	};
	window.__saltReady = true;
	hooks.onReady({
		best,
		muted,
		sens: sensScale
	});
	hooks.onPhase("menu", {
		score: 0,
		wave: 0,
		best
	});
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
			sensScale = Math.min(2, Math.max(.5, next));
			persist();
		}
	};
}
//#endregion
export { mountGame };
