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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import convertFileToWav from "./convertAudioToWav"

describe("convertAudioToWav", () => {
  let originalAudioContext: typeof AudioContext | undefined
  let originalOfflineAudioContext: typeof OfflineAudioContext | undefined

  // Helper function to create a blob with mocked arrayBuffer method
  const createMockBlob = (size = 100): Blob => {
    const testArrayBuffer = new ArrayBuffer(size)
    const blob = new Blob([testArrayBuffer], { type: "audio/wav" })
    // Mock the arrayBuffer method
    blob.arrayBuffer = vi.fn().mockResolvedValue(testArrayBuffer)
    return blob
  }

  beforeEach(() => {
    // Save original values
    originalAudioContext = window.AudioContext
    originalOfflineAudioContext = window.OfflineAudioContext

    // Clear console mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore original values
    if (originalAudioContext !== undefined) {
      window.AudioContext = originalAudioContext
    }
    if (originalOfflineAudioContext !== undefined) {
      window.OfflineAudioContext = originalOfflineAudioContext
    }
  })

  describe("error handling", () => {
    it("should return undefined for null blob", async () => {
      const result = await convertFileToWav(null as unknown as Blob)
      expect(result).toBeUndefined()
    })

    it("should return undefined for empty blob", async () => {
      const emptyBlob = new Blob([])
      const result = await convertFileToWav(emptyBlob)
      expect(result).toBeUndefined()
    })

    it("should handle AudioContext not being supported", async () => {
      // Remove AudioContext completely
      delete (window as Window & { AudioContext?: typeof AudioContext })
        .AudioContext

      const blob = createMockBlob()
      const result = await convertFileToWav(blob)
      expect(result).toBeUndefined()
    })

    it("should handle arrayBuffer() failure", async () => {
      const mockBlob = {
        size: 100,
        arrayBuffer: vi.fn().mockRejectedValue(new Error("Failed to read")),
        type: "audio/wav",
      } as unknown as Blob

      const mockClose = vi.fn()
      const MockAudioContext = vi.fn().mockImplementation(() => ({
        close: mockClose,
      }))
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext

      const result = await convertFileToWav(mockBlob)
      expect(result).toBeUndefined()
      expect(mockClose).toHaveBeenCalled()
    })

    it("should handle decodeAudioData failure", async () => {
      const mockClose = vi.fn()
      const mockDecodeAudioData = vi
        .fn()
        .mockRejectedValue(new Error("Decode failed"))

      const MockAudioContext = vi.fn().mockImplementation(() => ({
        close: mockClose,
        decodeAudioData: mockDecodeAudioData,
      }))
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext

      const blob = createMockBlob()

      const result = await convertFileToWav(blob)

      expect(result).toBeUndefined()
      expect(mockClose).toHaveBeenCalled()
    })
  })

  describe("resampling functionality", () => {
    const createMockAudioBuffer = (
      sampleRate: number,
      channels = 2,
      length = 100
    ): Partial<AudioBuffer> => ({
      sampleRate,
      numberOfChannels: channels,
      length,
      duration: length / sampleRate,
      getChannelData: vi.fn().mockImplementation((_channel: number) => {
        const data = new Float32Array(length)
        for (let i = 0; i < length; i++) {
          // Create a simple sine wave for testing
          data[i] = Math.sin((2 * Math.PI * i) / 10) * 0.5
        }
        return data
      }),
    })

    it("should not resample when target rate matches source rate", async () => {
      const mockAudioBuffer = createMockAudioBuffer(44100)
      const mockClose = vi.fn()
      const mockDecodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer)

      const MockAudioContext = vi.fn().mockImplementation(() => ({
        close: mockClose,
        decodeAudioData: mockDecodeAudioData,
      }))
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext

      const blob = createMockBlob()
      const result = await convertFileToWav(blob, 44100)

      expect(result).toBeInstanceOf(Blob)
      expect(result?.type).toBe("audio/wav")
      // OfflineAudioContext should not be used when no resampling is needed
      expect(window.OfflineAudioContext).toBeUndefined()
    })

    it.each([
      {
        sourceSampleRate: 22050,
        targetSampleRate: 44100,
        description: "upsample from 22kHz to 44.1kHz",
      },
      {
        sourceSampleRate: 48000,
        targetSampleRate: 16000,
        description: "downsample from 48kHz to 16kHz",
      },
      {
        sourceSampleRate: 16000,
        targetSampleRate: 48000,
        description: "upsample from 16kHz to 48kHz",
      },
      {
        sourceSampleRate: 44100,
        targetSampleRate: 22050,
        description: "downsample from 44.1kHz to 22kHz",
      },
      {
        sourceSampleRate: 8000,
        targetSampleRate: 44100,
        description: "upsample from 8kHz (telephony) to 44.1kHz",
      },
      {
        sourceSampleRate: 96000,
        targetSampleRate: 48000,
        description: "downsample from 96kHz (high-res) to 48kHz",
      },
    ])(
      "should resample audio: $description",
      async ({ sourceSampleRate, targetSampleRate }) => {
        const mockAudioBuffer = createMockAudioBuffer(sourceSampleRate)
        const mockResampledBuffer = createMockAudioBuffer(targetSampleRate)
        const mockClose = vi.fn()
        const mockDecodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer)

        const MockAudioContext = vi.fn().mockImplementation(() => ({
          close: mockClose,
          decodeAudioData: mockDecodeAudioData,
        }))
        window.AudioContext =
          MockAudioContext as unknown as typeof AudioContext

        const mockStartRendering = vi
          .fn()
          .mockResolvedValue(mockResampledBuffer)
        const mockCreateBufferSource = vi.fn().mockReturnValue({
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
        })

        const MockOfflineAudioContext = vi.fn().mockImplementation(() => ({
          createBufferSource: mockCreateBufferSource,
          destination: {},
          startRendering: mockStartRendering,
        }))
        window.OfflineAudioContext =
          MockOfflineAudioContext as unknown as typeof OfflineAudioContext

        const blob = createMockBlob()
        const result = await convertFileToWav(blob, targetSampleRate)

        expect(result).toBeInstanceOf(Blob)
        expect(result?.type).toBe("audio/wav")
        expect(MockOfflineAudioContext).toHaveBeenCalledWith(
          2,
          expect.any(Number),
          targetSampleRate
        )
        expect(mockStartRendering).toHaveBeenCalled()
      }
    )

    it("should fallback to original sample rate if OfflineAudioContext is not supported", async () => {
      const mockAudioBuffer = createMockAudioBuffer(22050)
      const mockClose = vi.fn()
      const mockDecodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer)

      const MockAudioContext = vi.fn().mockImplementation(() => ({
        close: mockClose,
        decodeAudioData: mockDecodeAudioData,
      }))
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext

      // Remove OfflineAudioContext completely
      delete (
        window as Window & { OfflineAudioContext?: typeof OfflineAudioContext }
      ).OfflineAudioContext

      const blob = createMockBlob()
      const result = await convertFileToWav(blob, 44100)

      expect(result).toBeInstanceOf(Blob)
      expect(result?.type).toBe("audio/wav")
      // Should return original audio without resampling
    })

    it("should handle startRendering failure gracefully", async () => {
      const mockAudioBuffer = createMockAudioBuffer(22050)
      const mockClose = vi.fn()
      const mockDecodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer)

      const MockAudioContext = vi.fn().mockImplementation(() => ({
        close: mockClose,
        decodeAudioData: mockDecodeAudioData,
      }))
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext

      const mockStartRendering = vi
        .fn()
        .mockRejectedValue(new Error("Rendering failed"))
      const mockCreateBufferSource = vi.fn().mockReturnValue({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
      })

      const MockOfflineAudioContext = vi.fn().mockImplementation(() => ({
        createBufferSource: mockCreateBufferSource,
        destination: {},
        startRendering: mockStartRendering,
      }))
      window.OfflineAudioContext =
        MockOfflineAudioContext as unknown as typeof OfflineAudioContext

      const blob = createMockBlob()
      const result = await convertFileToWav(blob, 44100)

      // Should fallback to original audio
      expect(result).toBeInstanceOf(Blob)
      expect(result?.type).toBe("audio/wav")
      expect(mockStartRendering).toHaveBeenCalled()
    })
  })

  describe("WAV encoding", () => {
    it("should handle mono audio correctly", async () => {
      const mockAudioBuffer = {
        sampleRate: 44100,
        numberOfChannels: 1,
        length: 100,
        duration: 100 / 44100,
        getChannelData: vi
          .fn()
          .mockReturnValue(new Float32Array(100).fill(0.5)),
      }

      const mockClose = vi.fn()
      const mockDecodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer)

      const MockAudioContext = vi.fn().mockImplementation(() => ({
        close: mockClose,
        decodeAudioData: mockDecodeAudioData,
      }))
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext

      const blob = createMockBlob()
      const result = await convertFileToWav(blob)

      expect(result).toBeInstanceOf(Blob)
      expect(result?.type).toBe("audio/wav")
      expect(result?.size).toBeGreaterThan(44) // WAV header is 44 bytes
    })

    it("should handle stereo audio correctly", async () => {
      const mockAudioBuffer = {
        sampleRate: 44100,
        numberOfChannels: 2,
        length: 100,
        duration: 100 / 44100,
        getChannelData: vi
          .fn()
          .mockImplementation((channel: number): Float32Array => {
            return new Float32Array(100).fill(channel === 0 ? 0.5 : -0.5)
          }),
      }

      const mockClose = vi.fn()
      const mockDecodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer)

      const MockAudioContext = vi.fn().mockImplementation(() => ({
        close: mockClose,
        decodeAudioData: mockDecodeAudioData,
      }))
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext

      const blob = createMockBlob()
      const result = await convertFileToWav(blob)

      expect(result).toBeInstanceOf(Blob)
      expect(result?.type).toBe("audio/wav")
      expect(result?.size).toBeGreaterThan(44) // WAV header is 44 bytes
    })

    it("should clamp audio samples that exceed [-1, 1] range", async () => {
      const mockAudioBuffer = {
        sampleRate: 44100,
        numberOfChannels: 1,
        length: 3,
        duration: 3 / 44100,
        getChannelData: vi
          .fn()
          .mockReturnValue(new Float32Array([2.0, -2.0, 0.5])),
      }

      const mockClose = vi.fn()
      const mockDecodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer)

      const MockAudioContext = vi.fn().mockImplementation(() => ({
        close: mockClose,
        decodeAudioData: mockDecodeAudioData,
      }))
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext

      const blob = createMockBlob()
      const result = await convertFileToWav(blob)

      expect(result).toBeInstanceOf(Blob)
      expect(result?.type).toBe("audio/wav")
      // Values should be clamped during encoding
      expect(result?.size).toBe(44 + 3 * 2) // 44 byte header + 3 samples * 2 bytes per sample
    })

    it("should use original sample rate when no target is specified", async () => {
      const mockAudioBuffer = {
        sampleRate: 22050,
        numberOfChannels: 1,
        length: 100,
        duration: 100 / 22050,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(100).fill(0)),
      }

      const mockClose = vi.fn()
      const mockDecodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer)

      const MockAudioContext = vi.fn().mockImplementation(() => ({
        close: mockClose,
        decodeAudioData: mockDecodeAudioData,
      }))
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext

      const blob = createMockBlob()
      const result = await convertFileToWav(blob)

      expect(result).toBeInstanceOf(Blob)
      expect(result?.type).toBe("audio/wav")
      // Should use original sample rate
    })
  })

  describe("different audio channel configurations", () => {
    it.each([
      { channels: 1, samples: 100, description: "mono audio" },
      { channels: 2, samples: 100, description: "stereo audio" },
      { channels: 4, samples: 50, description: "4-channel audio" },
      { channels: 6, samples: 25, description: "5.1 surround audio" },
    ])("should handle $description", async ({ channels, samples }) => {
      const mockAudioBuffer = {
        sampleRate: 44100,
        numberOfChannels: channels,
        length: samples,
        duration: samples / 44100,
        getChannelData: vi
          .fn()
          .mockImplementation((channel: number): Float32Array => {
            return new Float32Array(samples).fill(0.25 * channel)
          }),
      }

      const mockClose = vi.fn()
      const mockDecodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer)

      const MockAudioContext = vi.fn().mockImplementation(() => ({
        close: mockClose,
        decodeAudioData: mockDecodeAudioData,
      }))
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext

      const blob = createMockBlob()
      const result = await convertFileToWav(blob)

      expect(result).toBeInstanceOf(Blob)
      expect(result?.type).toBe("audio/wav")
      // WAV header is 44 bytes + (samples * channels * 2 bytes per sample)
      expect(result?.size).toBe(44 + samples * channels * 2)
      expect(mockAudioBuffer.getChannelData).toHaveBeenCalledTimes(
        samples * channels
      )
    })

    it.each([
      { length: 1, description: "single sample" },
      { length: 10, description: "very short buffer" },
      { length: 100000, description: "large buffer" },
    ])("should handle $description", async ({ length }) => {
      const mockAudioBuffer = {
        sampleRate: 44100,
        numberOfChannels: 1,
        length,
        duration: length / 44100,
        getChannelData: vi
          .fn()
          .mockReturnValue(new Float32Array(length).fill(0.5)),
      }

      const mockClose = vi.fn()
      const mockDecodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer)

      const MockAudioContext = vi.fn().mockImplementation(() => ({
        close: mockClose,
        decodeAudioData: mockDecodeAudioData,
      }))
      window.AudioContext = MockAudioContext as unknown as typeof AudioContext

      const blob = createMockBlob()
      const result = await convertFileToWav(blob)

      expect(result).toBeInstanceOf(Blob)
      expect(result?.type).toBe("audio/wav")
      expect(result?.size).toBe(44 + length * 2) // 44 byte header + length * 2 bytes
    })
  })
})
