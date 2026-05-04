/**
 * 条件节点实现
 *
 * 食堂仿真中 Agent 需要判断的各种条件。
 * 每个条件节点都是同步的：check() 返回 true → Success，false → Failure。
 */

import type { Agent } from '../agent';
import type { BTContext } from './behavior-tree';
import { ConditionNode } from './behavior-tree';

// ============================================================================
// IsAtTarget — 是否已到达目标位置
// ============================================================================

export class IsAtTarget extends ConditionNode {
  constructor() {
    super('IsAtTarget');
  }

  protected check(agent: Agent, _ctx: BTContext): boolean {
    // target === null 表示已到达或没有目标
    return agent.target === null;
  }
}

// ============================================================================
// HasAssignedWindow — 是否已分配窗口
// ============================================================================

export class HasAssignedWindow extends ConditionNode {
  constructor() {
    super('HasAssignedWindow');
  }

  protected check(agent: Agent, _ctx: BTContext): boolean {
    return agent.assignedWindow >= 0;
  }
}

// ============================================================================
// HasAssignedSeat — 是否已分配座位
// ============================================================================

export class HasAssignedSeat extends ConditionNode {
  constructor() {
    super('HasAssignedSeat');
  }

  protected check(agent: Agent, _ctx: BTContext): boolean {
    return agent.assignedSeat >= 0;
  }
}

// ============================================================================
// IsPatient — 耐心值是否足够（patience > 0）
// ============================================================================

export class IsPatient extends ConditionNode {
  constructor() {
    super('IsPatient');
  }

  protected check(agent: Agent, _ctx: BTContext): boolean {
    return agent.patience > 0;
  }
}

// ============================================================================
// IsQueueTooLong — 队列是否太长
// ============================================================================

/**
 * 检查 Agent 当前分配的窗口队列是否过长。
 * 如果尚未分配窗口，则检查所有窗口中最短的队列。
 */
export class IsQueueTooLong extends ConditionNode {
  constructor() {
    super('IsQueueTooLong');
  }

  protected check(agent: Agent, ctx: BTContext): boolean {
    if (agent.assignedWindow >= 0) {
      const info = ctx.windowQueues[agent.assignedWindow];
      return info.queueLength >= ctx.queueLongThreshold;
    }
    // 没分配窗口时，看最短队列是否仍然太长
    const minLen = Math.min(...ctx.windowQueues.map((q) => q.queueLength));
    return minLen >= ctx.queueLongThreshold;
  }
}

// ============================================================================
// IsWindowAvailable — 窗口是否可用（至少有一个窗口未满）
// ============================================================================

export class IsWindowAvailable extends ConditionNode {
  constructor() {
    super('IsWindowAvailable');
  }

  protected check(_agent: Agent, ctx: BTContext): boolean {
    return ctx.windowQueues.some(
      (q) => q.queueLength < ctx.queueLongThreshold
    );
  }
}

// ============================================================================
// IsSeatAvailable — 是否有空座位
// ============================================================================

export class IsSeatAvailable extends ConditionNode {
  constructor() {
    super('IsSeatAvailable');
  }

  protected check(_agent: Agent, ctx: BTContext): boolean {
    return ctx.layout.seats.some((s) => !ctx.occupiedSeats.has(s.id));
  }
}
