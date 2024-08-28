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
import RecordPlugin from "wavesurfer.js/dist/plugins/record"

import { GenericPlugin } from "wavesurfer.js/dist/base-plugin"

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

  const [plugins, setPlugins] = React.useState<GenericPlugin[]>([])

  // React.useEffect(() => {
  //   if (plugins.length === 0) {
  //     setPlugins([
  //       Record.create({
  //         audio: true,
  //         video: false,
  //         maxLength: 10,
  //         audioChannels: 1,
  //         audioSampleRate: 44100,
  //         audioBufferSize: 4096,
  //         audioType: "audio/wav",
  //         encoderOptions: {
  //           type: "audio/wav",
  //           ext: ".wav",
  //         },
  //       }),
  //     ])
  //   }
  // }, [plugins])

  const [state, setState] = React.useState<{ [key: string]: number }>({
    barWidth: 4,
    barGap: 4,
    height: 50,
    barRadius: 4,
  })

  return (
    <div>
      {/* {Object.keys(state).map(key => (
        <div>
          {key}
          <input
            key={key}
            value={state[key]}
            placeholder={key}
            onChange={event =>
              setState({
                ...state,
                [key]: event.target.value ? parseInt(event.target.value) : 0,
              })
            }
          />
        </div>
      ))} */}
      <WavesurferPlayer
        barWidth={state.barWidth}
        barGap={state.barGap}
        height={state.height}
        barRadius={state.barRadius}
        waveColor="red"
        url={mediaBlobUrl}
        onReady={onReady}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        plugins={plugins}
      />
    </div>
  )
}

export default WaveSurferVisualization
