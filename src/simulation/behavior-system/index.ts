/**
 * Behavior System — 统一导出
 *
 * 行为树框架：为 Agent 提供声明式的自主决策能力。
 * 与 FSM（状态标记）互补，BT 负责"做什么"的决策。
 */

// ---- 核心类型与节点 ----
export {
  BTStatus,
  SequenceNode,
  SelectorNode,
  InverterNode,
  RepeatUntilNode,
  AlwaysSucceedNode,
  ConditionNode,
  ActionNode,
} from './behavior-tree';
export type { BTNode, BTContext, WindowQueueInfo } from './behavior-tree';

// ---- 条件节点 ----
export {
  IsAtTarget,
  HasAssignedWindow,
  HasAssignedSeat,
  IsPatient,
  IsQueueTooLong,
  IsWindowAvailable,
  IsSeatAvailable,
} from './conditions';

// ---- 行为节点 ----
export {
  MoveToTarget,
  ChooseBestWindow,
  JoinQueue,
  OrderFood,
  FindSeat,
  Eat,
  LeaveCanteen,
} from './actions';

// ---- 预定义行为树 ----
export { createCustomerBehaviorTree } from './composites';
