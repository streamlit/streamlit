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

import React, { ReactElement } from "react"
import WavesurferPlayer from "@wavesurfer/react"
import WaveSurfer from "wavesurfer.js"

interface Props {
  setWavesurfer(wavesurfer: WaveSurfer): void
  setIsPlaying(isPlaying: boolean): void
  mediaBlobUrl: string | undefined
}

const WaveSurferVisualization = ({
  setWavesurfer,
  setIsPlaying,
  mediaBlobUrl,
}: Props): ReactElement => {
  const onReady = (ws: WaveSurfer) => {
    setWavesurfer(ws)
    setIsPlaying(false)
  }

  return (
    <WavesurferPlayer
      barWidth={2}
      barGap={2}
      height={120}
      waveColor="red"
      url={mediaBlobUrl}
      onReady={onReady}
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
    />
  )
}

export default WaveSurferVisualization
