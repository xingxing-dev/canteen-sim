import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';

interface InstancedFloorProps {
  width: number;
  depth: number;
  lightColor?: string;
  darkColor?: string;
}

export function InstancedFloor({
  width,
  depth,
  lightColor = '#E8E0D0',
  darkColor = '#D4C8B0',
}: InstancedFloorProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const totalTiles = width * depth;
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 0.1, 1), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ metalness: 0.1, roughness: 0.8, vertexColors: true }),
    []
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const lightC = new THREE.Color(lightColor);
    const darkC = new THREE.Color(darkColor);
    const colors = new Float32Array(totalTiles * 3);
    const matrix = new THREE.Matrix4();
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        const index = z * width + x;
        matrix.setPosition(x, -0.05, z);
        mesh.setMatrixAt(index, matrix);
        const c = (x + z) % 2 === 0 ? lightC : darkC;
        colors[index * 3] = c.r;
        colors[index * 3 + 1] = c.g;
        colors[index * 3 + 2] = c.b;
      }
    }
    mesh.geometry.setAttribute('instanceColor', new THREE.BufferAttribute(colors, 3));
    mesh.instanceMatrix.needsUpdate = true;
  }, [width, depth, lightColor, darkColor, totalTiles]);

  return <instancedMesh ref={meshRef} args={[geometry, material, totalTiles]} receiveShadow />;
}

export default InstancedFloor;
