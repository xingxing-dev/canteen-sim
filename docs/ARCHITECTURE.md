# 系统架构文档

## 分层架构

系统采用三层分离架构，各层通过接口通信，可独立开发和测试。

### Layer 1: Simulation Core（仿真内核）

**路径：** `src/simulation/`  
**依赖：** 无外部依赖（纯 TypeScript）  
**职责：** Agent 生命周期管理、状态转移、队列调度、统计采集

核心模块：

| 模�� | 文件 | 职责 |
|------|------|------|
| Engine | `engine.ts` | 主循环 `step(dt)`，编排所有子系统 |
| Agent | `agent.ts` | Agent 类，8 状态枚举，移动逻辑 |
| FSM | `state-machine/` | 声明式规则定义 + 执行器 |
| Routing | `routing.ts` | 窗口选择算法 |
| Config | `config.ts` | 场景参数、预设配置 |
| Layout | `layout.ts` | 食堂布局生成 |
| Stats | `stats.ts` | 统计数据结构定义 |

### Layer 2: Scene（3D 渲染层）

**路径：** `src/scene/`  
**依赖：** Three.js, React Three Fiber, Drei  
**职责：** 将仿真状态可视化为 3D 场景

核心模块：

| 模块 | 文件 | 职责 |
|------|------|------|
| Canteen | `Canteen.tsx` | 食堂静态/动态元素渲染 |
| Agent | `VoxelAgent.tsx` | 体素人渲染 + 行走动画 |
| Camera | `cameraViews.ts` | 预设视角 + 缓动过渡 |
| Instanced | `instanced/` | InstancedMesh 优化（地面/墙壁） |

### Layer 3: UI（交互控制层）

**路径：** `src/ui/`  
**依赖：** React, Recharts, Leva  
**职责：** 参数控制、数据展示、用户交互

核心模块：

| 模块 | 文件 | 职责 |
|------|------|------|
| Control | `ControlPanel.tsx` | 场景切换、速度控制、Demo 模式 |
| Stats | `StatsPanel.tsx` | 实时统计 + 趋势图表 |
| Legend | `Legend.tsx` | Agent 状态颜色图例 |

## 数据流

```
SimulationEngine.step(dt)
    │
    ├── spawnAgent() ─── 到达率曲线采样
    ├── updateAgent() ── FSM 状��转移 + 移动
    ├── updateWindowQueues() ── ���务调度
    ├── recordHeatmap() ── 空间停留累积
    └── updateStats() ── 统计聚合
            │
            ▼
        SimStats (接口)
            │
    ┌───────┼───────┐
    ▼       ▼       ▼
 Scene    Stats   Heatmap
 (3D)    Panel    Layer
```

## 关键设计决策

### 1. FSM + Window Queue 混合模式

Agent 状态转移大部分由 FSM 规则驱动（条件满足即触发），但 `Queuing → Ordering` 转移由窗口队列系统管理（必须排到队首且窗口空闲）。

**原因：** FSM 规则按帧评估，无法表达"排队顺序"这种外部系统时序约束。

### 2. 仿真-渲染频率解耦

引擎以 60fps 推进 `step(dt)`，但 React 状态更新节流到 0.25s（4fps）。引擎实例存储在 `useRef` 中，仿真推进不触发 React 重渲染。

**原因：** Recharts 图表组件较重，60fps 更新导致严重卡顿。

### 3. 确定性随机

使用 LCG 伪随机数生成器（`seed * 1664525 + 1013904223`），保证相同 seed + 相同 config = 完全相同的仿真结果。

**原因：** 窗口方案对比实验需要排除随机干扰。

### 4. 声明式 FSM 规则

状态转移规则定义为数据对象（`{fromState, toState, condition, effects}`），执行器保证每帧最多一次转移。

**原因：** 规则可独立测试、可枚举、可序列化，便于调试和扩展。

## 性能约束

| 场景 | 指标 | 现状 |
|------|------|------|
| 100 Agent 单帧 | <5ms | ✅ 通过 |
| 200 Agent 单帧 | <10ms | ✅ 通过 |
| 1000 步 50 Agent | <500ms | ✅ 通过 |
| Agent 内存泄漏 | Left 状态定期清理 | ✅ cleanup() 每 2s |

## 测试策略

- **单元测试**：每条 FSM 规则独立验证条件和效果
- **集成测试**：Agent 完整生命周期穿越所有状态
- **场景测试**：明湖午高峰特定行为验证
- **性能测试**：帧时间基准 + 内存泄漏检测
- **确定性验证**：相同 seed 运行两次结果一致
