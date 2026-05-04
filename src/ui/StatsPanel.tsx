import type { CSSProperties, ReactNode } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SimStats, WindowRuntimeStats } from '../simulation/stats';

export interface StatsHistoryPoint {
  time: number;
  queueTotal: number;
  served: number;
  agents: number;
  avgWait: number;
  p95Wait: number;
  seatUtilization: number;
  abandonRate: number;
}

interface StatsPanelProps {
  stats: SimStats;
  history: StatsHistoryPoint[];
}

export function StatsPanel({ stats, history }: StatsPanelProps) {
  const busiestWindow = findBusiestWindow(stats.perWindow);
  const topHotspot = stats.hotspots[0]?.label ?? '尚未形成热点';
  const avgWindowUtilization = average(stats.perWindow.map((win) => win.utilization));
  const recommendation = getRecommendation(stats, busiestWindow, topHotspot);

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Live metrics</div>
          <h2 style={titleStyle}>运行数据</h2>
        </div>
        <div style={timeStyle}>{formatTime(stats.elapsedTime)}</div>
      </div>

      <MetricSection title="Live Status">
        <Metric label="在场人数" value={stats.currentAgents.toString()} tone="blue" />
        <Metric label="已完成" value={stats.totalServed.toString()} tone="green" />
        <Metric label="放弃离开" value={stats.totalLeft.toString()} tone="orange" />
      </MetricSection>

      <MetricSection title="Efficiency">
        <Metric label="吞吐/分钟" value={stats.throughputPerMinute.toFixed(1)} />
        <Metric label="平均等待" value={`${stats.avgWaitTime.toFixed(1)}s`} />
        <Metric label="P95 等待" value={`${stats.waitTimeP95.toFixed(1)}s`} tone="yellow" />
      </MetricSection>

      <MetricSection title="Resource Usage">
        <Metric label="座位利用" value={formatPercent(stats.seatUtilization)} />
        <Metric label="峰值座位" value={formatPercent(stats.seatPeakUtilization)} />
        <Metric label="窗口利用" value={formatPercent(avgWindowUtilization)} />
      </MetricSection>

      <div style={insightStyle}>
        <div style={insightTitleStyle}>System Insight</div>
        <div>Current bottleneck: {busiestWindow?.name ?? 'None'} ({busiestWindow?.queueLength ?? 0} people)</div>
        <div>Hotspot: {topHotspot}</div>
        <div>Recommendation: {recommendation}</div>
      </div>

      <ChartTitle color="#E8874D">排队与在场人数</ChartTitle>
      <ResponsiveContainer width="100%" height={104}>
        <AreaChart data={history} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id="queueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#E8874D" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#E8874D" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="agentsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4B8FD6" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#4B8FD6" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fill: '#8C9692', fontSize: 9 }} tickFormatter={(v) => `${v}s`} />
          <YAxis tick={{ fill: '#8C9692', fontSize: 9 }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `${v}s`} />
          <Area type="monotone" dataKey="queueTotal" stroke="#E8874D" fill="url(#queueGrad)" dot={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="agents" stroke="#4B8FD6" fill="url(#agentsGrad)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>

      <ChartTitle color="#8CCF9E">等待时间</ChartTitle>
      <ResponsiveContainer width="100%" height={94}>
        <AreaChart data={history} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id="waitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8CCF9E" stopOpacity={0.48} />
              <stop offset="95%" stopColor="#8CCF9E" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fill: '#8C9692', fontSize: 9 }} tickFormatter={(v) => `${v}s`} />
          <YAxis tick={{ fill: '#8C9692', fontSize: 9 }} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `${v}s`} />
          <Area type="monotone" dataKey="avgWait" stroke="#8CCF9E" fill="url(#waitGrad)" dot={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="p95Wait" stroke="#D7C66A" fill="transparent" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  );
}

function MetricSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={metricSectionStyle}>
      <div style={metricSectionTitleStyle}>{title}</div>
      <div style={metricGridStyle}>{children}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'blue' | 'green' | 'orange' | 'yellow';
}) {
  return (
    <div style={metricStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={{ ...metricValueStyle, color: METRIC_TONES[tone] }}>{value}</div>
    </div>
  );
}

function ChartTitle({ color, children }: { color: string; children: string }) {
  return <div style={{ ...chartTitleStyle, color }}>{children}</div>;
}

function findBusiestWindow(windows: WindowRuntimeStats[]): WindowRuntimeStats | undefined {
  return windows
    .slice()
    .sort((a, b) => b.queueLength - a.queueLength || b.avgWaitTime - a.avgWaitTime)[0];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRecommendation(
  stats: SimStats,
  busiestWindow: WindowRuntimeStats | undefined,
  hotspot: string,
): string {
  if (busiestWindow && busiestWindow.queueLength >= 10) {
    return `Prioritize ${busiestWindow.name} or add quick-pick capacity.`;
  }
  if (stats.seatUtilization > 0.88) return 'Open overflow seating or guide diners to quieter areas.';
  if (hotspot.includes('入口')) return 'Keep entrance channel clear for incoming flow.';
  return 'System load is stable; continue monitoring.';
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const panelStyle: CSSProperties = {
  position: 'absolute',
  bottom: 18,
  left: 18,
  zIndex: 10,
  width: 386,
  color: '#F8FAF5',
  background: 'linear-gradient(180deg, rgba(20, 31, 36, 0.88), rgba(10, 16, 20, 0.84))',
  border: '1px solid rgba(157, 216, 199, 0.18)',
  borderRadius: 8,
  padding: '14px',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  boxShadow: '0 22px 70px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255,255,255,0.05)',
  backdropFilter: 'blur(16px)',
  pointerEvents: 'none',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  marginBottom: 10,
};

const eyebrowStyle: CSSProperties = {
  color: '#9DD8C7',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0,
};

const titleStyle: CSSProperties = {
  margin: '2px 0 0',
  fontSize: 18,
  lineHeight: 1,
};

const metricSectionStyle: CSSProperties = {
  marginTop: 9,
};

const metricSectionTitleStyle: CSSProperties = {
  color: '#9DD8C7',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0,
  marginBottom: 5,
  fontWeight: 760,
};

const timeStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  color: '#D7C66A',
  fontSize: 17,
  fontWeight: 700,
};

const metricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 6,
};

const metricStyle: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.055)',
  border: '1px solid rgba(255, 255, 255, 0.09)',
  borderRadius: 6,
  padding: '7px 6px',
};

const metricLabelStyle: CSSProperties = {
  color: '#B9C4BF',
  fontSize: 10,
  marginBottom: 3,
  whiteSpace: 'nowrap',
};

const metricValueStyle: CSSProperties = {
  color: '#FFFFFF',
  fontSize: 18,
  fontWeight: 760,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

const insightStyle: CSSProperties = {
  marginTop: 10,
  paddingTop: 9,
  borderTop: '1px solid rgba(255, 255, 255, 0.12)',
  color: '#DCE4E0',
  fontSize: 12,
  lineHeight: 1.55,
};

const insightTitleStyle: CSSProperties = {
  color: '#72B8FF',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0,
  marginBottom: 4,
  fontWeight: 760,
};

const chartTitleStyle: CSSProperties = {
  fontSize: 11,
  marginTop: 10,
  marginBottom: 2,
  fontWeight: 700,
};

const tooltipStyle: CSSProperties = {
  background: '#11181C',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 6,
  color: '#FFFFFF',
  fontSize: 11,
};

const METRIC_TONES = {
  default: '#FFFFFF',
  blue: '#72B8FF',
  green: '#8CCF9E',
  orange: '#E8874D',
  yellow: '#D7C66A',
};
