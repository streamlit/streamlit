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

import { FFmpeg } from "@ffmpeg/ffmpeg"

/**
 * Converts any audio/video Blob to a WAV Blob using FFmpeg.
 * @param fileBlob - The input file as a Blob.
 * @returns - A Promise that resolves with the WAV file as a Blob.
 */
async function convertFileToWav(fileBlob: Blob): Promise<Blob | undefined> {
  const ffmpeg = new FFmpeg()

  try {
    // Load FFmpeg if it's not loaded already
    if (!ffmpeg.loaded) {
      await ffmpeg.load()
    }

    const inputArrayBuffer = await fileBlob.arrayBuffer()
    const inputUint8Array = new Uint8Array(inputArrayBuffer)

    // Guess the input file extension based on the Blob's MIME type
    const mimeType = fileBlob.type
    const extension = mimeType.split("/")[1] || "dat" // Fallback to ".dat" if unknown
    const inputFileName = `input.${extension}`

    // Write the input file to FFmpeg's virtual file system with the guessed extension
    ffmpeg.writeFile(inputFileName, inputUint8Array)

    // Convert the input file to WAV
    await ffmpeg.exec(["-i", inputFileName, "output.wav"])

    // Read the WAV file from FFmpeg's virtual file system
    const wavData = await ffmpeg.readFile("output.wav")
    const wavBlob = new Blob([wavData], { type: "audio/wav" })

    return wavBlob
  } catch (error) {
    console.error("Error converting file to WAV:", error)
    return undefined
  }
}

export default convertFileToWav
