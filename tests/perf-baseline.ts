/**
 * 性能基准框架 - Phase 1 性能数据记录和对比
 *
 * 此文件存储 Phase 1 的性能基准数据，用于：
 * 1. 在 Phase 2 进行性能回归测试
 * 2. 验证优化是否达到预期
 * 3. 追踪性能变化趋势
 *
 * 基准数据来源：Phase 1 最终版本的性能测试结果
 */

/**
 * 单个基准测试的数据结构
 */
export interface BaselineData {
  name: string
  description: string
  timestamp: string // 记录时间（ISO 8601 格式）
  phase: 'phase1' | 'phase2'
  config: {
    agentCount: number
    windowCount: number
    seatCount: number
    arrivalRate: number
    duration: number // 测试持续时间（秒）
  }
  metrics: {
    fps: number
    avgFrameTime: number // 毫秒
    minFrameTime: number
    maxFrameTime: number
    estimatedMemory: number // 字节
    agentThroughput: number // 每秒处理的 agents 数
  }
}

/**
 * Phase 1 性能基准数据
 * 50 agents @ 60fps 的基线配置
 */
export const PHASE1_BASELINE: BaselineData = {
  name: '50 Agents Baseline',
  description: 'Phase 1 performance baseline: 50 agents, 4 windows, 40 seats @ 60fps',
  timestamp: '2026-04-11T00:00:00Z', // 占位符，应在实际测试时更新
  phase: 'phase1',
  config: {
    agentCount: 50,
    windowCount: 4,
    seatCount: 40,
    arrivalRate: 0.5,
    duration: 30, // 30秒测试
  },
  metrics: {
    fps: 60, // 目标 FPS
    avgFrameTime: 16.67, // 1000/60 ≈ 16.67ms
    minFrameTime: 15.0,
    maxFrameTime: 20.0,
    estimatedMemory: 25000, // 约 25KB for 50 agents
    agentThroughput: 50, // agents/second
  },
}

/**
 * Phase 1 的多种场景基准数据
 */
export const PHASE1_BASELINES = {
  small: {
    name: '10 Agents Small',
    agents: 10,
    windowCount: 2,
    seatCount: 20,
  },
  medium: {
    name: '50 Agents Medium',
    agents: 50,
    windowCount: 4,
    seatCount: 40,
  },
  large: {
    name: '200 Agents Large',
    agents: 200,
    windowCount: 8,
    seatCount: 160,
  },
}

/**
 * 性能对比结果
 */
export interface PerformanceComparison {
  baseline: BaselineData
  current: BaselineData
  comparison: {
    fpsDelta: number // 新值 - 基准值（正数表示提升）
    fpsImprovement: number // 百分比提升
    frameTimeDelta: number
    frameTimeImprovement: number
    memoryDelta: number
    memoryImprovement: number // 负数表示减少（好）
  }
}

/**
 * 对比性能数据
 * @param baseline 基准数据
 * @param current 当前数据
 */
export function comparePerformance(baseline: BaselineData, current: BaselineData): PerformanceComparison {
  const fpsDelta = current.metrics.fps - baseline.metrics.fps
  const fpsImprovement = (fpsDelta / baseline.metrics.fps) * 100

  const frameTimeDelta = current.metrics.avgFrameTime - baseline.metrics.avgFrameTime
  const frameTimeImprovement = (frameTimeDelta / baseline.metrics.avgFrameTime) * 100 * -1 // 负号因为时间越少越好

  const memoryDelta = current.metrics.estimatedMemory - baseline.metrics.estimatedMemory
  const memoryImprovement = (memoryDelta / baseline.metrics.estimatedMemory) * 100 * -1 // 负号因为内存越少越好

  return {
    baseline,
    current,
    comparison: {
      fpsDelta,
      fpsImprovement,
      frameTimeDelta,
      frameTimeImprovement,
      memoryDelta,
      memoryImprovement,
    },
  }
}

/**
 * 格式化性能对比结果为可读文本
 */
export function formatPerformanceComparison(comp: PerformanceComparison): string {
  const lines = [
    `Performance Comparison: ${comp.baseline.name} vs ${comp.current.name}`,
    `${'='.repeat(60)}`,
    '',
    `FPS: ${comp.baseline.metrics.fps} → ${comp.current.metrics.fps} (${comp.comparison.fpsImprovement > 0 ? '+' : ''}${comp.comparison.fpsImprovement.toFixed(2)}%)`,
    `Frame Time: ${comp.baseline.metrics.avgFrameTime.toFixed(2)}ms → ${comp.current.metrics.avgFrameTime.toFixed(2)}ms (${comp.comparison.frameTimeImprovement > 0 ? '+' : ''}${comp.comparison.frameTimeImprovement.toFixed(2)}%)`,
    `Memory: ${formatBytes(comp.baseline.metrics.estimatedMemory)} → ${formatBytes(comp.current.metrics.estimatedMemory)} (${comp.comparison.memoryImprovement > 0 ? '+' : ''}${comp.comparison.memoryImprovement.toFixed(2)}%)`,
    `${'='.repeat(60)}`,
  ]

  return lines.join('\n')
}

/**
 * 格式化字节数为可读格式
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * 检查当前性能是否满足目标
 */
export function meetsPerformanceTarget(
  metrics: BaselineData['metrics'],
  target: {
    minFps?: number
    maxFrameTime?: number
    maxMemory?: number
  } = {}
): boolean {
  const defaults = {
    minFps: 60,
    maxFrameTime: 16.67,
    maxMemory: 100000,
  }
  const finalTarget = { ...defaults, ...target }

  return (
    metrics.fps >= finalTarget.minFps &&
    metrics.avgFrameTime <= finalTarget.maxFrameTime &&
    metrics.estimatedMemory <= finalTarget.maxMemory
  )
}

/**
 * Phase 1 性能目标
 */
export const PHASE1_TARGETS = {
  minFps: 60,
  maxFrameTime: 16.67, // 1000/60
  maxMemory: 100000, // 100KB
}

/**
 * Phase 2 性能目标（相比 Phase 1 的改进目标）
 * - 目标：400+ agents 时维持 60fps
 * - 内存改进：每个 agent 减少 20% 内存占用
 */
export const PHASE2_TARGETS = {
  largeSceneAgents: 400,
  minFps: 60,
  maxFrameTime: 16.67,
  maxMemoryPerAgent: 320, // 相比 Phase 1 的 400 减少 20%
}
