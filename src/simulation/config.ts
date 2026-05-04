import type { Vec2 } from './agent';

export interface ArrivalProfile {
  /** 平峰到达率（人/秒） */
  baseRate: number;
  /** 高峰到达率（人/秒） */
  peakRate: number;
  /** 从平峰爬升到高峰的时间（秒） */
  warmupSeconds: number;
  /** 高峰平台期（秒） */
  sustainSeconds: number;
  /** 从高峰回落到平峰的时间（秒） */
  cooldownSeconds: number;
}

export interface AgentProfile {
  /** 可接受队列长度均值（人） */
  queueToleranceMean: number;
  /** 可接受队列长度标准差（人） */
  queueToleranceStd: number;
  /** 偏好随机扰动，值越高越不容易集中到同一窗口 */
  preferenceNoise: number;
}

export interface ScenarioWindowConfig {
  id: number;
  name: string;
  category: string;
  position: Vec2;
  queueStart: Vec2;
  queueDirection: Vec2;
  serviceMean: number;
  serviceStd: number;
  queueCapacity?: number;
}

export interface ScenarioSeatBlock {
  count: number;
  cols: number;
  start: Vec2;
  spacingX: number;
  spacingZ: number;
}

export interface SimulationScenario {
  id: string;
  name: string;
  period: 'lunch' | 'dinner';
  description: string;
  seed: number;
  layout: {
    width: number;
    depth: number;
    entrance: Vec2;
    exit: Vec2;
  };
  windows: ScenarioWindowConfig[];
  seats: ScenarioSeatBlock;
  arrivalProfile: ArrivalProfile;
  agentProfile: AgentProfile;
  diningTime: number;
  moveSpeed: number;
  maxPatience: number;
}

/** 仿真参数配置 */
export interface SimulationConfig {
  /** 场景预设；存在时优先使用其中的布局和窗口服务参数 */
  scenario?: SimulationScenario;
  /** 场景 ID，便于 UI/历史记录识别 */
  scenarioId?: string;
  /** 场景展示名称 */
  scenarioName?: string;
  /** 窗口数量 */
  windowCount: number;
  /** 座位数量 */
  seatCount: number;
  /** 每秒到达人数（泊松强度） */
  arrivalRate: number;
  /** 每个窗口平均服务时间（秒） */
  serviceTime: number;
  /** 平均就餐时间（秒） */
  diningTime: number;
  /** Agent 移动速度（单位/秒） */
  moveSpeed: number;
  /** 最大耐心值（秒），超过则离开 */
  maxPatience: number;
  /** 高峰到达曲线；缺省时使用 arrivalRate 常数 */
  arrivalProfile?: ArrivalProfile;
  /** Agent 偏好/容忍度参数 */
  agentProfile?: AgentProfile;
  /** 随机种子，保证作品集演示可复现 */
  seed?: number;
  /** 热力网格尺寸（单位） */
  heatmapCellSize?: number;
  /** 在明湖预设上临时增设的窗口数量 */
  extraWindowCount?: number;
}

export const DEFAULT_CONFIG: SimulationConfig = {
  windowCount: 4,
  seatCount: 40,
  arrivalRate: 0.5,
  serviceTime: 8,
  diningTime: 30,
  moveSpeed: 3,
  maxPatience: 120,
  seed: 2026050312,
  heatmapCellSize: 1,
  agentProfile: {
    queueToleranceMean: 5.5,
    queueToleranceStd: 2,
    preferenceNoise: 0.35,
  },
};

const WINDOW_CATEGORIES = ['面食', '快餐', '盖饭', '清真', '风味', '小吃'];
const WINDOW_MEANS = [7, 8, 9, 10, 11, 12];

function createMinghuWindows(count: number): ScenarioWindowConfig[] {
  const depth = 24;
  const spacing = depth / (count + 1);
  return Array.from({ length: count }, (_, i) => {
    const z = spacing * (i + 1);
    const isExtra = i >= WINDOW_CATEGORIES.length;
    const serviceMean = WINDOW_MEANS[i] ?? 8.5 + (i - WINDOW_CATEGORIES.length) * 0.7;
    const category = isExtra ? '增设快取' : WINDOW_CATEGORIES[i];
    return {
      id: i,
      name: `${i + 1}号 ${category}`,
      category,
      position: { x: 2.4, z },
      queueStart: { x: 5.2, z },
      queueDirection: { x: 1, z: 0 },
      serviceMean,
      serviceStd: Math.max(0.8, serviceMean * 0.18),
      queueCapacity: 18,
    };
  });
}

const MINGHU_LAYOUT = {
  width: 36,
  depth: 24,
  entrance: { x: 18, z: 0 },
  exit: { x: 33, z: 24 },
};

const MINGHU_SEATS: ScenarioSeatBlock = {
  count: 72,
  cols: 6,
  start: { x: 18.5, z: 2.2 },
  spacingX: 2.6,
  spacingZ: 1.7,
};

export const minghuLunchPeak: SimulationScenario = {
  id: 'minghu-lunch-peak',
  name: '明湖餐厅 · 午高峰',
  period: 'lunch',
  description: '课程仿真估算模型：饭点短时集中到达，窗口排队压力明显。',
  seed: 2026050312,
  layout: MINGHU_LAYOUT,
  windows: createMinghuWindows(6),
  seats: MINGHU_SEATS,
  arrivalProfile: {
    baseRate: 0.28,
    peakRate: 0.95,
    warmupSeconds: 120,
    sustainSeconds: 520,
    cooldownSeconds: 180,
  },
  agentProfile: {
    queueToleranceMean: 5.5,
    queueToleranceStd: 2,
    preferenceNoise: 0.35,
  },
  diningTime: 26,
  moveSpeed: 3.4,
  maxPatience: 150,
};

export const minghuDinnerPeak: SimulationScenario = {
  id: 'minghu-dinner-peak',
  name: '明湖餐厅 · 晚高峰',
  period: 'dinner',
  description: '课程仿真估算模型：到达峰值略低，但平台期更长。',
  seed: 2026050318,
  layout: MINGHU_LAYOUT,
  windows: createMinghuWindows(6),
  seats: MINGHU_SEATS,
  arrivalProfile: {
    baseRate: 0.22,
    peakRate: 0.76,
    warmupSeconds: 180,
    sustainSeconds: 780,
    cooldownSeconds: 260,
  },
  agentProfile: {
    queueToleranceMean: 6.5,
    queueToleranceStd: 2.4,
    preferenceNoise: 0.45,
  },
  diningTime: 32,
  moveSpeed: 3.2,
  maxPatience: 180,
};

export const MINGHU_SCENARIOS = [minghuLunchPeak, minghuDinnerPeak] as const;

export type MinghuScenarioId = (typeof MINGHU_SCENARIOS)[number]['id'];

export function getScenarioById(id: string): SimulationScenario {
  return MINGHU_SCENARIOS.find((scenario) => scenario.id === id) ?? minghuLunchPeak;
}

export function withExtraWindows(
  scenario: SimulationScenario,
  extraWindowCount: number,
): SimulationScenario {
  const extra = Math.max(0, Math.min(2, Math.round(extraWindowCount)));
  if (extra === 0) return scenario;
  const totalWindows = scenario.windows.length + extra;
  return {
    ...scenario,
    id: `${scenario.id}+${extra}`,
    name: `${scenario.name}（增设${extra}窗）`,
    windows: createMinghuWindows(totalWindows),
  };
}

export function createScenarioConfig(
  scenario: SimulationScenario = minghuLunchPeak,
  extraWindowCount = 0,
): SimulationConfig {
  const resolvedScenario = withExtraWindows(scenario, extraWindowCount);
  const avgService =
    resolvedScenario.windows.reduce((sum, win) => sum + win.serviceMean, 0) /
    resolvedScenario.windows.length;

  return {
    ...DEFAULT_CONFIG,
    scenario: resolvedScenario,
    scenarioId: scenario.id,
    scenarioName: resolvedScenario.name,
    windowCount: resolvedScenario.windows.length,
    seatCount: resolvedScenario.seats.count,
    arrivalRate: resolvedScenario.arrivalProfile.peakRate,
    serviceTime: avgService,
    diningTime: resolvedScenario.diningTime,
    moveSpeed: resolvedScenario.moveSpeed,
    maxPatience: resolvedScenario.maxPatience,
    arrivalProfile: resolvedScenario.arrivalProfile,
    agentProfile: resolvedScenario.agentProfile,
    seed: resolvedScenario.seed + extraWindowCount * 97,
    extraWindowCount,
  };
}
