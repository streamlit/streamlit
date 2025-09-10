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
// code in this file was adapted from recorder.js library

import { getLogger } from "loglevel"

const LOG = getLogger("convertAudioToWav")

/**
 * Converts an audio blob to WAV format with high-quality resampling.
 * Uses the Web Audio API's OfflineAudioContext for professional-quality
 * resampling with proper anti-aliasing filters instead of linear interpolation.
 *
 * @param fileBlob - The input audio blob to convert
 * @param targetSampleRate - Optional target sample rate for the output WAV file
 * @returns A Promise resolving to the WAV file as a Blob, or undefined on error
 */
async function convertFileToWav(
  fileBlob: Blob,
  targetSampleRate?: number
): Promise<Blob | undefined> {
  if (!fileBlob || fileBlob.size === 0) {
    LOG.error("Invalid or empty blob provided")
    return undefined
  }

  if (!window.AudioContext) {
    LOG.error("AudioContext not supported in this browser")
    return undefined
  }

  const audioContext = new AudioContext()

  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await fileBlob.arrayBuffer()
  } catch (error) {
    LOG.error("Failed to read blob as ArrayBuffer", error)
    void audioContext.close()
    return undefined
  }

  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  } catch (error) {
    LOG.error("Failed to decode audio data", error)
    void audioContext.close()
    return undefined
  } finally {
    void audioContext.close()
  }

  const outputSampleRate = targetSampleRate || audioBuffer.sampleRate

  if (outputSampleRate === audioBuffer.sampleRate) {
    LOG.debug(
      `No resampling needed, sample rate is already ${outputSampleRate}Hz`
    )
    return encodeWAV(audioBuffer, outputSampleRate)
  }

  LOG.debug(
    `Resampling from ${audioBuffer.sampleRate}Hz to ${outputSampleRate}Hz`
  )

  const { duration, numberOfChannels } = audioBuffer
  const frameCount = Math.ceil(duration * outputSampleRate)

  if (!window.OfflineAudioContext) {
    LOG.error(
      "OfflineAudioContext not supported, falling back to no resampling"
    )
    return encodeWAV(audioBuffer, audioBuffer.sampleRate)
  }

  const offlineContext = new OfflineAudioContext(
    numberOfChannels,
    frameCount,
    outputSampleRate
  )

  const source = offlineContext.createBufferSource()
  source.buffer = audioBuffer
  source.connect(offlineContext.destination)
  source.start(0)

  try {
    const resampledBuffer = await offlineContext.startRendering()
    return encodeWAV(resampledBuffer, outputSampleRate)
  } catch (error) {
    LOG.error("Failed to resample audio using OfflineAudioContext", error)
    return encodeWAV(audioBuffer, audioBuffer.sampleRate)
  }
}

/**
 * Encodes an AudioBuffer as a WAV file blob.
 * Separated from the main function for better modularity and testability.
 *
 * @param audioBuffer - The AudioBuffer containing the audio data to encode.
 *   - Each channel in the buffer will be interleaved in the output WAV file.
 *   - The buffer should contain PCM float samples in the range [-1, 1].
 * @param sampleRate - The sample rate (in Hz) to use for the WAV file header.
 *   - This determines the playback rate of the resulting WAV file.
 * @returns A Blob containing a WAV file encoded according to the RIFF/WAVE specification:
 *   - 44-byte header (RIFF, WAVE, fmt, data chunks)
 *   - 16-bit PCM samples, interleaved for multiple channels
 *   - Audio data starts at byte 44
 *   - MIME type is "audio/wav"
 */
function encodeWAV(audioBuffer: AudioBuffer, sampleRate: number): Blob {
  const HEADER_SIZE = 44
  const numOfChan = audioBuffer.numberOfChannels
  const length = audioBuffer.length * numOfChan * 2 + HEADER_SIZE
  const buffer = new ArrayBuffer(length)
  const view = new DataView(buffer)

  /**
   * Helper function to write a string to the DataView
   */
  const writeString = (offset: number, string: string): void => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  // Write RIFF chunk descriptor
  writeString(0, "RIFF")
  view.setUint32(4, length - 8, true) // File size minus RIFF header
  writeString(8, "WAVE")

  // Write fmt sub-chunk
  writeString(12, "fmt ")
  view.setUint32(16, 16, true) // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true) // AudioFormat (1 for PCM)
  view.setUint16(22, numOfChan, true) // NumChannels
  view.setUint32(24, sampleRate, true) // SampleRate
  view.setUint32(28, sampleRate * numOfChan * 2, true) // ByteRate
  view.setUint16(32, numOfChan * 2, true) // BlockAlign
  view.setUint16(34, 16, true) // BitsPerSample

  // Write data sub-chunk
  writeString(36, "data")
  view.setUint32(40, length - HEADER_SIZE, true) // SubChunk2Size

  // Write interleaved PCM samples
  let offset = HEADER_SIZE
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numOfChan; channel++) {
      const sample = Math.max(
        -1,
        Math.min(1, audioBuffer.getChannelData(channel)[i])
      )
      view.setInt16(offset, sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([buffer], { type: "audio/wav" })
}

export default convertFileToWav
