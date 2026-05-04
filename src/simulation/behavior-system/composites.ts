/**
 * 预定义的组合行为树
 *
 * 将条件节点与行为节点组装成完整的 Agent 决策树。
 *
 * 顾客行为树结构：
 *
 *   Sequence("Customer")
 *   ├── MoveToTarget              // 走向入口
 *   ├── Selector("GetFood")       // 获取食物（可能换窗口或放弃）
 *   │   ├── Sequence("NormalOrder")
 *   │   │   ├── ChooseBestWindow
 *   │   │   ├── JoinQueue
 *   │   │   ├── Sequence("WaitAndOrder")
 *   │   │   │   ├── MoveToTarget          // 走向排队位置
 *   │   │   │   └── OrderFood
 *   │   │   └── AlwaysSucceed             // 忽略后续失败，继续
 *   │   └── Sequence("QueueTooLong")
 *   │       ├── IsQueueTooLong
 *   │       ├── Inverter(IsPatient)       // 不耐烦了
 *   │       └── LeaveCanteen              // 直接走人
 *   ├── Selector("DineOrLeave")   // 找座位吃饭或离开
 *   │   ├── Sequence("Dine")
 *   │   │   ├── FindSeat
 *   │   │   ├── MoveToTarget             // 走向座位
 *   │   │   └── Eat
 *   │   └── LeaveCanteen                 // 没座位就走
 *   └── LeaveCanteen              // 吃完走人
 */

import type { BTNode } from './behavior-tree';
import {
  SequenceNode,
  SelectorNode,
  InverterNode,
  AlwaysSucceedNode,
} from './behavior-tree';
import {
  MoveToTarget,
  ChooseBestWindow,
  JoinQueue,
  OrderFood,
  FindSeat,
  Eat,
  LeaveCanteen,
} from './actions';
import {
  IsPatient,
  IsQueueTooLong,
} from './conditions';

/**
 * 创建完整的顾客行为树
 *
 * 行为流程：
 *   进入 → 选窗口 → 排队 → 点餐 → 找座位 → 就餐 → 离开
 *
 * 分支逻辑：
 *   - 队伍太长且不耐烦 → 直接离开
 *   - 没有空座位 → 直接离开
 */
export function createCustomerBehaviorTree(): BTNode {
  // ---- 排队点餐子树 ----
  const waitAndOrder = new SequenceNode('WaitAndOrder', [
    new MoveToTarget(),
    new OrderFood(),
  ]);

  const normalOrder = new SequenceNode('NormalOrder', [
    new ChooseBestWindow(),
    new JoinQueue(),
    new AlwaysSucceedNode(waitAndOrder),
  ]);

  // ---- 队伍太长→离开子树 ----
  const queueTooLongBail = new SequenceNode('QueueTooLongBail', [
    new IsQueueTooLong(),
    new InverterNode(new IsPatient()),  // 不耐烦时 IsPatient=Failure → Invert=Success
    new LeaveCanteen(),
  ]);

  // ---- 获取食物（正常点餐 or 放弃） ----
  const getFood = new SelectorNode('GetFood', [
    normalOrder,
    queueTooLongBail,
  ]);

  // ---- 就餐子树 ----
  const dine = new SequenceNode('Dine', [
    new FindSeat(),
    new MoveToTarget(),
    new Eat(),
  ]);

  // ---- 就餐或离开 ----
  const dineOrLeave = new SelectorNode('DineOrLeave', [
    dine,
    new LeaveCanteen(),
  ]);

  // ---- 顶层序列 ----
  return new SequenceNode('Customer', [
    new MoveToTarget(),   // 走向入口位置
    getFood,              // 选窗口 → 排队 → 点餐
    dineOrLeave,          // 找座位 → 吃饭 → 或离开
    new LeaveCanteen(),   // 吃完离开
  ]);
}
