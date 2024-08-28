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

import React, { ReactElement, useState, useEffect } from "react"
import { withTheme } from "@emotion/react"
import { useReactMediaRecorder } from "./useReactMediaRecorder"
import WaveSurfer from "wavesurfer.js"
import BaseButton, {
  BaseButtonKind,
} from "@streamlit/lib/src/components/shared/BaseButton"
import { FileUploadClient } from "@streamlit/lib/src/FileUploadClient"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { AudioInput as AudioInputProto } from "@streamlit/lib/src/proto"
import { uploadFiles } from "./uploadFiles"
import RecordIcon from "./RecordIcon"
import PlayIcon from "./PlayIcon"
import MicIcon from "./MicIcon"
import RecordPlugin from "wavesurfer.js/dist/plugins/record"
import Toolbar, {
  ToolbarAction,
} from "@streamlit/lib/src/components/shared/Toolbar"
import { Container } from "./styled-components"
import {
  Add,
  Close,
  Delete,
  FileDownload,
  Search,
} from "@emotion-icons/material-outlined"
import { EmotionTheme } from "@streamlit/lib/src/theme"

interface Props {
  element: AudioInputProto
  uploadClient: FileUploadClient
  widgetMgr: WidgetStateManager
  theme: EmotionTheme
}

const AudioInput: React.FC<Props> = ({
  element,
  uploadClient,
  widgetMgr,
  theme,
}): ReactElement => {
  // WAVE SURFER SPECIFIC STUFF
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null)
  const waveSurferRef = React.useRef<HTMLDivElement | null>(null)
  const [deleteFileUrl, setDeleteFileUrl] = useState<string | null>(null)
  const [recordPlugin, setRecordPlugin] = useState<RecordPlugin | null>(null)
  const [availableAudioDevices, setAvailableAudioDevices] = useState<
    MediaDeviceInfo[]
  >([])
  const [activeAudioDeviceId, setActiveAudioDeviceId] = useState<
    string | null
  >(null)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [, setRerender] = useState(0)
  const forceRerender = () => {
    setRerender(prev => prev + 1)
  }
  const [barMode, setBarMode] = useState(false)
  const [isScrolling, setIsScrolling] = useState(true)
  const [fileToUpload, setFileToUpload] = useState<File | null>(null)
  const [isAutoUpload, setIsAutoUpload] = useState(true)

  const [configuredHeight, setConfiguredHeight] = useState<number>(64)

  const barValues = {
    barWidth: 4,
    barGap: 4,
    barRadius: 4,
  }

  const uploadTheFile = (file: File) => {
    uploadFiles({
      files: [file],
      uploadClient,
      widgetMgr,
      widgetInfo: element,
    }).then(({ successfulUploads }) => {
      const upload = successfulUploads[0]
      if (upload && upload.fileUrl.deleteUrl) {
        setDeleteFileUrl(upload.fileUrl.deleteUrl)
      }
    })
  }

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
      RecordPlugin.getAvailableAudioDevices().then(devices => {
        setAvailableAudioDevices(devices)
        if (devices.length > 0) {
          setActiveAudioDeviceId(devices[0].deviceId)
        }
      })
    })
  }, [])

  useEffect(() => {
    if (waveSurferRef.current === null) {
      return
    }

    if (wavesurfer) {
      wavesurfer.destroy()
    }

    const ws = WaveSurfer.create({
      container: waveSurferRef.current,
      waveColor: "#FF4B4B",
      progressColor: "#8d1515",
      height: configuredHeight - 8,
      ...(barMode ? barValues : {}),
      // barGap: 4,
      // barWidth: 4,
      // barRadius: 2,

      // renderFunction: (channels, ctx) => {
      //   const { width, height } = ctx.canvas
      //   const scale = channels[0].length / width
      //   const barWidth = 4
      //   const gap = 4
      //   const step = barWidth + gap

      //   ctx.clearRect(0, 0, width, height) // Clear previous frame
      //   ctx.translate(0, height / 2)
      //   ctx.fillStyle = ctx.strokeStyle

      //   for (let i = 0; i < width; i += step) {
      //     const start = Math.floor(i * scale)
      //     const end = Math.floor((i + barWidth) * scale)
      //     const segment = channels[0].slice(start, end)

      //     // Calculate the average absolute value for the segment
      //     const avg =
      //       segment.reduce((sum, val) => sum + Math.abs(val), 0) /
      //       segment.length
      //     const barHeight = avg * height

      //     // Draw the bar
      //     ctx.fillStyle = "#FF4B4B"
      //     ctx.fillRect(i, -barHeight / 2, barWidth, barHeight)
      //   }
      // },
    })

    const recordPlugin = ws.registerPlugin(
      RecordPlugin.create({
        scrollingWaveform: isScrolling,
        renderRecordedAudio: true,
      })
    )

    recordPlugin.on("record-end", blob => {
      const url = URL.createObjectURL(blob)
      console.log({ blob })
      setRecordingUrl(url)

      const file = new File([blob], "audio.wav", { type: blob.type })
      setFileToUpload(file)
      if (isAutoUpload) {
        uploadTheFile(file)
      }

      // TODO error handling
      // setDownloadFilename(blob.type.split(";")[0].split("/")[1] || "webm")

      // if (downloadLinkRef.current) {
      //   downloadLinkRef.current.style.display = "inline"
      //   downloadLinkRef.current.href = url
      //   downloadLinkRef.current.download =
      //     "recording." + blob.type.split(";")[0].split("/")[1] || "webm"
      // }
    })

    // recordPlugin.on("record-progress", time => {
    //   updateProgress(time)
    // })

    setWavesurfer(ws)
    setRecordPlugin(recordPlugin)

    // const updateProgress = (time: number) => {
    //   const formattedTime = [
    //     Math.floor((time % 3600000) / 60000), // minutes
    //     Math.floor((time % 60000) / 1000), // seconds
    //   ]
    //     .map(v => (v < 10 ? "0" + v : v))
    //     .join(":")
    //   setProgressTime(formattedTime)
    // }
    return () => {
      if (wavesurfer) {
        wavesurfer.destroy()
      }
    }
  }, [barMode, isScrolling, isAutoUpload, configuredHeight])

  const onPlayPause = () => {
    wavesurfer && wavesurfer.playPause()
  }

  const [isPlaying, setIsPlaying] = React.useState(false)

  // const isRecording = status === "recording"
  // const buttonDisabled = status !== "idle" && status !== "recording"

  const handleRecord = () => {
    if (!recordPlugin || !activeAudioDeviceId) {
      return
    }

    if (recordPlugin.isRecording() || recordPlugin.isPaused()) {
      recordPlugin.stopRecording()
    } else {
      const deviceId = activeAudioDeviceId
      if (deviceId == null) {
        return
      }

      recordPlugin
        .startRecording({ deviceId: activeAudioDeviceId })
        .then(() => {
          forceRerender()
          // Update the record button to show the user that they can stop recording
        })
    }
  }

  const handleClear = () => {
    if (wavesurfer == null || deleteFileUrl == null) {
      return
    }
    setRecordingUrl(null)
    wavesurfer.empty()
    uploadClient.deleteFile(deleteFileUrl).then(() => {})
    // TODO revoke the url so that it gets gced
  }

  const isRecording = recordPlugin?.isRecording()

  const button = (() => {
    if (recordPlugin && recordPlugin.isRecording()) {
      return (
        <BaseButton
          kind={BaseButtonKind.BORDERLESS_ICON}
          onClick={handleRecord}
        >
          {recordPlugin && recordPlugin.isRecording()}
          <RecordIcon />
        </BaseButton>
      )
    } else if (recordingUrl) {
      return (
        <BaseButton
          kind={BaseButtonKind.BORDERLESS_ICON}
          onClick={onPlayPause}
        >
          <PlayIcon />
        </BaseButton>
      )
    } else {
      return (
        <BaseButton
          kind={BaseButtonKind.BORDERLESS_ICON}
          onClick={handleRecord}
        >
          <MicIcon />
        </BaseButton>
      )
    }
  })()

  return (
    <div>
      <Container data-testid="stAudioInput">
        <Toolbar
          isFullScreen={false}
          disableFullscreenMode={true}
          target={Container}
        >
          {!isAutoUpload && fileToUpload && (
            <ToolbarAction
              label="Upload"
              icon={FileDownload}
              onClick={() => uploadTheFile(fileToUpload)}
            />
          )}
          {deleteFileUrl && (
            <ToolbarAction
              label="Clear recording"
              icon={Close}
              onClick={handleClear}
            />
          )}
        </Toolbar>

        <div
          style={{
            height: configuredHeight,
            width: "100%",
            background: theme.colors.gray20,
            borderRadius: 8,
            marginBottom: 2,
            display: "flex",
            alignItems: "center",
            // padding: 16,
          }}
        >
          {button}
          <div style={{ flex: 1 }}>
            <div ref={waveSurferRef} />
          </div>

          <span style={{ margin: 8, font: "monospace", color: "black" }}>
            T0:D0
          </span>
        </div>
      </Container>
      <div
        style={{
          border: `1px solid ${theme.colors.gray20}`,
          padding: 16,
          margin: 16,
        }}
      >
        {isRecording ? (
          <span>
            to prevent bugs, you can only change these while not recording
          </span>
        ) : (
          <span>
            DISCLAIMER: very buggy prototype but should give the general feel
            for the different options if you squint just right
          </span>
        )}
        <div>
          <input
            type="checkbox"
            checked={barMode}
            disabled={isRecording}
            onChange={() => {
              handleClear()
              setBarMode(!barMode)
            }}
          />
          <span> Toggle Bar Mode</span>
        </div>
        <div>
          <input
            type="checkbox"
            checked={isScrolling}
            disabled={isRecording}
            onChange={() => {
              handleClear()
              setIsScrolling(!isScrolling)
            }}
          />
          <span> Toggle "Scrolling" Mode</span>
        </div>
        <div>
          <input
            type="checkbox"
            checked={isAutoUpload}
            disabled={isRecording}
            onChange={() => {
              handleClear()
              setIsAutoUpload(!isAutoUpload)
            }}
          />
          <span> Toggle "Auto upload" mode</span>
        </div>
        <div>
          <input
            type="number"
            value={configuredHeight}
            disabled={isRecording}
            onChange={e => {
              handleClear()
              setConfiguredHeight(parseInt(e.target.value))
            }}
          />
          <span> Height in px</span>
        </div>
        {isRecording && isScrolling && barMode && (
          <div>
            <span>
              you have scrolling and bars on, it should look buggy/jittery
              right now while you are recording
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default withTheme(AudioInput)
