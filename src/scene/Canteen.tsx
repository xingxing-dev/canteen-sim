import { useMemo, useRef } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { HeatmapCell, WindowRuntimeStats } from '../simulation/stats';
import type { CanteenLayout, Seat, ServiceWindow } from '../simulation/layout';
import { InstancedFloor } from './instanced/InstancedFloor';
import { InstancedWalls } from './instanced/InstancedWalls';

interface CanteenProps {
  layout: CanteenLayout;
  queueLengths: number[];
  perWindow: WindowRuntimeStats[];
  heatmap: HeatmapCell[];
  showHeatmap: boolean;
  warningThreshold: number;
}

const CHAIR_FREE = new THREE.Color('#A07040');
const CHAIR_OCCUPIED = new THREE.Color('#66BB6A');
const CATEGORY_LABELS: Record<string, string> = {
  面食: 'Noodles',
  快餐: 'Set Meal',
  盖饭: 'Rice Bowl',
  清真: 'Special',
  风味: 'Fast Food',
  小吃: 'Drinks',
  增设快取: 'Quick Pick',
};

function ChairMesh({ seat }: { seat: Seat }) {
  const padRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!padRef.current) return;
    (padRef.current.material as THREE.MeshStandardMaterial).color.copy(
      seat.occupied ? CHAIR_OCCUPIED : CHAIR_FREE,
    );
  });

  const { x, z } = seat.position;
  return (
    <group position={[x, 0, z]}>
      <mesh ref={padRef} position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.06, 0.36]} />
        <meshStandardMaterial color="#A07040" />
      </mesh>
      {[
        [-0.14, -0.14],
        [0.14, -0.14],
        [-0.14, 0.14],
        [0.14, 0.14],
      ].map(([legX, legZ]) => (
        <mesh key={`${legX}-${legZ}`} position={[legX, 0.2, legZ]} castShadow>
          <boxGeometry args={[0.05, 0.42, 0.05]} />
          <meshStandardMaterial color="#6B4423" />
        </mesh>
      ))}
    </group>
  );
}

function TableMesh({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.46, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.08, 0.72]} />
        <meshStandardMaterial color="#C4A882" />
      </mesh>
      {[
        [-0.28, -0.28],
        [0.28, -0.28],
        [-0.28, 0.28],
        [0.28, 0.28],
      ].map(([legX, legZ]) => (
        <mesh key={`${legX}-${legZ}`} position={[legX, 0.22, legZ]} castShadow>
          <boxGeometry args={[0.07, 0.44, 0.07]} />
          <meshStandardMaterial color="#6B4423" />
        </mesh>
      ))}
    </group>
  );
}

function ServiceWindowMesh({
  win,
  queueLength,
}: {
  win: ServiceWindow;
  queueLength: number;
}) {
  const signColors = [
    '#C94C4C',
    '#3D7FBF',
    '#4C9A72',
    '#D7C66A',
    '#8A6FB0',
    '#D8893A',
    '#5EA8A7',
    '#C65A8D',
  ];

  return (
    <group>
      <mesh position={[win.position.x, 0.5, win.position.z]} castShadow>
        <boxGeometry args={[1.5, 1, 1]} />
        <meshStandardMaterial color="#7C4F31" />
      </mesh>
      <mesh position={[win.position.x, 1.3, win.position.z]} castShadow>
        <boxGeometry args={[1.25, 0.38, 0.1]} />
        <meshStandardMaterial color={signColors[win.id % signColors.length]} />
      </mesh>
      <Text
        position={[win.position.x, 1.56, win.position.z - 0.1]}
        fontSize={0.32}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineColor="#1B1B1B"
        outlineWidth={0.01}
      >
        {win.id + 1}
      </Text>
      <Text
        position={[win.position.x + 0.1, 1.08, win.position.z - 0.52]}
        fontSize={0.16}
        color="#F7F2E8"
        anchorX="center"
        anchorY="middle"
        outlineColor="#11181C"
        outlineWidth={0.006}
      >
        {CATEGORY_LABELS[win.category] ?? win.category}
      </Text>
      <Text
        position={[win.queueStart.x + 0.8, 0.08, win.queueStart.z - 0.42]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.36}
        color="#11181C"
        anchorX="center"
        anchorY="middle"
      >
        {`Q ${queueLength}`}
      </Text>
      <mesh position={[win.queueStart.x + 4.8, 0.025, win.queueStart.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 0.72]} />
        <meshStandardMaterial color="#E8E3D5" transparent opacity={0.18} emissive="#29302C" emissiveIntensity={0.08} />
      </mesh>
    </group>
  );
}

function HeatmapCellMesh({ cell }: { cell: HeatmapCell }) {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const level = cell.normalized > 0.7 ? 'high' : cell.normalized > 0.34 ? 'medium' : 'low';
  const color = level === 'high'
    ? '#FF4B3E'
    : level === 'medium'
      ? '#FFB13D'
      : '#33C7D6';

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * (level === 'high' ? 4.2 : 2.1) + cell.x * 0.13 + cell.z * 0.07) + 1) / 2;
    if (materialRef.current) {
      const base = level === 'high' ? 0.28 : level === 'medium' ? 0.18 : 0.08;
      materialRef.current.opacity = base + pulse * (level === 'high' ? 0.25 : level === 'medium' ? 0.14 : 0.06);
    }
    if (meshRef.current) {
      const scale = 1 + pulse * (level === 'high' ? 0.16 : level === 'medium' ? 0.08 : 0.02);
      meshRef.current.scale.set(scale, scale, 1);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[cell.x, 0.045, cell.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[1.08, 1.08]} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.12}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function HeatmapLayer({ cells }: { cells: HeatmapCell[] }) {
  const visibleCells = useMemo(
    () => cells
      .filter((cell) => cell.normalized >= 0.035)
      .sort((a, b) => b.normalized - a.normalized)
      .slice(0, 260),
    [cells],
  );

  return (
    <group>
      {visibleCells.map((cell) => (
        <HeatmapCellMesh key={`${cell.x}-${cell.z}`} cell={cell} />
      ))}
    </group>
  );
}

function CongestionMarker({
  win,
  stat,
}: {
  win: ServiceWindow;
  stat: WindowRuntimeStats;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const eta = Math.round(stat.queueLength * Math.max(1, stat.serviceMean));

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * 4.4 + win.id) + 1) / 2;
    if (ringRef.current) {
      const scale = 1 + pulse * 0.42;
      ringRef.current.scale.set(scale, scale, scale);
    }
    if (materialRef.current) {
      materialRef.current.opacity = 0.24 + pulse * 0.32;
    }
  });

  const x = win.queueStart.x + win.queueDirection.x * 2.2;
  const z = win.queueStart.z + win.queueDirection.z * 2.2;

  return (
    <group position={[x, 0, z]}>
      <mesh ref={ringRef} position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 1.24, 48]} />
        <meshBasicMaterial ref={materialRef} color="#FF4B3E" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <Billboard position={[0, 2.4, 0]}>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[3.25, 1.45]} />
          <meshBasicMaterial color="#1B0808" transparent opacity={0.82} depthWrite={false} />
        </mesh>
        <Text fontSize={0.22} color="#FFE7E3" anchorX="center" anchorY="middle" lineHeight={1.18}>
          {`! Window ${win.id + 1} Congested\nQueue: ${stat.queueLength}\nETA: ${eta}s`}
        </Text>
      </Billboard>
    </group>
  );
}

function CampusLabels({ layout }: { layout: CanteenLayout }) {
  return (
    <group>
      <Text
        position={[layout.width / 2, 0.09, layout.depth - 1.15]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.62}
        color="#72B8FF"
        anchorX="center"
        anchorY="middle"
      >
        Minghu Canteen Digital Twin
      </Text>
      <Text
        position={[layout.entrance.x, 0.11, layout.entrance.z + 1.35]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.42}
        color="#BEE6FF"
        anchorX="center"
        anchorY="middle"
      >
        ENTRANCE
      </Text>
      <Text
        position={[layout.exit.x, 0.11, layout.exit.z - 1.35]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.42}
        color="#C8F6D9"
        anchorX="center"
        anchorY="middle"
      >
        EXIT
      </Text>
      <Text
        position={[layout.width * 0.72, 0.1, 1.1]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.36}
        color="#B9C4BF"
        anchorX="center"
        anchorY="middle"
      >
        SEATING AREA A / B
      </Text>
    </group>
  );
}

export function Canteen({
  layout,
  queueLengths,
  perWindow,
  heatmap,
  showHeatmap,
  warningThreshold,
}: CanteenProps) {
  const { width, depth } = layout;

  const tablePositions = useMemo(() => {
    const grouped = new Map<number, Seat[]>();
    for (const seat of layout.seats) {
      const key = Math.round(seat.position.x * 10) / 10;
      const seats = grouped.get(key) ?? [];
      seats.push(seat);
      grouped.set(key, seats);
    }

    const positions: { x: number; z: number }[] = [];
    for (const seats of grouped.values()) {
      const sorted = seats.slice().sort((a, b) => a.position.z - b.position.z);
      for (let i = 0; i < sorted.length - 1; i += 2) {
        positions.push({
          x: sorted[i].position.x,
          z: (sorted[i].position.z + sorted[i + 1].position.z) / 2,
        });
      }
    }
    return positions;
  }, [layout]);

  const congestedWindows = useMemo(() => perWindow
    .filter((stat) => stat.queueLength >= warningThreshold)
    .sort((a, b) => b.queueLength - a.queueLength)
    .slice(0, 2), [perWindow, warningThreshold]);

  return (
    <group>
      <InstancedFloor width={width} depth={depth} />
      <InstancedWalls width={width} depth={depth} />
      <CampusLabels layout={layout} />

      {showHeatmap && <HeatmapLayer cells={heatmap} />}

      <mesh position={[layout.entrance.x, 0.04, layout.entrance.z + 0.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 1.4]} />
        <meshStandardMaterial color="#4B8FD6" transparent opacity={0.32} emissive="#173D66" emissiveIntensity={0.28} />
      </mesh>
      <mesh position={[layout.exit.x, 0.04, layout.exit.z - 0.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 1.4]} />
        <meshStandardMaterial color="#4C9A72" transparent opacity={0.28} emissive="#1D5236" emissiveIntensity={0.18} />
      </mesh>

      {layout.windows.map((win) => (
        <ServiceWindowMesh
          key={`window-${win.id}`}
          win={win}
          queueLength={queueLengths[win.id] ?? 0}
        />
      ))}

      {congestedWindows.map((stat) => {
        const win = layout.windows[stat.id];
        return win ? <CongestionMarker key={`congested-${stat.id}`} win={win} stat={stat} /> : null;
      })}

      {tablePositions.map((pos, i) => (
        <TableMesh key={`table-${i}`} x={pos.x} z={pos.z} />
      ))}

      {layout.seats.map((seat) => (
        <ChairMesh key={seat.id} seat={seat} />
      ))}
    </group>
  );
}
