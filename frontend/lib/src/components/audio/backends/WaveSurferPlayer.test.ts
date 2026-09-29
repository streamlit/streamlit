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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type WaveSurfer from "wavesurfer.js"

import { WaveSurferPlayer } from "./WaveSurferPlayer"

type WaveSurferEventHandler = (...args: unknown[]) => void

interface WaveSurferMock {
  on: (event: string, handler: WaveSurferEventHandler) => void
  un: (event: string, handler: WaveSurferEventHandler) => void
  load: (url: string) => Promise<void>
  play: () => Promise<void>
  pause: () => void
  getDuration: () => number
  getCurrentTime: () => number
  seekTo: (progress: number) => void
  empty: () => void
}

describe("WaveSurferPlayer", () => {
  let player: WaveSurferPlayer
  let mockWaveSurfer: WaveSurferMock
  let mockWaveSurferInstance: WaveSurfer
  let mockEventHandlers: Map<string, WaveSurferEventHandler[]>

  beforeEach(() => {
    mockEventHandlers = new Map()

    mockWaveSurfer = {
      on: vi.fn<WaveSurferMock["on"]>((event, handler) => {
        if (!mockEventHandlers.has(event)) {
          mockEventHandlers.set(event, [])
        }
        const handlers = mockEventHandlers.get(event)
        if (handlers) {
          handlers.push(handler)
        }
      }),
      un: vi.fn<WaveSurferMock["un"]>((event, handler) => {
        const handlers = mockEventHandlers.get(event)
        if (!handlers) {
          return
        }
        mockEventHandlers.set(
          event,
          handlers.filter(storedHandler => storedHandler !== handler)
        )
      }),
      load: vi
        .fn<(url: string) => Promise<void>>()
        .mockResolvedValue(undefined),
      play: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      pause: vi.fn<() => void>(),
      getDuration: vi.fn<() => number>().mockReturnValue(10),
      getCurrentTime: vi.fn<() => number>().mockReturnValue(5),
      seekTo: vi.fn<(progress: number) => void>(),
      empty: vi.fn<() => void>(),
    }

    mockWaveSurferInstance = mockWaveSurfer as unknown as WaveSurfer

    player = new WaveSurferPlayer()
  })

  it("forwards WaveSurfer 'error' events to PlayerEvents.onError", () => {
    const onError = vi.fn()
    player.setEventHandlers({ onError })
    player.initialize(mockWaveSurferInstance)

    // Simulate WaveSurfer error event
    const errorHandlers = mockEventHandlers.get("error")
    expect(errorHandlers).toBeDefined()
    expect(errorHandlers?.length).toBe(1)

    // Test with string error
    errorHandlers?.[0]("decode failed")
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toBe("decode failed")

    // Test with Error object
    const testError = new Error("network error")
    errorHandlers?.[0](testError)
    expect(onError).toHaveBeenCalledTimes(2)
    expect(onError.mock.calls[1][0]).toBe(testError)
  })

  it("sets up all event listeners on initialization", () => {
    player.initialize(mockWaveSurferInstance)

    expect(mockWaveSurfer.on).toHaveBeenCalledWith(
      "timeupdate",
      expect.any(Function)
    )
    expect(mockWaveSurfer.on).toHaveBeenCalledWith(
      "pause",
      expect.any(Function)
    )
    expect(mockWaveSurfer.on).toHaveBeenCalledWith(
      "play",
      expect.any(Function)
    )
    expect(mockWaveSurfer.on).toHaveBeenCalledWith(
      "finish",
      expect.any(Function)
    )
    expect(mockWaveSurfer.on).toHaveBeenCalledWith(
      "ready",
      expect.any(Function)
    )
    expect(mockWaveSurfer.on).toHaveBeenCalledWith(
      "error",
      expect.any(Function)
    )
  })

  it("converts time to milliseconds in onTimeUpdate", () => {
    const onTimeUpdate = vi.fn()
    player.setEventHandlers({ onTimeUpdate })
    player.initialize(mockWaveSurferInstance)

    const timeUpdateHandlers = mockEventHandlers.get("timeupdate")
    expect(timeUpdateHandlers).toBeDefined()

    timeUpdateHandlers?.[0](5.5) // 5.5 seconds
    expect(onTimeUpdate).toHaveBeenCalledWith(5500) // 5500 ms
  })

  it("cleans up resources on destroy", async () => {
    player.initialize(mockWaveSurferInstance)

    // Mock URL methods
    const originalCreateObjectURL = global.URL.createObjectURL
    const originalRevokeObjectURL = global.URL.revokeObjectURL

    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:test")
    global.URL.revokeObjectURL = vi.fn()

    const testBlob = new Blob(["test"])
    await player.load(testBlob)
    player.destroy()

    expect(mockWaveSurfer.empty).toHaveBeenCalled()
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:test")
    expect(mockWaveSurfer.un).toHaveBeenCalled()

    // Restore
    global.URL.createObjectURL = originalCreateObjectURL
    global.URL.revokeObjectURL = originalRevokeObjectURL
  })

  it("forwards play, pause, finish and ready events and tracks playing state", () => {
    const onPlay = vi.fn()
    const onPause = vi.fn()
    const onFinish = vi.fn()
    const onReady = vi.fn()
    player.setEventHandlers({ onPlay, onPause, onFinish, onReady })
    player.initialize(mockWaveSurferInstance)

    expect(player.getIsPlaying()).toBe(false)

    mockEventHandlers.get("play")?.[0]()
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(player.getIsPlaying()).toBe(true)

    mockEventHandlers.get("pause")?.[0]()
    expect(onPause).toHaveBeenCalledTimes(1)
    expect(player.getIsPlaying()).toBe(false)

    // Playing again then finishing should reset the playing state.
    mockEventHandlers.get("play")?.[0]()
    expect(player.getIsPlaying()).toBe(true)
    mockEventHandlers.get("finish")?.[0]()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(player.getIsPlaying()).toBe(false)

    mockEventHandlers.get("ready")?.[0]()
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it("does not throw when events fire without registered handlers", () => {
    player.initialize(mockWaveSurferInstance)

    expect(() => {
      mockEventHandlers.get("play")?.[0]()
      mockEventHandlers.get("pause")?.[0]()
      mockEventHandlers.get("finish")?.[0]()
      mockEventHandlers.get("ready")?.[0]()
      mockEventHandlers.get("timeupdate")?.[0](1)
    }).not.toThrow()
    expect(player.getIsPlaying()).toBe(false)
  })

  describe("load", () => {
    let originalCreateObjectURL: typeof global.URL.createObjectURL
    let originalRevokeObjectURL: typeof global.URL.revokeObjectURL

    beforeEach(() => {
      originalCreateObjectURL = global.URL.createObjectURL
      originalRevokeObjectURL = global.URL.revokeObjectURL
      global.URL.createObjectURL = vi.fn().mockReturnValue("blob:test")
      global.URL.revokeObjectURL = vi.fn()
    })

    afterEach(() => {
      global.URL.createObjectURL = originalCreateObjectURL
      global.URL.revokeObjectURL = originalRevokeObjectURL
    })

    it("creates a blob URL when loading an ArrayBuffer", async () => {
      player.initialize(mockWaveSurferInstance)

      const buffer = new ArrayBuffer(8)
      await player.load(buffer)

      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1)
      expect(mockWaveSurfer.load).toHaveBeenCalledWith("blob:test")
    })

    it("loads a string URL directly without creating a blob URL", async () => {
      player.initialize(mockWaveSurferInstance)

      await player.load("https://example.com/audio.wav")

      expect(global.URL.createObjectURL).not.toHaveBeenCalled()
      expect(mockWaveSurfer.load).toHaveBeenCalledWith(
        "https://example.com/audio.wav"
      )
    })

    it("revokes the created blob URL and rethrows when load fails", async () => {
      player.initialize(mockWaveSurferInstance)
      mockWaveSurfer.load = vi
        .fn<(url: string) => Promise<void>>()
        .mockRejectedValueOnce(new Error("load failed"))

      await expect(player.load(new Blob(["data"]))).rejects.toThrow(
        "load failed"
      )
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:test")
    })

    it("throws when loading before initialization", async () => {
      await expect(player.load("audio.wav")).rejects.toThrow(
        "WaveSurfer not initialized"
      )
    })
  })

  describe("playback controls when initialized", () => {
    beforeEach(() => {
      player.initialize(mockWaveSurferInstance)
    })

    it("delegates play to WaveSurfer", async () => {
      await player.play()
      expect(mockWaveSurfer.play).toHaveBeenCalledTimes(1)
    })

    it("delegates pause to WaveSurfer", () => {
      player.pause()
      expect(mockWaveSurfer.pause).toHaveBeenCalledTimes(1)
    })

    it("converts duration and current time to milliseconds", () => {
      expect(player.getDuration()).toBe(10000)
      expect(player.getCurrentTime()).toBe(5000)
    })

    it("seeks to the start of the track", () => {
      player.seekToStart()
      expect(mockWaveSurfer.seekTo).toHaveBeenCalledWith(0)
    })
  })

  describe("controls before initialization", () => {
    it("throws when calling play", async () => {
      await expect(player.play()).rejects.toThrow("WaveSurfer not initialized")
    })

    it("returns safe defaults and no-ops for read/seek helpers", () => {
      expect(player.getDuration()).toBe(0)
      expect(player.getCurrentTime()).toBe(0)
      expect(() => player.pause()).not.toThrow()
      expect(() => player.seekToStart()).not.toThrow()
      expect(mockWaveSurfer.pause).not.toHaveBeenCalled()
      expect(mockWaveSurfer.seekTo).not.toHaveBeenCalled()
    })
  })
})
