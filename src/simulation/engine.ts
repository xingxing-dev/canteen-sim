import { Agent, AgentState, resetAgentIds } from './agent';
import type { SimulationConfig } from './config';
import { DEFAULT_CONFIG, createScenarioConfig, minghuLunchPeak } from './config';
import type { CanteenLayout } from './layout';
import { createDefaultLayout, createScenarioLayout } from './layout';
import type { HeatmapCell, Hotspot, SimStats } from './stats';
import { createEmptyStats } from './stats';
import type { WindowLoad } from './routing';
import { selectWindowByPreference } from './routing';
import { StateMachineExecutor } from './state-machine/executor';
import { STATE_TRANSITION_RULES } from './state-machine/rules';
import type { Effect } from './state-machine/types';

/** 窗口队列 */
interface WindowQueue {
  agents: Agent[];
  /** 当前正在服务的 Agent */
  serving: Agent | null;
  busyTime: number;
  servedCount: number;
  waitTimes: number[];
  maxQueueLength: number;
}

const FSM_MANAGED_STATES = new Set<AgentState>([
  AgentState.Entering,
  AgentState.Queuing,
  AgentState.FindingSeat,
  AgentState.Dining,
  AgentState.Leaving,
]);

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function samplePositiveNormal(
  random: () => number,
  mean: number,
  std: number,
  min = 0.5,
): number {
  if (std <= 0) return Math.max(min, mean);
  const u1 = Math.max(random(), 1e-6);
  const u2 = Math.max(random(), 1e-6);
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(min, mean + z0 * std);
}

export class SimulationEngine {
  config: SimulationConfig;
  layout: CanteenLayout;
  agents: Agent[] = [];
  stats: SimStats;

  private windowQueues: WindowQueue[];
  private arrivalAccum = 0;
  private running = false;
  private waitTimes: number[] = [];
  private cycleTimes: number[] = [];
  private heatmap: number[][] = [];
  private heatmapCols = 0;
  private heatmapRows = 0;
  private random: () => number;

  /** FSM 执行器：负责状态转移条件检查，返回 effects 列表 */
  private fsmExecutor: StateMachineExecutor;

  constructor(config: SimulationConfig = createScenarioConfig(minghuLunchPeak)) {
    this.config = this.normalizeConfig(config);
    this.layout = this.createLayout();
    this.stats = createEmptyStats(this.config.windowCount, this.layout.windows);
    this.windowQueues = this.createWindowQueues();
    this.random = createSeededRandom(this.config.seed ?? 1);
    this.heatmap = [];
    this.resetHeatmap();

    const fsmRules = STATE_TRANSITION_RULES.filter(
      (rule) => !(rule.fromState === AgentState.Queuing && rule.toState === AgentState.Ordering),
    );
    this.fsmExecutor = new StateMachineExecutor(fsmRules);
  }

  /** 重置仿真 */
  reset(config?: SimulationConfig) {
    if (config) this.config = this.normalizeConfig(config);
    resetAgentIds();
    this.layout = this.createLayout();
    this.agents = [];
    this.stats = createEmptyStats(this.config.windowCount, this.layout.windows);
    this.windowQueues = this.createWindowQueues();
    this.arrivalAccum = 0;
    this.waitTimes = [];
    this.cycleTimes = [];
    this.random = createSeededRandom(this.config.seed ?? 1);
    this.resetHeatmap();
  }

  get isRunning() {
    return this.running;
  }

  start() {
    this.running = true;
  }

  pause() {
    this.running = false;
  }

  /** 当前窗口负载快照，包含正在服务的人 */
  getWindowLoads(): WindowLoad[] {
    return this.windowQueues.map((queue, index) => {
      const win = this.layout.windows[index];
      return {
        index,
        queueLength: queue.agents.length + (queue.serving ? 1 : 0),
        serviceMean: win?.serviceMean ?? this.config.serviceTime,
        queueCapacity: win?.queueCapacity,
      };
    });
  }

  chooseWindowForAgent(agent: Agent) {
    return selectWindowByPreference(agent, this.getWindowLoads());
  }

  /** 推进一个时间步 */
  step(dt: number) {
    if (!this.running) return;

    this.stats.elapsedTime += dt;

    this.arrivalAccum += this.getArrivalRate() * dt;
    while (this.arrivalAccum >= 1) {
      this.arrivalAccum -= 1;
      this.spawnAgent();
    }

    for (const agent of this.agents) {
      this.updateAgent(agent, dt);
    }

    this.updateWindowQueues(dt);
    this.recordHeatmap(dt);
    this.updateStats();
  }

  private normalizeConfig(config: SimulationConfig): SimulationConfig {
    if (config.scenario) {
      return {
        ...DEFAULT_CONFIG,
        ...config,
        scenarioId: config.scenarioId ?? config.scenario.id,
        scenarioName: config.scenarioName ?? config.scenario.name,
        windowCount: config.scenario.windows.length,
        seatCount: config.scenario.seats.count,
        arrivalProfile: config.scenario.arrivalProfile,
        agentProfile: config.scenario.agentProfile,
        diningTime: config.diningTime ?? config.scenario.diningTime,
        moveSpeed: config.moveSpeed ?? config.scenario.moveSpeed,
        maxPatience: config.maxPatience ?? config.scenario.maxPatience,
        seed: config.seed ?? config.scenario.seed,
      };
    }

    return {
      ...DEFAULT_CONFIG,
      ...config,
      windowCount: config.windowCount,
      seatCount: config.seatCount,
    };
  }

  private createLayout(): CanteenLayout {
    if (this.config.scenario) return createScenarioLayout(this.config.scenario);
    const layout = createDefaultLayout(this.config.windowCount, this.config.seatCount);
    layout.windows = layout.windows.map((win) => ({
      ...win,
      serviceMean: this.config.serviceTime,
      serviceStd: Math.max(0.5, this.config.serviceTime * 0.18),
    }));
    return layout;
  }

  private createWindowQueues(): WindowQueue[] {
    return this.layout.windows.map(() => ({
      agents: [],
      serving: null,
      busyTime: 0,
      servedCount: 0,
      waitTimes: [],
      maxQueueLength: 0,
    }));
  }

  private resetHeatmap() {
    const cellSize = this.config.heatmapCellSize ?? 1;
    this.heatmapCols = Math.max(1, Math.ceil(this.layout.width / cellSize));
    this.heatmapRows = Math.max(1, Math.ceil(this.layout.depth / cellSize));
    this.heatmap = Array.from({ length: this.heatmapRows }, () =>
      new Array(this.heatmapCols).fill(0),
    );
  }

  private getArrivalRate(): number {
    const profile = this.config.arrivalProfile;
    if (!profile) return this.config.arrivalRate;

    const t = this.stats.elapsedTime;
    if (t < profile.warmupSeconds) {
      const k = t / Math.max(profile.warmupSeconds, 1);
      return profile.baseRate + (profile.peakRate - profile.baseRate) * k;
    }

    const plateauEnd = profile.warmupSeconds + profile.sustainSeconds;
    if (t < plateauEnd) return profile.peakRate;

    const cooldownEnd = plateauEnd + profile.cooldownSeconds;
    if (t < cooldownEnd) {
      const k = (t - plateauEnd) / Math.max(profile.cooldownSeconds, 1);
      return profile.peakRate + (profile.baseRate - profile.peakRate) * k;
    }

    return profile.baseRate;
  }

  private spawnAgent() {
    const jitter = (this.random() - 0.5) * 4;
    const spawn = {
      x: this.layout.entrance.x + jitter,
      z: this.layout.entrance.z - 1,
    };
    const profile = this.config.agentProfile ?? DEFAULT_CONFIG.agentProfile;
    const queueTolerance = Math.round(
      samplePositiveNormal(
        this.random,
        profile?.queueToleranceMean ?? 5,
        profile?.queueToleranceStd ?? 1.5,
        0,
      ),
    );
    const maxPatience = samplePositiveNormal(
      this.random,
      this.config.maxPatience,
      this.config.maxPatience * 0.12,
      15,
    );
    const agent = new Agent(spawn, this.config.moveSpeed, maxPatience, {
      windowPreferences: this.createWindowPreferences(),
      queueTolerance,
      enteredAtTime: this.stats.elapsedTime,
    });
    this.agents.push(agent);
    this.stats.totalEntered++;
  }

  private createWindowPreferences(): number[] {
    const preferences = this.layout.windows.map((win) => win.id);
    if (preferences.length === 0) return preferences;

    for (let i = preferences.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [preferences[i], preferences[j]] = [preferences[j], preferences[i]];
    }

    const profile = this.config.agentProfile ?? DEFAULT_CONFIG.agentProfile;
    if ((profile?.preferenceNoise ?? 0) < this.random()) {
      const fastFirst = preferences
        .slice()
        .sort((a, b) => this.layout.windows[a].serviceMean - this.layout.windows[b].serviceMean);
      const favorite = preferences[0];
      return [favorite, ...fastFirst.filter((id) => id !== favorite)];
    }

    return preferences;
  }

  private updateAgent(agent: Agent, dt: number) {
    switch (agent.state) {
      case AgentState.Entering:
        this.tickEntering(agent, dt);
        break;

      case AgentState.ChoosingWindow:
        this.handleChoosingWindow(agent);
        return;

      case AgentState.Queuing:
        this.tickQueuing(agent, dt);
        break;

      case AgentState.Ordering:
        this.tickOrdering(agent, dt);
        return;

      case AgentState.FindingSeat:
        this.tickFindingSeat(agent, dt);
        break;

      case AgentState.Dining:
        this.tickDining(agent, dt);
        break;

      case AgentState.Leaving:
        this.tickLeaving(agent, dt);
        break;

      default:
        return;
    }

    if (!FSM_MANAGED_STATES.has(agent.state)) return;

    const result = this.fsmExecutor.execute(agent, dt);
    if (result.transitioned) {
      this.applyEffects(result.effects, agent);
    }
  }

  /** Entering tick：设置目标并向入口移动 */
  private tickEntering(agent: Agent, dt: number) {
    if (!agent.target) {
      agent.target = { x: this.layout.entrance.x, z: this.layout.entrance.z + 2 };
    }
    agent.moveToward(dt);
  }

  /** Queuing tick：继续向排队位置移动，减少耐心值 */
  private tickQueuing(agent: Agent, dt: number) {
    agent.moveToward(dt);
    agent.stateTimer += dt;
    agent.patience -= dt;
    this.updateQueueTarget(agent);
  }

  /** Ordering tick：走向窗口柜台（服务计时由 updateWindowQueues 管理） */
  private tickOrdering(agent: Agent, dt: number) {
    if (agent.target) {
      agent.moveToward(dt);
    }
  }

  private tickFindingSeat(agent: Agent, dt: number) {
    if (agent.assignedSeat < 0) {
      const seat = this.layout.seats.find((candidate) => !candidate.occupied);
      if (seat) {
        seat.occupied = true;
        agent.assignedSeat = seat.id;
        agent.target = { ...seat.position };
      }
      return;
    }
    agent.moveToward(dt);
  }

  private tickDining(agent: Agent, dt: number) {
    agent.stateTimer += dt;
  }

  private tickLeaving(agent: Agent, dt: number) {
    agent.moveToward(dt);
  }

  private updateQueueTarget(agent: Agent) {
    if (agent.assignedWindow < 0) return;
    const queue = this.windowQueues[agent.assignedWindow];
    if (!queue) return;

    const posInQueue = queue.agents.indexOf(agent);
    if (posInQueue < 0) return;

    const win = this.layout.windows[agent.assignedWindow];
    agent.target = {
      x: win.queueStart.x + win.queueDirection.x * posInQueue * 1.2,
      z: win.queueStart.z + win.queueDirection.z * posInQueue * 1.2,
    };
  }

  private handleChoosingWindow(agent: Agent) {
    const choice = this.chooseWindowForAgent(agent);
    if (choice.windowIndex < 0) {
      agent.target = { ...this.layout.exit };
      agent.state = AgentState.Leaving;
      return;
    }

    agent.assignedWindow = choice.windowIndex;
    agent.fallbackLevel = choice.fallbackLevel;
    agent.waitStartTime = this.stats.elapsedTime;

    const queue = this.windowQueues[choice.windowIndex];
    queue.agents.push(agent);
    queue.maxQueueLength = Math.max(
      queue.maxQueueLength,
      queue.agents.length + (queue.serving ? 1 : 0),
    );
    this.updateQueueTarget(agent);

    agent.state = AgentState.Queuing;
    agent.stateTimer = 0;
  }

  private applyEffects(effects: Effect[], agent: Agent) {
    for (const effect of effects) {
      switch (effect.type) {
        case 'update_state': {
          const newState = effect.payload.state as AgentState;
          this.onStateTransition(agent, agent.state, newState);
          agent.state = newState;
          break;
        }

        case 'reset_timer':
          agent.stateTimer = 0;
          break;

        case 'set_duration': {
          const durationKey = effect.payload.duration as string;
          if (durationKey === 'serviceTime') {
            agent.stateDuration = samplePositiveNormal(
              this.random,
              this.config.serviceTime,
              this.config.serviceTime * 0.18,
              0.5,
            );
          } else if (durationKey === 'diningTime') {
            agent.stateDuration = samplePositiveNormal(
              this.random,
              this.config.diningTime,
              this.config.diningTime * 0.2,
              2,
            );
          }
          break;
        }

        case 'dequeue_agent':
          this.removeFromQueue(agent);
          break;

        case 'release_seat':
          if (agent.assignedSeat >= 0) {
            const seat = this.layout.seats[agent.assignedSeat];
            if (seat) seat.occupied = false;
          }
          break;

        default:
          break;
      }
    }
  }

  private onStateTransition(agent: Agent, fromState: AgentState, toState: AgentState) {
    if (toState !== AgentState.Leaving) return;

    agent.target = { ...this.layout.exit };

    if (fromState === AgentState.Queuing) {
      this.stats.totalLeft++;
    }

    if (fromState === AgentState.FindingSeat) {
      this.stats.totalSeatFailures++;
    }

    if (fromState === AgentState.Dining) {
      this.stats.totalServed++;
      this.cycleTimes.push(this.stats.elapsedTime - agent.enteredAtTime);
    }
  }

  private updateWindowQueues(dt: number) {
    for (let i = 0; i < this.windowQueues.length; i++) {
      const queue = this.windowQueues[i];
      const win = this.layout.windows[i];

      if (!queue.serving && queue.agents.length > 0) {
        const first = queue.agents[0];
        const dx = first.position.x - win.queueStart.x;
        const dz = first.position.z - win.queueStart.z;
        if (dx * dx + dz * dz < 0.5) {
          queue.agents.shift();
          queue.serving = first;
          first.state = AgentState.Ordering;
          first.stateTimer = 0;
          first.stateDuration = this.sampleWindowServiceDuration(i);
          first.target = {
            x: win.position.x + 1.5,
            z: win.position.z,
          };

          const waitTime = first.waitStartTime === null
            ? first.stateTimer
            : this.stats.elapsedTime - first.waitStartTime;
          queue.waitTimes.push(waitTime);
          this.waitTimes.push(waitTime);
        }
      }

      if (queue.serving) {
        queue.busyTime += dt;
        queue.serving.stateTimer += dt;
        if (queue.serving.stateTimer >= queue.serving.stateDuration) {
          queue.serving.state = AgentState.FindingSeat;
          queue.serving.stateTimer = 0;
          queue.serving.servedAtTime = this.stats.elapsedTime;
          queue.servedCount++;
          queue.serving = null;
        }
      }

      queue.maxQueueLength = Math.max(
        queue.maxQueueLength,
        queue.agents.length + (queue.serving ? 1 : 0),
      );
    }
  }

  private sampleWindowServiceDuration(windowIndex: number): number {
    const win = this.layout.windows[windowIndex];
    return samplePositiveNormal(
      this.random,
      win?.serviceMean ?? this.config.serviceTime,
      win?.serviceStd ?? this.config.serviceTime * 0.18,
      0.5,
    );
  }

  private removeFromQueue(agent: Agent) {
    if (agent.assignedWindow >= 0) {
      const queue = this.windowQueues[agent.assignedWindow];
      const idx = queue?.agents.indexOf(agent) ?? -1;
      if (idx >= 0) queue.agents.splice(idx, 1);
    }
  }

  private recordHeatmap(dt: number) {
    const cellSize = this.config.heatmapCellSize ?? 1;
    for (const agent of this.agents) {
      if (agent.state === AgentState.Left) continue;
      const col = Math.floor(agent.position.x / cellSize);
      const row = Math.floor(agent.position.z / cellSize);
      if (row < 0 || row >= this.heatmapRows || col < 0 || col >= this.heatmapCols) {
        continue;
      }
      this.heatmap[row][col] += dt;
    }
  }

  private updateStats() {
    const active = this.agents.filter((agent) => agent.state !== AgentState.Left);
    this.stats.currentAgents = active.length;

    this.stats.queueLengths = this.windowQueues.map(
      (queue) => queue.agents.length + (queue.serving ? 1 : 0),
    );

    const occupied = this.layout.seats.filter((seat) => seat.occupied).length;
    this.stats.seatUtilization = this.layout.seats.length > 0
      ? occupied / this.layout.seats.length
      : 0;
    this.stats.seatPeakUtilization = Math.max(
      this.stats.seatPeakUtilization,
      this.stats.seatUtilization,
    );

    this.stats.avgWaitTime = average(this.waitTimes);
    this.stats.waitTimeP95 = percentile(this.waitTimes, 0.95);
    this.stats.abandonRate = this.stats.totalEntered > 0
      ? this.stats.totalLeft / this.stats.totalEntered
      : 0;
    this.stats.avgCycleTime = average(this.cycleTimes);

    const elapsedMinutes = Math.max(this.stats.elapsedTime / 60, 1 / 60);
    const totalWindowServed = this.windowQueues.reduce(
      (sum, queue) => sum + queue.servedCount,
      0,
    );
    this.stats.throughputPerMinute = totalWindowServed / elapsedMinutes;

    this.stats.perWindow = this.windowQueues.map((queue, index) => {
      const win = this.layout.windows[index];
      return {
        id: win.id,
        name: win.name,
        category: win.category,
        queueLength: queue.agents.length + (queue.serving ? 1 : 0),
        isServing: queue.serving !== null,
        servedCount: queue.servedCount,
        avgWaitTime: average(queue.waitTimes),
        maxQueueLength: queue.maxQueueLength,
        utilization: this.stats.elapsedTime > 0
          ? Math.min(1, queue.busyTime / this.stats.elapsedTime)
          : 0,
        throughputPerMinute: queue.servedCount / elapsedMinutes,
        serviceMean: win.serviceMean,
      };
    });

    const heatmapCells = this.buildHeatmapCells();
    this.stats.heatmap = heatmapCells;
    this.stats.hotspots = this.findHotspots(heatmapCells);
  }

  private buildHeatmapCells(): HeatmapCell[] {
    const cellSize = this.config.heatmapCellSize ?? 1;
    let maxValue = 0;
    for (const row of this.heatmap) {
      for (const value of row) {
        maxValue = Math.max(maxValue, value);
      }
    }
    if (maxValue <= 0) return [];

    const cells: HeatmapCell[] = [];
    for (let row = 0; row < this.heatmapRows; row++) {
      for (let col = 0; col < this.heatmapCols; col++) {
        const value = this.heatmap[row][col];
        if (value <= 0) continue;
        cells.push({
          x: col * cellSize + cellSize / 2,
          z: row * cellSize + cellSize / 2,
          value,
          normalized: value / maxValue,
        });
      }
    }
    return cells;
  }

  private findHotspots(cells: HeatmapCell[]): Hotspot[] {
    const hotspots: Hotspot[] = [];
    const sorted = cells
      .filter((cell) => cell.normalized >= 0.15)
      .slice()
      .sort((a, b) => b.value - a.value);

    for (const cell of sorted) {
      const tooClose = hotspots.some((spot) => {
        const dx = spot.x - cell.x;
        const dz = spot.z - cell.z;
        return dx * dx + dz * dz < 6.25;
      });
      if (tooClose) continue;
      hotspots.push({
        x: cell.x,
        z: cell.z,
        intensity: cell.normalized,
        label: this.describeHotspot(cell),
      });
      if (hotspots.length >= 3) break;
    }

    return hotspots;
  }

  private describeHotspot(cell: HeatmapCell): string {
    const nearestWindow = this.layout.windows
      .map((win) => ({
        win,
        distance: Math.abs(win.queueStart.z - cell.z) + Math.max(0, win.queueStart.x - cell.x),
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (
      nearestWindow &&
      Math.abs(nearestWindow.win.queueStart.z - cell.z) < 1.4 &&
      cell.x >= nearestWindow.win.position.x &&
      cell.x <= nearestWindow.win.queueStart.x + 18
    ) {
      return `${nearestWindow.win.name}排队区`;
    }

    const entranceDx = cell.x - this.layout.entrance.x;
    const entranceDz = cell.z - this.layout.entrance.z;
    if (entranceDx * entranceDx + entranceDz * entranceDz < 16) {
      return '主入口缓冲区';
    }

    const seatZoneX = this.layout.width * 0.48;
    if (cell.x >= seatZoneX) return '座位区通道';

    return '公共通道';
  }

  /** 清理已离开的 Agent（防止数组无限增长） */
  cleanup() {
    this.agents = this.agents.filter((agent) => agent.state !== AgentState.Left);
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[index];
}
