import { useCallback, useRef } from 'react';
import type { InstancedGeometryRef, InstanceAttributes } from './InstancedGeometryWrapper';

/** Instance 数据存储 */
interface InstanceData extends InstanceAttributes {
  id: string;
}

/** useInstanced Hook 返回值 */
export interface UseInstancedReturn {
  /** InstancedGeometryWrapper 的 ref */
  ref: React.RefObject<InstancedGeometryRef | null>;
  /** 当前实例数量 */
  count: number;
  /** 添加实例，返回索引 */
  addInstance: (attributes: InstanceAttributes) => number;
  /** 更新指定索引的实例 */
  updateInstance: (index: number, attributes: Partial<InstanceAttributes>) => void;
  /** 按 ID 更新实例 */
  updateInstanceById: (id: string, attributes: Partial<InstanceAttributes>) => void;
  /** 删除实例（标记为无效，需要手动整理） */
  removeInstance: (index: number) => void;
  /** 获取所有实例数据 */
  getInstances: () => Map<number, InstanceData>;
  /** 获取实例 ID 到索引的映射 */
  getInstanceMap: () => Map<string, number>;
  /** 清空所有实例 */
  clear: () => void;
}

/**
 * Instancing 管理 Hook
 *
 * 便于在 React 组件中使用 Instanced Mesh
 * 自动处理 useFrame 中的同步
 * 提供 addInstance / updateInstance / removeInstance 方法
 *
 * @param initialCount - 初始实例数量或最大实例数量
 * @returns Instancing 管理接口
 */
export function useInstanced(initialCount: number): UseInstancedReturn {
  const ref = useRef<InstancedGeometryRef | null>(null);

  // 存储实例数据：索引 -> 实例数据
  const instancesRef = useRef<Map<number, InstanceData>>(new Map());
  // 存储 ID 到索引的映射
  const idMapRef = useRef<Map<string, number>>(new Map());
  // 空闲索引池（已删除的位置）
  const freeIndicesRef = useRef<number[]>([]);
  // 下一个 ID
  const nextIdRef = useRef(0);

  const addInstance = useCallback(
    (attributes: InstanceAttributes): number => {
      let index: number;

      // 尽可能从空闲池中获取索引
      if (freeIndicesRef.current.length > 0) {
        index = freeIndicesRef.current.pop()!;
      } else {
        index = instancesRef.current.size;
        if (index >= initialCount) {
          console.warn(
            `Instanced mesh capacity reached (${initialCount}). Cannot add more instances.`
          );
          return -1;
        }
      }

      const id = `inst_${nextIdRef.current++}`;
      const data: InstanceData = {
        ...attributes,
        id,
      };

      instancesRef.current.set(index, data);
      idMapRef.current.set(id, index);

      // 同步到 InstancedMesh
      if (ref.current) {
        ref.current.setInstance(index, attributes);
      }

      return index;
    },
    [initialCount]
  );

  const updateInstance = useCallback(
    (index: number, attributes: Partial<InstanceAttributes>) => {
      const data = instancesRef.current.get(index);
      if (!data) {
        console.warn(`Instance at index ${index} not found`);
        return;
      }

      // 合并新属性
      const merged: InstanceAttributes = {
        position: attributes.position || data.position,
        color: attributes.color || data.color,
        scale: attributes.scale || data.scale,
        quaternion: attributes.quaternion || data.quaternion,
        rotation: attributes.rotation || data.rotation,
      };

      // 更新本地存储
      Object.assign(data, merged);

      // 同步到 InstancedMesh
      if (ref.current) {
        ref.current.setInstance(index, merged);
      }
    },
    []
  );

  const updateInstanceById = useCallback(
    (id: string, attributes: Partial<InstanceAttributes>) => {
      const index = idMapRef.current.get(id);
      if (index !== undefined) {
        updateInstance(index, attributes);
      } else {
        console.warn(`Instance with ID ${id} not found`);
      }
    },
    [updateInstance]
  );

  const removeInstance = useCallback((index: number) => {
    const data = instancesRef.current.get(index);
    if (!data) {
      console.warn(`Instance at index ${index} not found`);
      return;
    }

    instancesRef.current.delete(index);
    idMapRef.current.delete(data.id);
    freeIndicesRef.current.push(index);
  }, []);

  const getInstances = useCallback(
    () => new Map(instancesRef.current),
    []
  );

  const getInstanceMap = useCallback(
    () => new Map(idMapRef.current),
    []
  );

  const clear = useCallback(() => {
    instancesRef.current.clear();
    idMapRef.current.clear();
    freeIndicesRef.current.length = 0;
    nextIdRef.current = 0;
  }, []);

  return {
    ref,
    count: initialCount,
    addInstance,
    updateInstance,
    updateInstanceById,
    removeInstance,
    getInstances,
    getInstanceMap,
    clear,
  };
}
