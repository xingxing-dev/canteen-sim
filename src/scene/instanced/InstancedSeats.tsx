import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Seat } from '../../simulation/layout';

interface InstancedSeatsProps {
  seats: Seat[];
}

export function InstancedSeats({ seats }: InstancedSeatsProps) {
  const topRef = useRef<THREE.InstancedMesh>(null);
  const legRef = useRef<THREE.InstancedMesh>(null);
  const seatCount = seats.length;

  const topGeometry = useMemo(() => new THREE.BoxGeometry(0.8, 0.05, 0.8), []);
  const legGeometry = useMemo(() => new THREE.BoxGeometry(0.15, 0.4, 0.15), []);
  const topMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ metalness: 0.1, roughness: 0.8, vertexColors: true }),
    []
  );
  const legMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#6B4423', metalness: 0.1, roughness: 0.8 }),
    []
  );

  // 初始化矩阵（座位不移动，只设置一次）
  useEffect(() => {
    const top = topRef.current;
    const leg = legRef.current;
    if (!top || !leg) return;
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < seatCount; i++) {
      const seat = seats[i];
      matrix.setPosition(seat.position.x, 0.45, seat.position.z);
      top.setMatrixAt(i, matrix);
      matrix.setPosition(seat.position.x, 0.2, seat.position.z);
      leg.setMatrixAt(i, matrix);
    }
    top.instanceMatrix.needsUpdate = true;
    leg.instanceMatrix.needsUpdate = true;
  }, [seats, seatCount]);

  const freeColor = useMemo(() => new THREE.Color('#C4A882'), []);
  const occupiedColor = useMemo(() => new THREE.Color('#A5D6A7'), []);

  // 每帧更新颜色（seat.occupied 是原地 mutation，effect 检测不到）
  useFrame(() => {
    const top = topRef.current;
    if (!top) return;
    for (let i = 0; i < seatCount; i++) {
      top.setColorAt(i, seats[i].occupied ? occupiedColor : freeColor);
    }
    if (top.instanceColor) top.instanceColor.needsUpdate = true;
  });

  if (seatCount === 0) return null;

  return (
    <group>
      <instancedMesh ref={topRef} args={[topGeometry, topMaterial, seatCount]} />
      <instancedMesh ref={legRef} args={[legGeometry, legMaterial, seatCount]} />
    </group>
  );
}

export default InstancedSeats;
