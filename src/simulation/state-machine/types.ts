import type { Agent, AgentState } from '../agent';

/**
 * 副作用接口
 * 定义状态转移可能产生的副作用结构
 * 注意：实际执行由外层系统处理，FSM 仅定义结构
 */
export interface Effect {
  /** 副作用的唯一标识 */
  id: string;
  /** 副作用的类型（如 'move_target', 'assign_window', 等） */
  type: string;
  /** 副作用携带的参数 */
  payload: Record<string, unknown>;
}

/**
 * 状态转移规则接口
 * 定义从一个状态转移到另一个状态的条件和副作用
 */
export interface StateTransitionRule {
  /** 从状态 */
  fromState: AgentState;
  /** 到状态 */
  toState: AgentState;
  /** 转移条件检查函数（纯函数，无副作用） */
  condition: (agent: Agent, deltaTime: number) => boolean;
  /** 转移时产生的副作用列表 */
  effects: Effect[];
}

/**
 * 状态转移结果
 * 表示状态机执行一次转移的结果
 */
export interface TransitionResult {
  /** 是否发生了状态转移 */
  transitioned: boolean;
  /** 新的状态（如果转移了） */
  newState?: AgentState;
  /** 转移产生的副作用 */
  effects: Effect[];
}

/**
 * 副作用执行函数类型
 * 定义如何执行具体的副作用（由外层系统实现）
 */
export type EffectExecutor = (effect: Effect, agent: Agent) => void;
