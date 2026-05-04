import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// 每个测试后清理 DOM
afterEach(() => {
  cleanup()
})

// 模拟 window.matchMedia (用于响应式设计测试)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// 模拟 requestAnimationFrame (用于动画和性能测试)
let rafCallbacks: FrameRequestCallback[] = []
let rafId = 0

global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  rafCallbacks.push(callback)
  return ++rafId
})

global.cancelAnimationFrame = vi.fn((id: number) => {
  rafCallbacks = rafCallbacks.filter((_, i) => i !== id - 1)
})

// 辅助函数：在测试中模拟 RAF 帧
export function flushRAF(timestamp = performance.now()) {
  const callbacks = rafCallbacks.slice()
  rafCallbacks = []
  callbacks.forEach(cb => cb(timestamp as any))
}

// 模拟 performance.now() (用于性能测试)
if (!global.performance) {
  global.performance = {
    now: () => Date.now(),
  } as any
}
