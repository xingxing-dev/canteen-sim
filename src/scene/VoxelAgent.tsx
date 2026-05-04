import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Agent } from '../simulation/agent';
import { AgentState, STATE_COLORS } from '../simulation/agent';

interface VoxelAgentProps {
  agent: Agent;
}

/** Minecraft 风格方块人 */
export function VoxelAgent({ agent }: VoxelAgentProps) {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  // 时间累计，用 delta 驱动（帧率无关）
  const timeRef = useRef(0);
  const color = STATE_COLORS[agent.state];
  const ringColor = STATE_RING_COLORS[agent.state] ?? '#FFFFFF';

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (groupRef.current) {
      // 平滑插值到目标位置
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        agent.position.x,
        0.15
      );
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        agent.position.z,
        0.15
      );
    }

    // 腿部行走动画：只在移动时（有 target）摆动，静止时归零
    if (leftLegRef.current && rightLegRef.current) {
      if (agent.target !== null) {
        const freq = agent.speed * 3;
        const swing = Math.sin(timeRef.current * freq) * 0.44;
        leftLegRef.current.rotation.x = swing;
        rightLegRef.current.rotation.x = -swing;
      } else {
        // 静止时平滑回到 0°
        leftLegRef.current.rotation.x = THREE.MathUtils.lerp(
          leftLegRef.current.rotation.x,
          0,
          0.2
        );
        rightLegRef.current.rotation.x = THREE.MathUtils.lerp(
          rightLegRef.current.rotation.x,
          0,
          0.2
        );
      }
    }

    if (ringRef.current && ringMaterialRef.current) {
      const pulse = (Math.sin(timeRef.current * 2.2 + agent.id) + 1) / 2;
      const scale = 1 + pulse * (agent.state === AgentState.Dining ? 0.18 : 0.1);
      ringRef.current.scale.set(scale, scale, scale);
      ringMaterialRef.current.opacity = 0.18 + pulse * 0.16;
    }
  });

  return (
    <group ref={groupRef} position={[agent.position.x, 0, agent.position.z]}>
      <mesh ref={ringRef} position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.48, 28]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={ringColor}
          transparent
          opacity={0.24}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* 身体 */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.5, 0.7, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.72} />
      </mesh>
      {/* 头 */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#FFE0B2" />
      </mesh>
      {agent.state === AgentState.Ordering && (
        <mesh position={[0, 0.9, -0.28]} castShadow>
          <boxGeometry args={[0.42, 0.05, 0.24]} />
          <meshStandardMaterial color="#D9D2BE" emissive="#3A3322" emissiveIntensity={0.18} />
        </mesh>
      )}
      {/* 左腿 — 绕腿顶端旋转，pivot 在 y=0.3（腿高一半） */}
      <group position={[-0.1, 0.35, 0]}>
        <mesh ref={leftLegRef} position={[0, -0.175, 0]} castShadow>
          <boxGeometry args={[0.12, 0.35, 0.12]} />
          <meshStandardMaterial color="#5D4037" />
        </mesh>
      </group>
      {/* 右腿 */}
      <group position={[0.1, 0.35, 0]}>
        <mesh ref={rightLegRef} position={[0, -0.175, 0]} castShadow>
          <boxGeometry args={[0.12, 0.35, 0.12]} />
          <meshStandardMaterial color="#5D4037" />
        </mesh>
      </group>
    </group>
  );
}

const STATE_RING_COLORS: Record<AgentState, string> = {
  [AgentState.Entering]: '#4B8FD6',
  [AgentState.ChoosingWindow]: '#F5D85C',
  [AgentState.Queuing]: '#FFAA3D',
  [AgentState.Ordering]: '#FF665C',
  [AgentState.FindingSeat]: '#B06DE8',
  [AgentState.Dining]: '#74D889',
  [AgentState.Leaving]: '#AAB5BA',
  [AgentState.Left]: '#757575',
};
