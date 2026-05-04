# 🍜 明湖餐厅就餐仿真系统

> Minghu Canteen Simulation — Agent-Based Modeling for campus dining flow analysis

北京交通大学明湖餐厅午/晚高峰就餐过程的 3D 微观仿真系统。基于 Agent-Based Modeling 方法，模拟学生从进入餐厅到就餐离开的全生命周期，支持窗口配置方案对比实验和拥堵瓶颈分析。

## 核心特性

- **8 状态 Agent 生命周期**：进入 → 选窗口 → 排队 → 点餐 → 找座 → 就餐 → 离开
- **偏好路由算法**：偏好优先 + 容忍度降级 + 最短等待兜底
- **参数可控实验**：支持增设窗口方案对比（6/7/8 窗口）、午/晚高峰场景切换
- **实时数据看板**：平均等待、P95 等待、吞吐量、座位利用率、放弃率
- **热力图分析**：基于停留时间累积的拥堵热点检测与可视化
- **Demo Mode**：35 秒自动演示，6 阶段相机编排 + 同步字幕
- **体素风格 3D**：Minecraft 风格方块人，行走动画，电影灯光

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试（157 个测试）
npx vitest run

# 类型检查
npx tsc --noEmit

# 生产构建
npm run build

# 部署到 GitHub Pages
npm run deploy
```

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    App.tsx                            │
│          (主循环 · 相机系统 · Demo Mode)              │
├──────────┬──────────────────┬───────────────────────┤
│ UI Layer │   Scene Layer    │  Simulation Layer     │
│          │                  │  (纯逻辑，零渲染依赖)  │
├──────────┼──────────────────┼───────────────────────┤
│ Control  │ Canteen.tsx      │ engine.ts             │
│  Panel   │  · 窗口/桌椅     │  ├─ FSM 状态机        │
│          │  · 热力图层      │  ├─ 窗口队列系统       │
│ Stats    │  · 拥堵标记      │  ├─ 路由算法          │
│  Panel   │                  │  ├─ 到达率曲线        │
│          │ VoxelAgent.tsx   │  ├─ 热力图累积        │
│ Legend   │  · 方块人渲染    │  └─ 统计采集          │
│          │  · 行走动画      │                       │
│          │                  │ config.ts             │
│          │ cameraViews.ts   │  · 明湖午/晚高峰      │
│          │  · 5 预设视角    │  · 窗口配置方案       │
│          │  · 电影开场      │                       │
└──────────┴──────────────────┴───────────────────────┘
```

**关键设计决策：** 仿真引擎 (`src/simulation/`) 不依赖任何渲染库，可在 Node.js 环境独立运行和测试。渲染层通过 `SimStats` 接口订阅引擎状态。

## 目录结构

```
src/
├── simulation/           # 仿真内核（纯 TypeScript，零依赖）
│   ├── engine.ts         # SimulationEngine 主循环（708 行）
│   ├── agent.ts          # Agent 类 + 8 状态枚举
│   ├── config.ts         # 场景配置 + 明湖预设
│   ├── layout.ts         # 食堂布局生成
│   ├── stats.ts          # 统计接口定义
│   ├── routing.ts        # 窗口选择路由
│   └── state-machine/    # 声明式 FSM 框架
│       ├── types.ts      # Effect / Rule / Result 类型
│       ├── rules.ts      # 9 条状态转移规则
│       └── executor.ts   # 单帧单转移执行器
├── scene/                # 3D 渲染层（React Three Fiber）
│   ├── Canteen.tsx       # 食堂场景（窗口/桌椅/热力图）
│   ├── VoxelAgent.tsx    # 体素人渲染 + 行走动画
│   ├── cameraViews.ts    # 相机预设 + 缓动函数
│   └── instanced/        # InstancedMesh 优化（地面/墙壁）
├── ui/                   # UI 组件
│   ├── ControlPanel.tsx  # 控制面板（场景/速度/视角/Demo）
│   ├── StatsPanel.tsx    # 统计面板 + Recharts 实时图表
│   └── Legend.tsx        # Agent 状态颜色图例
├── App.tsx               # 主应用（仿真循环/相机/灯光）
└── main.tsx              # 入口
tests/
├── simulation/           # 仿真核心测试（157 个用例）
│   ├── engine.test.ts    # 引擎集成测试
│   ├── agent.test.ts     # Agent 行为测试
│   ├── state-machine/    # FSM 规则/执行器测试
│   ├── minghu-features.test.ts  # 明湖场景特性测试
│   └── engine-perf.test.ts      # 性能基准测试
└── utils.ts              # 测试工具函数
```

## 仿真模型

### Agent 状态流

```
Entering → ChoosingWindow → Queuing → Ordering → FindingSeat → Dining → Leaving → Left
                                ↓（耐心耗尽）                    ↓（无空座）
                              Leaving                          Leaving
```

### 窗口选择策略

1. **偏好优先**：按个人偏好顺序检查窗口
2. **容忍度检查**：当前队长 ≤ 个人阈值才加入
3. **兜底策略**：所有偏好窗口超限时，选预计等待最短的窗口

### 到达率曲线

梯形分布：预热（2min）→ 高峰持续（~8min）→ 冷却（3min）

- 午高峰：峰值 0.95 人/秒，耐心 150s，就餐 26s
- 晚高峰：峰值 0.76 人/秒，耐心 180s，就餐 32s

### 输出指标

| 指标 | 说明 |
|------|------|
| 平均等待 | 从加入队列到开始服务的等待时间 |
| P95 等待 | 95% 的人等待不超过此值 |
| 吞吐/分钟 | 所有窗口每分钟完成服务人数 |
| 座位利用率 | 当前占用 / 总座位数 |
| 放弃率 | 因排队超时离开的比例 |
| 热点区域 | 停留时间最高的空间位置 |

## 场景假设

本项目是**课程仿真估算模型**，不使用真实测量数据。明湖餐厅场景依据公开描述做抽象化建模：

- 默认布局 36×24 单位，1 入口、1 出口、6 服务窗口、72 座位
- 6 窗口服务均值分别为 7/8/9/10/11/12 秒（反映不同窗口出餐效率差异）
- 到达率和耐心值基于经验估算，非实测数据

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 语言 | TypeScript (strict) | 6.0 |
| 框架 | React | 19.2 |
| 3D | Three.js + React Three Fiber + Drei | 0.183 |
| 图表 | Recharts | 3.8 |
| 构建 | Vite | 8.0 |
| 测试 | Vitest + Testing Library | 4.1 |
| CI | GitHub Actions (Node 18/20 matrix) | — |
| 部署 | GitHub Pages (gh-pages) | — |

## 开发

```bash
# 开发模式（热重载）
npm run dev

# 运行测试（watch 模式）
npm test

# 测试覆盖率
npm run test:coverage

# ESLint 检查
npm run lint
```

## 版本历史

参见 [CHANGELOG.md](./CHANGELOG.md)

## 许可

MIT
