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

import { beforeEach, describe, expect, it, vi } from "vitest"

import { WaveSurferPlayer } from "./WaveSurferPlayer"

describe("WaveSurferPlayer", () => {
  let player: WaveSurferPlayer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWaveSurfer: any
  let mockEventHandlers: Map<string, Array<(...args: unknown[]) => void>>

  beforeEach(() => {
    mockEventHandlers = new Map()

    mockWaveSurfer = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!mockEventHandlers.has(event)) {
          mockEventHandlers.set(event, [])
        }
        const handlers = mockEventHandlers.get(event)
        if (handlers) {
          handlers.push(handler)
        }
      }),
      load: vi.fn().mockResolvedValue(undefined),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      getDuration: vi.fn().mockReturnValue(10),
      getCurrentTime: vi.fn().mockReturnValue(5),
      empty: vi.fn(),
    }

    player = new WaveSurferPlayer()
  })

  it("forwards WaveSurfer 'error' events to PlayerEvents.onError", () => {
    const onError = vi.fn()
    player.setEventHandlers({ onError })
    player.initialize(mockWaveSurfer)

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
    player.initialize(mockWaveSurfer)

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
    player.initialize(mockWaveSurfer)

    const timeUpdateHandlers = mockEventHandlers.get("timeupdate")
    expect(timeUpdateHandlers).toBeDefined()

    timeUpdateHandlers?.[0](5.5) // 5.5 seconds
    expect(onTimeUpdate).toHaveBeenCalledWith(5500) // 5500 ms
  })

  it("cleans up resources on destroy", async () => {
    player.initialize(mockWaveSurfer)

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

    // Restore
    global.URL.createObjectURL = originalCreateObjectURL
    global.URL.revokeObjectURL = originalRevokeObjectURL
  })
})
