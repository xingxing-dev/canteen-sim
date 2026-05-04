import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';

interface InstancedWallsProps {
  width: number;
  depth: number;
  wallHeight?: number;
  color?: string;
}

export function InstancedWalls({
  width,
  depth,
  wallHeight = 2,
  color = '#A89888',
}: InstancedWallsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const wallData = useMemo(() => {
    const halfW = Math.floor(width / 2);
    const gapMin = halfW - 2;
    const gapMax = halfW + 2;
    const data: { x: number; y: number; z: number }[] = [];
    for (let z = 0; z < depth; z++) data.push({ x: -0.5, y: 1, z });
    for (let z = 0; z < depth; z++) data.push({ x: width, y: 1, z });
    for (let x = 0; x < width; x++) {
      if (x >= gapMin && x <= gapMax) continue;
      data.push({ x, y: 1, z: depth });
    }
    for (let x = 0; x < width; x++) {
      if (x >= gapMin && x <= gapMax) continue;
      data.push({ x, y: 1, z: -1 });
    }
    return data;
  }, [width, depth]);

  const geometry = useMemo(() => new THREE.BoxGeometry(1, wallHeight, 1), [wallHeight]);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.8 }),
    [color]
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < wallData.length; i++) {
      const { x, y, z } = wallData[i];
      matrix.setPosition(x, y, z);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [wallData]);

  return <instancedMesh ref={meshRef} args={[geometry, material, wallData.length]} castShadow />;
}

export default InstancedWalls;
