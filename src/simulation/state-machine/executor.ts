import type { Agent, AgentState } from '../agent';
import type { StateTransitionRule, TransitionResult } from './types';

/**
 * 状态机执行引擎
 *
 * 核心职责：
 * 1. 管理 FSM 规则集合
 * 2. 每帧为每个 Agent 执行一次转移检查（最多转移一次）
 * 3. 返回转移结果（新状态和副作用）
 *
 * 设计约束：
 * - 单帧单转移：一个 Agent 在一个 update 周期内最多转移一次
 * - 纯执行：不处理副作用执行，只返回副作用列表
 * - 确定性：给定相同的输入，总是返回相同的结果
 */
export class StateMachineExecutor {
  /** 状态转移规则集合 */
  private rules: StateTransitionRule[];

  /**
   * 构造函数
   * @param rules - 状态转移规则数组
   */
  constructor(rules: StateTransitionRule[]) {
    this.rules = [...rules];
  }

  /**
   * 为指定 Agent 执行一次状态转移检查
   *
   * 执行流程：
   * 1. 查找从当前状态出发的所有可用规则
   * 2. 按顺序检查每条规则的条件
   * 3. 如果条件满足，执行转移并返回结果
   * 4. 如果没有规则匹配，返回"未转移"结果
   *
   * 关键保证：
   * - 单帧最多一次转移（遇到第一条匹配的规则就停止）
   * - 不修改 Agent 状态（由调用方处理副作用后修改）
   *
   * @param agent - 要执行转移的 Agent
   * @param deltaTime - 本帧时间增量（秒）
   * @returns 转移结果，包含是否转移、新状态和副作用列表
   */
  execute(agent: Agent, deltaTime: number): TransitionResult {
    // 当前状态
    const currentState = agent.state;

    // 查找从当前状态出发的所有规则
    const applicableRules = this.rules.filter(
      (rule) => rule.fromState === currentState
    );

    // 按顺序检查每条规则
    for (const rule of applicableRules) {
      // 检查条件（纯函数，无副作用）
      if (rule.condition(agent, deltaTime)) {
        // 条件满足，返回转移结果
        return {
          transitioned: true,
          newState: rule.toState,
          effects: [...rule.effects], // 复制副作用列表，避免外部修改
        };
      }
    }

    // 没有规则匹配，返回"未转移"结果
    return {
      transitioned: false,
      effects: [],
    };
  }

  /**
   * 获取指定源状态的所有可用转移目标
   *
   * 用途：
   * - 调试和分析 FSM 结构
   * - UI 展示可能的转移
   *
   * @param state - 源状态
   * @returns 可能的目标状态列表
   */
  getAvailableTransitions(state: AgentState): AgentState[] {
    return this.rules
      .filter((rule) => rule.fromState === state)
      .map((rule) => rule.toState);
  }

  /**
   * 添加新的转移规则
   *
   * @param rule - 新的转移规则
   */
  addRule(rule: StateTransitionRule): void {
    this.rules.push(rule);
  }

  /**
   * 替换现有的规则集合
   *
   * @param rules - 新的规则数组
   */
  setRules(rules: StateTransitionRule[]): void {
    this.rules = [...rules];
  }

  /**
   * 获取当前规则集合的副本
   *
   * @returns 规则数组的副本
   */
  getRules(): StateTransitionRule[] {
    return [...this.rules];
  }

  /**
   * 获取 FSM 的结构信息（用于调试）
   *
   * @returns FSM 结构描述对象
   */
  getStructure(): Record<string, AgentState[]> {
    const structure: Record<string, AgentState[]> = {};

    for (const rule of this.rules) {
      const fromStateName = rule.fromState;
      if (!structure[fromStateName]) {
        structure[fromStateName] = [];
      }
      if (!structure[fromStateName].includes(rule.toState)) {
        structure[fromStateName].push(rule.toState);
      }
    }

    return structure;
  }
}

/**
 * 创建一个预配置的状态机执行器
 *
 * @param rules - 状态转移规则数组
 * @returns 新的 StateMachineExecutor 实例
 */
export function createStateMachineExecutor(
  rules: StateTransitionRule[]
): StateMachineExecutor {
  return new StateMachineExecutor(rules);
}
