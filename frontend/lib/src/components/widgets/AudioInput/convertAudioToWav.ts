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
// code in this file was adapted from recorder.js library

import { logError } from "@streamlit/lib/src/util/log"

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
    logError(error)
    return undefined // Return undefined if decoding fails
  }

  const numOfChan = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const length = audioBuffer.length * numOfChan * 2 + 44
  const buffer = new ArrayBuffer(length)
  const view = new DataView(buffer)

  // WAV header metadata
  const wavHeader = {
    0: { type: "string", value: "RIFF" },
    4: { type: "uint32", value: 36 + audioBuffer.length * 2 * numOfChan },
    8: { type: "string", value: "WAVE" },
    12: { type: "string", value: "fmt " },
    16: { type: "uint32", value: 16 }, // PCM format
    20: { type: "uint16", value: 1 }, // PCM format code
    22: { type: "uint16", value: numOfChan }, // Number of channels
    24: { type: "uint32", value: sampleRate }, // Sample rate
    28: { type: "uint32", value: sampleRate * numOfChan * 2 }, // Byte rate
    32: { type: "uint16", value: numOfChan * 2 }, // Block align
    34: { type: "uint16", value: 16 }, // Bits per sample (16-bit)
    36: { type: "string", value: "data" },
    40: { type: "uint32", value: audioBuffer.length * numOfChan * 2 }, // Data chunk length
  }

  // Write WAV header from the dictionary using Object.entries
  Object.entries(wavHeader).forEach(([offset, { type, value }]) => {
    const intOffset = parseInt(offset, 10)
    if (type === "string") {
      writeString(view, intOffset, value as string)
    } else if (type === "uint32") {
      view.setUint32(intOffset, value as number, true)
    } else if (type === "uint16") {
      view.setUint16(intOffset, value as number, true)
    }
  })

  // Write PCM data
  for (let channel = 0; channel < numOfChan; channel++) {
    floatTo16BitPCM(
      view,
      44 + channel * audioBuffer.length * 2,
      audioBuffer.getChannelData(channel)
    )
  }

  const wavArray = new Uint8Array(buffer)
  return new Blob([wavArray], { type: "audio/wav" })
}

/**
 * Converts a floating-point sample array into 16-bit PCM format.
 * @param output - The DataView to write to.
 * @param offset - The starting offset in the DataView.
 * @param input - The Float32Array with the input samples.
 */
function floatTo16BitPCM(
  output: DataView,
  offset: number,
  input: Float32Array
): void {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
}

/**
 * Writes a string to a DataView at the specified offset.
 * @param view - The DataView to write to.
 * @param offset - The starting offset in the DataView.
 * @param string - The string to write.
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

export default convertFileToWav
