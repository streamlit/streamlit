/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import ThemeProvider from "~lib/components/core/ThemeProvider"
import { mockTheme } from "~lib/mocks/mockTheme"

import { useWaveformController } from "./useWaveformController"

// Mock WaveSurfer and RecordPlugin
vi.mock("wavesurfer.js", () => ({
  default: {
    create: vi.fn(),
  },
}))

vi.mock("wavesurfer.js/dist/plugins/record", () => ({
  default: {
    create: vi.fn(),
  },
}))

// Mock theme utils
vi.mock("~lib/theme/utils", () => ({
  convertRemToPx: (rem: string) => parseFloat(rem) * 16,
}))

describe("useWaveformController", () => {
  let mockContainerRef: { current: HTMLDivElement | null }
  let mockEvents: {
    onPermissionDenied?: () => void
    onError?: (error: Error) => void
    onRecordStart?: () => void
    onRecordReady?: (blob: Blob) => void
    onApprove?: (wav: Blob) => void
    onCancel?: () => void
    onProgressMs?: (ms: number) => void
  }

  beforeEach(() => {
    mockContainerRef = { current: document.createElement("div") }
    mockEvents = {
      onPermissionDenied: vi.fn(),
      onError: vi.fn(),
      onRecordStart: vi.fn(),
      onRecordReady: vi.fn(),
      onApprove: vi.fn(),
      onCancel: vi.fn(),
      onProgressMs: vi.fn(),
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should initialize with idle state", () => {
    const { result } = renderHook(() =>
      useWaveformController({
        containerRef: mockContainerRef,
        events: mockEvents,
      })
    )

    expect(result.current.state).toBe("idle")
  })

  it("should have playback methods", () => {
    const { result } = renderHook(() =>
      useWaveformController({
        containerRef: mockContainerRef,
        events: mockEvents,
      })
    )

    expect(result.current.playback).toBeDefined()
    expect(typeof result.current.playback.isPlaying).toBe("function")
    expect(typeof result.current.playback.play).toBe("function")
    expect(typeof result.current.playback.pause).toBe("function")
    expect(typeof result.current.playback.getCurrentTimeMs).toBe("function")
    expect(typeof result.current.playback.getDurationMs).toBe("function")
  })

  it("should have control methods", () => {
    const { result } = renderHook(() =>
      useWaveformController({
        containerRef: mockContainerRef,
        events: mockEvents,
      })
    )

    expect(typeof result.current.start).toBe("function")
    expect(typeof result.current.stop).toBe("function")
    expect(typeof result.current.approve).toBe("function")
    expect(typeof result.current.cancel).toBe("function")
    expect(typeof result.current.setEventHandlers).toBe("function")
  })

  it("should update events via setEventHandlers", () => {
    const { result } = renderHook(() =>
      useWaveformController({
        containerRef: mockContainerRef,
        events: mockEvents,
      })
    )

    const newEvents = {
      onError: vi.fn(),
    }

    act(() => {
      result.current.setEventHandlers(newEvents)
    })

    expect(result.current).toBeDefined()
  })

  it("should call cancel and update state on cancel()", () => {
    const { result } = renderHook(() =>
      useWaveformController({
        containerRef: mockContainerRef,
        events: mockEvents,
      })
    )

    act(() => {
      result.current.cancel()
    })

    expect(result.current.state).toBe("idle")
    expect(mockEvents.onCancel).toHaveBeenCalled()
  })

  it("should throw error when approving without recording", async () => {
    const { result } = renderHook(() =>
      useWaveformController({
        containerRef: mockContainerRef,
        events: mockEvents,
      })
    )

    await expect(result.current.approve()).rejects.toThrow(
      "No recorded audio to approve"
    )
  })

  it("should return false for isPlaying when not playing", () => {
    const { result } = renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: mockEvents,
        }),
      {
        wrapper: ({ children }) => (
          <ThemeProvider theme={mockTheme.emotion}>{children}</ThemeProvider>
        ),
      }
    )

    expect(result.current.playback.isPlaying()).toBe(false)
  })

  it("should return 0 for getCurrentTimeMs when no playback", () => {
    const { result } = renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: mockEvents,
        }),
      {
        wrapper: ({ children }) => (
          <ThemeProvider theme={mockTheme.emotion}>{children}</ThemeProvider>
        ),
      }
    )

    expect(result.current.playback.getCurrentTimeMs()).toBe(0)
  })

  it("should return 0 for getDurationMs when no recording", () => {
    const { result } = renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: mockEvents,
        }),
      {
        wrapper: ({ children }) => (
          <ThemeProvider theme={mockTheme.emotion}>{children}</ThemeProvider>
        ),
      }
    )

    expect(result.current.playback.getDurationMs()).toBe(0)
  })

  it("destroys WaveSurfer and Record backend on unmount", async () => {
    const mockWaveSurferInstance = {
      destroy: vi.fn(),
      on: vi.fn(),
      registerPlugin: vi.fn(),
      empty: vi.fn(),
      pause: vi.fn(),
    }

    const mockRecordPlugin = {
      destroy: vi.fn(),
      on: vi.fn(),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    }

    const WaveSurferModule = await import("wavesurfer.js")
    const RecordPluginModule = await import(
      "wavesurfer.js/dist/plugins/record"
    )

    // Mock the WaveSurfer.create to return our mock instance
    const createMock = WaveSurferModule.default.create as ReturnType<
      typeof vi.fn
    >
    createMock.mockReturnValue(mockWaveSurferInstance)
    const recordCreateMock = RecordPluginModule.default.create as ReturnType<
      typeof vi.fn
    >
    recordCreateMock.mockReturnValue(mockRecordPlugin)

    mockWaveSurferInstance.registerPlugin.mockReturnValue(mockRecordPlugin)

    const { unmount } = renderHook(() =>
      useWaveformController({
        containerRef: mockContainerRef,
        events: mockEvents,
      })
    )

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // Unmount the component
    unmount()

    // Verify destroy was called on WaveSurfer
    expect(mockWaveSurferInstance.destroy).toHaveBeenCalledTimes(1)
    expect(mockRecordPlugin.destroy).toHaveBeenCalledTimes(1)
  })

  it("handles errors from WaveSurfer initialization", async () => {
    const onError = vi.fn()
    const WaveSurferModule = await import("wavesurfer.js")

    // Reset the mock first
    const createMock = WaveSurferModule.default.create as ReturnType<
      typeof vi.fn
    >
    createMock.mockReset()

    // Make WaveSurfer.create throw an error
    createMock.mockImplementationOnce(() => {
      throw new Error("WaveSurfer init failed")
    })

    renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: { ...mockEvents, onError },
        }),
      {
        wrapper: ({ children }) => (
          <ThemeProvider theme={mockTheme.emotion}>{children}</ThemeProvider>
        ),
      }
    )

    // Wait for initialization attempt
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    expect(onError).toHaveBeenCalled()
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toContain(
      "WaveSurfer init failed"
    )
  })
})
