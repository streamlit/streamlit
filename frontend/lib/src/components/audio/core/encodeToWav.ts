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

/**
 * Encodes an audio blob to WAV format at specified sample rate, mono.
 * This function performs high-quality resampling using OfflineAudioContext.
 *
 * @param blob - The input audio blob (any format Web Audio API can decode)
 * @param targetSampleRate - Target sample rate (default: 16000 Hz for speech). If null, uses browser's native sample rate without resampling.
 * @returns Promise resolving to WAV Blob at specified sample rate, mono
 * @throws Error if encoding fails
 */
export async function encodeToWav(
  blob: Blob,
  targetSampleRate: number | null = 16000
): Promise<Blob> {
  if (!blob || blob.size === 0) {
    throw new Error("Invalid or empty blob provided")
  }

  if (!window.AudioContext) {
    throw new Error("AudioContext not supported in this browser")
  }

  const audioContext = new AudioContext()

  try {
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // If targetSampleRate is null, use the browser's native sample rate without resampling
    const effectiveTargetSampleRate =
      targetSampleRate ?? audioBuffer.sampleRate

    const monoBuffer = await resampleAndConvertToMono(
      audioBuffer,
      effectiveTargetSampleRate
    )

    return encodeAudioBufferToWav(monoBuffer, effectiveTargetSampleRate)
  } finally {
    void audioContext.close()
  }
}

/**
 * Resamples audio and converts to mono using OfflineAudioContext.
 * This provides professional-quality resampling with proper anti-aliasing.
 */
async function resampleAndConvertToMono(
  audioBuffer: AudioBuffer,
  targetSampleRate: number
): Promise<AudioBuffer> {
  const { duration, numberOfChannels, sampleRate } = audioBuffer
  const frameCount = Math.ceil(duration * targetSampleRate)

  if (!window.OfflineAudioContext) {
    throw new Error("OfflineAudioContext not supported")
  }

  const offlineContext = new OfflineAudioContext(
    1,
    frameCount,
    targetSampleRate
  )

  const source = offlineContext.createBufferSource()
  source.buffer = audioBuffer

  if (numberOfChannels > 1) {
    const splitter = offlineContext.createChannelSplitter(numberOfChannels)
    const merger = offlineContext.createChannelMerger(1)
    source.connect(splitter)

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const gainNode = offlineContext.createGain()
      gainNode.gain.value = 1 / numberOfChannels
      splitter.connect(gainNode, channel)
      gainNode.connect(merger, 0, 0)
    }

    merger.connect(offlineContext.destination)
  } else {
    source.connect(offlineContext.destination)
  }

  source.start(0)

  try {
    return await offlineContext.startRendering()
  } catch (error) {
    throw new Error(
      `Failed to resample audio from ${sampleRate}Hz to ${targetSampleRate}Hz: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

/**
 * Encodes an AudioBuffer as a 16-bit PCM WAV file.
 * Produces a standard RIFF WAVE file with proper headers.
 */
function encodeAudioBufferToWav(
  audioBuffer: AudioBuffer,
  sampleRate: number
): Blob {
  const HEADER_SIZE = 44
  const length = audioBuffer.length
  const arrayBufferLength = length * 2 + HEADER_SIZE
  const buffer = new ArrayBuffer(arrayBufferLength)
  const view = new DataView(buffer)
  const channelData = audioBuffer.getChannelData(0)

  const writeString = (offset: number, string: string): void => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, arrayBufferLength - 8, true)
  writeString(8, "WAVE")

  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)

  writeString(36, "data")
  view.setUint32(40, length * 2, true)

  let offset = HEADER_SIZE
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]))
    view.setInt16(offset, sample * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: "audio/wav" })
}
