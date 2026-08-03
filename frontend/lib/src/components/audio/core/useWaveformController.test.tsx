/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { ReactNode } from "react"

import {
  act,
  renderHook,
  type RenderHookResult,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import ThemeProvider from "~lib/components/core/ThemeProvider"
import { mockTheme } from "~lib/mocks/mockTheme"
import { convertRemToPx } from "~lib/theme/utils"

import { encodeToWav } from "./encodeToWav"
import type { StopResult } from "./types"
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

// encodeToWav relies on AudioContext, which is unavailable in jsdom, so mock it
// to exercise the approve() flow deterministically. The specifier matches the
// import below so the mock reliably applies.
vi.mock("./encodeToWav", () => ({
  encodeToWav: vi
    .fn()
    .mockResolvedValue(new Blob(["wav"], { type: "audio/wav" })),
}))

describe("useWaveformController", () => {
  let mockContainerRef: { current: HTMLDivElement | null }
  let mockEvents: {
    onPermissionDenied: () => void
    onError: (error: Error) => void
    onRecordStart?: () => void
    onRecordReady?: (blob: Blob) => void
    onApprove?: (wav: Blob) => Promise<void>
    onCancel?: () => void
    onProgressMs?: (ms: number) => void
    onPlaybackPlay?: () => void
    onPlaybackPause?: () => void
    onPlaybackFinish?: () => void
  }

  const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
    <ThemeProvider theme={mockTheme.emotion}>{children}</ThemeProvider>
  )

  beforeEach(() => {
    mockContainerRef = { current: document.createElement("div") }
    mockEvents = {
      onPermissionDenied: vi.fn(),
      onError: vi.fn(),
      onRecordStart: vi.fn(),
      onRecordReady: vi.fn(),
      onApprove: vi.fn().mockResolvedValue(undefined),
      onCancel: vi.fn(),
      onProgressMs: vi.fn(),
      onPlaybackPlay: vi.fn(),
      onPlaybackPause: vi.fn(),
      onPlaybackFinish: vi.fn(),
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should initialize with idle state", () => {
    const { result } = renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: mockEvents,
        }),
      { wrapper }
    )

    expect(result.current.state).toBe("idle")
  })

  it("should have playback methods", () => {
    const { result } = renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: mockEvents,
        }),
      { wrapper }
    )

    expect(result.current.playback).toBeDefined()
    expect(typeof result.current.playback.isPlaying).toBe("function")
    expect(typeof result.current.playback.play).toBe("function")
    expect(typeof result.current.playback.pause).toBe("function")
    expect(typeof result.current.playback.load).toBe("function")
    expect(typeof result.current.playback.getCurrentTimeMs).toBe("function")
    expect(typeof result.current.playback.getDurationMs).toBe("function")
  })

  it("should have control methods", () => {
    const { result } = renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: mockEvents,
        }),
      { wrapper }
    )

    expect(typeof result.current.start).toBe("function")
    expect(typeof result.current.stop).toBe("function")
    expect(typeof result.current.approve).toBe("function")
    expect(typeof result.current.cancel).toBe("function")
    expect(typeof result.current.setEventHandlers).toBe("function")
  })

  it("should update events via setEventHandlers", () => {
    const { result } = renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: mockEvents,
        }),
      { wrapper }
    )

    const newEvents = {
      onPermissionDenied: vi.fn(),
      onError: vi.fn(),
      onCancel: vi.fn(),
    }

    act(() => {
      result.current.setEventHandlers(newEvents)
    })

    // The updated handlers should now receive events instead of the originals.
    act(() => {
      result.current.cancel()
    })
    expect(newEvents.onCancel).toHaveBeenCalledTimes(1)
    expect(mockEvents.onCancel).not.toHaveBeenCalled()
  })

  it("should call cancel and update state on cancel()", () => {
    const { result } = renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: mockEvents,
        }),
      { wrapper }
    )

    act(() => {
      result.current.cancel()
    })

    expect(result.current.state).toBe("idle")
    expect(mockEvents.onCancel).toHaveBeenCalled()
  })

  it("should call onError when approving without recording", async () => {
    const { result } = renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: mockEvents,
        }),
      { wrapper }
    )

    await result.current.approve()

    expect(mockEvents.onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "No recorded audio to approve",
      })
    )
  })

  it("should return false for isPlaying when not playing", () => {
    const { result } = renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: mockEvents,
        }),
      { wrapper }
    )

    expect(result.current.playback.isPlaying()).toBe(false)
    expect(result.current.isPlaybackPlaying).toBe(false)
  })

  it("should return 0 for getCurrentTimeMs in initial state", () => {
    const { result } = renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: mockEvents,
        }),
      { wrapper }
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
      { wrapper }
    )

    expect(result.current.playback.getDurationMs()).toBe(0)
  })

  it("destroys WaveSurfer and Record backend on unmount", async () => {
    const mockWaveSurferInstance = {
      destroy: vi.fn(),
      on: vi.fn(),
      un: vi.fn(),
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
    const RecordPluginModule =
      await import("wavesurfer.js/dist/plugins/record")

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

    const { unmount } = renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: mockEvents,
        }),
      { wrapper }
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
    const onError = vi.fn().mockResolvedValue(undefined)
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
      { wrapper }
    )

    // Wait for initialization attempt and error to be reported
    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toContain(
      "WaveSurfer init failed"
    )
  })

  it("propagates playback events", async () => {
    const mockWaveSurferInstance = {
      destroy: vi.fn(),
      on: vi.fn(),
      un: vi.fn(),
      registerPlugin: vi.fn(),
      empty: vi.fn(),
      pause: vi.fn(),
    }

    const waveEventHandlers = new Map<string, (...args: unknown[]) => void>()
    mockWaveSurferInstance.on.mockImplementation(
      (event: string, handler: (...args: unknown[]) => void) => {
        waveEventHandlers.set(event, handler)
      }
    )

    const mockRecordPlugin = {
      destroy: vi.fn(),
      on: vi.fn(),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    }

    mockRecordPlugin.on.mockImplementation(() => {})

    const WaveSurferModule = await import("wavesurfer.js")
    const RecordPluginModule =
      await import("wavesurfer.js/dist/plugins/record")

    const createMock = WaveSurferModule.default.create as ReturnType<
      typeof vi.fn
    >
    createMock.mockReturnValue(mockWaveSurferInstance)

    const recordCreateMock = RecordPluginModule.default.create as ReturnType<
      typeof vi.fn
    >
    recordCreateMock.mockReturnValue(mockRecordPlugin)

    mockWaveSurferInstance.registerPlugin.mockReturnValue(mockRecordPlugin)

    const { result } = renderHook(
      () =>
        useWaveformController({
          containerRef: mockContainerRef,
          events: mockEvents,
        }),
      { wrapper }
    )

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    act(() => {
      waveEventHandlers.get("play")?.()
    })
    expect(mockEvents.onPlaybackPlay).toHaveBeenCalledTimes(1)
    expect(result.current.isPlaybackPlaying).toBe(true)

    act(() => {
      waveEventHandlers.get("pause")?.()
    })
    expect(mockEvents.onPlaybackPause).toHaveBeenCalledTimes(1)
    expect(result.current.isPlaybackPlaying).toBe(false)

    act(() => {
      waveEventHandlers.get("finish")?.()
    })
    expect(mockEvents.onPlaybackFinish).toHaveBeenCalledTimes(1)
    expect(result.current.isPlaybackPlaying).toBe(false)
  })

  describe("recording and playback flows", () => {
    type EventMap = Map<string, (...args: unknown[]) => void>
    // The mocked WaveSurfer and Record instances only expose vi mock methods.
    type MockedInstance = Record<string, ReturnType<typeof vi.fn>>

    let wsHandlers: EventMap
    let recordHandlers: EventMap
    let mockWaveSurfer: MockedInstance
    let mockRecordPlugin: MockedInstance

    const buildMocks = async (): Promise<void> => {
      wsHandlers = new Map()
      recordHandlers = new Map()

      mockWaveSurfer = {
        destroy: vi.fn(),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          wsHandlers.set(event, handler)
        }),
        un: vi.fn(),
        registerPlugin: vi.fn(),
        empty: vi.fn(),
        pause: vi.fn(),
        play: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue(undefined),
        setOptions: vi.fn(),
        seekTo: vi.fn(),
        getDuration: vi.fn().mockReturnValue(3),
        getCurrentTime: vi.fn().mockReturnValue(1),
      }

      mockRecordPlugin = {
        destroy: vi.fn(),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          recordHandlers.set(event, handler)
        }),
        startRecording: vi.fn().mockResolvedValue(undefined),
        stopRecording: vi.fn(),
      }

      mockWaveSurfer.registerPlugin.mockReturnValue(mockRecordPlugin)

      const WaveSurferModule = await import("wavesurfer.js")
      const RecordPluginModule =
        await import("wavesurfer.js/dist/plugins/record")
      ;(
        WaveSurferModule.default.create as ReturnType<typeof vi.fn>
      ).mockReturnValue(mockWaveSurfer)
      ;(
        RecordPluginModule.default.create as ReturnType<typeof vi.fn>
      ).mockReturnValue(mockRecordPlugin)
    }

    const renderInitialized = async (): Promise<
      RenderHookResult<
        ReturnType<typeof useWaveformController>,
        { events: typeof mockEvents }
      >
    > => {
      const view = renderHook(
        ({ events }) =>
          useWaveformController({
            containerRef: mockContainerRef,
            events,
          }),
        { wrapper, initialProps: { events: mockEvents } }
      )

      // Wait for the async dynamic import + WaveSurfer.create to finish.
      await waitFor(() => {
        expect(mockWaveSurfer.on).toHaveBeenCalled()
      })

      return view
    }

    beforeEach(async () => {
      // URL.createObjectURL/revokeObjectURL are used by WaveSurferPlayer.load
      // but are not implemented in jsdom.
      vi.stubGlobal("URL", {
        ...URL,
        createObjectURL: vi.fn(() => "blob:mock-url"),
        revokeObjectURL: vi.fn(),
      })
      await buildMocks()
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    const startRecording = async (result: {
      current: ReturnType<typeof useWaveformController>
    }): Promise<void> => {
      await act(async () => {
        await result.current.start()
      })
      // Simulate WaveSurfer emitting record-start so the backend marks itself
      // as recording (required for stop()/cancel() to operate).
      act(() => {
        recordHandlers.get("record-start")?.()
      })
    }

    it("transitions to recording state on start()", async () => {
      const { result } = await renderInitialized()

      await startRecording(result)

      expect(result.current.state).toBe("recording")
      expect(mockEvents.onRecordStart).toHaveBeenCalledTimes(1)
      expect(mockRecordPlugin.startRecording).toHaveBeenCalledTimes(1)
      expect(mockWaveSurfer.setOptions).toHaveBeenCalled()
    })

    it("does nothing when start() is called while already recording", async () => {
      const { result } = await renderInitialized()

      await startRecording(result)
      mockRecordPlugin.startRecording.mockClear()

      await act(async () => {
        await result.current.start()
      })

      expect(mockRecordPlugin.startRecording).not.toHaveBeenCalled()
      expect(result.current.state).toBe("recording")
    })

    it("forwards record progress to onProgressMs", async () => {
      await renderInitialized()

      act(() => {
        recordHandlers.get("record-progress")?.(1234)
      })

      expect(mockEvents.onProgressMs).toHaveBeenCalledWith(1234)
    })

    it("reports permission denial and returns to idle", async () => {
      const { result } = await renderInitialized()

      const permissionError = Object.assign(new Error("denied"), {
        name: "NotAllowedError",
      })
      mockRecordPlugin.startRecording.mockRejectedValueOnce(permissionError)

      await act(async () => {
        await expect(result.current.start()).rejects.toThrow(
          "Microphone permission denied"
        )
      })

      expect(mockEvents.onPermissionDenied).toHaveBeenCalledTimes(1)
      // Permission denial must be distinct from a generic error.
      expect(mockEvents.onError).not.toHaveBeenCalled()
      expect(result.current.state).toBe("idle")
    })

    it("reports generic recording errors and returns to idle", async () => {
      const { result } = await renderInitialized()

      mockRecordPlugin.startRecording.mockRejectedValueOnce(
        new Error("device busy")
      )

      await act(async () => {
        await expect(result.current.start()).rejects.toThrow("device busy")
      })

      expect(mockEvents.onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "device busy" })
      )
      // A generic failure must not be misreported as a permission denial.
      expect(mockEvents.onPermissionDenied).not.toHaveBeenCalled()
      expect(result.current.state).toBe("idle")
    })

    it("throws when stop() is called without an active recording", async () => {
      const { result } = await renderInitialized()

      await expect(result.current.stop()).rejects.toThrow(
        "Not currently recording"
      )
    })

    it("completes a full record then stop then playback cycle", async () => {
      const { result } = await renderInitialized()

      await startRecording(result)

      const stopPromise = result.current.stop()

      // Resolve the recording with a non-empty blob, then flush pending work so
      // stop()'s load() flow registers the ready resolver before we fire "ready".
      await act(async () => {
        recordHandlers.get("record-end")?.(
          new Blob(["audio"], { type: "audio/webm" })
        )
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      // Signal that the loaded audio is ready for playback.
      let stopResult: StopResult | undefined
      await act(async () => {
        wsHandlers.get("ready")?.()
        stopResult = await stopPromise
      })

      expect(result.current.state).toBe("idle")
      expect(stopResult?.blob).toBeInstanceOf(Blob)
      expect(stopResult?.meta.durationMs).toBe(3000)
      expect(mockEvents.onRecordReady).toHaveBeenCalledTimes(1)
      expect(mockWaveSurfer.seekTo).toHaveBeenCalledWith(0)
      // A successful cycle must not surface any error.
      expect(mockEvents.onError).not.toHaveBeenCalled()
    })

    it("reports errors thrown while stopping and returns a fallback result", async () => {
      const { result } = await renderInitialized()

      await startRecording(result)

      const stopPromise = result.current.stop()

      let fallback: StopResult | undefined
      await act(async () => {
        recordHandlers.get("record-end")?.(
          new Blob([], { type: "audio/webm" })
        )
        fallback = await stopPromise
      })

      expect(fallback?.blob).toBeInstanceOf(Blob)
      expect(fallback?.meta.size).toBe(0)
      expect(mockEvents.onError).toHaveBeenCalled()
      expect(result.current.state).toBe("idle")
    })

    it("plays and pauses through the playback controls", async () => {
      const { result } = await renderInitialized()

      await act(async () => {
        await result.current.playback.play()
      })
      expect(mockWaveSurfer.play).toHaveBeenCalledTimes(1)

      act(() => {
        result.current.playback.pause()
      })
      expect(mockWaveSurfer.pause).toHaveBeenCalled()
    })

    it("loads a source and enters playback mode via playback.load", async () => {
      const { result } = await renderInitialized()

      await act(async () => {
        await result.current.playback.load(new Blob(["audio"]))
      })

      expect(mockWaveSurfer.load).toHaveBeenCalledWith("blob:mock-url")
      expect(mockWaveSurfer.seekTo).toHaveBeenCalledWith(0)
    })

    it("cancels an in-progress recording and resets the player", async () => {
      const { result } = await renderInitialized()

      await startRecording(result)

      act(() => {
        result.current.cancel()
      })

      expect(mockRecordPlugin.stopRecording).toHaveBeenCalled()
      expect(result.current.state).toBe("idle")
      expect(mockEvents.onCancel).toHaveBeenCalledTimes(1)
    })

    it("approves a provided blob and resets state", async () => {
      const { result } = await renderInitialized()

      await act(async () => {
        await result.current.approve(new Blob(["audio"]))
      })

      // The controller should encode with the default sample rate and forward
      // the resulting wav to onApprove.
      expect(encodeToWav).toHaveBeenCalledWith(expect.any(Blob), 16000)
      expect(mockEvents.onApprove).toHaveBeenCalledWith(expect.any(Blob))
      expect(result.current.state).toBe("idle")
      expect(mockEvents.onError).not.toHaveBeenCalled()
    })

    it("reports errors raised while approving", async () => {
      const { result } = await renderInitialized()

      vi.mocked(encodeToWav).mockRejectedValueOnce(new Error("encode failed"))

      await act(async () => {
        await result.current.approve(new Blob(["audio"]))
      })

      expect(mockEvents.onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "encode failed" })
      )
      expect(mockEvents.onApprove).not.toHaveBeenCalled()
    })

    it("reconfigures player events when the events prop changes", async () => {
      const { rerender } = await renderInitialized()

      const newEvents = { ...mockEvents, onPlaybackPlay: vi.fn() }
      rerender({ events: newEvents })

      // The freshly configured play handler should be wired up, and the
      // original handler should no longer receive events.
      act(() => {
        wsHandlers.get("play")?.()
      })
      expect(newEvents.onPlaybackPlay).toHaveBeenCalledTimes(1)
      expect(mockEvents.onPlaybackPlay).not.toHaveBeenCalled()
    })

    it("honors waveformPadding when creating the waveform", async () => {
      const WaveSurferModule = await import("wavesurfer.js")
      const createMock = vi.mocked(WaveSurferModule.default.create)

      const waveformPadding = 10
      renderHook(
        () =>
          useWaveformController({
            containerRef: mockContainerRef,
            events: mockEvents,
            waveformPadding,
          }),
        { wrapper }
      )

      await waitFor(() => {
        expect(createMock).toHaveBeenCalled()
      })
      // The height should be the full element height minus padding on both sides.
      const options = createMock.mock.calls[0][0]
      const expectedHeight =
        convertRemToPx(mockTheme.emotion.sizes.largestElementHeight) -
        2 * waveformPadding
      expect(options.height).toBe(expectedHeight)
    })

    it("skips initialization and rejects playback when container is missing", async () => {
      const emptyContainerRef = { current: null }
      const { result } = renderHook(
        () =>
          useWaveformController({
            containerRef: emptyContainerRef,
            events: mockEvents,
          }),
        { wrapper }
      )

      await expect(result.current.playback.play()).rejects.toThrow(
        "Player not initialized"
      )
      await expect(
        result.current.playback.load(new Blob(["x"]))
      ).rejects.toThrow("Player not initialized")
    })
  })
})
