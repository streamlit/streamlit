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
import { withTheme } from "@emotion/react"
import { useReactMediaRecorder } from "react-media-recorder"
import WaveSurfer from "wavesurfer.js"
import BaseButton, {
  BaseButtonKind,
} from "@streamlit/lib/src/components/shared/BaseButton"
import { FileUploadClient, WidgetStateManager } from "@streamlit/lib"
import { AudioInput as AudioInputProto } from "@streamlit/lib/src/proto"
import MediaStreamVisualizer from "./MediaStreamVisualizer"

import WaveSurferVisualization from "./WaveSurferVisualization"
import { uploadFiles } from "./uploadFiles"

interface Props {
  element: AudioInputProto
  uploadClient: FileUploadClient
  widgetMgr: WidgetStateManager
}

const AudioInput: React.FC<Props> = ({
  element,
  uploadClient,
  widgetMgr,
}): ReactElement => {
  const {
    status,
    startRecording,
    stopRecording,
    mediaBlobUrl,
    pauseRecording,
    previewAudioStream,
  } = useReactMediaRecorder({ audio: true, video: false })

  // WAVE SURFER SPECIFIC STUFF
  const [wavesurfer, setWavesurfer] = React.useState<WaveSurfer | null>(null)
  const onPlayPause = () => {
    wavesurfer && wavesurfer.playPause()
  }

  const [isPlaying, setIsPlaying] = React.useState(false)

  const isRecording = status === "recording"
  const buttonDisabled = status !== "idle" && status !== "recording"

  const onSubmit = async () => {
    if (!mediaBlobUrl) {
      return
    }

    const blob = await (await fetch(mediaBlobUrl)).blob()
    const file = new File([blob], "audio.wav", { type: blob.type })

    uploadFiles({
      files: [file],
      uploadClient,
      widgetMgr,
      widgetInfo: element,
    }) // TODO error handling
  }

  return (
    <div>
      <div>
        <div
          style={{
            height: 128,
            width: "100%",
            paddingTop: 4,
            paddingBottom: 4,
            border: `1px solid gray`,
            borderRadius: 8,
            marginBottom: 2,
          }}
        >
          {isRecording && previewAudioStream ? (
            <MediaStreamVisualizer
              mediaStream={previewAudioStream}
              heightPx={120}
            />
          ) : (
            <WaveSurferVisualization
              setWavesurfer={setWavesurfer}
              setIsPlaying={setIsPlaying}
              mediaBlobUrl={mediaBlobUrl}
            ></WaveSurferVisualization>
          )}
        </div>
        <p style={{ position: "absolute", top: 20, right: 20 }}>{status}</p>

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 4,
              border: `1px solid gray`,
              borderRadius: 8,
            }}
          >
            {isRecording ? (
              <BaseButton
                kind={BaseButtonKind.PRIMARY}
                onClick={stopRecording}
              >
                Stop Recording
              </BaseButton>
            ) : (
              <BaseButton
                kind={BaseButtonKind.PRIMARY}
                onClick={startRecording}
              >
                Start Recording
              </BaseButton>
            )}

            <BaseButton kind={BaseButtonKind.SECONDARY} onClick={onPlayPause}>
              {isPlaying ? "Pause" : "Play"}
            </BaseButton>
            <BaseButton kind={BaseButtonKind.SECONDARY}>Buttons</BaseButton>
            <BaseButton kind={BaseButtonKind.SECONDARY} onClick={onSubmit}>
              Submit
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  )
}

export default withTheme(AudioInput)
