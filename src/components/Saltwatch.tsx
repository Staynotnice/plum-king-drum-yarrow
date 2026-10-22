import { useEffect, useRef, useState } from "react";
import { Crosshair, Pause, Volume2, VolumeX } from "lucide-react";
import type { GameApi, HudTarget, Phase, RunStats, TouchInput } from "@/game/types";

const emptyHud = (): HudTarget => ({
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
  barge: null,
  weapon: null,
  prompt: null,
});

export function Saltwatch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<GameApi | null>(null);
  const hudRef = useRef<HudTarget>(emptyHud());
  const touchRef = useRef<TouchInput>({
    moveX: 0,
    moveY: 0,
    lookX: 0,
    lookY: 0,
    attack: false,
    reload: false,
    use: false,
    melee: false,
  });
  const stickId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const knobRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("menu");
  const [stats, setStats] = useState<RunStats>({ score: 0, wave: 0, best: 0 });
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sens, setSens] = useState(1);
  const [locked, setLocked] = useState(false);
  const [narrow, setNarrow] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 959px), (pointer: coarse)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const sync = () => setLocked(document.pointerLockElement === canvasRef.current);
    document.addEventListener("pointerlockchange", sync);
    return () => document.removeEventListener("pointerlockchange", sync);
  }, []);

  useEffect(() => {
    let dead = false;
    let api: GameApi | null = null;
    void import("@/game/createGame").then(({ mountGame }) => {
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
          setStats((prev) => ({ ...prev, best: meta.best }));
        },
        onError: (message) => {
          if (!dead) setError(message);
        },
      });
      apiRef.current = api;
    });
    return () => {
      dead = true;
      api?.dispose();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (phase === "playing") return;
    touchRef.current.moveX = 0;
    touchRef.current.moveY = 0;
    touchRef.current.attack = false;
    touchRef.current.lookX = 0;
    touchRef.current.lookY = 0;
    if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
  }, [phase]);

  function onLookDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-control]")) return;
    if (phase !== "playing") return;
    if (e.pointerType !== "touch" && document.pointerLockElement !== canvasRef.current) {
      apiRef.current?.requestLock();
    }
    if (document.pointerLockElement === canvasRef.current) return;
    lookId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onLookMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== lookId.current) return;
    if (document.pointerLockElement === canvasRef.current) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    touchRef.current.lookX += dx;
    touchRef.current.lookY += dy;
  }

  function onLookUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== lookId.current) return;
    lookId.current = null;
  }

  function moveStick(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = rect.width * 0.36;
    const mag = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(mag, max);
    dx = (dx / mag) * clamped;
    dy = (dy / mag) * clamped;
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    touchRef.current.moveX = dx / max;
    touchRef.current.moveY = -dy / max;
  }

  const showStick = narrow;
  const showFire = narrow || !locked;
  const playing = phase === "playing";

  return (
    <main className="game-root relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div
        className="absolute inset-0"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      />

      <div
        ref={(el) => {
          hudRef.current.vignette = el;
        }}
        className="vignette pointer-events-none absolute inset-0 opacity-0"
      />

      <div
        className={`pointer-events-none absolute inset-0 ${playing ? "" : "invisible"}`}
      >
        <div className="safe-t flex items-start justify-between px-4">
          <div>
            <p className="text-xs font-medium tracking-widest text-muted uppercase">Score</p>
            <p
              ref={(el) => {
                hudRef.current.score = el;
              }}
              className="font-display text-4xl leading-none"
            >
              0
            </p>
            <p
              ref={(el) => {
                hudRef.current.barge = el;
              }}
              className="mt-1 text-xs font-medium tracking-widest text-primary uppercase"
            >
              600 to the barge
            </p>
            <p
              ref={(el) => {
                hudRef.current.weapon = el;
              }}
              className="mt-2 text-xs font-semibold tracking-widest text-muted uppercase"
            >
              Salt Iron
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium tracking-widest text-muted uppercase">Wave</p>
            <p
              ref={(el) => {
                hudRef.current.wave = el;
              }}
              className="font-display text-4xl leading-none"
            >
              –
            </p>
          </div>
        </div>
        <p
          ref={(el) => {
            hudRef.current.banner = el;
          }}
          className="pointer-events-none absolute top-16 right-0 left-0 text-center font-display text-2xl tracking-wide text-primary italic"
        />

        <div
          ref={(el) => {
            hudRef.current.crosshair = el;
          }}
          className="crosshair absolute top-1/2 left-1/2"
        >
          <span className="up" />
          <span className="down" />
          <span className="left" />
          <span className="right" />
        </div>

        <p
          ref={(el) => {
            hudRef.current.prompt = el;
          }}
          className="pointer-events-none absolute bottom-36 left-1/2 w-max max-w-[90vw] -translate-x-1/2 text-center text-sm font-semibold tracking-widest text-primary uppercase"
        />

        <div className="safe-b absolute inset-x-0 bottom-0 flex items-end justify-between px-4">
          <div className="flex flex-col gap-3">
            <div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-xs font-medium tracking-widest text-muted uppercase">Hull</span>
                <span
                  ref={(el) => {
                    hudRef.current.healthNum = el;
                  }}
                  className="font-display text-2xl leading-none"
                >
                  100
                </span>
              </div>
              <div className="h-2 w-36 overflow-hidden rounded-full bg-border">
                <div
                  ref={(el) => {
                    hudRef.current.healthBar = el;
                  }}
                  className="h-full w-full origin-left bg-primary"
                />
              </div>
            </div>
            {showStick ? (
              <div
                data-control
                className="pointer-events-auto relative h-32 w-32 rounded-full border border-border bg-surface/70"
                aria-label="Move"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  stickId.current = e.pointerId;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  moveStick(e);
                }}
                onPointerMove={(e) => {
                  if (e.pointerId !== stickId.current) return;
                  e.stopPropagation();
                  moveStick(e);
                }}
                onPointerUp={(e) => {
                  if (e.pointerId !== stickId.current) return;
                  stickId.current = null;
                  touchRef.current.moveX = 0;
                  touchRef.current.moveY = 0;
                  if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
                }}
                onPointerCancel={() => {
                  stickId.current = null;
                  touchRef.current.moveX = 0;
                  touchRef.current.moveY = 0;
                  if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
                }}
              >
                <div
                  ref={knobRef}
                  className="absolute top-1/2 left-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-2">
            <p className="text-xs font-medium tracking-widest text-muted uppercase">
              Left <span
                ref={(el) => {
                  hudRef.current.enemies = el;
                }}
              >
                0
              </span>
            </p>
            <p
              ref={(el) => {
                hudRef.current.reloadLabel = el;
              }}
              className="min-h-4 text-xs font-semibold tracking-widest text-accent uppercase"
            />
            <p className="leading-none">
              <span
                ref={(el) => {
                  hudRef.current.mag = el;
                }}
                className="font-display text-5xl"
              >
                18
              </span>
              <span
                ref={(el) => {
                  hudRef.current.reserve = el;
                }}
                className="text-lg text-muted"
              >
                72
              </span>
            </p>
            {showFire ? (
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  data-control
                  className="flex h-12 min-w-12 items-center justify-center rounded-full border border-border bg-surface px-3 text-xs font-semibold tracking-widest text-fg uppercase"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    touchRef.current.use = true;
                  }}
                >
                  Use
                </button>
                <button
                  type="button"
                  data-control
                  className="flex h-12 min-w-12 items-center justify-center rounded-full border border-border bg-surface px-3 text-xs font-semibold tracking-widest text-fg uppercase"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    touchRef.current.melee = true;
                  }}
                >
                  Hit
                </button>
                <button
                  type="button"
                  data-control
                  className="flex h-12 min-w-12 items-center justify-center rounded-full border border-border bg-surface px-3 text-xs font-semibold tracking-widest text-fg uppercase"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    touchRef.current.reload = true;
                  }}
                >
                  Rld
                </button>
                <button
                  type="button"
                  data-control
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-sm font-semibold tracking-widest text-primary-fg uppercase"
                  aria-label="Fire"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    touchRef.current.attack = true;
                  }}
                  onPointerUp={() => {
                    touchRef.current.attack = false;
                  }}
                  onPointerCancel={() => {
                    touchRef.current.attack = false;
                  }}
                >
                  Fire
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {playing ? (
        <button
          type="button"
          data-control
          className="safe-top-btn absolute left-1/2 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface/80 text-fg"
          aria-label="Pause"
          onClick={() => apiRef.current?.pause()}
        >
          <Pause className="size-4" />
        </button>
      ) : null}

      {playing && !locked && !narrow ? (
        <p className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 text-xs tracking-widest text-muted uppercase">
          Drag to look · click the deck to capture the mouse
        </p>
      ) : null}

      {phase === "menu" ? (
        <div className="menu-scrim absolute inset-0 flex flex-col justify-end px-5 pb-8 md:justify-center md:px-16">
          <div className="max-w-md">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Night shift</p>
            <h1 className="font-display text-6xl leading-none italic md:text-7xl">Saltwatch</h1>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-muted">
              The floodgates failed at dusk. Hold the deck, buy the Hawser, then the barge. The berth past the bow has a bunk room upstairs.
            </p>
            {stats.best > 0 ? (
              <p className="mt-3 text-sm text-fg">
                Best score <span className="font-display text-2xl text-primary">{stats.best}</span>
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                id="start-shift"
                type="button"
                disabled={!ready || Boolean(error)}
                className="min-h-12 rounded-full bg-primary px-7 text-base font-semibold text-primary-fg disabled:opacity-50"
                onClick={(e) => {
                  e.currentTarget.blur();
                  apiRef.current?.start();
                }}
              >
                {ready ? "Start the shift" : "Lighting the deck"}
              </button>
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-fg"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  apiRef.current?.setMuted(next);
                }}
              >
                {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>
            </div>
            {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted">
              <li>WASD move</li>
              <li>Mouse or drag looks</li>
              <li>Click or Fire shoots</li>
              <li>R reloads</li>
              <li>Shift sprints</li>
              <li>Esc pauses</li>
              <li>V or Hit is the knife</li>
              <li>F buys doors and guns</li>
              <li>1 2 3 4 swap guns</li>
              <li>900 opens the berth</li>
            </ul>
            <label className="mt-4 flex items-center gap-3 text-sm text-muted">
              Look speed
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={sens}
                aria-label="Look speed"
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setSens(next);
                  apiRef.current?.setSens(next);
                }}
                className="w-32"
              />
            </label>
          </div>
        </div>
      ) : null}

      {phase === "paused" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/70 px-5">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Hold</p>
            <h2 className="font-display text-4xl italic">Watch paused</h2>
            <label className="mt-5 flex items-center justify-between gap-3 text-sm text-muted">
              Look speed
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={sens}
                aria-label="Look speed"
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setSens(next);
                  apiRef.current?.setSens(next);
                }}
                className="w-32"
              />
            </label>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                className="min-h-12 rounded-full bg-primary font-semibold text-primary-fg"
                onClick={(e) => {
                  e.currentTarget.blur();
                  apiRef.current?.resume();
                }}
              >
                Resume
              </button>
              <button
                type="button"
                className="min-h-12 rounded-full border border-border font-semibold text-fg"
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  apiRef.current?.setMuted(next);
                }}
              >
                {muted ? "Sound off" : "Sound on"}
              </button>
              <button
                type="button"
                className="min-h-12 rounded-full text-sm text-muted"
                onClick={() => apiRef.current?.title()}
              >
                Leave the deck
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "dead" ? (
        <div className="absolute inset-0 flex items-end justify-center bg-bg/75 px-5 pb-10 md:items-center">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
            <Crosshair className="size-6 text-accent" />
            <h2 className="mt-2 font-display text-4xl italic">The tide takes the watch</h2>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-xs tracking-widest text-muted uppercase">Score</dt>
                <dd className="font-display text-3xl">{stats.score}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-widest text-muted uppercase">Wave</dt>
                <dd className="font-display text-3xl">{stats.wave}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-widest text-muted uppercase">Best</dt>
                <dd className="font-display text-3xl text-primary">{stats.best}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="mt-6 min-h-12 w-full rounded-full bg-primary font-semibold text-primary-fg"
              onClick={(e) => {
                e.currentTarget.blur();
                apiRef.current?.start();
              }}
            >
              Try again
            </button>
            <button
              type="button"
              className="mt-2 min-h-11 w-full text-sm text-muted"
              onClick={() => apiRef.current?.title()}
            >
              Title
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
