import { useRef, useState, useCallback, useEffect } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { SimulationEngine } from './simulation/engine';
import type { SimulationConfig } from './simulation/config';
import {
  MINGHU_SCENARIOS,
  createScenarioConfig,
  getScenarioById,
  minghuLunchPeak,
} from './simulation/config';
import type { SimStats } from './simulation/stats';
import { createEmptyStats } from './simulation/stats';
import { AgentState } from './simulation/agent';
import { Canteen } from './scene/Canteen';
import { VoxelAgent } from './scene/VoxelAgent';
import { ControlPanel } from './ui/ControlPanel';
import { StatsPanel } from './ui/StatsPanel';
import type { StatsHistoryPoint } from './ui/StatsPanel';
import { Legend } from './ui/Legend';
import type { CameraPose, CameraViewMode } from './scene/cameraViews';
import { easeInOutCubic, getCameraPose, getIntroPose } from './scene/cameraViews';

const MAX_HISTORY = 80;
const INITIAL_SCENARIO_ID = minghuLunchPeak.id;
const INTRO_DURATION = 5.2;
const DEMO_DURATION = 35;

const DEMO_PHASES = [
  { at: 0, view: 'overview', heatmap: false, subtitle: 'Minghu Canteen peak-hour simulation starts.' },
  { at: 5, view: 'entrance', heatmap: false, subtitle: 'Incoming flow increases during the lunch peak.' },
  { at: 10, view: 'queue', heatmap: false, subtitle: 'Queues gradually form near high-demand windows.' },
  { at: 15, view: 'queue', heatmap: true, subtitle: 'The heatmap highlights local congestion pressure.' },
  { at: 20, view: 'queue', heatmap: true, subtitle: 'The system identifies bottleneck windows in real time.' },
  { at: 25, view: 'overview', heatmap: true, subtitle: 'Live metrics support scheduling and resource allocation decisions.' },
] as const;

function cloneStats(stats: SimStats): SimStats {
  return {
    ...stats,
    queueLengths: [...stats.queueLengths],
    perWindow: stats.perWindow.map((win) => ({ ...win })),
    heatmap: stats.heatmap.map((cell) => ({ ...cell })),
    hotspots: stats.hotspots.map((spot) => ({ ...spot })),
  };
}

/** 仿真循环组件，挂在 Canvas 内用 useFrame 驱动 */
function SimulationLoop({
  engine,
  speedRef,
  onStatsUpdate,
}: {
  engine: SimulationEngine;
  speedRef: RefObject<number>;
  onStatsUpdate: (stats: SimStats) => void;
}) {
  const cleanupTimer = useRef(0);
  const statsTimer = useRef(0);

  useFrame((_, delta) => {
    const baseDt = Math.min(delta, 0.1);
    const speed = speedRef.current ?? 1;
    const subSteps = Math.min(speed, 8);
    const subDt = (baseDt * speed) / subSteps;
    for (let i = 0; i < subSteps; i++) {
      engine.step(subDt);
    }

    cleanupTimer.current += baseDt;
    if (cleanupTimer.current > 2) {
      engine.cleanup();
      cleanupTimer.current = 0;
    }

    statsTimer.current += baseDt;
    if (statsTimer.current >= 0.25) {
      statsTimer.current = 0;
      onStatsUpdate(cloneStats(engine.stats));
    }
  });

  return null;
}

function CameraDirector({
  width,
  depth,
  viewMode,
  controlsRef,
  onIntroComplete,
}: {
  width: number;
  depth: number;
  viewMode: CameraViewMode;
  controlsRef: RefObject<OrbitControlsImpl | null>;
  onIntroComplete: () => void;
}) {
  const { camera, clock } = useThree();
  const introRef = useRef({
    elapsed: 0,
    done: false,
    from: getIntroPose(width, depth),
    to: getCameraPose('overview', width, depth),
  });
  const transitionRef = useRef<{
    elapsed: number;
    duration: number;
    from: CameraPose;
    to: CameraPose;
  } | null>(null);
  const cruiseAngleRef = useRef(-0.6);

  const applyPose = useCallback((pose: CameraPose) => {
    const controls = controlsRef.current;
    camera.position.set(...pose.position);
    if (controls) {
      controls.target.set(...pose.target);
      controls.update();
    } else {
      camera.lookAt(...pose.target);
    }
  }, [camera, controlsRef]);

  useEffect(() => {
    const introFrom = getIntroPose(width, depth);
    const introTo = getCameraPose('overview', width, depth);
    introRef.current = {
      elapsed: 0,
      done: false,
      from: introFrom,
      to: introTo,
    };
    transitionRef.current = null;
    applyPose(introFrom);
  }, [applyPose, depth, width]);

  useEffect(() => {
    if (!introRef.current.done || viewMode === 'cruise') return;
    const controls = controlsRef.current;
    const currentTarget = controls?.target ?? new THREE.Vector3(width / 2, 0, depth / 2);
    transitionRef.current = {
      elapsed: 0,
      duration: 1.45,
      from: {
        position: camera.position.toArray() as [number, number, number],
        target: currentTarget.toArray() as [number, number, number],
      },
      to: getCameraPose(viewMode, width, depth),
    };
  }, [camera, controlsRef, depth, viewMode, width]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;

    if (!introRef.current.done) {
      const intro = introRef.current;
      intro.elapsed += delta;
      const t = Math.min(1, intro.elapsed / INTRO_DURATION);
      const eased = easeInOutCubic(t);
      const pose = interpolatePose(intro.from, intro.to, eased);
      applyPose(pose);
      if (t >= 1) {
        intro.done = true;
        onIntroComplete();
      }
      return;
    }

    if (viewMode === 'cruise') {
      cruiseAngleRef.current += delta * 0.2;
      const center = new THREE.Vector3(width / 2, 0.1, depth / 2);
      const radius = Math.max(width, depth) * 0.72;
      const height = 17 + Math.sin(clock.elapsedTime * 0.35) * 1.2;
      camera.position.set(
        center.x + Math.sin(cruiseAngleRef.current) * radius,
        height,
        center.z + Math.cos(cruiseAngleRef.current) * radius,
      );
      if (controls) {
        controls.target.copy(center);
        controls.update();
      } else {
        camera.lookAt(center);
      }
      return;
    }

    const transition = transitionRef.current;
    if (!transition) return;
    transition.elapsed += delta;
    const t = Math.min(1, transition.elapsed / transition.duration);
    applyPose(interpolatePose(transition.from, transition.to, easeInOutCubic(t)));
    if (t >= 1) {
      transitionRef.current = null;
    }
  });

  return null;
}

function interpolatePose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  return {
    position: [
      THREE.MathUtils.lerp(from.position[0], to.position[0], t),
      THREE.MathUtils.lerp(from.position[1], to.position[1], t),
      THREE.MathUtils.lerp(from.position[2], to.position[2], t),
    ],
    target: [
      THREE.MathUtils.lerp(from.target[0], to.target[0], t),
      THREE.MathUtils.lerp(from.target[1], to.target[1], t),
      THREE.MathUtils.lerp(from.target[2], to.target[2], t),
    ],
  };
}

function App() {
  const initialConfigRef = useRef(createScenarioConfig(minghuLunchPeak));
  const engineRef = useRef(new SimulationEngine(initialConfigRef.current));
  const engine = engineRef.current;

  const [scenarioId, setScenarioId] = useState(INITIAL_SCENARIO_ID);
  const [extraWindowCount, setExtraWindowCount] = useState(0);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [cameraView, setCameraView] = useState<CameraViewMode>('overview');
  const [hudVisible, setHudVisible] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const [demoSubtitle, setDemoSubtitle] = useState('Entering Minghu Canteen digital twin...');
  const [stats, setStats] = useState<SimStats>(
    createEmptyStats(engine.config.windowCount, engine.layout.windows),
  );
  const [statsHistory, setStatsHistory] = useState<StatsHistoryPoint[]>([]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const demoStartedAtRef = useRef(0);
  const demoRestoreRef = useRef({
    running: false,
    speed: 1,
    showHeatmap: true,
  });
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setHudVisible(true), 900);
    return () => window.clearTimeout(id);
  }, []);

  const resetWithConfig = useCallback((config: SimulationConfig) => {
    engine.pause();
    engine.reset(config);
    setRunning(false);
    setStats(createEmptyStats(engine.config.windowCount, engine.layout.windows));
    setStatsHistory([]);
    forceUpdate((n) => n + 1);
  }, [engine]);

  const handleScenarioChange = useCallback((nextScenarioId: string) => {
    setScenarioId(nextScenarioId);
    resetWithConfig(createScenarioConfig(getScenarioById(nextScenarioId), extraWindowCount));
  }, [extraWindowCount, resetWithConfig]);

  const handleExtraWindowChange = useCallback((count: number) => {
    setExtraWindowCount(count);
    resetWithConfig(createScenarioConfig(getScenarioById(scenarioId), count));
  }, [resetWithConfig, scenarioId]);

  const handleStart = useCallback(() => {
    engine.start();
    setRunning(true);
  }, [engine]);

  const handlePause = useCallback(() => {
    engine.pause();
    setRunning(false);
  }, [engine]);

  const handleReset = useCallback(() => {
    resetWithConfig(createScenarioConfig(getScenarioById(scenarioId), extraWindowCount));
  }, [extraWindowCount, resetWithConfig, scenarioId]);

  const handleSpeedChange = useCallback((nextSpeed: number) => {
    setSpeed(nextSpeed);
    speedRef.current = nextSpeed;
  }, []);

  const handleViewChange = useCallback((view: CameraViewMode) => {
    setCameraView((current) => (view === 'cruise' && current === 'cruise' ? 'overview' : view));
  }, []);

  const finishDemo = useCallback(() => {
    setDemoActive(false);
    setDemoSubtitle('');
    setCameraView('overview');
    setShowHeatmap(demoRestoreRef.current.showHeatmap);
    setSpeed(demoRestoreRef.current.speed);
    speedRef.current = demoRestoreRef.current.speed;
    if (!demoRestoreRef.current.running) {
      engine.pause();
      setRunning(false);
    }
  }, [engine]);

  const startDemo = useCallback(() => {
    demoRestoreRef.current = {
      running,
      speed,
      showHeatmap,
    };
    demoStartedAtRef.current = performance.now();
    setDemoActive(true);
    setDemoSubtitle(DEMO_PHASES[0].subtitle);
    setCameraView('overview');
    setShowHeatmap(false);
    setSpeed(8);
    speedRef.current = 8;
    engine.start();
    setRunning(true);
  }, [engine, running, showHeatmap, speed]);

  const handleDemoToggle = useCallback(() => {
    if (demoActive) {
      finishDemo();
    } else {
      startDemo();
    }
  }, [demoActive, finishDemo, startDemo]);

  useEffect(() => {
    if (!demoActive) return undefined;

    const id = window.setInterval(() => {
      const elapsed = (performance.now() - demoStartedAtRef.current) / 1000;
      if (elapsed >= DEMO_DURATION) {
        finishDemo();
        return;
      }

      const phase = DEMO_PHASES
        .filter((candidate) => elapsed >= candidate.at)
        .at(-1) ?? DEMO_PHASES[0];
      setCameraView(phase.view);
      setShowHeatmap(phase.heatmap);
      setDemoSubtitle(phase.subtitle);
    }, 250);

    return () => window.clearInterval(id);
  }, [demoActive, finishDemo]);

  const visibleAgents = engine.agents.filter((agent) => agent.state !== AgentState.Left);
  const scenario = getScenarioById(scenarioId);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#11181C', position: 'relative' }}>
      <Canvas
        shadows="percentage"
        dpr={[1, 1.75]}
        camera={{ position: [18, 22, -10], fov: 48 }}
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <CameraDirector
          width={engine.layout.width}
          depth={engine.layout.depth}
          viewMode={cameraView}
          controlsRef={controlsRef}
          onIntroComplete={() => setDemoSubtitle('')}
        />
        <color attach="background" args={['#11181C']} />
        <fog attach="fog" args={['#11181C', 34, 76]} />
        <hemisphereLight color="#DDEEFF" groundColor="#1F1713" intensity={0.42} />
        <ambientLight color="#F5F0E8" intensity={0.42} />
        <directionalLight
          color="#FFF6DE"
          position={[18, 28, 8]}
          intensity={1.55}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <spotLight
          color="#8FD3FF"
          position={[engine.layout.entrance.x, 8, -3]}
          target-position={[engine.layout.entrance.x, 0, 2]}
          intensity={16}
          distance={26}
          angle={0.52}
          penumbra={0.78}
        />
        <spotLight
          color="#FFE6A3"
          position={[5, 8, engine.layout.depth / 2]}
          intensity={10}
          distance={30}
          angle={0.68}
          penumbra={0.88}
        />

        <Canteen
          layout={engine.layout}
          queueLengths={stats.queueLengths}
          perWindow={stats.perWindow}
          heatmap={stats.heatmap}
          showHeatmap={showHeatmap}
          warningThreshold={10}
        />

        {visibleAgents.map((agent) => (
          <VoxelAgent key={agent.id} agent={agent} />
        ))}

        <SimulationLoop
          engine={engine}
          speedRef={speedRef}
          onStatsUpdate={(nextStats) => {
            setStats(nextStats);
            setStatsHistory((prev) => {
              const point: StatsHistoryPoint = {
                time: Math.floor(nextStats.elapsedTime),
                queueTotal: nextStats.queueLengths.reduce((a, b) => a + b, 0),
                served: nextStats.totalServed,
                agents: nextStats.currentAgents,
                avgWait: nextStats.avgWaitTime,
                p95Wait: nextStats.waitTimeP95,
                seatUtilization: nextStats.seatUtilization,
                abandonRate: nextStats.abandonRate,
              };
              const next = [...prev, point];
              return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
            });
          }}
        />

        <OrbitControls
          ref={controlsRef}
          target={[engine.layout.width / 2, 0, engine.layout.depth / 2]}
          makeDefault
          maxPolarAngle={Math.PI / 2.15}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>

      <div style={hudLayerStyle(hudVisible)}>
        <ControlPanel
          scenarios={MINGHU_SCENARIOS}
          scenarioId={scenarioId}
          extraWindowCount={extraWindowCount}
          showHeatmap={showHeatmap}
          isRunning={running}
          speed={speed}
          activeView={cameraView}
          demoActive={demoActive}
          onScenarioChange={handleScenarioChange}
          onExtraWindowChange={handleExtraWindowChange}
          onHeatmapToggle={setShowHeatmap}
          onStart={handleStart}
          onPause={handlePause}
          onReset={handleReset}
          onSpeedChange={handleSpeedChange}
          onViewChange={handleViewChange}
          onDemoToggle={handleDemoToggle}
        />

        <StatsPanel stats={stats} history={statsHistory} />
        <Legend />

        <header style={headerStyle}>
          <div style={headerKickerStyle}>BJTU Campus Dining Operations</div>
          <div style={headerTitleStyle}>{engine.config.scenarioName ?? scenario.name}</div>
          <div style={headerSubStyle}>
            {engine.layout.width} x {engine.layout.depth} digital twin · {engine.layout.windows.length} windows / {engine.layout.seats.length} seats · Minghu Canteen
          </div>
        </header>
      </div>

      {demoSubtitle && (
        <div style={subtitleStyle}>
          {demoSubtitle}
        </div>
      )}
    </div>
  );
}

function hudLayerStyle(visible: boolean): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    zIndex: 10,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(8px)',
    transition: 'opacity 900ms ease, transform 900ms ease',
    pointerEvents: 'none',
  };
}

const headerStyle: CSSProperties = {
  position: 'absolute',
  top: 18,
  left: 18,
  zIndex: 10,
  color: '#F8FAF5',
  background: 'rgba(17, 24, 28, 0.72)',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  borderRadius: 8,
  padding: '12px 16px',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  pointerEvents: 'none',
  backdropFilter: 'blur(10px)',
};

const headerKickerStyle: CSSProperties = {
  color: '#72B8FF',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0,
  marginBottom: 4,
};

const headerTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 780,
  marginBottom: 4,
};

const headerSubStyle: CSSProperties = {
  color: '#B9C4BF',
  fontSize: 12,
};

const subtitleStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 34,
  zIndex: 20,
  transform: 'translateX(-50%)',
  maxWidth: 720,
  padding: '11px 18px',
  borderRadius: 8,
  color: '#F9FFFB',
  background: 'rgba(8, 14, 18, 0.72)',
  border: '1px solid rgba(157, 216, 199, 0.28)',
  boxShadow: '0 18px 50px rgba(0, 0, 0, 0.32)',
  backdropFilter: 'blur(14px)',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: 15,
  fontWeight: 650,
  textAlign: 'center',
  pointerEvents: 'none',
};

export default App;
