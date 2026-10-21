# Extras: what was built, how it was checked, what is open

Branch `extras` (from `extended-models`). Plan: [`extras-plan.md`](extras-plan.md). Every
algorithm follows its paper's own rules; where a rule was approximated or a choice left open,
the code and the page say so.

## Models and schedulers

| Addition | Setting | Source | Checked by |
|---|---|---|---|
| Unreliable compass, static or dynamic | `frames: "compass"`, `compass_error` (°), `compass_static` | Izumi et al., SIAM J. Comput. 2012 | `tests/compass.rs`: deviations stay within ±φ; static never redrawn; dynamic redrawn; φ = 0 is the global frame up to rounding |
| k-ASYNC (bounded asynchrony) | `scheduler: "kasync"`, `k_async` | Kirkpatrick et al., Distributed Computing 2024 | `tests/kasync.rs`: an outside checker never sees more than k Looks in one cycle (k = 1, 2, 3, 15 runs); plain async breaks it; huge k = async event for event; k = 1 still gathers |
| Local multiplicity detection | `multiplicity: "local"` | Kamei et al., SIROCCO 2011 | unit test of `Look::occupied`; SqGathering under it keeps two multiplicities apart (robots on one see κ = 1 and hold) |

## Algorithms

| Algorithm (registry key) | Source | Result |
|---|---|---|
| `CompassGathering`: A_SS, A_SD, A_AD | Izumi et al. 2012 | gathers in every seed tried: static φ = 85° (SSYNC, sequential, async; rigid and not), dynamic synchronous φ = 44°, dynamic async φ = 25° |
| `RandomizedGathering`, `RandomizedGatheringUniform` | Pattanayak, Augustine, Mandal, TCS 2021 (Thms 12, 3) | two robots from mirror-image starts gather in every seed under async, SSYNC, FSYNC |
| `MutualVisibility` | Di Luna et al., Inf. Comput. 2017, §6.7 (sequential, no lights) | lines of 3-12 robots and grids: everyone sees everyone after one epoch, and still after six |
| `CrashGathering` (`Gather_k`) | Pattanayak et al., ICDCN 2017 / JPDC 2019 | working robots gather with 0, 3 and 9 of 10 crashed, from a stacked start, and from robots lined up behind each other |
| Gathering on a ring (`lcm-ring`, `web/ring.html`) | Navarra & Piselli, arXiv:2502.03939 (GatheRRing) | 4,546 random starts outside the unsolvable set (n = 6-16, distinct and stacked, random orders) all gather within n − 3 epochs (Theorem V.1); a deliberately broken m1 fails 60 % of them |

## Approximations and choices (stated in the code and on the page)

- **Crash-tolerant gathering:** the paper's blocked robots follow circular arcs; the engine moves in
  straight lines, so a blocked robot takes one straight step to the middle of the arc, then goes
  straight. The paper's recursive tangent for robots on one ray is not used (their circles are
  nested anyway). Crashes happen at the start here; the paper allows any time.
- **Mutual visibility:** "a small amount" is the paper's; here it is half the distance to the ε band
  around the nearest line through two visible robots, along the middle of the widest free angle.
  The robots never terminate, as in the paper. (Stopping on seeing all n robots was tried and is
  wrong: a later mover that cannot see a stopped robot can hide it.)
- **Randomized gathering:** two robots only; the paper's extension to more robots needs co-located
  robots to merge.
- **Ring:** where the paper lets the adversary choose a side, the choice is explicit: the next
  node, or random from the seed.
- **Compass gathering under async:** robots do not terminate (Remark 2 of the paper); runs go on.

## Core changes these needed (all default to the old behaviour)

- `Algorithm::randomized()`: the "a whole epoch without progress means stalled" check is skipped for
  randomized algorithms (both robots can draw "stay" in the same round and still move later).
- `Algorithm::stops_when_alone()`: the original rule "a robot that sees no other active robot
  terminates" can be switched off by an algorithm. Without this the last working robot in
  crash-tolerant gathering stopped short of the robots already gathered.

## Open

1. **A_AD near its bound.** Theorem 6 says A_AD gathers for every φ < 30°. At φ = 29° some runs had
   not gathered after 500,000 time units (rigid: seed 8; non-rigid with δ = 5: seed 4, gap ~7 × 10⁶),
   while every seed tried gathers at 25°. The rules were checked against the paper's text. Finite
   runs cannot tell "never" from "very slow" (the rotate rule turns by almost 180° there). Kept as the
   ignored test `a_ad_at_29_degrees`: worth raising with the supervisor.
2. The page's new examples and the ring page have no automated browser checks yet (checked by hand
   in the browser: every example loads its own start and ends as described).
3. Not done: Frei & Wada's distinct gathering in the plane (only a brief announcement, rules not
   published); Kamei et al.'s ring algorithm (local detection is modelled, their algorithm is not).

## Try it

- Simulator: pick *Two robots, unreliable compasses*, *Randomized gathering*, *Mutual visibility* or
  *Gathering despite crashes* and open **Examples**. Settings → Robot model has the compass and
  local detection; Settings → Scheduler has k-ASYNC.
- Ring: the target button in the toolbar, or `/web/ring.html`. CLI: `lcm ring config.json --trace`
  with `{"nodes": 9, "robots": [0, 2, 5]}`.
