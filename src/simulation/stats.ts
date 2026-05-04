import type { ServiceWindow } from './layout';

export interface WindowRuntimeStats {
  id: number;
  name: string;
  category: string;
  queueLength: number;
  isServing: boolean;
  servedCount: number;
  avgWaitTime: number;
  maxQueueLength: number;
  utilization: number;
  throughputPerMinute: number;
  serviceMean: number;
}

export interface HeatmapCell {
  x: number;
  z: number;
  value: number;
  normalized: number;
}

export interface Hotspot {
  x: number;
  z: number;
  intensity: number;
  label: string;
}

/** 实时统计数据 */
export interface SimStats {
  /** 仿真已运行时间（秒） */
  elapsedTime: number;
  /** 当前在食堂内的人数 */
  currentAgents: number;
  /** 总共进入过的人数 */
  totalEntered: number;
  /** 已完成用餐离开的人数 */
  totalServed: number;
  /** 因不耐烦离开的人数 */
  totalLeft: number;
  /** 各窗口当前排队人数 */
  queueLengths: number[];
  /** 座位利用率 (0-1) */
  seatUtilization: number;
  /** 座位峰值利用率 (0-1) */
  seatPeakUtilization: number;
  /** 平均等待时间（秒） */
  avgWaitTime: number;
  /** 95 分位等待时间（秒） */
  waitTimeP95: number;
  /** 因队列过久放弃的比例 (0-1) */
  abandonRate: number;
  /** 窗口总吞吐（人/分钟） */
  throughputPerMinute: number;
  /** 因找不到座位直接离开的人数 */
  totalSeatFailures: number;
  /** 平均从进门到离开的完整周期（秒） */
  avgCycleTime: number;
  /** 各窗口独立统计 */
  perWindow: WindowRuntimeStats[];
  /** 地面停留热力网格 */
  heatmap: HeatmapCell[];
  /** 拥堵热点 Top N */
  hotspots: Hotspot[];
}

export function createEmptyStats(windowCount: number, windows?: ServiceWindow[]): SimStats {
  return {
    elapsedTime: 0,
    currentAgents: 0,
    totalEntered: 0,
    totalServed: 0,
    totalLeft: 0,
    queueLengths: new Array(windowCount).fill(0),
    seatUtilization: 0,
    seatPeakUtilization: 0,
    avgWaitTime: 0,
    waitTimeP95: 0,
    abandonRate: 0,
    throughputPerMinute: 0,
    totalSeatFailures: 0,
    avgCycleTime: 0,
    perWindow: Array.from({ length: windowCount }, (_, index) => {
      const win = windows?.[index];
      return {
        id: index,
        name: win?.name ?? `${index + 1}号窗口`,
        category: win?.category ?? '常规',
        queueLength: 0,
        isServing: false,
        servedCount: 0,
        avgWaitTime: 0,
        maxQueueLength: 0,
        utilization: 0,
        throughputPerMinute: 0,
        serviceMean: win?.serviceMean ?? 0,
      };
    }),
    heatmap: [],
    hotspots: [],
  };
}
