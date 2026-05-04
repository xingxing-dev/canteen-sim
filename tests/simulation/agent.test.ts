/**
 * Agent 类单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Agent, AgentState, resetAgentIds } from '../../src/simulation/agent'

beforeEach(() => {
  resetAgentIds()
})

describe('Agent', () => {
  describe('construction', () => {
    it('should initialize with correct properties', () => {
      const agent = new Agent({ x: 5, z: 3 }, 2, 120)

      expect(agent.id).toBe(0)
      expect(agent.state).toBe(AgentState.Entering)
      expect(agent.position.x).toBe(5)
      expect(agent.position.z).toBe(3)
      expect(agent.speed).toBe(2)
      expect(agent.patience).toBe(120)
      expect(agent.maxPatience).toBe(120)
      expect(agent.target).toBeNull()
      expect(agent.assignedWindow).toBe(-1)
      expect(agent.assignedSeat).toBe(-1)
      expect(agent.stateTimer).toBe(0)
      expect(agent.stateDuration).toBe(0)
    })

    it('should auto-increment IDs', () => {
      const a1 = new Agent({ x: 0, z: 0 }, 1, 60)
      const a2 = new Agent({ x: 0, z: 0 }, 1, 60)
      const a3 = new Agent({ x: 0, z: 0 }, 1, 60)

      expect(a1.id).toBe(0)
      expect(a2.id).toBe(1)
      expect(a3.id).toBe(2)
    })

    it('should copy spawn position (not reference)', () => {
      const spawn = { x: 10, z: 20 }
      const agent = new Agent(spawn, 1, 60)
      spawn.x = 999

      expect(agent.position.x).toBe(10)
    })
  })

  describe('moveToward', () => {
    it('should return true when no target', () => {
      const agent = new Agent({ x: 0, z: 0 }, 3, 60)
      agent.target = null

      expect(agent.moveToward(0.016)).toBe(true)
    })

    it('should return true and set target to null when arriving', () => {
      const agent = new Agent({ x: 0, z: 0 }, 100, 60)
      agent.target = { x: 0.1, z: 0 }

      const arrived = agent.moveToward(0.016)

      expect(arrived).toBe(true)
      expect(agent.target).toBeNull()
      expect(agent.position.x).toBe(0.1)
      expect(agent.position.z).toBe(0)
    })

    it('should return false when not yet arrived', () => {
      const agent = new Agent({ x: 0, z: 0 }, 1, 60)
      agent.target = { x: 100, z: 0 }

      const arrived = agent.moveToward(0.016)

      expect(arrived).toBe(false)
      expect(agent.target).not.toBeNull()
    })

    it('should move correct distance per frame', () => {
      const agent = new Agent({ x: 0, z: 0 }, 5, 60)
      agent.target = { x: 100, z: 0 }

      agent.moveToward(1.0)

      // speed=5, dt=1.0 → move 5 units along x
      expect(agent.position.x).toBeCloseTo(5, 5)
      expect(agent.position.z).toBeCloseTo(0, 5)
    })

    it('should move diagonally correctly', () => {
      const agent = new Agent({ x: 0, z: 0 }, 1, 60)
      agent.target = { x: 10, z: 10 }

      agent.moveToward(1.0)

      // distance to target = sqrt(200) ≈ 14.14
      // step = 1 * 1.0 = 1
      // direction = (10/14.14, 10/14.14) ≈ (0.707, 0.707)
      expect(agent.position.x).toBeCloseTo(1 / Math.SQRT2, 5)
      expect(agent.position.z).toBeCloseTo(1 / Math.SQRT2, 5)
    })

    it('should snap to target when step >= distance', () => {
      const agent = new Agent({ x: 0, z: 0 }, 10, 60)
      agent.target = { x: 1, z: 0 }

      agent.moveToward(1.0) // step=10, distance=1 → snap

      expect(agent.position.x).toBe(1)
      expect(agent.position.z).toBe(0)
      expect(agent.target).toBeNull()
    })
  })

  describe('resetAgentIds', () => {
    it('should reset ID counter', () => {
      new Agent({ x: 0, z: 0 }, 1, 60) // id=0
      new Agent({ x: 0, z: 0 }, 1, 60) // id=1
      resetAgentIds()
      const fresh = new Agent({ x: 0, z: 0 }, 1, 60)
      expect(fresh.id).toBe(0)
    })
  })
})
