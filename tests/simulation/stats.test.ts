/**
 * createEmptyStats 统计对象测试
 */

import { describe, it, expect } from 'vitest'
import { createEmptyStats } from '../../src/simulation/stats'

describe('createEmptyStats', () => {

  describe('初始字段值', () => {
    it('elapsedTime 初始为 0', () => {
      const stats = createEmptyStats(4)
      expect(stats.elapsedTime).toBe(0)
    })

    it('currentAgents 初始为 0', () => {
      const stats = createEmptyStats(4)
      expect(stats.currentAgents).toBe(0)
    })

    it('totalEntered 初始为 0', () => {
      const stats = createEmptyStats(4)
      expect(stats.totalEntered).toBe(0)
    })

    it('totalServed 初始为 0', () => {
      const stats = createEmptyStats(4)
      expect(stats.totalServed).toBe(0)
    })

    it('totalLeft 初始为 0', () => {
      const stats = createEmptyStats(4)
      expect(stats.totalLeft).toBe(0)
    })

    it('seatUtilization 初始为 0', () => {
      const stats = createEmptyStats(4)
      expect(stats.seatUtilization).toBe(0)
    })

    it('avgWaitTime 初始为 0', () => {
      const stats = createEmptyStats(4)
      expect(stats.avgWaitTime).toBe(0)
    })
  })

  describe('queueLengths', () => {
    it('queueLengths 长度等于 windowCount', () => {
      const stats = createEmptyStats(4)
      expect(stats.queueLengths).toHaveLength(4)
    })

    it('windowCount=1 时 queueLengths 长度为 1', () => {
      const stats = createEmptyStats(1)
      expect(stats.queueLengths).toHaveLength(1)
    })

    it('windowCount=8 时 queueLengths 长度为 8', () => {
      const stats = createEmptyStats(8)
      expect(stats.queueLengths).toHaveLength(8)
    })

    it('queueLengths 所有元素初始为 0', () => {
      const stats = createEmptyStats(4)
      for (const len of stats.queueLengths) {
        expect(len).toBe(0)
      }
    })

    it('windowCount=0 时 queueLengths 为空数组', () => {
      const stats = createEmptyStats(0)
      expect(stats.queueLengths).toHaveLength(0)
    })
  })

  describe('独立性', () => {
    it('两次调用返回不同对象（无引用共享）', () => {
      const a = createEmptyStats(4)
      const b = createEmptyStats(4)
      expect(a).not.toBe(b)
    })

    it('修改一个 stats 不影响另一个', () => {
      const a = createEmptyStats(4)
      const b = createEmptyStats(4)
      a.totalEntered = 99
      a.queueLengths[0] = 5

      expect(b.totalEntered).toBe(0)
      expect(b.queueLengths[0]).toBe(0)
    })

    it('queueLengths 数组不共享引用', () => {
      const a = createEmptyStats(4)
      const b = createEmptyStats(4)
      a.queueLengths.push(99)

      expect(b.queueLengths).toHaveLength(4)
    })
  })
})
