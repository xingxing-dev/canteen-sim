import type { Agent } from './agent';

export interface WindowLoad {
  index: number;
  queueLength: number;
  serviceMean: number;
  queueCapacity?: number;
}

export interface WindowChoice {
  windowIndex: number;
  fallbackLevel: number;
  estimatedWait: number;
}

function estimatedWait(load: WindowLoad): number {
  return load.queueLength * Math.max(0.5, load.serviceMean);
}

function canJoin(load: WindowLoad): boolean {
  return load.queueCapacity === undefined || load.queueLength < load.queueCapacity;
}

/**
 * 偏好优先、队长容忍度降级的窗口选择。
 * 若所有偏好窗口都超过容忍阈值，则选择预计等待时间最低的可加入窗口。
 */
export function selectWindowByPreference(
  agent: Pick<Agent, 'windowPreferences' | 'queueTolerance'>,
  loads: WindowLoad[],
): WindowChoice {
  if (loads.length === 0) {
    return { windowIndex: -1, fallbackLevel: 0, estimatedWait: Infinity };
  }

  const byIndex = new Map(loads.map((load) => [load.index, load]));
  const preferences =
    agent.windowPreferences.length > 0
      ? agent.windowPreferences
      : loads.map((load) => load.index);

  for (let fallbackLevel = 0; fallbackLevel < preferences.length; fallbackLevel++) {
    const load = byIndex.get(preferences[fallbackLevel]);
    if (!load || !canJoin(load)) continue;
    if (load.queueLength <= agent.queueTolerance) {
      return {
        windowIndex: load.index,
        fallbackLevel,
        estimatedWait: estimatedWait(load),
      };
    }
  }

  const fallback = loads
    .filter(canJoin)
    .slice()
    .sort((a, b) => estimatedWait(a) - estimatedWait(b))[0] ?? loads[0];

  return {
    windowIndex: fallback.index,
    fallbackLevel: preferences.length,
    estimatedWait: estimatedWait(fallback),
  };
}
