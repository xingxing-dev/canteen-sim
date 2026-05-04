import { AgentState, STATE_COLORS } from '../simulation/agent';

const STATE_LABELS: Record<AgentState, string> = {
  [AgentState.Entering]: '进入',
  [AgentState.ChoosingWindow]: '选窗口',
  [AgentState.Queuing]: '排队中',
  [AgentState.Ordering]: '点餐中',
  [AgentState.FindingSeat]: '找座位',
  [AgentState.Dining]: '就餐中',
  [AgentState.Leaving]: '离开中',
  [AgentState.Left]: '已离开',
};

const VISIBLE_STATES = Object.values(AgentState).filter(
  (s) => s !== AgentState.Left
);

export function Legend() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 18,
        right: 18,
        background: 'linear-gradient(180deg, rgba(20, 31, 36, 0.84), rgba(10, 16, 20, 0.78))',
        color: '#F8FAF5',
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid rgba(157, 216, 199, 0.16)',
        boxShadow: '0 18px 50px rgba(0, 0, 0, 0.32)',
        backdropFilter: 'blur(14px)',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: 12,
        pointerEvents: 'none',
      }}
    >
      <div style={{ color: '#9DD8C7', fontWeight: 760, marginBottom: 7, fontSize: 12 }}>
        Agent State
      </div>
      {VISIBLE_STATES.map((state) => (
        <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div
            style={{
              width: 14,
              height: 14,
              background: STATE_COLORS[state],
              borderRadius: 2,
              boxShadow: `0 0 12px ${STATE_COLORS[state]}55`,
            }}
          />
          <span>{STATE_LABELS[state]}</span>
        </div>
      ))}
    </div>
  );
}
