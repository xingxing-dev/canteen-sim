/**
 * Behavior Tree 核心节点类型
 *
 * 行为树提供声明式的决策结构：
 * - Selector：依次尝试子节点，任一成功即成功（OR 语义）
 * - Sequence：依次执行子节点，全部成功才成功（AND 语义）
 * - 装饰器：修饰单个子节点的返回值或执行策略
 * - 叶子节点：实际的条件判断 / 行为执行
 *
 * 与 FSM 的分工：
 *   BT 决定 Agent "做什么"（决策层）
 *   FSM 标记 Agent "是什么状态"（状态标记层）
 */

import type { Agent } from '../agent';
import type { CanteenLayout } from '../layout';
import type { SimulationConfig } from '../config';

// ============================================================================
// 节点状态
// ============================================================================

/** 行为树节点的执行状态 */
export enum BTStatus {
  /** 成功完成 */
  Success = 'success',
  /** 失败 */
  Failure = 'failure',
  /** 仍在执行中（需要下一帧继续） */
  Running = 'running',
}

// ============================================================================
// 共享上下文
// ============================================================================

/** 窗口队列信息（BT 可读的只读视图） */
export interface WindowQueueInfo {
  /** 当前排队 Agent 数量（不含正在服务的） */
  queueLength: number;
  /** 是否有 Agent 正在被服务 */
  isServing: boolean;
}

/**
 * BT 上下文
 * 包含行为树执行时需要的共享数据，由引擎每帧注入
 */
export interface BTContext {
  /** 食堂布局数据 */
  layout: CanteenLayout;
  /** 仿真配置 */
  config: SimulationConfig;
  /** 各窗口队列信息（只读快照） */
  windowQueues: WindowQueueInfo[];
  /** 已占用座位 ID 集合 */
  occupiedSeats: ReadonlySet<number>;
  /** 队列太长的阈值（超过此值 IsQueueTooLong 返回 true） */
  queueLongThreshold: number;
}

// ============================================================================
// 基础节点接口
// ============================================================================

/** 行为树节点接口 */
export interface BTNode {
  /** 节点名称（调试用） */
  readonly name: string;
  /**
   * 执行一次 tick
   * @param agent  - 当前决策的 Agent
   * @param ctx    - 共享上下文
   * @param dt     - 帧间隔（秒）
   * @returns 节点执行状态
   */
  tick(agent: Agent, ctx: BTContext, dt: number): BTStatus;
}

// ============================================================================
// 叶子节点基类
// ============================================================================

/** 条件节点基类：同步判断，返回 Success 或 Failure */
export abstract class ConditionNode implements BTNode {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  tick(agent: Agent, ctx: BTContext, _dt: number): BTStatus {
    return this.check(agent, ctx) ? BTStatus.Success : BTStatus.Failure;
  }

  /** 子类实现：返回 true 表示条件成立 */
  protected abstract check(agent: Agent, ctx: BTContext): boolean;
}

/** 行为节点基类：可返回 Running 表示尚未完成 */
export abstract class ActionNode implements BTNode {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract tick(agent: Agent, ctx: BTContext, dt: number): BTStatus;
}

// ============================================================================
// 组合节点
// ============================================================================

/**
 * Sequence 节点（顺序执行）
 * - 从左到右依次 tick 子节点
 * - 任一子节点返回 Failure → 整体 Failure
 * - 任一子节点返回 Running → 整体 Running（下一帧从该子节点继续）
 * - 全部返回 Success → 整体 Success
 */
export class SequenceNode implements BTNode {
  readonly name: string;
  private readonly children: BTNode[];
  /** 当前正在执行的子节点索引（支持 Running 续帧） */
  private runningIndex: number = 0;

  constructor(name: string, children: BTNode[]) {
    this.name = name;
    this.children = children;
  }

  tick(agent: Agent, ctx: BTContext, dt: number): BTStatus {
    for (let i = this.runningIndex; i < this.children.length; i++) {
      const status = this.children[i].tick(agent, ctx, dt);

      if (status === BTStatus.Failure) {
        this.runningIndex = 0;
        return BTStatus.Failure;
      }

      if (status === BTStatus.Running) {
        this.runningIndex = i;
        return BTStatus.Running;
      }

      // Success → 继续下一个子节点
    }

    // 全部子节点成功
    this.runningIndex = 0;
    return BTStatus.Success;
  }
}

/**
 * Selector 节点（选择执行）
 * - 从左到右依次 tick 子节点
 * - 任一子节点返回 Success → 整体 Success
 * - 任一子节点返回 Running → 整体 Running（下一帧从该子节点继续）
 * - 全部返回 Failure → 整体 Failure
 */
export class SelectorNode implements BTNode {
  readonly name: string;
  private readonly children: BTNode[];
  /** 当前正在执行的子节点索引（支持 Running 续帧） */
  private runningIndex: number = 0;

  constructor(name: string, children: BTNode[]) {
    this.name = name;
    this.children = children;
  }

  tick(agent: Agent, ctx: BTContext, dt: number): BTStatus {
    for (let i = this.runningIndex; i < this.children.length; i++) {
      const status = this.children[i].tick(agent, ctx, dt);

      if (status === BTStatus.Success) {
        this.runningIndex = 0;
        return BTStatus.Success;
      }

      if (status === BTStatus.Running) {
        this.runningIndex = i;
        return BTStatus.Running;
      }

      // Failure → 继续尝试下一个子节点
    }

    // 全部子节点失败
    this.runningIndex = 0;
    return BTStatus.Failure;
  }
}

// ============================================================================
// 装饰器节点
// ============================================================================

/** Inverter：取反（Success ↔ Failure, Running 不变） */
export class InverterNode implements BTNode {
  readonly name: string;
  private readonly child: BTNode;

  constructor(child: BTNode) {
    this.name = `Invert(${child.name})`;
    this.child = child;
  }

  tick(agent: Agent, ctx: BTContext, dt: number): BTStatus {
    const status = this.child.tick(agent, ctx, dt);
    if (status === BTStatus.Success) return BTStatus.Failure;
    if (status === BTStatus.Failure) return BTStatus.Success;
    return BTStatus.Running;
  }
}

/**
 * RepeatUntil：反复执行子节点直到返回指定状态
 * - 子节点返回 targetStatus → 整体 Success
 * - 否则 → 整体 Running（下一帧再执行子节点）
 */
export class RepeatUntilNode implements BTNode {
  readonly name: string;
  private readonly child: BTNode;
  private readonly targetStatus: BTStatus;

  constructor(child: BTNode, targetStatus: BTStatus) {
    this.name = `RepeatUntil(${child.name}, ${targetStatus})`;
    this.child = child;
    this.targetStatus = targetStatus;
  }

  tick(agent: Agent, ctx: BTContext, dt: number): BTStatus {
    const status = this.child.tick(agent, ctx, dt);
    if (status === this.targetStatus) {
      return BTStatus.Success;
    }
    return BTStatus.Running;
  }
}

/** AlwaysSucceed：无论子节点返回什么，都返回 Success（Running 除外） */
export class AlwaysSucceedNode implements BTNode {
  readonly name: string;
  private readonly child: BTNode;

  constructor(child: BTNode) {
    this.name = `AlwaysSucceed(${child.name})`;
    this.child = child;
  }

  tick(agent: Agent, ctx: BTContext, dt: number): BTStatus {
    const status = this.child.tick(agent, ctx, dt);
    if (status === BTStatus.Running) return BTStatus.Running;
    return BTStatus.Success;
  }
}
