# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/).

## [2.0.0] - 2026-05-04

### Added
- Cinematic intro camera animation (5.2s easeInOutCubic sweep)
- 5 camera presets: Overview / Queue / Seating / Entrance / Cruise
- Cruise mode with orbital path + vertical bobbing
- Demo Mode: 35-second automated 6-phase presentation with subtitles
- Heatmap layer with 3-tier color coding (cyan/orange/red) and pulse animation
- Congestion markers (billboard text + pulsing rings) for overloaded windows
- Glassmorphism UI panels (ControlPanel, StatsPanel, Legend)
- System Insight module (bottleneck identification + smart recommendations)
- Campus labels (entrance/exit/title billboards)
- VoxelAgent walking animation (leg swing + state ring)
- Spotlight lighting (entrance blue, side warm) + hemisphere light
- Fog effect for depth perception
- InstancedMesh floor and walls for performance
- Window plan comparison (6/7/8 windows via UI dropdown)
- Performance baseline tests (100 agents <5ms, 200 agents <10ms)
- GitHub Actions CI/CD (Node 18/20 matrix + Codecov)
- GitHub Pages deployment configuration

### Changed
- Agent rendering: switched to VoxelAgent (body/head/legs) from flat circles
- Stats throttled to 0.25s (was per-frame, caused React thrashing)
- Recharts animation disabled for high-frequency data compatibility
- Lighting upgraded from single directional to 4-source cinematic setup
- Control panel redesigned with scenario switching and camera view grid

## [1.0.0] - 2026-04-21

### Added
- SimulationEngine with `step(dt)` frame-driven loop
- Agent 8-state FSM (Entering → ... → Left)
- Declarative state transition rules (9 rules) + StateMachineExecutor
- Window queue management system (Queuing→Ordering driven by queue position)
- Window selection routing: preference-first + tolerance-degradation + min-wait fallback
- Minghu canteen scenarios: lunch peak (0.95/s) and dinner peak (0.76/s)
- Trapezoidal arrival profile (warmup → sustain → cooldown)
- Seeded random (LCG) for deterministic reproduction
- Box-Muller sampling for service/dining time variance
- Heatmap tracking (grid-based dwell time accumulation)
- Hotspot detection (threshold + proximity clustering)
- 72-seat layout with automatic table placement
- Real-time statistics: avgWait, P95, throughput, seatUtil, abandonRate
- Per-window metrics: queue length, utilization, throughput
- StatsPanel with Recharts area charts (queue trend, wait time trend)
- ControlPanel with Leva integration
- 157 unit/integration/performance tests (Vitest)
- TypeScript strict mode, ESLint configuration
- Vite build with GitHub Pages base path

## [Unreleased]

### Planned (V3)
- Behavior tree integration for dynamic window-switching decisions
- A/B comparison mode (split-screen dual engine)
- Parameter optimizer (grid search / Bayesian)
- Simulation recording and replay
- InstancedMesh agent rendering (500+ agents @ 60fps)
