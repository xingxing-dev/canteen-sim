import { useMemo, useRef, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** 实例属性接口 */
export interface InstanceAttributes {
  position: THREE.Vector3;
  color?: THREE.Color | string;
  scale?: THREE.Vector3 | number;
  quaternion?: THREE.Quaternion;
  rotation?: THREE.Euler;
}

/** Instancing 包装器的 Props */
export interface InstancedGeometryWrapperProps {
  /** 几何体 */
  geometry: THREE.BufferGeometry;
  /** 材质 */
  material: THREE.Material;
  /** 初始实例数量 */
  count: number;
  /** 是否需要颜色属性（会添加 instanceColor） */
  hasColor?: boolean;
  /** 是否自动更新 */
  autoUpdate?: boolean;
}

/** 实例化几何体的 ref 接口 */
export interface InstancedGeometryRef {
  /** 获取 InstancedMesh */
  mesh: THREE.InstancedMesh | null;
  /** 添加或更新实例 */
  setInstance: (index: number, attributes: InstanceAttributes) => void;
  /** 批量设置多个实例 */
  setInstances: (
    indices: number[],
    attributesList: InstanceAttributes[]
  ) => void;
  /** 获取实例属性 */
  getInstance: (index: number) => THREE.Matrix4;
  /** 手动标记脏数据，触发更新 */
  markDirty: (index?: number) => void;
}

/**
 * 通用 Instancing 包装器组件
 *
 * 管理 InstancedBufferGeometry 和 InstancedMesh 的创建和更新
 * 提供简单的实例管理接口
 */
const InstancedGeometryWrapperImpl = forwardRef<
  InstancedGeometryRef,
  InstancedGeometryWrapperProps
>(
  (
    { geometry, material, count, hasColor = false, autoUpdate = true },
    ref
  ) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dirtyIndices = useRef(new Set<number>());
    const matrixData = useRef<THREE.Matrix4[]>(
      Array.from({ length: count }, () => new THREE.Matrix4())
    );
    const colorData = useRef<THREE.Color[] | null>(
      hasColor ? Array.from({ length: count }, () => new THREE.Color()) : null
    );

    // 暴露 ref 接口
    useMemo(() => {
      if (!ref) return;

      const refValue: InstancedGeometryRef = {
        mesh: meshRef.current,

        setInstance: (index: number, attributes: InstanceAttributes) => {
          if (index < 0 || index >= count) {
            console.warn(`Instance index ${index} out of range [0, ${count})`);
            return;
          }

          const matrix = matrixData.current[index];
          const position = attributes.position;
          const scale = attributes.scale || 1;
          const quaternion =
            attributes.quaternion || new THREE.Quaternion();

          if (attributes.rotation) {
            quaternion.setFromEuler(attributes.rotation);
          }

          // 构建变换矩阵
          matrix.compose(
            position,
            quaternion,
            typeof scale === 'number'
              ? new THREE.Vector3(scale, scale, scale)
              : scale
          );

          if (meshRef.current) {
            meshRef.current.setMatrixAt(index, matrix);
          }

          // 处理颜色
          if (hasColor && colorData.current && attributes.color) {
            const color = new THREE.Color(attributes.color);
            colorData.current[index] = color;
            if (
              meshRef.current &&
              meshRef.current.geometry.attributes.instanceColor
            ) {
              const attr = meshRef.current.geometry.attributes
                .instanceColor as THREE.BufferAttribute;
              attr.setXYZ(index, color.r, color.g, color.b);
              attr.needsUpdate = true;
            }
          }

          dirtyIndices.current.add(index);
        },

        setInstances: (
          indices: number[],
          attributesList: InstanceAttributes[]
        ) => {
          indices.forEach((index, i) => {
            if (attributesList[i]) {
              refValue.setInstance(index, attributesList[i]);
            }
          });
        },

        getInstance: (index: number) => {
          if (index < 0 || index >= count) {
            console.warn(
              `Instance index ${index} out of range [0, ${count})`
            );
            return new THREE.Matrix4();
          }
          return matrixData.current[index];
        },

        markDirty: (index?: number) => {
          if (index !== undefined) {
            dirtyIndices.current.add(index);
          } else {
            for (let i = 0; i < count; i++) {
              dirtyIndices.current.add(i);
            }
          }
        },
      };

      if (typeof ref === 'function') {
        ref(refValue);
      } else {
        ref.current = refValue;
      }
    }, [ref, count, hasColor]);

    // 每帧更新变脏的实例
    useFrame(() => {
      if (!meshRef.current || !autoUpdate || dirtyIndices.current.size === 0)
        return;

      dirtyIndices.current.forEach((index) => {
        meshRef.current?.setMatrixAt(index, matrixData.current[index]);
      });

      meshRef.current.instanceMatrix.needsUpdate = true;
      dirtyIndices.current.clear();
    });

    return (
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, count]}
        castShadow
        receiveShadow
      />
    );
  }
);

InstancedGeometryWrapperImpl.displayName = 'InstancedGeometryWrapper';

export const InstancedGeometryWrapper = InstancedGeometryWrapperImpl;
export default InstancedGeometryWrapper;
