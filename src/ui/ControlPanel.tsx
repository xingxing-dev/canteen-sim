import type { CSSProperties } from 'react';
import type { SimulationScenario } from '../simulation/config';
import type { CameraViewMode } from '../scene/cameraViews';

interface ControlPanelProps {
  scenarios: readonly SimulationScenario[];
  scenarioId: string;
  extraWindowCount: number;
  showHeatmap: boolean;
  isRunning: boolean;
  speed: number;
  activeView: CameraViewMode;
  demoActive: boolean;
  onScenarioChange: (scenarioId: string) => void;
  onExtraWindowChange: (count: number) => void;
  onHeatmapToggle: (visible: boolean) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onViewChange: (view: CameraViewMode) => void;
  onDemoToggle: () => void;
}

const speedOptions = [1, 2, 4, 8];
const viewOptions: { id: CameraViewMode; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'queue', label: 'Window Queue' },
  { id: 'seating', label: 'Seating Area' },
  { id: 'entrance', label: 'Entrance Flow' },
  { id: 'cruise', label: 'Cruise View' },
];

export function ControlPanel({
  scenarios,
  scenarioId,
  extraWindowCount,
  showHeatmap,
  isRunning,
  speed,
  activeView,
  demoActive,
  onScenarioChange,
  onExtraWindowChange,
  onHeatmapToggle,
  onStart,
  onPause,
  onReset,
  onSpeedChange,
  onViewChange,
  onDemoToggle,
}: ControlPanelProps) {
  return (
    <aside style={panelStyle}>
      <div style={eyebrowStyle}>Beijing Jiaotong University</div>
      <h1 style={titleStyle}>明湖餐厅就餐仿真</h1>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>场景</div>
        <div style={segmentStyle}>
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onScenarioChange(scenario.id)}
              style={{
                ...segmentButtonStyle,
                ...(scenario.id === scenarioId ? activeSegmentStyle : null),
              }}
            >
              {scenario.period === 'lunch' ? '午高峰' : '晚高峰'}
            </button>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>演示控制</div>
        <div style={buttonRowStyle}>
          <button
            type="button"
            onClick={isRunning ? onPause : onStart}
            style={{ ...primaryButtonStyle, background: isRunning ? '#E8874D' : '#4C9A72' }}
          >
            {isRunning ? '暂停' : '开始'}
          </button>
          <button type="button" onClick={onReset} style={secondaryButtonStyle}>
            重置
          </button>
        </div>
        <button
          type="button"
          onClick={onDemoToggle}
          style={{
            ...demoButtonStyle,
            ...(demoActive ? activeDemoButtonStyle : null),
          }}
        >
          {demoActive ? 'Exit Demo Mode' : 'Demo Mode'}
        </button>
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>Camera View</div>
        <div style={viewGridStyle}>
          {viewOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onViewChange(option.id)}
              style={{
                ...viewButtonStyle,
                ...(activeView === option.id ? activeViewButtonStyle : null),
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <label style={labelStyle} htmlFor="speed-control">
          仿真速度
        </label>
        <select
          id="speed-control"
          value={speed}
          onChange={(event) => onSpeedChange(Number(event.target.value))}
          style={selectStyle}
        >
          {speedOptions.map((option) => (
            <option key={option} value={option}>
              {option}x
            </option>
          ))}
        </select>
      </section>

      <section style={sectionStyle}>
        <label style={labelStyle} htmlFor="window-plan">
          窗口增设方案
        </label>
        <select
          id="window-plan"
          value={extraWindowCount}
          onChange={(event) => onExtraWindowChange(Number(event.target.value))}
          style={selectStyle}
        >
          <option value={0}>维持 6 个窗口</option>
          <option value={1}>增设 1 个快取窗口</option>
          <option value={2}>增设 2 个快取窗口</option>
        </select>
      </section>

      <section style={{ ...sectionStyle, marginBottom: 0 }}>
        <label style={toggleStyle}>
          <input
            type="checkbox"
            checked={showHeatmap}
            onChange={(event) => onHeatmapToggle(event.target.checked)}
          />
          <span>显示拥堵热力层</span>
        </label>
      </section>
    </aside>
  );
}

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 18,
  right: 18,
  zIndex: 10,
  width: 308,
  color: '#F8FAF5',
  background: 'linear-gradient(180deg, rgba(20, 31, 36, 0.86), rgba(11, 17, 21, 0.82))',
  border: '1px solid rgba(157, 216, 199, 0.18)',
  borderRadius: 8,
  padding: '16px',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  boxShadow: '0 22px 70px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255,255,255,0.05)',
  backdropFilter: 'blur(16px)',
  pointerEvents: 'auto',
};

const eyebrowStyle: CSSProperties = {
  color: '#9DD8C7',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0,
  marginBottom: 4,
};

const titleStyle: CSSProperties = {
  fontSize: 22,
  lineHeight: 1.15,
  margin: '0 0 16px',
  fontWeight: 760,
};

const sectionStyle: CSSProperties = {
  marginBottom: 15,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 12,
  color: '#B9C4BF',
  marginBottom: 8,
};

const segmentStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 6,
};

const segmentButtonStyle: CSSProperties = {
  height: 36,
  border: '1px solid rgba(255, 255, 255, 0.14)',
  borderRadius: 6,
  background: 'rgba(255, 255, 255, 0.06)',
  color: '#D7E1DD',
  cursor: 'pointer',
  fontSize: 13,
};

const activeSegmentStyle: CSSProperties = {
  background: 'linear-gradient(180deg, #D9F2DE, #A9E2C4)',
  color: '#13251B',
  border: '1px solid #D9F2DE',
  fontWeight: 700,
};

const buttonRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
};

const primaryButtonStyle: CSSProperties = {
  height: 38,
  border: 0,
  borderRadius: 6,
  color: '#FFFFFF',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 14,
};

const secondaryButtonStyle: CSSProperties = {
  height: 38,
  border: '1px solid rgba(255, 255, 255, 0.16)',
  borderRadius: 6,
  background: 'rgba(255, 255, 255, 0.08)',
  color: '#FFFFFF',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 14,
};

const demoButtonStyle: CSSProperties = {
  width: '100%',
  height: 38,
  marginTop: 8,
  border: '1px solid rgba(114, 184, 255, 0.28)',
  borderRadius: 6,
  background: 'rgba(72, 134, 203, 0.16)',
  color: '#D9ECFF',
  cursor: 'pointer',
  fontWeight: 760,
  fontSize: 13,
};

const activeDemoButtonStyle: CSSProperties = {
  background: 'linear-gradient(180deg, #72B8FF, #3E82C6)',
  color: '#061018',
  border: '1px solid #A7D4FF',
};

const viewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 6,
};

const viewButtonStyle: CSSProperties = {
  minHeight: 34,
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 6,
  background: 'rgba(255, 255, 255, 0.055)',
  color: '#D7E1DD',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1.1,
  padding: '0 8px',
};

const activeViewButtonStyle: CSSProperties = {
  background: 'rgba(114, 184, 255, 0.22)',
  border: '1px solid rgba(114, 184, 255, 0.7)',
  color: '#FFFFFF',
  boxShadow: '0 0 18px rgba(114, 184, 255, 0.18)',
};

const labelStyle: CSSProperties = {
  display: 'block',
  color: '#B9C4BF',
  fontSize: 12,
  marginBottom: 8,
};

const selectStyle: CSSProperties = {
  width: '100%',
  height: 38,
  borderRadius: 6,
  border: '1px solid rgba(255, 255, 255, 0.16)',
  background: '#1A262B',
  color: '#FFFFFF',
  padding: '0 10px',
};

const toggleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: '#E9F0ED',
  fontSize: 13,
  cursor: 'pointer',
};
