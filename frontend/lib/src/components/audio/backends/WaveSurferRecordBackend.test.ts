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

import { WaveSurferRecordBackend } from "./WaveSurferRecordBackend"

describe("WaveSurferRecordBackend", () => {
  let backend: WaveSurferRecordBackend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWaveSurfer: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRecordPlugin: any
  let mockEventHandlers: Map<string, Array<(...args: unknown[]) => void>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let MockRecordPluginClass: any

  beforeEach(() => {
    mockEventHandlers = new Map()

    mockRecordPlugin = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!mockEventHandlers.has(event)) {
          mockEventHandlers.set(event, [])
        }
        const handlers = mockEventHandlers.get(event)
        if (handlers) {
          handlers.push(handler)
        }
      }),
      startRecording: vi.fn().mockResolvedValue(undefined),
      stopRecording: vi.fn(),
      destroy: vi.fn(),
    }

    mockWaveSurfer = {
      registerPlugin: vi.fn().mockReturnValue(mockRecordPlugin),
    }

    MockRecordPluginClass = {
      create: vi.fn().mockReturnValue(mockRecordPlugin),
    }

    backend = new WaveSurferRecordBackend({ sampleRate: 16000 })
  })

  it("emits onError for non-permission failures in initialize", () => {
    const onError = vi.fn()
    backend.setEventHandlers({ onError })

    mockWaveSurfer.registerPlugin.mockImplementationOnce(() => {
      throw new Error("Plugin load failed")
    })

    expect(() =>
      backend.initialize(mockWaveSurfer, MockRecordPluginClass)
    ).toThrow("Plugin load failed")
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toBe("Plugin load failed")
  })

  it("emits onPermissionDenied for permission errors in initialize", () => {
    const onPermissionDenied = vi.fn()
    const onError = vi.fn()
    backend.setEventHandlers({ onPermissionDenied, onError })

    const permissionError = new Error("Permission denied")
    permissionError.name = "NotAllowedError"

    mockWaveSurfer.registerPlugin.mockImplementationOnce(() => {
      throw permissionError
    })

    expect(() =>
      backend.initialize(mockWaveSurfer, MockRecordPluginClass)
    ).toThrow("Microphone permission denied")
    expect(onPermissionDenied).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it("emits onError for non-permission failures in startRecording", async () => {
    const onError = vi.fn()
    backend.setEventHandlers({ onError })
    backend.initialize(mockWaveSurfer, MockRecordPluginClass)

    mockRecordPlugin.startRecording.mockRejectedValueOnce(
      new Error("Device busy")
    )

    await expect(backend.startRecording()).rejects.toThrow("Device busy")
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0].message).toBe("Device busy")
  })

  it("emits onPermissionDenied for permission errors in startRecording", async () => {
    const onPermissionDenied = vi.fn()
    const onError = vi.fn()
    backend.setEventHandlers({ onPermissionDenied, onError })
    backend.initialize(mockWaveSurfer, MockRecordPluginClass)

    const permissionError = new Error("Permission denied")
    permissionError.name = "PermissionDeniedError"

    mockRecordPlugin.startRecording.mockRejectedValueOnce(permissionError)

    await expect(backend.startRecording()).rejects.toThrow(
      "Microphone permission denied"
    )
    expect(onPermissionDenied).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it("handles non-Error objects in catch blocks", async () => {
    const onError = vi.fn()
    backend.setEventHandlers({ onError })
    backend.initialize(mockWaveSurfer, MockRecordPluginClass)

    mockRecordPlugin.startRecording.mockRejectedValueOnce("String error")

    await expect(backend.startRecording()).rejects.toThrow("String error")
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toBe("String error")
  })

  it("cleans up resources on destroy", async () => {
    backend.initialize(mockWaveSurfer, MockRecordPluginClass)

    // Start recording
    await backend.startRecording()
    const recordStartHandlers = mockEventHandlers.get("record-start")
    recordStartHandlers?.[0]() // Simulate recording started

    backend.destroy()

    expect(mockRecordPlugin.stopRecording).toHaveBeenCalled()
    expect(mockRecordPlugin.destroy).toHaveBeenCalled()
  })
})
