/** Agent 状态枚举 */
export enum AgentState {
  Entering = 'entering',
  ChoosingWindow = 'choosing_window',
  Queuing = 'queuing',
  Ordering = 'ordering',
  FindingSeat = 'finding_seat',
  Dining = 'dining',
  Leaving = 'leaving',
  Left = 'left',
}

/** Agent 状态对应的颜色（体素风格用） */
export const STATE_COLORS: Record<AgentState, string> = {
  [AgentState.Entering]: '#42A5F5',
  [AgentState.ChoosingWindow]: '#FFCA28',
  [AgentState.Queuing]: '#FFA726',
  [AgentState.Ordering]: '#EF5350',
  [AgentState.FindingSeat]: '#AB47BC',
  [AgentState.Dining]: '#66BB6A',
  [AgentState.Leaving]: '#90A4AE',
  [AgentState.Left]: '#757575',
};

/** 2D 位置 */
export interface Vec2 {
  x: number;
  z: number;
}

export interface AgentOptions {
  windowPreferences?: number[];
  queueTolerance?: number;
  enteredAtTime?: number;
}

let nextId = 0;

export class Agent {
  readonly id: number;
  state: AgentState;
  position: Vec2;
  target: Vec2 | null = null;
  speed: number;
  patience: number;
  maxPatience: number;
  assignedWindow: number = -1;
  assignedSeat: number = -1;
  windowPreferences: number[];
  queueTolerance: number;
  fallbackLevel: number = 0;
  waitStartTime: number | null = null;
  servedAtTime: number | null = null;
  enteredAtTime: number = 0;

  /** 当前状态已持续的时间（秒） */
  stateTimer: number = 0;
  /** 当前状态需要的时间（如服务时间、就餐时间） */
  stateDuration: number = 0;

  constructor(spawn: Vec2, speed: number, maxPatience: number, options: AgentOptions = {}) {
    this.id = nextId++;
    this.state = AgentState.Entering;
    this.position = { ...spawn };
    this.speed = speed;
    this.patience = maxPatience;
    this.maxPatience = maxPatience;
    this.windowPreferences = options.windowPreferences ?? [];
    this.queueTolerance = options.queueTolerance ?? 5;
    this.enteredAtTime = options.enteredAtTime ?? 0;
  }

  /** 朝 target 移动，到达返回 true */
  moveToward(dt: number): boolean {
    if (!this.target) return true;
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const step = this.speed * dt;
    if (step >= dist) {
      this.position.x = this.target.x;
      this.position.z = this.target.z;
      this.target = null;
      return true;
    }
    this.position.x += (dx / dist) * step;
    this.position.z += (dz / dist) * step;
    return false;
  }
}

/** 重置 ID 计数器（用于重新开始仿真） */
export function resetAgentIds() {
  nextId = 0;
}
