/**
 * 测试工具库 - 为单元测试提供便利的工厂函数和辅助工具
 */

import type { SimulationConfig } from '../src/simulation/config'
import { DEFAULT_CONFIG } from '../src/simulation/config'
import { Agent, AgentState, resetAgentIds, type Vec2 } from '../src/simulation/agent'
import { SimulationEngine } from '../src/simulation/engine'
import { createDefaultLayout, type CanteenLayout } from '../src/simulation/layout'

/**
 * 创建测试用的 Agent
 * @param overrides 覆盖的配置选项
 */
export function createTestAgent(overrides?: {
  spawn?: Vec2
  speed?: number
  maxPatience?: number
  state?: AgentState
}): Agent {
  const spawn = overrides?.spawn ?? { x: 0, z: 0 }
  const speed = overrides?.speed ?? DEFAULT_CONFIG.moveSpeed
  const maxPatience = overrides?.maxPatience ?? DEFAULT_CONFIG.maxPatience

  const agent = new Agent(spawn, speed, maxPatience)

  if (overrides?.state) {
    agent.state = overrides.state
  }

  return agent
}

/**
 * 创建多个测试用的 Agent
 * @param count 数量
 * @param overrides 覆盖的配置选项
 */
export function createTestAgents(count: number, overrides?: Parameters<typeof createTestAgent>[0]): Agent[] {
  const agents: Agent[] = []
  for (let i = 0; i < count; i++) {
    agents.push(createTestAgent(overrides))
  }
  return agents
}

/**
 * 创建测试用的 SimulationEngine
 * @param configOverrides 覆盖的配置选项
 */
export function createTestEngine(configOverrides?: Partial<SimulationConfig>): SimulationEngine {
  resetAgentIds()
  const config = { ...DEFAULT_CONFIG, ...configOverrides }
  return new SimulationEngine(config)
}

/**
 * 创建测试用的 CanteenLayout
 * @param windowCount 窗口数量
 * @param seatCount 座位数量
 */
export function createTestLayout(windowCount = 4, seatCount = 40): CanteenLayout {
  return createDefaultLayout(windowCount, seatCount)
}

/**
 * 性能测试工具：测量 FPS 和帧时间
 */
export interface PerformanceMetrics {
  fps: number
  avgFrameTime: number
  minFrameTime: number
  maxFrameTime: number
  frameCount: number
}

/**
 * 运行引擎并测量性能指标
 * @param engine 仿真引擎
 * @param duration 运行时长（秒）
 * @param dt 每帧时间步长（秒）
 */
export function measureEnginePerformance(
  engine: SimulationEngine,
  duration: number = 10,
  dt: number = 1 / 60
): PerformanceMetrics {
  const frameTimes: number[] = []
  let elapsedTime = 0

  engine.start()

  while (elapsedTime < duration) {
    const frameStart = performance.now()
    engine.step(dt)
    const frameEnd = performance.now()

    frameTimes.push(frameEnd - frameStart)
    elapsedTime += dt
  }

  engine.pause()

  const totalFrameTime = frameTimes.reduce((a, b) => a + b, 0)
  const avgFrameTime = totalFrameTime / frameTimes.length
  const minFrameTime = Math.min(...frameTimes)
  const maxFrameTime = Math.max(...frameTimes)
  const fps = 1000 / avgFrameTime // 毫秒转换为 FPS

  return {
    fps,
    avgFrameTime,
    minFrameTime,
    maxFrameTime,
    frameCount: frameTimes.length,
  }
}

/**
 * 内存使用量测试（基于代理数量估算）
 */
export interface MemoryMetrics {
  agentCount: number
  estimatedMemory: number // 估算内存（字节）
  memoryPerAgent: number // 每个代理的内存（字节）
}

/**
 * 测量引擎的内存使用（基于代理数量估算）
 * @param engine 仿真引擎
 */
export function measureEngineMemory(engine: SimulationEngine): MemoryMetrics {
  // 粗略估算：每个 Agent 对象约 400 字节 + 队列数据
  const agentMemory = engine.agents.length * 400
  const statsMemory = 1024 * 4 // 统计数据约 4KB
  const layoutMemory = engine.config.windowCount * 200 + engine.config.seatCount * 100
  const totalEstimated = agentMemory + statsMemory + layoutMemory

  return {
    agentCount: engine.agents.length,
    estimatedMemory: totalEstimated,
    memoryPerAgent: agentMemory / engine.agents.length || 0,
  }
}

/**
 * 运行引擎直到指定条件满足或超时
 * @param engine 仿真引擎
 * @param condition 条件函数，返回 true 时停止
 * @param timeout 超时时间（秒）
 * @param dt 时间步长（秒）
 * @returns 条件满足返回 true，超时返回 false
 */
export function runEngineUntil(
  engine: SimulationEngine,
  condition: (engine: SimulationEngine) => boolean,
  timeout: number = 60,
  dt: number = 1 / 60
): boolean {
  let elapsedTime = 0
  engine.start()

  while (elapsedTime < timeout) {
    engine.step(dt)
    if (condition(engine)) {
      engine.pause()
      return true
    }
    elapsedTime += dt
  }

  engine.pause()
  return false
}

/**
 * 运行引擎指定步数
 * @param engine 仿真引擎
 * @param steps 步数
 * @param dt 时间步长（秒）
 */
export function stepEngine(engine: SimulationEngine, steps: number = 1, dt: number = 1 / 60): void {
  engine.start()
  for (let i = 0; i < steps; i++) {
    engine.step(dt)
  }
  engine.pause()
}

/**
 * 批量运行引擎测试
 * @param config 仿真配置
 * @param testCount 测试次数
 * @param testFn 测试函数
 */
export async function runEngineTests<T>(
  config: Partial<SimulationConfig>,
  testCount: number,
  testFn: (engine: SimulationEngine, index: number) => Promise<T> | T
): Promise<T[]> {
  const results: T[] = []

  for (let i = 0; i < testCount; i++) {
    const engine = createTestEngine(config)
    results.push(await testFn(engine, i))
  }

  return results
}

/**
 * 重置 Agent ID 计数器（防止不同测试之间的 ID 冲突）
 */
export function resetTestState(): void {
  resetAgentIds()
}
