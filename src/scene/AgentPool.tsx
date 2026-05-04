import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Agent } from '../simulation/agent';
import { AgentState, STATE_COLORS } from '../simulation/agent';

interface AgentPoolProps {
  agents: Agent[];
  maxAgents?: number;
}

/** 需要腿部摆动的状态 */
const WALKING_STATES = new Set<AgentState>([
  AgentState.Entering,
  AgentState.Queuing,
  AgentState.FindingSeat,
  AgentState.Leaving,
]);

/**
 * 高性能 Agent 渲染池
 *
 * 将所有 Agent 合并为 4 个 InstancedMesh（身体/头部/左腿/右腿），
 * 把 N×4 draw calls 降低至固定 4 draw calls。
 */
export function AgentPool({ agents, maxAgents = 300 }: AgentPoolProps) {
  const bodiesRef = useRef<THREE.InstancedMesh>(null);
  const headsRef = useRef<THREE.InstancedMesh>(null);
  const leftLegsRef = useRef<THREE.InstancedMesh>(null);
  const rightLegsRef = useRef<THREE.InstancedMesh>(null);

  // ---- 共享几何体（组件外创建，useMemo 保证单例） ----
  const bodyGeo = useMemo(() => new THREE.BoxGeometry(0.5, 0.7, 0.3), []);
  const headGeo = useMemo(() => new THREE.BoxGeometry(0.4, 0.4, 0.4), []);
  const legGeo = useMemo(() => new THREE.BoxGeometry(0.12, 0.35, 0.12), []);

  // ---- 共享材质（vertexColors: true 支持 instanceColor） ----
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true }),
    []
  );
  const headMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#FFE0B2',
        vertexColors: false,
      }),
    []
  );
  const legMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#5D4037',
        vertexColors: false,
      }),
    []
  );

  // ---- 帧间缓存对象，避免 useFrame 内 new THREE.* ----
  const _pos = useRef(new THREE.Vector3());
  const _quat = useRef(new THREE.Quaternion());
  const _scale = useRef(new THREE.Vector3());
  const _matrix = useRef(new THREE.Matrix4());
  const _color = useRef(new THREE.Color());
  const _euler = useRef(new THREE.Euler());
  const _zeroScale = useRef(new THREE.Vector3(0, 0, 0));
  const _identityQuat = useRef(new THREE.Quaternion());
  const _oneScale = useRef(new THREE.Vector3(1, 1, 1));

  // 追踪上一帧的 agent 数量，只在数量变化时才隐藏多余槽位
  const prevCountRef = useRef(0);

  // 初始化：把所有槽位设为 scale=0（隐藏），避免未使用的实例堆在原点
  useEffect(() => {
    const bodies = bodiesRef.current;
    const heads = headsRef.current;
    const leftLegs = leftLegsRef.current;
    const rightLegs = rightLegsRef.current;
    if (!bodies || !heads || !leftLegs || !rightLegs) return;
    const zeroMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(),
      new THREE.Quaternion(),
      new THREE.Vector3(0, 0, 0)
    );
    for (let i = 0; i < maxAgents; i++) {
      bodies.setMatrixAt(i, zeroMatrix);
      heads.setMatrixAt(i, zeroMatrix);
      leftLegs.setMatrixAt(i, zeroMatrix);
      rightLegs.setMatrixAt(i, zeroMatrix);
    }
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    leftLegs.instanceMatrix.needsUpdate = true;
    rightLegs.instanceMatrix.needsUpdate = true;
  }, [maxAgents]);

  useFrame(() => {
    const bodies = bodiesRef.current;
    const heads = headsRef.current;
    const leftLegs = leftLegsRef.current;
    const rightLegs = rightLegsRef.current;
    if (!bodies || !heads || !leftLegs || !rightLegs) return;

    const count = Math.min(agents.length, maxAgents);
    const prevCount = prevCountRef.current;

    // 只在 agent 数量缩减时，才把多余的槽位隐藏（scale=0）
    if (prevCount > count) {
      _matrix.current.compose(
        _pos.current.set(0, 0, 0),
        _identityQuat.current,
        _zeroScale.current
      );
      for (let i = count; i < prevCount; i++) {
        bodies.setMatrixAt(i, _matrix.current);
        heads.setMatrixAt(i, _matrix.current);
        leftLegs.setMatrixAt(i, _matrix.current);
        rightLegs.setMatrixAt(i, _matrix.current);
      }
    }
    prevCountRef.current = count;

    // 只遍历实际存在的 agent
    for (let i = 0; i < count; i++) {

      const agent = agents[i];
      const ax = agent.position.x;

      const az = agent.position.z;

      // ---- 身体 ----
      _pos.current.set(ax, 0.6, az);
      _quat.current.identity();
      _scale.current.copy(_oneScale.current);
      _matrix.current.compose(_pos.current, _quat.current, _scale.current);
      bodies.setMatrixAt(i, _matrix.current);

      // 身体颜色
      _color.current.set(STATE_COLORS[agent.state]);
      bodies.setColorAt(i, _color.current);

      // ---- 头部 ----
      _pos.current.set(ax, 1.2, az);
      _matrix.current.compose(_pos.current, _quat.current, _scale.current);
      heads.setMatrixAt(i, _matrix.current);

      // ---- 腿部摆动角度 ----
      const isWalking = WALKING_STATES.has(agent.state) && agent.target !== null;
      const swing = isWalking
        ? Math.sin(agent.stateTimer * agent.speed * 3) * 0.44
        : 0;

      // ---- 左腿 ----
      // pivot 在 y=0.35，mesh 在 pivot 下方 0.175
      // 等效：pivot 处旋转，mesh 世界位置 = pivot_y - cos(swing)*0.175
      // 为简化，直接用 Matrix4.makeRotationX + translate
      _euler.current.set(swing, 0, 0);
      _quat.current.setFromEuler(_euler.current);
      // 腿的中心在 pivot(y=0.35) 偏下 0.175，且腿顶端做旋转
      // 世界 y = 0.35 + cos(swing)*(-0.175)  ≈ 0.35 - 0.175*cos(swing)
      const cosSwing = Math.cos(swing);
      const sinSwing = Math.sin(swing);
      const leftY = 0.35 - cosSwing * 0.175;
      const leftZ = az - sinSwing * 0.175;
      _pos.current.set(ax - 0.1, leftY, leftZ);
      _scale.current.copy(_oneScale.current);
      _matrix.current.compose(_pos.current, _quat.current, _scale.current);
      leftLegs.setMatrixAt(i, _matrix.current);

      // ---- 右腿（反相） ----
      _euler.current.set(-swing, 0, 0);
      _quat.current.setFromEuler(_euler.current);
      const rightY = 0.35 - cosSwing * 0.175;
      const rightZ = az + sinSwing * 0.175;
      _pos.current.set(ax + 0.1, rightY, rightZ);
      _matrix.current.compose(_pos.current, _quat.current, _scale.current);
      rightLegs.setMatrixAt(i, _matrix.current);
    }

    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    leftLegs.instanceMatrix.needsUpdate = true;
    rightLegs.instanceMatrix.needsUpdate = true;

    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* 身体 —— 带 instanceColor，vertexColors 材质 */}
      <instancedMesh ref={bodiesRef} args={[bodyGeo, bodyMat, maxAgents]} castShadow />
      {/* 头部 —— 固定肤色 */}
      <instancedMesh ref={headsRef} args={[headGeo, headMat, maxAgents]} castShadow />
      {/* 左腿 */}
      <instancedMesh ref={leftLegsRef} args={[legGeo, legMat, maxAgents]} castShadow />
      {/* 右腿 */}
      <instancedMesh ref={rightLegsRef} args={[legGeo, legMat, maxAgents]} castShadow />
    </group>
  );
}

export default AgentPool;
