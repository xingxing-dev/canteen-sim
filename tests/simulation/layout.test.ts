/**
 * createDefaultLayout 布局生成测试
 */

import { describe, it, expect } from 'vitest'
import { createDefaultLayout } from '../../src/simulation/layout'
import { createTestLayout } from '../utils'

describe('createDefaultLayout', () => {

  describe('窗口数量', () => {
    it('windows 数量等于 windowCount', () => {
      const layout = createDefaultLayout(4, 40)
      expect(layout.windows).toHaveLength(4)
    })

    it('windowCount=1 时只有 1 个窗口', () => {
      const layout = createDefaultLayout(1, 10)
      expect(layout.windows).toHaveLength(1)
    })

    it('windowCount=8 时有 8 个窗口', () => {
      const layout = createDefaultLayout(8, 40)
      expect(layout.windows).toHaveLength(8)
    })
  })

  describe('座位数量', () => {
    it('seats 数量等于 seatCount', () => {
      const layout = createDefaultLayout(4, 40)
      expect(layout.seats).toHaveLength(40)
    })

    it('seatCount=10 时有 10 个座位', () => {
      const layout = createDefaultLayout(2, 10)
      expect(layout.seats).toHaveLength(10)
    })

    it('seatCount=1 时有 1 个座位', () => {
      const layout = createDefaultLayout(1, 1)
      expect(layout.seats).toHaveLength(1)
    })
  })

  describe('入口和出口', () => {
    it('entrance 的 x 在布局宽度范围内', () => {
      const layout = createDefaultLayout(4, 40)
      expect(layout.entrance.x).toBeGreaterThanOrEqual(0)
      expect(layout.entrance.x).toBeLessThanOrEqual(layout.width)
    })

    it('exit 的 x 在布局宽度范围内', () => {
      const layout = createDefaultLayout(4, 40)
      expect(layout.exit.x).toBeGreaterThanOrEqual(0)
      expect(layout.exit.x).toBeLessThanOrEqual(layout.width)
    })

    it('entrance 的 z 在布局深度范围内', () => {
      const layout = createDefaultLayout(4, 40)
      expect(layout.entrance.z).toBeGreaterThanOrEqual(0)
      expect(layout.entrance.z).toBeLessThanOrEqual(layout.depth)
    })

    it('exit 的 z 在布局深度范围内', () => {
      const layout = createDefaultLayout(4, 40)
      expect(layout.exit.z).toBeGreaterThanOrEqual(0)
      expect(layout.exit.z).toBeLessThanOrEqual(layout.depth)
    })

    it('entrance 和 exit 位置不同（出入分离）', () => {
      const layout = createDefaultLayout(4, 40)
      const samePos =
        layout.entrance.x === layout.exit.x && layout.entrance.z === layout.exit.z
      expect(samePos).toBe(false)
    })
  })

  describe('窗口属性', () => {
    it('每个 window 有有效 id', () => {
      const layout = createDefaultLayout(4, 40)
      layout.windows.forEach((win, idx) => {
        expect(win.id).toBe(idx)
      })
    })

    it('每个 window 有 queueStart 坐标', () => {
      const layout = createDefaultLayout(4, 40)
      for (const win of layout.windows) {
        expect(win.queueStart).toBeDefined()
        expect(typeof win.queueStart.x).toBe('number')
        expect(typeof win.queueStart.z).toBe('number')
      }
    })

    it('每个 window 有 queueDirection 向量', () => {
      const layout = createDefaultLayout(4, 40)
      for (const win of layout.windows) {
        expect(win.queueDirection).toBeDefined()
        expect(typeof win.queueDirection.x).toBe('number')
        expect(typeof win.queueDirection.z).toBe('number')
      }
    })

    it('queueDirection 是单位向量（长度为 1）', () => {
      const layout = createDefaultLayout(4, 40)
      for (const win of layout.windows) {
        const { x, z } = win.queueDirection
        const len = Math.sqrt(x * x + z * z)
        expect(len).toBeCloseTo(1, 5)
      }
    })

    it('每个 window 的 position 在布局范围内', () => {
      const layout = createDefaultLayout(4, 40)
      for (const win of layout.windows) {
        expect(win.position.x).toBeGreaterThanOrEqual(0)
        expect(win.position.x).toBeLessThanOrEqual(layout.width)
        expect(win.position.z).toBeGreaterThanOrEqual(0)
        expect(win.position.z).toBeLessThanOrEqual(layout.depth)
      }
    })
  })

  describe('座位属性', () => {
    it('所有座位初始 occupied = false', () => {
      const layout = createDefaultLayout(4, 40)
      for (const seat of layout.seats) {
        expect(seat.occupied).toBe(false)
      }
    })

    it('座位 id 从 0 开始连续编号', () => {
      const layout = createDefaultLayout(4, 10)
      layout.seats.forEach((seat, idx) => {
        expect(seat.id).toBe(idx)
      })
    })

    it('座位 position 在布局范围内', () => {
      const layout = createDefaultLayout(4, 40)
      for (const seat of layout.seats) {
        expect(seat.position.x).toBeGreaterThanOrEqual(0)
        expect(seat.position.x).toBeLessThanOrEqual(layout.width)
        expect(seat.position.z).toBeGreaterThanOrEqual(0)
        expect(seat.position.z).toBeLessThanOrEqual(layout.depth)
      }
    })
  })

  describe('布局尺寸', () => {
    it('width 和 depth 为正数', () => {
      const layout = createDefaultLayout(4, 40)
      expect(layout.width).toBeGreaterThan(0)
      expect(layout.depth).toBeGreaterThan(0)
    })

    it('createTestLayout 默认参数与 createDefaultLayout(4, 40) 一致', () => {
      const a = createTestLayout()
      const b = createDefaultLayout(4, 40)
      expect(a.windows).toHaveLength(b.windows.length)
      expect(a.seats).toHaveLength(b.seats.length)
      expect(a.width).toBe(b.width)
      expect(a.depth).toBe(b.depth)
    })
  })
})
