/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
 * Converts a file Blob (audio/video) to a WAV Blob.
 * @param fileBlob - The input file as a Blob.
 * @returns - A Promise resolving with the WAV file as a Blob.
 */
async function convertFileToWav(fileBlob: Blob): Promise<Blob | undefined> {
  const audioContext = new window.AudioContext()
  const arrayBuffer = await fileBlob.arrayBuffer()

  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  } catch (error) {
    console.error("Error decoding audio data:", error)
    return undefined // Return undefined if decoding fails
  }

  const numOfChan = audioBuffer.numberOfChannels
  const length = audioBuffer.length * numOfChan * 2 + 44
  const buffer = new ArrayBuffer(length)
  const view = new DataView(buffer)
  let offset = 0

  const writeString = (
    view: DataView,
    offset: number,
    string: string
  ): void => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  // Write WAV header
  writeString(view, offset, "RIFF")
  offset += 4
  view.setUint32(offset, length - 8, true) // Size of file minus RIFF header
  offset += 4
  writeString(view, offset, "WAVE")
  offset += 4
  writeString(view, offset, "fmt ")
  offset += 4
  view.setUint32(offset, 16, true) // PCM format
  offset += 4
  view.setUint16(offset, 1, true) // PCM
  offset += 2
  view.setUint16(offset, numOfChan, true) // Number of channels
  offset += 2
  view.setUint32(offset, audioBuffer.sampleRate, true) // Sample rate
  offset += 4
  view.setUint32(offset, audioBuffer.sampleRate * numOfChan * 2, true) // Byte rate
  offset += 4
  view.setUint16(offset, numOfChan * 2, true) // Block align
  offset += 2
  view.setUint16(offset, 16, true) // Bits per sample (16-bit)
  offset += 2
  writeString(view, offset, "data")
  offset += 4
  view.setUint32(offset, audioBuffer.length * numOfChan * 2, true) // Data chunk size
  offset += 4

  // Write PCM data
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

  const wavArray = new Uint8Array(buffer)
  return new Blob([wavArray], { type: "audio/wav" })
}

export default convertFileToWav
