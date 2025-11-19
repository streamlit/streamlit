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

import { describe, expect, it, vi } from "vitest"

import { encodeToWav } from "./encodeToWav"

describe("encodeToWav", () => {
  it("should reject with an error for empty blob", async () => {
    const emptyBlob = new Blob([])
    await expect(encodeToWav(emptyBlob)).rejects.toThrow(
      "Invalid or empty blob provided"
    )
  })

  it("should produce a WAV file with correct properties", async () => {
    const mockAudioBuffer = {
      length: 16000,
      sampleRate: 48000,
      numberOfChannels: 1,
      duration: 1,
      getChannelData: vi.fn(() => new Float32Array(16000)),
    }

    const mockOfflineContext = {
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
      })),
      createChannelMerger: vi.fn(() => ({
        connect: vi.fn(),
      })),
      createChannelSplitter: vi.fn(),
      createGain: vi.fn(),
      destination: {},
      startRendering: vi.fn(() => Promise.resolve(mockAudioBuffer)),
    }

    const mockAudioContext = {
      decodeAudioData: vi.fn(() => Promise.resolve(mockAudioBuffer)),
      close: vi.fn(),
    }

    global.AudioContext = vi.fn(
      () => mockAudioContext
    ) as unknown as typeof AudioContext
    global.OfflineAudioContext = vi.fn(
      () => mockOfflineContext
    ) as unknown as typeof OfflineAudioContext

    const testArrayBuffer = new ArrayBuffer(100)
    const testBlob = {
      arrayBuffer: vi.fn(() => Promise.resolve(testArrayBuffer)),
      size: 100,
      type: "audio/webm",
    } as unknown as Blob
    const wavBlob = await encodeToWav(testBlob, 16000)

    expect(wavBlob).toBeInstanceOf(Blob)
    expect(wavBlob.type).toBe("audio/wav")
    // Verify that the correct sample rate was used
    expect(mockOfflineContext.startRendering).toHaveBeenCalled()
    expect(global.OfflineAudioContext).toHaveBeenCalledWith(
      1,
      expect.any(Number),
      16000
    )
  })

  it("should handle AudioContext not supported", async () => {
    const originalAudioContext = global.AudioContext
    global.AudioContext = undefined as unknown as typeof AudioContext

    const testBlob = new Blob(["test"], { type: "audio/webm" })
    await expect(encodeToWav(testBlob)).rejects.toThrow(
      "AudioContext not supported in this browser"
    )

    global.AudioContext = originalAudioContext
  })

  it("should handle OfflineAudioContext not supported", async () => {
    const mockAudioBuffer = {
      length: 16000,
      sampleRate: 48000,
      numberOfChannels: 2,
      duration: 1,
      getChannelData: vi.fn(() => new Float32Array(16000)),
    }

    const mockAudioContext = {
      decodeAudioData: vi.fn(() => Promise.resolve(mockAudioBuffer)),
      close: vi.fn(),
    }

    global.AudioContext = vi.fn(
      () => mockAudioContext
    ) as unknown as typeof AudioContext
    const originalOfflineAudioContext = global.OfflineAudioContext
    global.OfflineAudioContext =
      undefined as unknown as typeof OfflineAudioContext

    const testArrayBuffer = new ArrayBuffer(100)
    const testBlob = {
      arrayBuffer: vi.fn(() => Promise.resolve(testArrayBuffer)),
      size: 100,
      type: "audio/webm",
    } as unknown as Blob
    await expect(encodeToWav(testBlob)).rejects.toThrow(
      "OfflineAudioContext not supported"
    )

    global.OfflineAudioContext = originalOfflineAudioContext
  })

  it("averages channels when resampling to mono", async () => {
    const mockAudioBuffer = {
      length: 16000,
      sampleRate: 44100,
      numberOfChannels: 2,
      duration: 1,
      getChannelData: vi.fn(() => new Float32Array(16000)),
    }

    const sourceConnect = vi.fn()
    const mockSource = {
      buffer: null,
      connect: sourceConnect,
      start: vi.fn(),
    } as unknown as AudioBufferSourceNode

    const splitterConnect = vi.fn()
    const mockSplitter = {
      connect: splitterConnect,
    } as unknown as ChannelSplitterNode

    const gainNodeSpies: Array<{
      node: GainNode
      gainParam: { value: number }
      connect: ReturnType<typeof vi.fn>
    }> = []

    const createGain = vi.fn(() => {
      const gainParam = { value: 0 }
      const connect = vi.fn()
      const node = { gain: gainParam, connect } as unknown as GainNode
      gainNodeSpies.push({ node, gainParam, connect })
      return node
    })

    const mergerConnect = vi.fn()
    const mockMerger = {
      connect: mergerConnect,
    } as unknown as ChannelMergerNode

    const mockOfflineContext = {
      createBufferSource: vi.fn(() => mockSource),
      createChannelSplitter: vi.fn(() => mockSplitter),
      createChannelMerger: vi.fn(() => mockMerger),
      createGain,
      destination: {},
      startRendering: vi.fn(() => Promise.resolve(mockAudioBuffer)),
    }

    const mockAudioContext = {
      decodeAudioData: vi.fn(() => Promise.resolve(mockAudioBuffer)),
      close: vi.fn(),
    }

    const originalAudioContext = global.AudioContext
    const originalOfflineAudioContext = global.OfflineAudioContext

    global.AudioContext = vi.fn(
      () => mockAudioContext
    ) as unknown as typeof AudioContext
    global.OfflineAudioContext = vi.fn(
      () => mockOfflineContext
    ) as unknown as typeof OfflineAudioContext

    const testArrayBuffer = new ArrayBuffer(100)
    const testBlob = {
      arrayBuffer: vi.fn(() => Promise.resolve(testArrayBuffer)),
      size: 100,
      type: "audio/webm",
    } as unknown as Blob

    await encodeToWav(testBlob, 16000)

    expect(sourceConnect).toHaveBeenCalledWith(mockSplitter)
    expect(createGain).toHaveBeenCalledTimes(2)
    expect(gainNodeSpies[0].gainParam.value).toBeCloseTo(0.5)
    expect(gainNodeSpies[1].gainParam.value).toBeCloseTo(0.5)
    expect(splitterConnect).toHaveBeenNthCalledWith(
      1,
      gainNodeSpies[0].node,
      0
    )
    expect(splitterConnect).toHaveBeenNthCalledWith(
      2,
      gainNodeSpies[1].node,
      1
    )
    expect(gainNodeSpies[0].connect).toHaveBeenCalledWith(mockMerger, 0, 0)
    expect(gainNodeSpies[1].connect).toHaveBeenCalledWith(mockMerger, 0, 0)
    expect(mergerConnect).toHaveBeenCalledWith(mockOfflineContext.destination)

    global.AudioContext = originalAudioContext
    global.OfflineAudioContext = originalOfflineAudioContext
  })
})
