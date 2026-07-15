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

import { beforeEach, describe, expect, it, vi } from "vitest"
import type WaveSurfer from "wavesurfer.js"
import type RecordPlugin from "wavesurfer.js/dist/plugins/record"

import { WaveSurferRecordBackend } from "./WaveSurferRecordBackend"

interface MockRecordPlugin {
  on: ReturnType<typeof vi.fn>
  startRecording: ReturnType<typeof vi.fn>
  stopRecording: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
}

interface MockWaveSurfer {
  registerPlugin: ReturnType<typeof vi.fn>
}

interface MockRecordPluginClass {
  create: ReturnType<typeof vi.fn>
}

describe("WaveSurferRecordBackend", () => {
  let backend: WaveSurferRecordBackend
  let mockWaveSurfer: MockWaveSurfer
  let mockRecordPlugin: MockRecordPlugin
  let mockEventHandlers: Map<string, Array<(...args: unknown[]) => void>>
  let MockRecordPluginClass: MockRecordPluginClass

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
      backend.initialize(
        mockWaveSurfer as unknown as WaveSurfer,
        MockRecordPluginClass as unknown as typeof RecordPlugin
      )
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
      backend.initialize(
        mockWaveSurfer as unknown as WaveSurfer,
        MockRecordPluginClass as unknown as typeof RecordPlugin
      )
    ).toThrow("Microphone permission denied")
    expect(onPermissionDenied).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it("emits onError for non-permission failures in startRecording", async () => {
    const onError = vi.fn()
    backend.setEventHandlers({ onError })
    backend.initialize(
      mockWaveSurfer as unknown as WaveSurfer,
      MockRecordPluginClass as unknown as typeof RecordPlugin
    )

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
    backend.initialize(
      mockWaveSurfer as unknown as WaveSurfer,
      MockRecordPluginClass as unknown as typeof RecordPlugin
    )

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
    backend.initialize(
      mockWaveSurfer as unknown as WaveSurfer,
      MockRecordPluginClass as unknown as typeof RecordPlugin
    )

    mockRecordPlugin.startRecording.mockRejectedValueOnce("String error")

    await expect(backend.startRecording()).rejects.toThrow("String error")
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toBe("String error")
  })

  it("retries without constraints when device rejects sample rate", async () => {
    backend.initialize(
      mockWaveSurfer as unknown as WaveSurfer,
      MockRecordPluginClass as unknown as typeof RecordPlugin
    )

    const constraintError = new Error("Overconstrained")
    constraintError.name = "OverconstrainedError"
    mockRecordPlugin.startRecording
      .mockRejectedValueOnce(constraintError)
      .mockResolvedValueOnce(undefined)

    await expect(backend.startRecording()).resolves.toBeUndefined()

    expect(mockRecordPlugin.startRecording).toHaveBeenCalledTimes(2)
    expect(mockRecordPlugin.startRecording.mock.calls[0][0]).toEqual({
      sampleRate: { ideal: 16000 },
    })
    expect(mockRecordPlugin.startRecording.mock.calls[1][0]).toBeUndefined()

    mockRecordPlugin.startRecording.mockClear()
    await expect(backend.startRecording()).resolves.toBeUndefined()
    expect(mockRecordPlugin.startRecording).toHaveBeenCalledTimes(1)
    expect(mockRecordPlugin.startRecording.mock.calls[0][0]).toBeUndefined()
  })

  it("cleans up resources on destroy", async () => {
    backend.initialize(
      mockWaveSurfer as unknown as WaveSurfer,
      MockRecordPluginClass as unknown as typeof RecordPlugin
    )

    // Start recording
    await backend.startRecording()
    const recordStartHandlers = mockEventHandlers.get("record-start")
    recordStartHandlers?.[0]() // Simulate recording started

    backend.destroy()

    expect(mockRecordPlugin.stopRecording).toHaveBeenCalled()
    expect(mockRecordPlugin.destroy).toHaveBeenCalled()
  })

  it("forwards record-progress events to the controller", () => {
    const onRecordProgress = vi.fn()
    backend.setEventHandlers({ onRecordProgress })
    backend.initialize(
      mockWaveSurfer as unknown as WaveSurfer,
      MockRecordPluginClass as unknown as typeof RecordPlugin
    )

    const progressHandlers = mockEventHandlers.get("record-progress")
    expect(progressHandlers).toBeDefined()

    progressHandlers?.[0](1234)

    expect(onRecordProgress).toHaveBeenCalledTimes(1)
    expect(onRecordProgress).toHaveBeenCalledWith(1234)
  })

  it("forwards record-start events to the controller", () => {
    const onRecordStart = vi.fn()
    backend.setEventHandlers({ onRecordStart })
    backend.initialize(
      mockWaveSurfer as unknown as WaveSurfer,
      MockRecordPluginClass as unknown as typeof RecordPlugin
    )

    mockEventHandlers.get("record-start")?.[0]()

    expect(onRecordStart).toHaveBeenCalledTimes(1)
  })

  const startAndActivateRecording = async (): Promise<void> => {
    backend.initialize(
      mockWaveSurfer as unknown as WaveSurfer,
      MockRecordPluginClass as unknown as typeof RecordPlugin
    )
    await backend.startRecording()
    mockEventHandlers.get("record-start")?.[0]()
  }

  it("resolves stopRecording with the recorded blob", async () => {
    const onRecordEnd = vi.fn()
    backend.setEventHandlers({ onRecordEnd })
    await startAndActivateRecording()

    const recordedBlob = new Blob(["audio-data"], { type: "audio/webm" })
    const stopPromise = backend.stopRecording()
    mockEventHandlers.get("record-end")?.[0](recordedBlob)

    await expect(stopPromise).resolves.toBe(recordedBlob)
    expect(mockRecordPlugin.stopRecording).toHaveBeenCalledTimes(1)
    expect(onRecordEnd).toHaveBeenCalledWith(recordedBlob)
  })

  it("rejects stopRecording and emits onError when the recording is empty", async () => {
    const onError = vi.fn()
    backend.setEventHandlers({ onError })
    await startAndActivateRecording()

    const emptyBlob = new Blob([])
    const stopPromise = backend.stopRecording()
    mockEventHandlers.get("record-end")?.[0](emptyBlob)

    await expect(stopPromise).rejects.toThrow("Invalid or empty recording")
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0].message).toBe("Invalid or empty recording")
  })

  it("throws when stopping while not recording", async () => {
    backend.initialize(
      mockWaveSurfer as unknown as WaveSurfer,
      MockRecordPluginClass as unknown as typeof RecordPlugin
    )

    await expect(backend.stopRecording()).rejects.toThrow(
      "Not currently recording"
    )
  })

  it("throws when starting before initialization", async () => {
    const uninitialized = new WaveSurferRecordBackend()

    await expect(uninitialized.startRecording()).rejects.toThrow(
      "Record plugin not initialized"
    )
  })

  it("ignores startRecording when already recording", async () => {
    await startAndActivateRecording()
    mockRecordPlugin.startRecording.mockClear()

    await expect(backend.startRecording()).resolves.toBeUndefined()
    expect(mockRecordPlugin.startRecording).not.toHaveBeenCalled()
  })

  it("handles record-end without a pending stop request", () => {
    const onRecordEnd = vi.fn()
    backend.setEventHandlers({ onRecordEnd })
    backend.initialize(
      mockWaveSurfer as unknown as WaveSurfer,
      MockRecordPluginClass as unknown as typeof RecordPlugin
    )
    mockEventHandlers.get("record-start")?.[0]()

    const recordedBlob = new Blob(["audio-data"])
    expect(() =>
      mockEventHandlers.get("record-end")?.[0](recordedBlob)
    ).not.toThrow()
    expect(onRecordEnd).toHaveBeenCalledWith(recordedBlob)
  })
})
