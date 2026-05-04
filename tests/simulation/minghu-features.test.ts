import { describe, expect, it } from 'vitest';
import type { SimulationScenario } from '../../src/simulation/config';
import {
  createScenarioConfig,
  minghuLunchPeak,
} from '../../src/simulation/config';
import { SimulationEngine } from '../../src/simulation/engine';
import { selectWindowByPreference } from '../../src/simulation/routing';

function runFor(engine: SimulationEngine, duration: number, dt = 0.2) {
  engine.start();
  for (let t = 0; t < duration; t += dt) {
    engine.step(dt);
  }
  engine.pause();
}

function sumMaxQueue(engine: SimulationEngine): number {
  return engine.stats.perWindow.reduce((sum, win) => sum + win.maxQueueLength, 0);
}

function createTwoWindowScenario(): SimulationScenario {
  return {
    id: 'test-two-window',
    name: '测试双窗口',
    period: 'lunch',
    description: 'test scenario',
    seed: 20260503,
    layout: {
      width: 24,
      depth: 14,
      entrance: { x: 12, z: 0 },
      exit: { x: 21, z: 14 },
    },
    windows: [
      {
        id: 0,
        name: '快窗口',
        category: '快取',
        position: { x: 2, z: 4 },
        queueStart: { x: 5, z: 4 },
        queueDirection: { x: 1, z: 0 },
        serviceMean: 1,
        serviceStd: 0,
      },
      {
        id: 1,
        name: '慢窗口',
        category: '现做',
        position: { x: 2, z: 9 },
        queueStart: { x: 5, z: 9 },
        queueDirection: { x: 1, z: 0 },
        serviceMean: 8,
        serviceStd: 0,
      },
    ],
    seats: {
      count: 80,
      cols: 5,
      start: { x: 12, z: 2 },
      spacingX: 1.8,
      spacingZ: 0.9,
    },
    arrivalProfile: {
      baseRate: 1.4,
      peakRate: 1.4,
      warmupSeconds: 0,
      sustainSeconds: 300,
      cooldownSeconds: 0,
    },
    agentProfile: {
      queueToleranceMean: 0,
      queueToleranceStd: 0,
      preferenceNoise: 1,
    },
    diningTime: 1,
    moveSpeed: 80,
    maxPatience: 240,
  };
}

describe('Minghu scenario features', () => {
  it('keeps the first preferred window when it is within tolerance', () => {
    const choice = selectWindowByPreference(
      { windowPreferences: [2, 1, 0], queueTolerance: 3 },
      [
        { index: 0, queueLength: 0, serviceMean: 7 },
        { index: 1, queueLength: 1, serviceMean: 8 },
        { index: 2, queueLength: 3, serviceMean: 9 },
      ],
    );

    expect(choice.windowIndex).toBe(2);
    expect(choice.fallbackLevel).toBe(0);
  });

  it('falls back through preferences when the favorite queue is too long', () => {
    const choice = selectWindowByPreference(
      { windowPreferences: [2, 1, 0], queueTolerance: 2 },
      [
        { index: 0, queueLength: 0, serviceMean: 7 },
        { index: 1, queueLength: 2, serviceMean: 8 },
        { index: 2, queueLength: 5, serviceMean: 9 },
      ],
    );

    expect(choice.windowIndex).toBe(1);
    expect(choice.fallbackLevel).toBe(1);
  });

  it('uses the lowest estimated wait when every preference exceeds tolerance', () => {
    const choice = selectWindowByPreference(
      { windowPreferences: [2, 1, 0], queueTolerance: 1 },
      [
        { index: 0, queueLength: 4, serviceMean: 3 },
        { index: 1, queueLength: 2, serviceMean: 9 },
        { index: 2, queueLength: 3, serviceMean: 8 },
      ],
    );

    expect(choice.windowIndex).toBe(0);
    expect(choice.fallbackLevel).toBe(3);
  });

  it('gives the faster window higher throughput under sustained pressure', () => {
    const engine = new SimulationEngine(createScenarioConfig(createTwoWindowScenario()));
    runFor(engine, 90, 0.2);

    expect(engine.stats.perWindow[0].servedCount).toBeGreaterThan(
      engine.stats.perWindow[1].servedCount,
    );
  });

  it('counts seat failures when diners cannot find an empty seat', () => {
    const engine = new SimulationEngine({
      windowCount: 1,
      seatCount: 1,
      arrivalRate: 3,
      serviceTime: 0.5,
      diningTime: 90,
      moveSpeed: 80,
      maxPatience: 240,
      seed: 20260503,
    });

    runFor(engine, 12, 0.1);

    expect(engine.stats.totalSeatFailures).toBeGreaterThan(0);
  });

  it('accumulates heatmap hotspots in the Minghu queue areas', () => {
    const engine = new SimulationEngine(createScenarioConfig(minghuLunchPeak));
    runFor(engine, 180, 0.3);

    expect(engine.stats.heatmap.length).toBeGreaterThan(0);
    expect(engine.stats.hotspots.length).toBeGreaterThan(0);
    expect(engine.stats.hotspots.some((spot) => spot.label.includes('排队区'))).toBe(true);
  });

  it('runs the lunch preset through a full high-peak lifecycle', () => {
    const engine = new SimulationEngine(createScenarioConfig(minghuLunchPeak));
    runFor(engine, 600, 0.5);

    expect(engine.stats.totalEntered).toBeGreaterThan(100);
    expect(engine.stats.perWindow.some((win) => win.servedCount > 0)).toBe(true);
    expect(engine.stats.seatPeakUtilization).toBeGreaterThan(0);
    expect(engine.stats.hotspots.length).toBeGreaterThan(0);
  });

  it('extra pickup windows reduce waiting or maximum queues against the default plan', () => {
    const defaultConfig = createScenarioConfig(minghuLunchPeak, 0);
    const expandedConfig = {
      ...createScenarioConfig(minghuLunchPeak, 2),
      seed: defaultConfig.seed,
    };
    const baseline = new SimulationEngine(defaultConfig);
    const expanded = new SimulationEngine(expandedConfig);

    runFor(baseline, 240, 0.3);
    runFor(expanded, 240, 0.3);

    const waitImproved = expanded.stats.avgWaitTime < baseline.stats.avgWaitTime;
    const queueImproved = sumMaxQueue(expanded) < sumMaxQueue(baseline);
    expect(waitImproved || queueImproved).toBe(true);
  });
});
