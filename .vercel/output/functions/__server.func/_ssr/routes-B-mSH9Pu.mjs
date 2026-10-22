import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Crosshair, i as Pause, n as Volume2, t as VolumeX } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B-mSH9Pu.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var emptyHud = () => ({
	score: null,
	wave: null,
	enemies: null,
	healthBar: null,
	healthNum: null,
	mag: null,
	reserve: null,
	crosshair: null,
	vignette: null,
	banner: null,
	reloadLabel: null,
	hit: null,
	barge: null
});
function Saltwatch() {
	const canvasRef = (0, import_react.useRef)(null);
	const apiRef = (0, import_react.useRef)(null);
	const hudRef = (0, import_react.useRef)(emptyHud());
	const touchRef = (0, import_react.useRef)({
		moveX: 0,
		moveY: 0,
		lookX: 0,
		lookY: 0,
		attack: false,
		reload: false
	});
	const stickId = (0, import_react.useRef)(null);
	const lookId = (0, import_react.useRef)(null);
	const lookLast = (0, import_react.useRef)({
		x: 0,
		y: 0
	});
	const knobRef = (0, import_react.useRef)(null);
	const [phase, setPhase] = (0, import_react.useState)("menu");
	const [stats, setStats] = (0, import_react.useState)({
		score: 0,
		wave: 0,
		best: 0
	});
	const [ready, setReady] = (0, import_react.useState)(false);
	const [muted, setMuted] = (0, import_react.useState)(false);
	const [sens, setSens] = (0, import_react.useState)(1);
	const [locked, setLocked] = (0, import_react.useState)(false);
	const [narrow, setNarrow] = (0, import_react.useState)(true);
	const [error, setError] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const mq = window.matchMedia("(max-width: 959px), (pointer: coarse)");
		const sync = () => setNarrow(mq.matches);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);
	(0, import_react.useEffect)(() => {
		const sync = () => setLocked(document.pointerLockElement === canvasRef.current);
		document.addEventListener("pointerlockchange", sync);
		return () => document.removeEventListener("pointerlockchange", sync);
	}, []);
	(0, import_react.useEffect)(() => {
		let dead = false;
		let api = null;
		import("./createGame-CAVE6nyr.mjs").then(({ mountGame }) => {
			if (dead || !canvasRef.current) return;
			api = mountGame(canvasRef.current, touchRef.current, hudRef, {
				onPhase: (next, run) => {
					if (dead) return;
					setPhase(next);
					setStats(run);
				},
				onReady: (meta) => {
					if (dead) return;
					setReady(true);
					setMuted(meta.muted);
					setSens(meta.sens);
					setStats((prev) => ({
						...prev,
						best: meta.best
					}));
				},
				onError: (message) => {
					if (!dead) setError(message);
				}
			});
			apiRef.current = api;
		});
		return () => {
			dead = true;
			api?.dispose();
			apiRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (phase === "playing") return;
		touchRef.current.moveX = 0;
		touchRef.current.moveY = 0;
		touchRef.current.attack = false;
		touchRef.current.lookX = 0;
		touchRef.current.lookY = 0;
		if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
	}, [phase]);
	function onLookDown(e) {
		if (e.target.closest("[data-control]")) return;
		if (phase !== "playing") return;
		if (e.pointerType !== "touch" && document.pointerLockElement !== canvasRef.current) apiRef.current?.requestLock();
		if (document.pointerLockElement === canvasRef.current) return;
		lookId.current = e.pointerId;
		lookLast.current = {
			x: e.clientX,
			y: e.clientY
		};
		e.currentTarget.setPointerCapture(e.pointerId);
	}
	function onLookMove(e) {
		if (e.pointerId !== lookId.current) return;
		if (document.pointerLockElement === canvasRef.current) return;
		const dx = e.clientX - lookLast.current.x;
		const dy = e.clientY - lookLast.current.y;
		lookLast.current = {
			x: e.clientX,
			y: e.clientY
		};
		touchRef.current.lookX += dx;
		touchRef.current.lookY += dy;
	}
	function onLookUp(e) {
		if (e.pointerId !== lookId.current) return;
		lookId.current = null;
	}
	function moveStick(e) {
		const rect = e.currentTarget.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		let dx = e.clientX - cx;
		let dy = e.clientY - cy;
		const max = rect.width * .36;
		const mag = Math.hypot(dx, dy) || 1;
		const clamped = Math.min(mag, max);
		dx = dx / mag * clamped;
		dy = dy / mag * clamped;
		if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
		touchRef.current.moveX = dx / max;
		touchRef.current.moveY = -dy / max;
	}
	const showStick = narrow;
	const showFire = narrow || !locked;
	const playing = phase === "playing";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "game-root relative h-dvh w-full overflow-hidden bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "absolute inset-0 h-full w-full"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0",
				onPointerDown: onLookDown,
				onPointerMove: onLookMove,
				onPointerUp: onLookUp,
				onPointerCancel: onLookUp
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: (el) => {
					hudRef.current.vignette = el;
				},
				className: "vignette pointer-events-none absolute inset-0 opacity-0"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `pointer-events-none absolute inset-0 ${playing ? "" : "invisible"}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "safe-t flex items-start justify-between px-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-medium tracking-widest text-muted uppercase",
								children: "Score"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								ref: (el) => {
									hudRef.current.score = el;
								},
								className: "font-display text-4xl leading-none",
								children: "0"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								ref: (el) => {
									hudRef.current.barge = el;
								},
								className: "mt-1 text-xs font-medium tracking-widest text-primary uppercase",
								children: "600 to the barge"
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-right",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-medium tracking-widest text-muted uppercase",
								children: "Wave"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								ref: (el) => {
									hudRef.current.wave = el;
								},
								className: "font-display text-4xl leading-none",
								children: "–"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						ref: (el) => {
							hudRef.current.banner = el;
						},
						className: "pointer-events-none absolute top-16 right-0 left-0 text-center font-display text-2xl tracking-wide text-primary italic"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						ref: (el) => {
							hudRef.current.crosshair = el;
						},
						className: "crosshair absolute top-1/2 left-1/2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "up" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "down" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "left" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "right" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "safe-b absolute inset-x-0 bottom-0 flex items-end justify-between px-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-1 flex items-baseline gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-medium tracking-widest text-muted uppercase",
									children: "Hull"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									ref: (el) => {
										hudRef.current.healthNum = el;
									},
									className: "font-display text-2xl leading-none",
									children: "100"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-2 w-36 overflow-hidden rounded-full bg-border",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									ref: (el) => {
										hudRef.current.healthBar = el;
									},
									className: "h-full w-full origin-left bg-primary"
								})
							})] }), showStick ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								"data-control": true,
								className: "pointer-events-auto relative h-32 w-32 rounded-full border border-border bg-surface/70",
								"aria-label": "Move",
								onPointerDown: (e) => {
									e.stopPropagation();
									stickId.current = e.pointerId;
									e.currentTarget.setPointerCapture(e.pointerId);
									moveStick(e);
								},
								onPointerMove: (e) => {
									if (e.pointerId !== stickId.current) return;
									e.stopPropagation();
									moveStick(e);
								},
								onPointerUp: (e) => {
									if (e.pointerId !== stickId.current) return;
									stickId.current = null;
									touchRef.current.moveX = 0;
									touchRef.current.moveY = 0;
									if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
								},
								onPointerCancel: () => {
									stickId.current = null;
									touchRef.current.moveX = 0;
									touchRef.current.moveY = 0;
									if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
								},
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									ref: knobRef,
									className: "absolute top-1/2 left-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
								})
							}) : null]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col items-end gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs font-medium tracking-widest text-muted uppercase",
									children: ["Left ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										ref: (el) => {
											hudRef.current.enemies = el;
										},
										children: "0"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									ref: (el) => {
										hudRef.current.reloadLabel = el;
									},
									className: "min-h-4 text-xs font-semibold tracking-widest text-accent uppercase"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "leading-none",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										ref: (el) => {
											hudRef.current.mag = el;
										},
										className: "font-display text-5xl",
										children: "18"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										ref: (el) => {
											hudRef.current.reserve = el;
										},
										className: "text-lg text-muted",
										children: "72"
									})]
								}),
								showFire ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "pointer-events-auto flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										"data-control": true,
										className: "flex h-12 min-w-12 items-center justify-center rounded-full border border-border bg-surface px-3 text-xs font-semibold tracking-widest text-fg uppercase",
										onPointerDown: (e) => {
											e.stopPropagation();
											touchRef.current.reload = true;
										},
										children: "Rld"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										"data-control": true,
										className: "flex h-20 w-20 items-center justify-center rounded-full bg-primary text-sm font-semibold tracking-widest text-primary-fg uppercase",
										"aria-label": "Fire",
										onPointerDown: (e) => {
											e.stopPropagation();
											e.currentTarget.setPointerCapture(e.pointerId);
											touchRef.current.attack = true;
										},
										onPointerUp: () => {
											touchRef.current.attack = false;
										},
										onPointerCancel: () => {
											touchRef.current.attack = false;
										},
										children: "Fire"
									})]
								}) : null
							]
						})]
					})
				]
			}),
			playing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"data-control": true,
				className: "safe-top-btn absolute left-1/2 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface/80 text-fg",
				"aria-label": "Pause",
				onClick: () => apiRef.current?.pause(),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4" })
			}) : null,
			playing && !locked && !narrow ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 text-xs tracking-widest text-muted uppercase",
				children: "Drag to look · click the deck to capture the mouse"
			}) : null,
			phase === "menu" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "menu-scrim absolute inset-0 flex flex-col justify-end px-5 pb-8 md:justify-center md:px-16",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-md",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-semibold tracking-widest text-primary uppercase",
							children: "Night shift"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-6xl leading-none italic md:text-7xl",
							children: "Saltwatch"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 max-w-sm text-base leading-relaxed text-muted",
							children: "The floodgates failed at dusk. Drifters came in with the tide. Hold the pump deck. Six hundred points opens the barge on the north gate."
						}),
						stats.best > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-3 text-sm text-fg",
							children: ["Best score ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-display text-2xl text-primary",
								children: stats.best
							})]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 flex flex-wrap items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								id: "start-shift",
								type: "button",
								disabled: !ready || Boolean(error),
								className: "min-h-12 rounded-full bg-primary px-7 text-base font-semibold text-primary-fg disabled:opacity-50",
								onClick: (e) => {
									e.currentTarget.blur();
									apiRef.current?.start();
								},
								children: ready ? "Start the shift" : "Lighting the deck"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-fg",
								"aria-label": muted ? "Unmute" : "Mute",
								onClick: () => {
									const next = !muted;
									setMuted(next);
									apiRef.current?.setMuted(next);
								},
								children: muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-5" })
							})]
						}),
						error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-accent",
							children: error
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "mt-6 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "WASD move" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Mouse or drag looks" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Click or Fire shoots" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "R reloads" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Shift sprints" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Esc pauses" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "600 opens the barge" })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "mt-4 flex items-center gap-3 text-sm text-muted",
							children: ["Look speed", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "range",
								min: .5,
								max: 2,
								step: .05,
								value: sens,
								"aria-label": "Look speed",
								onChange: (e) => {
									const next = Number(e.target.value);
									setSens(next);
									apiRef.current?.setSens(next);
								},
								className: "w-32"
							})]
						})
					]
				})
			}) : null,
			phase === "paused" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 flex items-center justify-center bg-bg/70 px-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-sm rounded-2xl border border-border bg-surface p-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-semibold tracking-widest text-primary uppercase",
							children: "Hold"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-4xl italic",
							children: "Watch paused"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "mt-5 flex items-center justify-between gap-3 text-sm text-muted",
							children: ["Look speed", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "range",
								min: .5,
								max: 2,
								step: .05,
								value: sens,
								"aria-label": "Look speed",
								onChange: (e) => {
									const next = Number(e.target.value);
									setSens(next);
									apiRef.current?.setSens(next);
								},
								className: "w-32"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 flex flex-col gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "min-h-12 rounded-full bg-primary font-semibold text-primary-fg",
									onClick: (e) => {
										e.currentTarget.blur();
										apiRef.current?.resume();
									},
									children: "Resume"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "min-h-12 rounded-full border border-border font-semibold text-fg",
									onClick: () => {
										const next = !muted;
										setMuted(next);
										apiRef.current?.setMuted(next);
									},
									children: muted ? "Sound off" : "Sound on"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "min-h-12 rounded-full text-sm text-muted",
									onClick: () => apiRef.current?.title(),
									children: "Leave the deck"
								})
							]
						})
					]
				})
			}) : null,
			phase === "dead" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 flex items-end justify-center bg-bg/75 px-5 pb-10 md:items-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-sm rounded-2xl border border-border bg-surface p-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "size-6 text-accent" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-2 font-display text-4xl italic",
							children: "The tide takes the watch"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
							className: "mt-4 grid grid-cols-3 gap-3 text-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-xs tracking-widest text-muted uppercase",
									children: "Score"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "font-display text-3xl",
									children: stats.score
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-xs tracking-widest text-muted uppercase",
									children: "Wave"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "font-display text-3xl",
									children: stats.wave
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-xs tracking-widest text-muted uppercase",
									children: "Best"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "font-display text-3xl text-primary",
									children: stats.best
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "mt-6 min-h-12 w-full rounded-full bg-primary font-semibold text-primary-fg",
							onClick: (e) => {
								e.currentTarget.blur();
								apiRef.current?.start();
							},
							children: "Try again"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "mt-2 min-h-11 w-full text-sm text-muted",
							onClick: () => apiRef.current?.title(),
							children: "Title"
						})
					]
				})
			}) : null
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Saltwatch, {});
}
//#endregion
export { Home as component };
