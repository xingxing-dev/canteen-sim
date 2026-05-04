/**
 * SimulationEngine 集成测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AgentState, resetAgentIds } from '../../src/simulation/agent'
import {
  createTestEngine,
  stepEngine,
  runEngineUntil,
} from '../utils'

beforeEach(() => {
  resetAgentIds()
})

// ------------------------------------------------------------------
// 高速仿真配置：让 Agent 快速走完全程，便于集成测试
// ------------------------------------------------------------------
const FAST_CONFIG = {
  windowCount: 1,
  seatCount: 10,
  arrivalRate: 5,   // 每秒 5 人，积累快
  moveSpeed: 50,    // 快速移动
  serviceTime: 1,   // 服务 1 秒
  diningTime: 1,    // 就餐 1 秒
  maxPatience: 300, // 充足耐心
}

describe('SimulationEngine', () => {

  // ----------------------------------------------------------------
  // 引擎生命周期
  // ----------------------------------------------------------------
  describe('lifecycle', () => {
    it('新建引擎处于暂停状态', () => {
      const engine = createTestEngine()
      expect(engine.isRunning).toBe(false)
    })

    it('start() 后 isRunning = true', () => {
      const engine = createTestEngine()
      engine.start()
      expect(engine.isRunning).toBe(true)
    })

    it('pause() 后 isRunning = false', () => {
      const engine = createTestEngine()
      engine.start()
      engine.pause()
      expect(engine.isRunning).toBe(false)
    })

    it('step() 在暂停状态下不推进 elapsedTime', () => {
      const engine = createTestEngine()
      // 未 start，直接 step
      engine.step(1 / 60)
      expect(engine.stats.elapsedTime).toBe(0)
    })

    it('step() 在运行状态下推进 elapsedTime', () => {
      const engine = createTestEngine()
      engine.start()
      engine.step(1.0)
      expect(engine.stats.elapsedTime).toBeCloseTo(1.0, 5)
    })

    it('reset() 重置所有核心状态', () => {
      const engine = createTestEngine(FAST_CONFIG)
      stepEngine(engine, 60, 1 / 10) // 运行 6 秒，产生 Agent
      expect(engine.stats.totalEntered).toBeGreaterThan(0)

      engine.reset()

      expect(engine.agents).toHaveLength(0)
      expect(engine.stats.totalEntered).toBe(0)
      expect(engine.stats.totalServed).toBe(0)
      expect(engine.stats.elapsedTime).toBe(0)
      expect(engine.stats.currentAgents).toBe(0)
    })

    it('reset(newConfig) 使用新配置', () => {
      const engine = createTestEngine({ windowCount: 2, seatCount: 20 })
      engine.reset({ windowCount: 3, seatCount: 30, arrivalRate: 1, serviceTime: 8, diningTime: 30, moveSpeed: 3, maxPatience: 120 })

      expect(engine.config.windowCount).toBe(3)
      expect(engine.config.seatCount).toBe(30)
      expect(engine.layout.windows).toHaveLength(3)
      expect(engine.layout.seats).toHaveLength(30)
    })
  })

  // ----------------------------------------------------------------
  // Agent 生命周期集成
  // ----------------------------------------------------------------
  describe('agent lifecycle integration', () => {
    it('运行后应生成 Agent（arrivalRate > 0）', () => {
      const engine = createTestEngine({ arrivalRate: 2 })
      // 运行 2 秒，期望至少有 1 个 Agent 进入
      stepEngine(engine, 120, 1 / 60)
      expect(engine.stats.totalEntered).toBeGreaterThan(0)
    })

    it('Agent 能从 Entering 转换到 ChoosingWindow', () => {
      const engine = createTestEngine(FAST_CONFIG)
      // 高速模式，运行若干帧后应有 Agent 达到 ChoosingWindow 或更后状态
      stepEngine(engine, 30, 1 / 60)

      const hasPassedEntering = engine.agents.some(
        (a) => a.state !== AgentState.Entering,
      )
      expect(hasPassedEntering).toBe(true)
    })

    it('运行足够长时间后 totalServed > 0', () => {
      const engine = createTestEngine(FAST_CONFIG)
      const reached = runEngineUntil(
        engine,
        (e) => e.stats.totalServed > 0,
        120, // 最多 120 秒
        1 / 10,
      )
      expect(reached).toBe(true)
      expect(engine.stats.totalServed).toBeGreaterThan(0)
    })

    it('cleanup() 移除 Left 状态的 Agent', () => {
      const engine = createTestEngine(FAST_CONFIG)
      // 运行到有 Agent 离开
      runEngineUntil(
        engine,
        (e) => e.agents.some((a) => a.state === AgentState.Left),
        120,
        1 / 10,
      )

      const leftBefore = engine.agents.filter(
        (a) => a.state === AgentState.Left,
      ).length
      expect(leftBefore).toBeGreaterThan(0)

      engine.cleanup()

      const leftAfter = engine.agents.filter(
        (a) => a.state === AgentState.Left,
      ).length
      expect(leftAfter).toBe(0)
    })

    it('cleanup() 保留未离开的 Agent', () => {
      const engine = createTestEngine(FAST_CONFIG)
      stepEngine(engine, 30, 1 / 60) // 产生 Agent 但不全部离开

      const activeBefore = engine.agents.filter(
        (a) => a.state !== AgentState.Left,
      ).length

      engine.cleanup()

      const activeAfter = engine.agents.filter(
        (a) => a.state !== AgentState.Left,
      ).length
      expect(activeAfter).toBe(activeBefore)
    })
  })

  // ----------------------------------------------------------------
  // 窗口队列
  // ----------------------------------------------------------------
  describe('window queues', () => {
    it('queueLengths 长度与 windowCount 一致', () => {
      const windowCount = 3
      const engine = createTestEngine({ windowCount, seatCount: 20 })
      stepEngine(engine, 10, 1 / 60)
      expect(engine.stats.queueLengths).toHaveLength(windowCount)
    })

    it('windowCount=1 场景下，Agent 最终能排队（进入 Queuing 状态）', () => {
      const engine = createTestEngine({
        ...FAST_CONFIG,
        windowCount: 1,
        seatCount: 10,
      })
      const reached = runEngineUntil(
        engine,
        (e) => e.agents.some((a) => a.state === AgentState.Queuing || a.state === AgentState.Ordering),
        30,
        1 / 60,
      )
      expect(reached).toBe(true)
    })

    it('queueLengths 各元素为非负整数', () => {
      const engine = createTestEngine(FAST_CONFIG)
      stepEngine(engine, 60, 1 / 10)
      for (const len of engine.stats.queueLengths) {
        expect(len).toBeGreaterThanOrEqual(0)
        expect(Number.isInteger(len)).toBe(true)
      }
    })
  })

  // ----------------------------------------------------------------
  // 统计正确性
  // ----------------------------------------------------------------
  describe('stats correctness', () => {
    it('totalEntered 随时间增加（arrivalRate > 0）', () => {
      const engine = createTestEngine({ arrivalRate: 1 })
      engine.start()

      engine.step(2.0)
      const entered1 = engine.stats.totalEntered

      engine.step(2.0)
      const entered2 = engine.stats.totalEntered

      expect(entered2).toBeGreaterThanOrEqual(entered1)
    })

    it('高速仿真下最终 totalServed > 0', () => {
      const engine = createTestEngine(FAST_CONFIG)
      const reached = runEngineUntil(
        engine,
        (e) => e.stats.totalServed > 0,
        120,
        1 / 10,
      )
      expect(reached).toBe(true)
    })

    it('currentAgents 反映当前在场 Agent 数量', () => {
      const engine = createTestEngine(FAST_CONFIG)
      stepEngine(engine, 30, 1 / 60)

      const actual = engine.agents.filter(
        (a) => a.state !== AgentState.Left,
      ).length
      expect(engine.stats.currentAgents).toBe(actual)
    })

    it('seatUtilization 在 0 到 1 之间', () => {
      const engine = createTestEngine(FAST_CONFIG)
      stepEngine(engine, 120, 1 / 10)
      expect(engine.stats.seatUtilization).toBeGreaterThanOrEqual(0)
      expect(engine.stats.seatUtilization).toBeLessThanOrEqual(1)
    })

    it('elapsedTime 与累计 dt 之和一致', () => {
      const engine = createTestEngine()
      engine.start()
      const dt = 1 / 60
      const steps = 60
      for (let i = 0; i < steps; i++) {
        engine.step(dt)
      }
      expect(engine.stats.elapsedTime).toBeCloseTo(dt * steps, 5)
    })

    it('暂停状态下 step 不修改 totalEntered', () => {
      const engine = createTestEngine({ arrivalRate: 10 })
      // engine 未 start，step 不会执行逻辑
      engine.step(10)
      expect(engine.stats.totalEntered).toBe(0)
    })
  })

  // ----------------------------------------------------------------
  // 初始状态
  // ----------------------------------------------------------------
  describe('initial state', () => {
    it('初始 agents 数组为空', () => {
      const engine = createTestEngine()
      expect(engine.agents).toHaveLength(0)
    })

    it('初始 stats 全为零', () => {
      const engine = createTestEngine({ windowCount: 2, seatCount: 10 })
      expect(engine.stats.elapsedTime).toBe(0)
      expect(engine.stats.currentAgents).toBe(0)
      expect(engine.stats.totalEntered).toBe(0)
      expect(engine.stats.totalServed).toBe(0)
      expect(engine.stats.totalLeft).toBe(0)
      expect(engine.stats.seatUtilization).toBe(0)
      expect(engine.stats.avgWaitTime).toBe(0)
    })

    it('布局与配置的 windowCount/seatCount 一致', () => {
      const engine = createTestEngine({ windowCount: 3, seatCount: 15 })
      expect(engine.layout.windows).toHaveLength(3)
      expect(engine.layout.seats).toHaveLength(15)
    })
  })
})
