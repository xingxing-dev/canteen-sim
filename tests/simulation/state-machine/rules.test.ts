/**
 * FSM 状态转换规则单元测试
 *
 * 测试 rules.ts 中定义的 9 条状态转换规则：
 * 每条规则测试其 condition 函数和 effects 结构
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createTestAgent, resetTestState } from '../../utils'
import { AgentState } from '../../../src/simulation/agent'
import {
  RULE_ENTERING_TO_CHOOSING_WINDOW,
  RULE_CHOOSING_WINDOW_TO_QUEUING,
  RULE_QUEUING_TO_ORDERING,
  RULE_QUEUING_TO_LEAVING,
  RULE_ORDERING_TO_FINDING_SEAT,
  RULE_FINDING_SEAT_TO_DINING,
  RULE_FINDING_SEAT_TO_LEAVING,
  RULE_DINING_TO_LEAVING,
  RULE_LEAVING_TO_LEFT,
  STATE_TRANSITION_RULES,
} from '../../../src/simulation/state-machine/rules'

beforeEach(() => {
  resetTestState()
})

// ============================================================================
// Entering -> ChoosingWindow
// ============================================================================
describe('RULE_ENTERING_TO_CHOOSING_WINDOW', () => {
  const rule = RULE_ENTERING_TO_CHOOSING_WINDOW

  it('should define correct fromState and toState', () => {
    expect(rule.fromState).toBe(AgentState.Entering)
    expect(rule.toState).toBe(AgentState.ChoosingWindow)
  })

  it('should transition when agent has no target (arrived)', () => {
    const agent = createTestAgent({ state: AgentState.Entering })
    agent.target = null

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should NOT transition when agent still has a target (not arrived)', () => {
    const agent = createTestAgent({ state: AgentState.Entering })
    agent.target = { x: 10, z: 10 }

    expect(rule.condition(agent, 0.016)).toBe(false)
  })

  it('should produce effects with update_state type', () => {
    expect(rule.effects.length).toBeGreaterThan(0)
    const stateEffect = rule.effects.find((e) => e.type === 'update_state')
    expect(stateEffect).toBeDefined()
    expect(stateEffect!.payload.state).toBe(AgentState.ChoosingWindow)
  })
})

// ============================================================================
// ChoosingWindow -> Queuing
// ============================================================================
describe('RULE_CHOOSING_WINDOW_TO_QUEUING', () => {
  const rule = RULE_CHOOSING_WINDOW_TO_QUEUING

  it('should define correct fromState and toState', () => {
    expect(rule.fromState).toBe(AgentState.ChoosingWindow)
    expect(rule.toState).toBe(AgentState.Queuing)
  })

  it('should transition when agent has an assigned window (>= 0)', () => {
    const agent = createTestAgent({ state: AgentState.ChoosingWindow })
    agent.assignedWindow = 2

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should transition when assigned window is 0', () => {
    const agent = createTestAgent({ state: AgentState.ChoosingWindow })
    agent.assignedWindow = 0

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should NOT transition when no window assigned (assignedWindow = -1)', () => {
    const agent = createTestAgent({ state: AgentState.ChoosingWindow })
    agent.assignedWindow = -1

    expect(rule.condition(agent, 0.016)).toBe(false)
  })

  it('should produce effects with update_state and reset_timer types', () => {
    const stateEffect = rule.effects.find((e) => e.type === 'update_state')
    const timerEffect = rule.effects.find((e) => e.type === 'reset_timer')
    expect(stateEffect).toBeDefined()
    expect(stateEffect!.payload.state).toBe(AgentState.Queuing)
    expect(timerEffect).toBeDefined()
    expect(timerEffect!.payload.timer).toBe('stateTimer')
  })
})

// ============================================================================
// Queuing -> Ordering
// ============================================================================
describe('RULE_QUEUING_TO_ORDERING', () => {
  const rule = RULE_QUEUING_TO_ORDERING

  it('should define correct fromState and toState', () => {
    expect(rule.fromState).toBe(AgentState.Queuing)
    expect(rule.toState).toBe(AgentState.Ordering)
  })

  it('should transition when agent has patience remaining (patience > 0)', () => {
    const agent = createTestAgent({ state: AgentState.Queuing })
    agent.patience = 50

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should NOT transition when patience is depleted (<= 0)', () => {
    const agent = createTestAgent({ state: AgentState.Queuing })
    agent.patience = 0

    expect(rule.condition(agent, 0.016)).toBe(false)
  })

  it('should NOT transition when patience is negative', () => {
    const agent = createTestAgent({ state: AgentState.Queuing })
    agent.patience = -5

    expect(rule.condition(agent, 0.016)).toBe(false)
  })

  it('should produce effects with update_state, reset_timer, and set_duration types', () => {
    const stateEffect = rule.effects.find((e) => e.type === 'update_state')
    const timerEffect = rule.effects.find((e) => e.type === 'reset_timer')
    const durationEffect = rule.effects.find((e) => e.type === 'set_duration')
    expect(stateEffect).toBeDefined()
    expect(stateEffect!.payload.state).toBe(AgentState.Ordering)
    expect(timerEffect).toBeDefined()
    expect(durationEffect).toBeDefined()
    expect(durationEffect!.payload.duration).toBe('serviceTime')
  })
})

// ============================================================================
// Queuing -> Leaving (patience exhausted)
// ============================================================================
describe('RULE_QUEUING_TO_LEAVING', () => {
  const rule = RULE_QUEUING_TO_LEAVING

  it('should define correct fromState and toState', () => {
    expect(rule.fromState).toBe(AgentState.Queuing)
    expect(rule.toState).toBe(AgentState.Leaving)
  })

  it('should transition when patience is depleted (patience = 0)', () => {
    const agent = createTestAgent({ state: AgentState.Queuing })
    agent.patience = 0

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should transition when patience is negative', () => {
    const agent = createTestAgent({ state: AgentState.Queuing })
    agent.patience = -10

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should NOT transition when agent still has patience', () => {
    const agent = createTestAgent({ state: AgentState.Queuing })
    agent.patience = 30

    expect(rule.condition(agent, 0.016)).toBe(false)
  })

  it('should produce effects with dequeue_agent and update_state types', () => {
    const dequeueEffect = rule.effects.find((e) => e.type === 'dequeue_agent')
    const stateEffect = rule.effects.find((e) => e.type === 'update_state')
    expect(dequeueEffect).toBeDefined()
    expect(stateEffect).toBeDefined()
    expect(stateEffect!.payload.state).toBe(AgentState.Leaving)
  })
})

// ============================================================================
// Ordering -> FindingSeat
// ============================================================================
describe('RULE_ORDERING_TO_FINDING_SEAT', () => {
  const rule = RULE_ORDERING_TO_FINDING_SEAT

  it('should define correct fromState and toState', () => {
    expect(rule.fromState).toBe(AgentState.Ordering)
    expect(rule.toState).toBe(AgentState.FindingSeat)
  })

  it('should transition when service time is complete (stateTimer >= stateDuration)', () => {
    const agent = createTestAgent({ state: AgentState.Ordering })
    agent.stateTimer = 10
    agent.stateDuration = 8

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should transition when stateTimer equals stateDuration exactly', () => {
    const agent = createTestAgent({ state: AgentState.Ordering })
    agent.stateTimer = 8
    agent.stateDuration = 8

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should NOT transition when service is still in progress', () => {
    const agent = createTestAgent({ state: AgentState.Ordering })
    agent.stateTimer = 3
    agent.stateDuration = 8

    expect(rule.condition(agent, 0.016)).toBe(false)
  })

  it('should produce effects with dequeue_agent, update_state, and reset_timer types', () => {
    const dequeueEffect = rule.effects.find((e) => e.type === 'dequeue_agent')
    const stateEffect = rule.effects.find((e) => e.type === 'update_state')
    const timerEffect = rule.effects.find((e) => e.type === 'reset_timer')
    expect(dequeueEffect).toBeDefined()
    expect(stateEffect).toBeDefined()
    expect(stateEffect!.payload.state).toBe(AgentState.FindingSeat)
    expect(timerEffect).toBeDefined()
  })
})

// ============================================================================
// FindingSeat -> Dining
// ============================================================================
describe('RULE_FINDING_SEAT_TO_DINING', () => {
  const rule = RULE_FINDING_SEAT_TO_DINING

  it('should define correct fromState and toState', () => {
    expect(rule.fromState).toBe(AgentState.FindingSeat)
    expect(rule.toState).toBe(AgentState.Dining)
  })

  it('should transition when agent arrived at seat (target null) and seat assigned', () => {
    const agent = createTestAgent({ state: AgentState.FindingSeat })
    agent.target = null
    agent.assignedSeat = 5

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should transition when assignedSeat is 0 (valid seat)', () => {
    const agent = createTestAgent({ state: AgentState.FindingSeat })
    agent.target = null
    agent.assignedSeat = 0

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should NOT transition when agent still moving toward seat', () => {
    const agent = createTestAgent({ state: AgentState.FindingSeat })
    agent.target = { x: 20, z: 5 }
    agent.assignedSeat = 5

    expect(rule.condition(agent, 0.016)).toBe(false)
  })

  it('should NOT transition when no seat assigned (assignedSeat = -1)', () => {
    const agent = createTestAgent({ state: AgentState.FindingSeat })
    agent.target = null
    agent.assignedSeat = -1

    expect(rule.condition(agent, 0.016)).toBe(false)
  })

  it('should produce effects with update_state, reset_timer, and set_duration types', () => {
    const stateEffect = rule.effects.find((e) => e.type === 'update_state')
    const timerEffect = rule.effects.find((e) => e.type === 'reset_timer')
    const durationEffect = rule.effects.find((e) => e.type === 'set_duration')
    expect(stateEffect).toBeDefined()
    expect(stateEffect!.payload.state).toBe(AgentState.Dining)
    expect(timerEffect).toBeDefined()
    expect(durationEffect).toBeDefined()
    expect(durationEffect!.payload.duration).toBe('diningTime')
  })
})

// ============================================================================
// FindingSeat -> Leaving (no seat available)
// ============================================================================
describe('RULE_FINDING_SEAT_TO_LEAVING', () => {
  const rule = RULE_FINDING_SEAT_TO_LEAVING

  it('should define correct fromState and toState', () => {
    expect(rule.fromState).toBe(AgentState.FindingSeat)
    expect(rule.toState).toBe(AgentState.Leaving)
  })

  it('should transition when no seat is assigned (assignedSeat < 0)', () => {
    const agent = createTestAgent({ state: AgentState.FindingSeat })
    agent.assignedSeat = -1

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should NOT transition when a seat is assigned', () => {
    const agent = createTestAgent({ state: AgentState.FindingSeat })
    agent.assignedSeat = 3

    expect(rule.condition(agent, 0.016)).toBe(false)
  })

  it('should NOT transition when assignedSeat is 0 (valid seat)', () => {
    const agent = createTestAgent({ state: AgentState.FindingSeat })
    agent.assignedSeat = 0

    expect(rule.condition(agent, 0.016)).toBe(false)
  })

  it('should produce effects with update_state type', () => {
    const stateEffect = rule.effects.find((e) => e.type === 'update_state')
    expect(stateEffect).toBeDefined()
    expect(stateEffect!.payload.state).toBe(AgentState.Leaving)
  })
})

// ============================================================================
// Dining -> Leaving
// ============================================================================
describe('RULE_DINING_TO_LEAVING', () => {
  const rule = RULE_DINING_TO_LEAVING

  it('should define correct fromState and toState', () => {
    expect(rule.fromState).toBe(AgentState.Dining)
    expect(rule.toState).toBe(AgentState.Leaving)
  })

  it('should transition when dining time is complete (stateTimer >= stateDuration)', () => {
    const agent = createTestAgent({ state: AgentState.Dining })
    agent.stateTimer = 35
    agent.stateDuration = 30

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should transition when stateTimer equals stateDuration exactly', () => {
    const agent = createTestAgent({ state: AgentState.Dining })
    agent.stateTimer = 30
    agent.stateDuration = 30

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should NOT transition when still dining', () => {
    const agent = createTestAgent({ state: AgentState.Dining })
    agent.stateTimer = 15
    agent.stateDuration = 30

    expect(rule.condition(agent, 0.016)).toBe(false)
  })

  it('should produce effects with release_seat and update_state types', () => {
    const releaseEffect = rule.effects.find((e) => e.type === 'release_seat')
    const stateEffect = rule.effects.find((e) => e.type === 'update_state')
    expect(releaseEffect).toBeDefined()
    expect(stateEffect).toBeDefined()
    expect(stateEffect!.payload.state).toBe(AgentState.Leaving)
  })
})

// ============================================================================
// Leaving -> Left
// ============================================================================
describe('RULE_LEAVING_TO_LEFT', () => {
  const rule = RULE_LEAVING_TO_LEFT

  it('should define correct fromState and toState', () => {
    expect(rule.fromState).toBe(AgentState.Leaving)
    expect(rule.toState).toBe(AgentState.Left)
  })

  it('should transition when agent has reached the exit (target null)', () => {
    const agent = createTestAgent({ state: AgentState.Leaving })
    agent.target = null

    expect(rule.condition(agent, 0.016)).toBe(true)
  })

  it('should NOT transition when agent is still moving toward exit', () => {
    const agent = createTestAgent({ state: AgentState.Leaving })
    agent.target = { x: 15, z: 20 }

    expect(rule.condition(agent, 0.016)).toBe(false)
  })

  it('should produce effects with update_state type set to Left', () => {
    const stateEffect = rule.effects.find((e) => e.type === 'update_state')
    expect(stateEffect).toBeDefined()
    expect(stateEffect!.payload.state).toBe(AgentState.Left)
  })
})

// ============================================================================
// STATE_TRANSITION_RULES aggregate
// ============================================================================
describe('STATE_TRANSITION_RULES (aggregate)', () => {
  it('should contain exactly 9 rules', () => {
    expect(STATE_TRANSITION_RULES).toHaveLength(9)
  })

  it('should cover all expected state transitions', () => {
    const transitionPairs = STATE_TRANSITION_RULES.map(
      (r) => `${r.fromState}->${r.toState}`
    )
    expect(transitionPairs).toContain(`${AgentState.Entering}->${AgentState.ChoosingWindow}`)
    expect(transitionPairs).toContain(`${AgentState.ChoosingWindow}->${AgentState.Queuing}`)
    expect(transitionPairs).toContain(`${AgentState.Queuing}->${AgentState.Ordering}`)
    expect(transitionPairs).toContain(`${AgentState.Queuing}->${AgentState.Leaving}`)
    expect(transitionPairs).toContain(`${AgentState.Ordering}->${AgentState.FindingSeat}`)
    expect(transitionPairs).toContain(`${AgentState.FindingSeat}->${AgentState.Dining}`)
    expect(transitionPairs).toContain(`${AgentState.FindingSeat}->${AgentState.Leaving}`)
    expect(transitionPairs).toContain(`${AgentState.Dining}->${AgentState.Leaving}`)
    expect(transitionPairs).toContain(`${AgentState.Leaving}->${AgentState.Left}`)
  })

  it('should have all rules with non-empty effects arrays', () => {
    for (const rule of STATE_TRANSITION_RULES) {
      expect(rule.effects.length).toBeGreaterThan(0)
    }
  })

  it('every rule should have a condition that is a function', () => {
    for (const rule of STATE_TRANSITION_RULES) {
      expect(typeof rule.condition).toBe('function')
    }
  })
})
