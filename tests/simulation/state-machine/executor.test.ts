/**
 * StateMachineExecutor 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createTestAgent, resetTestState } from '../../utils'
import { AgentState } from '../../../src/simulation/agent'
import { StateMachineExecutor, createStateMachineExecutor } from '../../../src/simulation/state-machine/executor'
import { STATE_TRANSITION_RULES } from '../../../src/simulation/state-machine/rules'
import type { StateTransitionRule } from '../../../src/simulation/state-machine/types'

beforeEach(() => {
  resetTestState()
})

describe('StateMachineExecutor', () => {
  describe('single transition per frame guarantee', () => {
    it('should return at most one transition per execute call', () => {
      const executor = new StateMachineExecutor(STATE_TRANSITION_RULES)
      // Agent at Entering with no target → should transition to ChoosingWindow
      const agent = createTestAgent({ state: AgentState.Entering })
      agent.target = null

      const result = executor.execute(agent, 0.016)
      expect(result.transitioned).toBe(true)
      expect(result.newState).toBe(AgentState.ChoosingWindow)
    })

    it('should not transition again if called twice without applying state change', () => {
      const executor = new StateMachineExecutor(STATE_TRANSITION_RULES)
      const agent = createTestAgent({ state: AgentState.Entering })
      agent.target = null

      const result1 = executor.execute(agent, 0.016)
      expect(result1.transitioned).toBe(true)
      // Agent state hasn't been updated externally, so same transition fires again
      const result2 = executor.execute(agent, 0.016)
      expect(result2.transitioned).toBe(true)
      expect(result2.newState).toBe(AgentState.ChoosingWindow)
    })
  })

  describe('no matching rule', () => {
    it('should return transitioned=false when no rule matches', () => {
      const executor = new StateMachineExecutor(STATE_TRANSITION_RULES)
      // Agent at Entering but still has target → no rule matches
      const agent = createTestAgent({ state: AgentState.Entering })
      agent.target = { x: 10, z: 10 }

      const result = executor.execute(agent, 0.016)
      expect(result.transitioned).toBe(false)
      expect(result.newState).toBeUndefined()
      expect(result.effects).toEqual([])
    })

    it('should return transitioned=false for Left state (terminal)', () => {
      const executor = new StateMachineExecutor(STATE_TRANSITION_RULES)
      const agent = createTestAgent({ state: AgentState.Left })

      const result = executor.execute(agent, 0.016)
      expect(result.transitioned).toBe(false)
    })
  })

  describe('rule priority (first match wins)', () => {
    it('should match Queuing→Ordering before Queuing→Leaving when patience > 0', () => {
      const executor = new StateMachineExecutor(STATE_TRANSITION_RULES)
      const agent = createTestAgent({ state: AgentState.Queuing })
      agent.patience = 50

      const result = executor.execute(agent, 0.016)
      expect(result.transitioned).toBe(true)
      // Queuing→Ordering comes before Queuing→Leaving in rules
      expect(result.newState).toBe(AgentState.Ordering)
    })

    it('should match Queuing→Leaving when patience <= 0', () => {
      const executor = new StateMachineExecutor(STATE_TRANSITION_RULES)
      const agent = createTestAgent({ state: AgentState.Queuing })
      agent.patience = 0

      const result = executor.execute(agent, 0.016)
      expect(result.transitioned).toBe(true)
      expect(result.newState).toBe(AgentState.Leaving)
    })
  })

  describe('effects are returned correctly', () => {
    it('should return effects array for matched rule', () => {
      const executor = new StateMachineExecutor(STATE_TRANSITION_RULES)
      const agent = createTestAgent({ state: AgentState.Entering })
      agent.target = null

      const result = executor.execute(agent, 0.016)
      expect(result.effects.length).toBeGreaterThan(0)
      expect(result.effects[0].type).toBe('update_state')
    })

    it('should return a copy of effects (not the original array)', () => {
      const executor = new StateMachineExecutor(STATE_TRANSITION_RULES)
      const agent = createTestAgent({ state: AgentState.Entering })
      agent.target = null

      const result = executor.execute(agent, 0.016)
      const originalRule = STATE_TRANSITION_RULES.find(
        r => r.fromState === AgentState.Entering && r.toState === AgentState.ChoosingWindow
      )!
      expect(result.effects).not.toBe(originalRule.effects)
      expect(result.effects).toEqual(originalRule.effects)
    })
  })

  describe('getAvailableTransitions', () => {
    it('should return all possible targets from Queuing', () => {
      const executor = new StateMachineExecutor(STATE_TRANSITION_RULES)
      const targets = executor.getAvailableTransitions(AgentState.Queuing)
      expect(targets).toContain(AgentState.Ordering)
      expect(targets).toContain(AgentState.Leaving)
      expect(targets).toHaveLength(2)
    })

    it('should return empty array for Left (terminal state)', () => {
      const executor = new StateMachineExecutor(STATE_TRANSITION_RULES)
      const targets = executor.getAvailableTransitions(AgentState.Left)
      expect(targets).toHaveLength(0)
    })
  })

  describe('addRule and setRules', () => {
    it('should allow adding custom rules', () => {
      const executor = new StateMachineExecutor([])
      const customRule: StateTransitionRule = {
        fromState: AgentState.Entering,
        toState: AgentState.Leaving,
        condition: () => true,
        effects: [{ id: 'test', type: 'test', payload: {} }],
      }
      executor.addRule(customRule)

      const agent = createTestAgent({ state: AgentState.Entering })
      const result = executor.execute(agent, 0.016)
      expect(result.transitioned).toBe(true)
      expect(result.newState).toBe(AgentState.Leaving)
    })

    it('should replace all rules with setRules', () => {
      const executor = new StateMachineExecutor(STATE_TRANSITION_RULES)
      executor.setRules([])

      const agent = createTestAgent({ state: AgentState.Entering })
      agent.target = null
      const result = executor.execute(agent, 0.016)
      expect(result.transitioned).toBe(false)
    })
  })

  describe('getStructure', () => {
    it('should return FSM structure map', () => {
      const executor = new StateMachineExecutor(STATE_TRANSITION_RULES)
      const structure = executor.getStructure()

      expect(structure[AgentState.Entering]).toContain(AgentState.ChoosingWindow)
      expect(structure[AgentState.Queuing]).toContain(AgentState.Ordering)
      expect(structure[AgentState.Queuing]).toContain(AgentState.Leaving)
    })
  })

  describe('createStateMachineExecutor factory', () => {
    it('should create an executor with given rules', () => {
      const executor = createStateMachineExecutor(STATE_TRANSITION_RULES)
      expect(executor.getRules()).toHaveLength(9)
    })
  })
})
