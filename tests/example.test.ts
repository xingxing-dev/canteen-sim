/**
 * 示例测试 - 验证测试框架是否正常工作
 * 此文件作为参考示例，可在后续删除
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createTestAgent, createTestEngine, createTestLayout, measureEnginePerformance } from './utils'
import { Agent, AgentState } from '../src/simulation/agent'
import { SimulationEngine } from '../src/simulation/engine'

describe('Test Framework Verification', () => {
  describe('Agent Creation Utils', () => {
    it('should create a test agent with default config', () => {
      const agent = createTestAgent()
      expect(agent).toBeInstanceOf(Agent)
      expect(agent.state).toBe(AgentState.Entering)
      expect(agent.position).toEqual({ x: 0, z: 0 })
    })

    it('should create a test agent with custom config', () => {
      const agent = createTestAgent({
        spawn: { x: 10, z: 20 },
        speed: 5,
        state: AgentState.Dining,
      })
      expect(agent.position).toEqual({ x: 10, z: 20 })
      expect(agent.speed).toBe(5)
      expect(agent.state).toBe(AgentState.Dining)
    })

    it('should have unique IDs for each agent', () => {
      const agent1 = createTestAgent()
      const agent2 = createTestAgent()
      expect(agent1.id).not.toBe(agent2.id)
    })
  })

  describe('Engine Creation Utils', () => {
    it('should create a test engine with default config', () => {
      const engine = createTestEngine()
      expect(engine).toBeInstanceOf(SimulationEngine)
      expect(engine.config.windowCount).toBe(4)
      expect(engine.config.seatCount).toBe(40)
    })

    it('should create a test engine with custom config', () => {
      const engine = createTestEngine({
        windowCount: 8,
        seatCount: 80,
        arrivalRate: 1.0,
      })
      expect(engine.config.windowCount).toBe(8)
      expect(engine.config.seatCount).toBe(80)
      expect(engine.config.arrivalRate).toBe(1.0)
    })

    it('should have proper layout', () => {
      const engine = createTestEngine()
      expect(engine.layout.windows.length).toBe(4)
      expect(engine.layout.seats.length).toBe(40)
      expect(engine.layout.entrance).toBeDefined()
      expect(engine.layout.exit).toBeDefined()
    })
  })

  describe('Layout Creation Utils', () => {
    it('should create a test layout', () => {
      const layout = createTestLayout(4, 40)
      expect(layout.windows.length).toBe(4)
      expect(layout.seats.length).toBe(40)
      expect(layout.width).toBe(30)
      expect(layout.depth).toBe(20)
    })

    it('should create layout with custom dimensions', () => {
      const layout = createTestLayout(8, 80)
      expect(layout.windows.length).toBe(8)
      expect(layout.seats.length).toBe(80)
    })
  })

  describe('Engine Simulation', () => {
    let engine: SimulationEngine

    beforeEach(() => {
      engine = createTestEngine()
    })

    it('should start and pause simulation', () => {
      expect(engine.isRunning).toBe(false)
      engine.start()
      expect(engine.isRunning).toBe(true)
      engine.pause()
      expect(engine.isRunning).toBe(false)
    })

    it('should advance simulation by step', () => {
      engine.start()
      const timeBefore = engine.stats.elapsedTime
      engine.step(0.016)
      expect(engine.stats.elapsedTime).toBeGreaterThan(timeBefore)
    })

    it('should not advance when not running', () => {
      engine.pause()
      const timeBefore = engine.stats.elapsedTime
      engine.step(0.016)
      expect(engine.stats.elapsedTime).toBe(timeBefore)
    })
  })

  describe('Performance Measurement', () => {
    it('should measure engine performance', () => {
      const engine = createTestEngine()
      const metrics = measureEnginePerformance(engine, 1, 0.016)

      expect(metrics.fps).toBeGreaterThan(0)
      expect(metrics.avgFrameTime).toBeGreaterThan(0)
      expect(metrics.minFrameTime).toBeLessThanOrEqual(metrics.avgFrameTime)
      expect(metrics.maxFrameTime).toBeGreaterThanOrEqual(metrics.avgFrameTime)
      expect(metrics.frameCount).toBeGreaterThan(0)
    })
  })
})
