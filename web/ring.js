/* Ring page: GatheRRing (crates/lcm-ring) run turn by turn in the browser,
 * through the WasmRing binding of web/pkg. The page owns the start (nodes,
 * robots, order, ties); every change rebuilds the run from it. */
import { icon, renderIcons } from "./icons.js";

const $ = (id) => document.getElementById(id);
renderIcons();

const PRESETS = [
  { label: "Three robots, all apart", nodes: 9, robots: [0, 2, 5] },
  { label: "Seven robots, some stacked", nodes: 12, robots: [0, 0, 3, 4, 4, 8, 9] },
  { label: "Ten robots on fifteen nodes", nodes: 15, robots: [0, 1, 3, 4, 6, 8, 9, 11, 12, 14] },
  { label: "6-ring, two islands of two", nodes: 6, robots: [0, 1, 3, 4] },
  { label: "Every node but two", nodes: 10, robots: [0, 1, 2, 4, 5, 6, 7, 8] },
  { label: "Unsolvable: three in a row", nodes: 9, robots: [3, 4, 5] },
  { label: "Unsolvable: a full 5-ring", nodes: 5, robots: [0, 1, 2, 3, 4] },
];

let wasm = null;
let ring = null;      // the WasmRing being played
let start = { nodes: 9, robots: [0, 2, 5] };
let state = null;
let trace = [];
let timer = 0;

$("preset").innerHTML = `<option value="">Your own</option>` + PRESETS.map((p, k) => `<option value="${k}">${p.label}</option>`).join("");

function config() {
  const order = $("order").value.split(/[\s,;]+/).filter(Boolean).map(Number);
  return {
    nodes: start.nodes,
    robots: start.robots,
    order: order.length ? order : null,
    ties: $("ties").value,
    seed: 7,
  };
}

function rebuild() {
  stop();
  trace = [];
  ring?.free();
  ring = null;
  if (!start.robots.length) { state = null; draw(); say("Click nodes to place robots."); return; }
  try {
    ring = new wasm.WasmRing(JSON.stringify(config()));
    state = JSON.parse(ring.state());
    say("");
  } catch (e) {
    state = null;
    say(`<strong>Cannot start:</strong> ${String(e.message ?? e)}`);
  }
  draw();
}

function say(html) { $("ring_status").innerHTML = html; }

function step() {
  if (!ring || state.status !== "running") return false;
  const t = JSON.parse(ring.step());
  if (!t) return false;
  trace.push(t);
  state = JSON.parse(ring.state());
  draw(t);
  return state.status === "running";
}

function play() {
  if (timer) { stop(); return; }
  if (!ring || state.status !== "running") return;
  $("play").innerHTML = `${icon("pause")}<span class="label">Pause</span>`;
  const tick = () => { if (step()) timer = setTimeout(tick, Number($("speed").value)); else stop(); };
  timer = setTimeout(tick, 0);
}
function stop() {
  clearTimeout(timer);
  timer = 0;
  $("play").innerHTML = `${icon("play")}<span class="label">Play</span>`;
}

const STATUS = { running: "Running", gathered: "Gathered", stalled: "Stalled: a whole epoch without a move", incomplete: "Stopped at the epoch limit" };

function draw(last = null) {
  const n = start.nodes, R = 120;
  const at = (v) => { const a = -Math.PI / 2 + (2 * Math.PI * v) / n; return [R * Math.cos(a), R * Math.sin(a)]; };
  const positions = state?.positions ?? start.robots;
  const count = new Array(n).fill(0);
  const ids = Array.from({ length: n }, () => []);
  positions.forEach((v, r) => { count[v]++; ids[v].push(r); });
  const biggest = Math.max(0, ...(state?.holes ?? []).map((h) => h[1]));
  const big = new Array(n).fill(false);
  for (const [first, len] of state?.holes ?? []) if (len === biggest) for (let k = 0; k < len; k++) big[(first + k) % n] = true;
  const nodeR = Math.max(7, Math.min(16, 300 / n));
  let svg = `<defs><marker id="tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" style="color:var(--sg-active)"/></marker></defs>`;
  svg += `<circle class="edge" r="${R}"/>`;
  for (let v = 0; v < n; v++) {
    const [x, y] = at(v);
    svg += `<circle class="node${count[v] ? " occupied" : ""}${big[v] ? " hole-big" : ""}" data-node="${v}" cx="${x}" cy="${y}" r="${nodeR}"/>`;
    const [lx, ly] = [x * 1.2, y * 1.2];
    svg += `<text class="label" x="${lx}" y="${ly}">${v}</text>`;
  }
  const gathered = state?.status === "gathered";
  for (let v = 0; v < n; v++) {
    if (!count[v]) continue;
    const [x, y] = at(v);
    const isNext = state && state.status === "running" && ids[v].includes(state.next);
    svg += `<circle class="robot${isNext ? " next" : ""}${gathered ? " ring-gathered" : ""}" cx="${x}" cy="${y}" r="${nodeR - 3}" pointer-events="none"/>`;
    if (count[v] > 1) svg += `<text class="count" x="${x}" y="${y}">${count[v]}</text>`;
    const [ix, iy] = [x * 0.78, y * 0.78];
    svg += `<text class="ids" x="${ix}" y="${iy}">${ids[v].map((r) => `R${r}`).join(" ")}</text>`;
  }
  // Where the next robot will go.
  if (state && state.status === "running" && (state.move === 1 || state.move === -1)) {
    const from = positions[state.next], to = (from + state.move + n) % n;
    const a0 = -Math.PI / 2 + (2 * Math.PI * from) / n, a1 = -Math.PI / 2 + (2 * Math.PI * to) / n;
    const rr = R + nodeR + 8, sweep = state.move === 1 ? 1 : 0;
    svg += `<path class="arrow" d="M${rr * Math.cos(a0)},${rr * Math.sin(a0)} A${rr},${rr} 0 0 ${sweep} ${rr * Math.cos(a1)},${rr * Math.sin(a1)}"/>`;
  }
  $("ring").innerHTML = svg;

  const facts = state ? [
    ["Status", STATUS[state.status] ?? state.status],
    ["Epochs", `${state.epochs} (bound n − 3 = ${state.bound})`],
    ["Activations", state.turns],
    ["Robots · occupied nodes", `${positions.length} · ${count.filter((c) => c).length}`],
    ["Next robot", state.status === "running" ? `R${state.next}` : "—"],
    ["Its task", state.status === "running" ? state.task : "—"],
    ["Its rule", state.status === "running" ? state.rule + (state.move === 2 ? " (the adversary picks the side)" : "") : "—"],
  ] : [["Robots", positions.length]];
  $("facts").innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  const why = state?.unsolvable;
  $("warning").hidden = !why;
  if (why) $("warning").innerHTML = `<strong>In the unsolvable set:</strong> ${why}. No algorithm gathers every such start under round robin, so GatheRRing is not expected to.`;
  if (last) say(`R${last.robot}: ${last.from === last.to ? `stays on ${last.from}` : `${last.from} → ${last.to}`} · ${last.task} · ${last.rule}`);
  else if (gathered) say("<strong>Gathered</strong>: every robot on one node.");
  $("trace").querySelector("tbody").innerHTML = trace.slice(-200).reverse().map((t) =>
    `<tr class="${t.from !== t.to ? "moved" : ""}"><td>${t.turn}</td><td>${t.epoch}</td><td>R${t.robot}</td><td>${t.from === t.to ? `${t.from}` : `${t.from} → ${t.to}`}</td><td>${t.task}</td><td>${t.rule}</td></tr>`).join("");
}

/* Editing the start: click a node to add a robot, right-click (or long-press) to take one off. */
function editNode(v, add) {
  const robots = [...start.robots];
  if (add) robots.push(v);
  else { const k = robots.lastIndexOf(v); if (k < 0) return; robots.splice(k, 1); }
  start = { nodes: start.nodes, robots };
  $("preset").value = "";
  $("order").value = "";
  rebuild();
}
let press = 0;
$("ring").addEventListener("pointerdown", (e) => {
  const v = e.target.closest?.("[data-node]")?.dataset.node;
  if (v === undefined) return;
  press = setTimeout(() => { press = -1; editNode(Number(v), false); }, 550);
});
$("ring").addEventListener("pointerup", (e) => {
  const v = e.target.closest?.("[data-node]")?.dataset.node;
  const long = press === -1;
  clearTimeout(press);
  press = 0;
  if (v === undefined || long || e.button !== 0) return;
  editNode(Number(v), true);
});
$("ring").addEventListener("contextmenu", (e) => {
  const v = e.target.closest?.("[data-node]")?.dataset.node;
  e.preventDefault();
  if (v !== undefined) editNode(Number(v), false);
});

$("preset").addEventListener("change", () => {
  const p = PRESETS[Number($("preset").value)];
  if (!p) return;
  start = { nodes: p.nodes, robots: [...p.robots] };
  $("nodes").value = p.nodes;
  $("order").value = "";
  rebuild();
});
$("nodes").addEventListener("change", () => {
  const n = Math.max(3, Math.min(60, Number($("nodes").value) || 3));
  $("nodes").value = n;
  start = { nodes: n, robots: start.robots.filter((v) => v < n) };
  $("preset").value = "";
  rebuild();
});
$("order").addEventListener("change", rebuild);
$("ties").addEventListener("change", rebuild);
$("reset").addEventListener("click", rebuild);
$("step").addEventListener("click", () => { stop(); step(); });
$("play").addEventListener("click", play);
$("clear").addEventListener("click", () => { start = { nodes: start.nodes, robots: [] }; $("preset").value = ""; rebuild(); });
window.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, select, textarea")) return;
  if (e.key === " ") { e.preventDefault(); play(); }
  if (e.key === "ArrowRight") { e.preventDefault(); stop(); step(); }
});

/* Theme, shared with the other pages. */
const THEMES = ["system", "light", "dark"];
function current() { try { return localStorage.getItem("lcm-theme") || "system"; } catch { return "system"; } }
function apply(t) {
  if (t === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { localStorage.setItem("lcm-theme", t); } catch {}
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  $("theme").innerHTML = icon(dark ? "sun" : "moon");
}
$("theme").addEventListener("click", () => apply(THEMES[(THEMES.indexOf(current()) + 1) % THEMES.length]));
apply(current());

/* The core, with the build id so a cached older package is never used. */
(async () => {
  const { id } = await fetch("./pkg/build.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const suffix = id ? `?v=${encodeURIComponent(id)}` : "";
  const module = await import(`./pkg/lcm_wasm.js${suffix}`);
  await module.default(`./pkg/lcm_wasm_bg.wasm${suffix}`);
  wasm = module;
  window.lcmRing = { get state() { return state; }, get trace() { return trace; }, step, rebuild, setStart: (s) => { start = s; $("nodes").value = s.nodes; rebuild(); } };
  $("preset").value = "0";
  $("preset").dispatchEvent(new Event("change"));
})();
