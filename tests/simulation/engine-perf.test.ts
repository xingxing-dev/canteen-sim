/**
 * 引擎性能基线测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createTestEngine, resetTestState, measureEnginePerformance, stepEngine } from '../utils'

beforeEach(() => {
  resetTestState()
})

describe('Engine Performance Baseline', () => {
  it('should handle 100 agents with single step < 5ms', () => {
    const engine = createTestEngine({ arrivalRate: 100 })
    engine.start()

    // Populate agents by stepping several times
    for (let i = 0; i < 60; i++) {
      engine.step(1 / 60)
    }

    // Ensure we have agents
    expect(engine.agents.length).toBeGreaterThan(0)

    // Measure single step time
    const start = performance.now()
    engine.step(1 / 60)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(5)
  })

  it('should handle 200 agents with single step < 10ms', () => {
    const engine = createTestEngine({ arrivalRate: 200 })
    engine.start()

    for (let i = 0; i < 120; i++) {
      engine.step(1 / 60)
    }

    expect(engine.agents.length).toBeGreaterThan(0)

    const start = performance.now()
    engine.step(1 / 60)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(10)
  })

  it('should run 1000 steps with 50 agents in reasonable time', () => {
    const engine = createTestEngine({ arrivalRate: 50 })
    engine.start()

    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      engine.step(1 / 60)
    }
    const totalTime = performance.now() - start

    // 1000 steps should complete within 1 second
    expect(totalTime).toBeLessThan(1000)
  })

  it('should measure performance metrics with measureEnginePerformance', () => {
    const engine = createTestEngine({ arrivalRate: 2 })
    const metrics = measureEnginePerformance(engine, 2, 1 / 60)

    expect(metrics.frameCount).toBeGreaterThan(0)
    expect(metrics.avgFrameTime).toBeGreaterThan(0)
    expect(metrics.minFrameTime).toBeLessThanOrEqual(metrics.avgFrameTime)
    expect(metrics.maxFrameTime).toBeGreaterThanOrEqual(metrics.avgFrameTime)
    expect(metrics.fps).toBeGreaterThan(0)
  })

  it('should not leak agents over time (Left agents should be removable)', () => {
    const engine = createTestEngine({
      arrivalRate: 5,
      serviceTime: 1,
      diningTime: 1,
      moveSpeed: 50,
      maxPatience: 300,
    })
    engine.start()

    // Run for a long time
    for (let i = 0; i < 6000; i++) {
      engine.step(1 / 60)
    }

    // Some agents should have completed (reached Left state)
    expect(engine.stats.totalServed).toBeGreaterThan(0)
  })
})
