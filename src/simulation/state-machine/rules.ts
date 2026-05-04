import type { Agent } from '../agent';
import { AgentState } from '../agent';
import type { StateTransitionRule } from './types';

/**
 * FSM 状态转移规则定义
 *
 * 设计原则：
 * 1. 所有条件检查都是纯函数（同样的输入→同样的输出）
 * 2. 条件检查不产生副作用
 * 3. 每条规则代表一个可能的状态转移
 * 4. Agent 每帧最多转移一次（由 StateMachineExecutor 保证）
 */

// ============================================================================
// Entering → ChoosingWindow
// ============================================================================

/**
 * 条件：Agent 已到达入口处
 * 检查方式：Agent 没有移动目标（moveToward 返回 true 表示已到达）
 */
export const RULE_ENTERING_TO_CHOOSING_WINDOW: StateTransitionRule = {
  fromState: AgentState.Entering,
  toState: AgentState.ChoosingWindow,
  condition: (agent: Agent): boolean => {
    // 当没有 target 或已到达 target 时，视为进入完成
    // 这由 moveToward() 的调用方来确定
    return agent.target === null;
  },
  effects: [
    {
      id: 'set_choosing_state',
      type: 'update_state',
      payload: { state: AgentState.ChoosingWindow },
    },
  ],
};

// ============================================================================
// ChoosingWindow → Queuing
// ============================================================================

/**
 * 条件：Agent 已选择窗口并进入队列
 * 检查方式：Agent 已被加入某个窗口的队列
 */
export const RULE_CHOOSING_WINDOW_TO_QUEUING: StateTransitionRule = {
  fromState: AgentState.ChoosingWindow,
  toState: AgentState.Queuing,
  condition: (agent: Agent): boolean => {
    // 当 Agent 有分配的窗口时，表示已选择窗口
    // 实际队列操作由外层系统处理
    return agent.assignedWindow >= 0;
  },
  effects: [
    {
      id: 'set_queuing_state',
      type: 'update_state',
      payload: { state: AgentState.Queuing },
    },
    {
      id: 'reset_state_timer',
      type: 'reset_timer',
      payload: { timer: 'stateTimer' },
    },
  ],
};

// ============================================================================
// Queuing → Ordering
// ============================================================================

/**
 * 条件：Agent 已到达队首位置，现在被叫号
 * 检查方式：stateTimer > 0 且 Agent 已被分配为正在服务的状态
 */
export const RULE_QUEUING_TO_ORDERING: StateTransitionRule = {
  fromState: AgentState.Queuing,
  toState: AgentState.Ordering,
  condition: (agent: Agent): boolean => {
    // 这个转移由窗口服务系统触发
    // 条件检查：Agent 仍在活跃状态（耐心未耗尽）
    return agent.patience > 0;
  },
  effects: [
    {
      id: 'set_ordering_state',
      type: 'update_state',
      payload: { state: AgentState.Ordering },
    },
    {
      id: 'reset_state_timer',
      type: 'reset_timer',
      payload: { timer: 'stateTimer' },
    },
    {
      id: 'set_service_duration',
      type: 'set_duration',
      payload: { duration: 'serviceTime' },
    },
  ],
};

// ============================================================================
// Queuing → Leaving
// ============================================================================

/**
 * 条件：Agent 因不耐烦而离开队列
 * 检查方式：耐心值 <= 0
 */
export const RULE_QUEUING_TO_LEAVING: StateTransitionRule = {
  fromState: AgentState.Queuing,
  toState: AgentState.Leaving,
  condition: (agent: Agent): boolean => {
    return agent.patience <= 0;
  },
  effects: [
    {
      id: 'remove_from_queue',
      type: 'dequeue_agent',
      payload: { windowSource: 'assignedWindow' },
    },
    {
      id: 'set_leaving_state',
      type: 'update_state',
      payload: { state: AgentState.Leaving },
    },
  ],
};

// ============================================================================
// Ordering → FindingSeat
// ============================================================================

/**
 * 条件：服务已完成（stateTimer >= stateDuration）
 * 检查方式：计时器检查
 */
export const RULE_ORDERING_TO_FINDING_SEAT: StateTransitionRule = {
  fromState: AgentState.Ordering,
  toState: AgentState.FindingSeat,
  condition: (agent: Agent): boolean => {
    return agent.stateTimer >= agent.stateDuration;
  },
  effects: [
    {
      id: 'dequeue_from_service',
      type: 'dequeue_agent',
      payload: { windowSource: 'assignedWindow' },
    },
    {
      id: 'set_finding_seat_state',
      type: 'update_state',
      payload: { state: AgentState.FindingSeat },
    },
    {
      id: 'reset_state_timer',
      type: 'reset_timer',
      payload: { timer: 'stateTimer' },
    },
  ],
};

// ============================================================================
// FindingSeat → Dining
// ============================================================================

/**
 * 条件：Agent 已到达座位位置
 * 检查方式：target 为 null（表示已到达）且 assignedSeat 有效
 */
export const RULE_FINDING_SEAT_TO_DINING: StateTransitionRule = {
  fromState: AgentState.FindingSeat,
  toState: AgentState.Dining,
  condition: (agent: Agent): boolean => {
    return agent.target === null && agent.assignedSeat >= 0;
  },
  effects: [
    {
      id: 'set_dining_state',
      type: 'update_state',
      payload: { state: AgentState.Dining },
    },
    {
      id: 'reset_state_timer',
      type: 'reset_timer',
      payload: { timer: 'stateTimer' },
    },
    {
      id: 'set_dining_duration',
      type: 'set_duration',
      payload: { duration: 'diningTime' },
    },
  ],
};

// ============================================================================
// FindingSeat → Leaving (no seat available)
// ============================================================================

/**
 * 条件：没有座位可用
 * 检查方式：assignedSeat < 0（表示未能分配座位）
 */
export const RULE_FINDING_SEAT_TO_LEAVING: StateTransitionRule = {
  fromState: AgentState.FindingSeat,
  toState: AgentState.Leaving,
  condition: (agent: Agent): boolean => {
    return agent.assignedSeat < 0;
  },
  effects: [
    {
      id: 'set_leaving_state',
      type: 'update_state',
      payload: { state: AgentState.Leaving },
    },
  ],
};

// ============================================================================
// Dining → Leaving
// ============================================================================

/**
 * 条件：用餐时间已完成（stateTimer >= stateDuration）
 * 检查方式：计时器检查
 */
export const RULE_DINING_TO_LEAVING: StateTransitionRule = {
  fromState: AgentState.Dining,
  toState: AgentState.Leaving,
  condition: (agent: Agent): boolean => {
    return agent.stateTimer >= agent.stateDuration;
  },
  effects: [
    {
      id: 'release_seat',
      type: 'release_seat',
      payload: { seatSource: 'assignedSeat' },
    },
    {
      id: 'set_leaving_state',
      type: 'update_state',
      payload: { state: AgentState.Leaving },
    },
  ],
};

// ============================================================================
// Leaving → Left
// ============================================================================

/**
 * 条件：Agent 已到达出口
 * 检查方式：target 为 null（表示已到达）
 */
export const RULE_LEAVING_TO_LEFT: StateTransitionRule = {
  fromState: AgentState.Leaving,
  toState: AgentState.Left,
  condition: (agent: Agent): boolean => {
    return agent.target === null;
  },
  effects: [
    {
      id: 'set_left_state',
      type: 'update_state',
      payload: { state: AgentState.Left },
    },
  ],
};

// ============================================================================
// 完整的规则集合
// ============================================================================

/**
 * 所有可用的状态转移规则
 * 这个数组定义了整个 FSM 的转移图
 */
export const STATE_TRANSITION_RULES: StateTransitionRule[] = [
  RULE_ENTERING_TO_CHOOSING_WINDOW,
  RULE_CHOOSING_WINDOW_TO_QUEUING,
  RULE_QUEUING_TO_ORDERING,
  RULE_QUEUING_TO_LEAVING,
  RULE_ORDERING_TO_FINDING_SEAT,
  RULE_FINDING_SEAT_TO_DINING,
  RULE_FINDING_SEAT_TO_LEAVING,
  RULE_DINING_TO_LEAVING,
  RULE_LEAVING_TO_LEFT,
];
