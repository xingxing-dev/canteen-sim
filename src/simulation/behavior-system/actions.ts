/**
 * 行为节点实现
 *
 * 食堂仿真中 Agent 的具体行为。
 * 行为节点可返回 Running（需要多帧完成）或立即返回 Success / Failure。
 */

import { AgentState } from '../agent';
import type { Agent } from '../agent';
import type { BTContext } from './behavior-tree';
import { ActionNode, BTStatus } from './behavior-tree';

// ============================================================================
// MoveToTarget — 向目标移动（返回 Running 直到到达）
// ============================================================================

export class MoveToTarget extends ActionNode {
  constructor() {
    super('MoveToTarget');
  }

  tick(agent: Agent, _ctx: BTContext, dt: number): BTStatus {
    if (!agent.target) {
      // 没有目标，视为已到达
      return BTStatus.Success;
    }
    const arrived = agent.moveToward(dt);
    return arrived ? BTStatus.Success : BTStatus.Running;
  }
}

// ============================================================================
// ChooseBestWindow — 选择最短队列的窗口
// ============================================================================

/**
 * 为 Agent 选择排队人数最少的窗口。
 * 成功时设置 agent.assignedWindow 和 agent.target（队尾位置）。
 * 如果没有可用窗口则返回 Failure。
 */
export class ChooseBestWindow extends ActionNode {
  constructor() {
    super('ChooseBestWindow');
  }

  tick(agent: Agent, ctx: BTContext, _dt: number): BTStatus {
    if (ctx.windowQueues.length === 0) {
      return BTStatus.Failure;
    }

    let bestIdx = 0;
    let minLen = Infinity;

    for (let i = 0; i < ctx.windowQueues.length; i++) {
      const total = ctx.windowQueues[i].queueLength + (ctx.windowQueues[i].isServing ? 1 : 0);
      if (total < minLen) {
        minLen = total;
        bestIdx = i;
      }
    }

    agent.assignedWindow = bestIdx;

    // 计算排队目标位置（队尾）
    const win = ctx.layout.windows[bestIdx];
    const queuePos = ctx.windowQueues[bestIdx].queueLength;
    agent.target = {
      x: win.queueStart.x + win.queueDirection.x * queuePos * 1.2,
      z: win.queueStart.z + win.queueDirection.z * queuePos * 1.2,
    };

    agent.state = AgentState.ChoosingWindow;
    return BTStatus.Success;
  }
}

// ============================================================================
// JoinQueue — 加入队列
// ============================================================================

/**
 * 将 Agent 标记为排队状态。
 * 前置条件：agent.assignedWindow >= 0 且 agent.target 已设置。
 */
export class JoinQueue extends ActionNode {
  constructor() {
    super('JoinQueue');
  }

  tick(agent: Agent, _ctx: BTContext, _dt: number): BTStatus {
    if (agent.assignedWindow < 0) {
      return BTStatus.Failure;
    }

    agent.state = AgentState.Queuing;
    agent.stateTimer = 0;
    return BTStatus.Success;
  }
}

// ============================================================================
// OrderFood — 点餐（计时，完成返回 Success）
// ============================================================================

/**
 * 在窗口前点餐。
 * 首次 tick 初始化 stateDuration，后续 tick 累加 stateTimer。
 * 计时完成后返回 Success。
 */
export class OrderFood extends ActionNode {
  constructor() {
    super('OrderFood');
  }

  tick(agent: Agent, ctx: BTContext, dt: number): BTStatus {
    // 首次进入：初始化计时
    if (agent.state !== AgentState.Ordering) {
      agent.state = AgentState.Ordering;
      agent.stateTimer = 0;
      agent.stateDuration =
        ctx.config.serviceTime * (0.7 + Math.random() * 0.6);
    }

    agent.stateTimer += dt;

    if (agent.stateTimer >= agent.stateDuration) {
      return BTStatus.Success;
    }

    return BTStatus.Running;
  }
}

// ============================================================================
// FindSeat — 寻找空座位
// ============================================================================

/**
 * 寻找并分配一个空座位，设置 agent.target 为座位位置。
 * 没有空座位则返回 Failure。
 */
export class FindSeat extends ActionNode {
  constructor() {
    super('FindSeat');
  }

  tick(agent: Agent, ctx: BTContext, _dt: number): BTStatus {
    // 已有座位
    if (agent.assignedSeat >= 0) {
      return BTStatus.Success;
    }

    // 查找空座位
    const available = ctx.layout.seats.find(
      (s) => !ctx.occupiedSeats.has(s.id)
    );

    if (!available) {
      return BTStatus.Failure;
    }

    agent.assignedSeat = available.id;
    agent.target = { ...available.position };
    agent.state = AgentState.FindingSeat;
    return BTStatus.Success;
  }
}

// ============================================================================
// Eat — 就餐（计时，完成返回 Success）
// ============================================================================

/**
 * 在座位上就餐。
 * 首次 tick 初始化 stateDuration，后续 tick 累加 stateTimer。
 * 计时完成后返回 Success。
 */
export class Eat extends ActionNode {
  constructor() {
    super('Eat');
  }

  tick(agent: Agent, ctx: BTContext, dt: number): BTStatus {
    // 首次进入：初始化计时
    if (agent.state !== AgentState.Dining) {
      agent.state = AgentState.Dining;
      agent.stateTimer = 0;
      agent.stateDuration =
        ctx.config.diningTime * (0.7 + Math.random() * 0.6);
    }

    agent.stateTimer += dt;

    if (agent.stateTimer >= agent.stateDuration) {
      return BTStatus.Success;
    }

    return BTStatus.Running;
  }
}

// ============================================================================
// LeaveCanteen — 走向出口
// ============================================================================

/**
 * 设置出口为目标并移动。
 * 到达出口后标记为 Left 状态。
 */
export class LeaveCanteen extends ActionNode {
  constructor() {
    super('LeaveCanteen');
  }

  tick(agent: Agent, ctx: BTContext, dt: number): BTStatus {
    // 设置出口目标
    if (agent.state !== AgentState.Leaving) {
      agent.state = AgentState.Leaving;
      agent.target = { ...ctx.layout.exit };
    }

    if (!agent.target) {
      agent.state = AgentState.Left;
      return BTStatus.Success;
    }

    const arrived = agent.moveToward(dt);
    if (arrived) {
      agent.state = AgentState.Left;
      return BTStatus.Success;
    }

    return BTStatus.Running;
  }
}
