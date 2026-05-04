import type { Vec2 } from './agent';
import type { SimulationScenario } from './config';

/** 服务窗口 */
export interface ServiceWindow {
  id: number;
  name: string;
  category: string;
  position: Vec2;
  /** 排队等候点（队列从 queueStart 向后延伸） */
  queueStart: Vec2;
  /** 排队方向（单位向量，从窗口向外） */
  queueDirection: Vec2;
  /** 平均服务时间（秒） */
  serviceMean: number;
  /** 服务时间标准差（秒） */
  serviceStd: number;
  /** 可选队列容量；超过后 Agent 会考虑换窗口 */
  queueCapacity?: number;
}

/** 座位 */
export interface Seat {
  id: number;
  position: Vec2;
  occupied: boolean;
}

/** 食堂布局 */
export interface CanteenLayout {
  /** 食堂尺寸（体素网格） */
  width: number;
  depth: number;
  /** 入口位置 */
  entrance: Vec2;
  /** 出口位置 */
  exit: Vec2;
  /** 服务窗口列表 */
  windows: ServiceWindow[];
  /** 座位列表 */
  seats: Seat[];
}

/**
 * 生成默认食堂布局
 * 长条形：窗口沿左墙一排，座位在右侧排列
 */
export function createDefaultLayout(windowCount: number, seatCount: number): CanteenLayout {
  const width = 30;
  const depth = 20;

  // 窗口沿左墙（x = 2）均匀分布
  const windows: ServiceWindow[] = [];
  const windowSpacing = depth / (windowCount + 1);
  for (let i = 0; i < windowCount; i++) {
    const z = windowSpacing * (i + 1);
    windows.push({
      id: i,
      name: `${i + 1}号窗口`,
      category: '常规',
      position: { x: 2, z },
      queueStart: { x: 5, z },
      queueDirection: { x: 1, z: 0 },
      serviceMean: 8,
      serviceStd: 1.5,
    });
  }

  // 座位在右侧区域（x: 16-28），排成多行
  const seats: Seat[] = [];
  const cols = 4;
  const rows = Math.ceil(seatCount / cols);
  const seatAreaStartX = 16;
  const seatAreaStartZ = 2;
  const seatSpacingX = 3;
  const seatSpacingZ = Math.min(2.5, (depth - 4) / rows);

  for (let i = 0; i < seatCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    seats.push({
      id: i,
      position: {
        x: seatAreaStartX + col * seatSpacingX,
        z: seatAreaStartZ + row * seatSpacingZ,
      },
      occupied: false,
    });
  }

  return {
    width,
    depth,
    entrance: { x: width / 2, z: 0 },
    exit: { x: width / 2, z: depth },
    windows,
    seats,
  };
}

/** 根据场景预设生成布局，座位占用状态每次重置为 false */
export function createScenarioLayout(scenario: SimulationScenario): CanteenLayout {
  const seats: Seat[] = [];
  const { count, cols, start, spacingX, spacingZ } = scenario.seats;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    seats.push({
      id: i,
      position: {
        x: start.x + col * spacingX,
        z: start.z + row * spacingZ,
      },
      occupied: false,
    });
  }

  return {
    width: scenario.layout.width,
    depth: scenario.layout.depth,
    entrance: { ...scenario.layout.entrance },
    exit: { ...scenario.layout.exit },
    windows: scenario.windows.map((win) => ({
      ...win,
      position: { ...win.position },
      queueStart: { ...win.queueStart },
      queueDirection: { ...win.queueDirection },
    })),
    seats,
  };
}
