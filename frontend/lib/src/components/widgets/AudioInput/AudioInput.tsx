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
import { Theme, withTheme } from "@emotion/react"
import { useReactMediaRecorder } from "./useReactMediaRecorder"
import WaveSurfer from "wavesurfer.js"
import BaseButton, {
  BaseButtonKind,
} from "@streamlit/lib/src/components/shared/BaseButton"
import { FileUploadClient } from "@streamlit/lib/src/FileUploadClient"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { AudioInput as AudioInputProto } from "@streamlit/lib/src/proto"
import { uploadFiles } from "./uploadFiles"
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
  Mic,
} from "@emotion-icons/material-outlined"
import { PlayArrow, StopCircle, Pause } from "@emotion-icons/material-rounded"
import { EmotionTheme, darkTheme } from "@streamlit/lib/src/theme"

import Icon from "@streamlit/lib/src/components/shared/Icon"

const HEIGHT = 40
const WAVEFORM_PADDING = 4

const DotArray = withTheme((props: { theme: Theme }) => {
  return (
    <div
      style={{
        height: HEIGHT,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          height: 10,
          opacity: 0.2, // we cool with doing this to get a "lighter" color?
          width: "100%",
          backgroundImage: `radial-gradient(${props.theme.colors.fadedText10} 40%, transparent 40%)`,
          backgroundSize: "10px 10px",
          backgroundRepeat: "repeat",
        }}
      ></div>
    </div>
  )
})

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
  const [progressTime, setProgressTime] = useState("00:00")

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
      waveColor: theme.colors.primary,
      progressColor: theme.colors.bodyText,
      height: HEIGHT - 2 * WAVEFORM_PADDING,
      barWidth: 4,
      barGap: 4,
      barRadius: 4,
      cursorWidth: 0,
    })

    ws.on("timeupdate", time => {
      updateProgress(time * 1000) // get from seconds to milliseconds
    })

    ws.on("pause", () => {
      forceRerender()
    })

    const recordPlugin = ws.registerPlugin(
      RecordPlugin.create({
        scrollingWaveform: false,
        renderRecordedAudio: true,
      })
    )

    recordPlugin.on("record-end", blob => {
      const url = URL.createObjectURL(blob)
      setRecordingUrl(url)

      const file = new File([blob], "audio.wav", { type: blob.type })
      uploadTheFile(file)

      ws.setOptions({
        waveColor: "#A5A5AA",
        progressColor: theme.colors.bodyText,
      })
    })

    recordPlugin.on("record-progress", time => {
      updateProgress(time)
    })

    setWavesurfer(ws)
    setRecordPlugin(recordPlugin)

    const updateProgress = (time: number) => {
      const formattedTime = [
        Math.floor((time % 3600000) / 60000), // minutes
        Math.floor((time % 60000) / 1000), // seconds
      ]
        .map(v => (v < 10 ? "0" + v : v))
        .join(":")

      setProgressTime(formattedTime)
    }

    return () => {
      if (wavesurfer) {
        wavesurfer.destroy()
      }
    }
  }, [theme])

  const onPlayPause = () => {
    wavesurfer && wavesurfer.playPause()

    // to get the pause button to show
    forceRerender()
  }

  const handleRecord = () => {
    if (!recordPlugin || !activeAudioDeviceId || !wavesurfer) {
      return
    }

    if (recordPlugin.isRecording() || recordPlugin.isPaused()) {
      recordPlugin.stopRecording()
    } else {
      const deviceId = activeAudioDeviceId
      if (deviceId == null) {
        return
      }

      wavesurfer.setOptions({
        waveColor: theme.colors.primary,
      })

      recordPlugin
        .startRecording({ deviceId: activeAudioDeviceId })
        .then(() => {
          // Update the record button to show the user that they can stop recording
          forceRerender()
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
    setProgressTime("00:00")
    setDeleteFileUrl(null)
    // TODO revoke the url so that it gets gced
  }

  const button = (() => {
    if (recordPlugin && recordPlugin.isRecording()) {
      return (
        <BaseButton
          kind={BaseButtonKind.BORDERLESS_ICON}
          onClick={handleRecord}
        >
          {recordPlugin && recordPlugin.isRecording()}
          <Icon
            content={StopCircle}
            size="lg"
            color={theme.colors.primary}
          ></Icon>
        </BaseButton>
      )
    } else if (recordingUrl) {
      if (wavesurfer && wavesurfer.isPlaying()) {
        return (
          <BaseButton
            kind={BaseButtonKind.BORDERLESS_ICON}
            onClick={onPlayPause}
          >
            <Icon
              content={Pause}
              size="lg"
              color={theme.colors.fadedText60}
            ></Icon>
          </BaseButton>
        )
      } else {
        return (
          <BaseButton
            kind={BaseButtonKind.BORDERLESS_ICON}
            onClick={onPlayPause}
          >
            <Icon
              content={PlayArrow}
              size="lg"
              color={theme.colors.fadedText60}
            ></Icon>
          </BaseButton>
        )
      }
    } else {
      return (
        <BaseButton
          kind={BaseButtonKind.BORDERLESS_ICON}
          onClick={handleRecord}
        >
          <Icon
            content={Mic}
            size="lg"
            color={theme.colors.fadedText60}
          ></Icon>
        </BaseButton>
      )
    }
  })()

  const showPlaceholder =
    !(recordPlugin && recordPlugin.isRecording()) && !recordingUrl

  console.log({ theme })
  return (
    <div>
      <Container data-testid="stAudioInput">
        <Toolbar
          isFullScreen={false}
          disableFullscreenMode={true}
          target={Container}
        >
          {deleteFileUrl && (
            <ToolbarAction
              label="Clear recording"
              icon={Delete}
              onClick={handleClear}
            />
          )}
        </Toolbar>
        <div
          style={{
            height: HEIGHT,
            width: "100%",
            background: theme.genericColors.secondaryBg,
            borderRadius: 8,
            marginBottom: 2,
            display: "flex",
            alignItems: "center",
          }}
        >
          {button}
          <div style={{ flex: 1 }}>
            {showPlaceholder && <DotArray theme={theme} />}
            <div
              ref={waveSurferRef}
              style={{ display: showPlaceholder ? "none" : "block" }}
            />
          </div>

          <code
            style={{
              margin: 8,
              font: "Source Code Pro",
              color: theme.colors.fadedText60,
              backgroundColor: theme.genericColors.secondaryBg,
              fontSize: 14,
            }}
          >
            {progressTime}
          </code>
        </div>
      </Container>
    </div>
  )
}

export default withTheme(AudioInput)
