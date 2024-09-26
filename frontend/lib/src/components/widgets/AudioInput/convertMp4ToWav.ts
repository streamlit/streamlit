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
 * Converts an MP4 Blob to a WAV Blob using FFmpeg.
 * @param mp4Blob - The input MP4 file as a Blob.
 * @returns - A Promise that resolves with the WAV file as a Blob.
 */
async function convertMp4ToWav(mp4Blob: Blob): Promise<Blob | undefined> {
  const ffmpeg = new FFmpeg()

  try {
    // load FFmpeg if it's not loaded already
    if (!ffmpeg.loaded) {
      await ffmpeg.load()
    }

    const mp4ArrayBuffer = await mp4Blob.arrayBuffer()
    const mp4Uint8Array = new Uint8Array(mp4ArrayBuffer)

    // write the MP4 file to FFmpeg's virtual file system
    ffmpeg.writeFile("input.mp4", mp4Uint8Array)

    // conversion from MP4 to WAV
    await ffmpeg.exec(["-i", "input.mp4", "output.wav"])

    // read the WAV file from FFmpeg's virtual file system
    const wavData = await ffmpeg.readFile("output.wav")
    const wavBlob = new Blob([wavData], { type: "audio/wav" })

    return wavBlob
  } catch (error) {
    console.error("Error converting MP4 to WAV:", error)
    return undefined
  }
}

export default convertMp4ToWav
