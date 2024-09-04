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

import React, {
  ReactElement,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react"
import { Theme, withTheme } from "@emotion/react"
import WaveSurfer from "wavesurfer.js"
import { FileUploadClient } from "@streamlit/lib/src/FileUploadClient"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { AudioInput as AudioInputProto } from "@streamlit/lib/src/proto"
import { uploadFiles } from "./uploadFiles"
import RecordPlugin from "wavesurfer.js/dist/plugins/record"
import Toolbar, {
  ToolbarAction,
} from "@streamlit/lib/src/components/shared/Toolbar"
import {
  StyledAudioInputContainerDiv,
  StyledWaveformContainerDiv,
  StyledWaveformInnerDiv,
  StyledWaveformTimeCode,
  StyledWaveSurferDiv,
} from "./styled-components"
import { Delete } from "@emotion-icons/material-outlined"
import { EmotionTheme } from "@streamlit/lib/src/theme"

import NoMicPermissions from "./NoMicPermissions"
import { WidgetLabel } from "../BaseWidget"
import { labelVisibilityProtoValueToEnum } from "@streamlit/lib/src/util/utils"
import Placeholder from "./Placeholder"

import {
  BAR_GAP,
  BAR_RADIUS,
  BAR_WIDTH,
  CURSOR_WIDTH,
  STARTING_TIME_STRING,
  WAVEFORM_HEIGHT,
  WAVEFORM_PADDING,
} from "./constants"
import formatTime from "./formatTime"
import ActionButton from "./ActionButton"

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
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null)
  const waveSurferRef = React.useRef<HTMLDivElement | null>(null)
  const [deleteFileUrl, setDeleteFileUrl] = useState<string | null>(null)
  const [recordPlugin, setRecordPlugin] = useState<RecordPlugin | null>(null)
  // to eventually show the user the available audio devices
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
  const [progressTime, setProgressTime] = useState(STARTING_TIME_STRING)
  const [recordingTime, setRecordingTime] = useState(STARTING_TIME_STRING)
  const [shouldUpdatePlaybackTime, setShouldUpdatePlaybackTime] =
    useState(false)
  const [hasNoMicPermissions, setHasNoMicPermissions] = useState(false)

  const uploadTheFile = useCallback(
    (file: File) => {
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
    },
    [element, uploadClient, widgetMgr]
  )

  useEffect(() => {
    // this first part is to ensure we prompt for getting the user's media devices
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(() => {
        RecordPlugin.getAvailableAudioDevices().then(devices => {
          setAvailableAudioDevices(devices)
          if (devices.length > 0) {
            setActiveAudioDeviceId(devices[0].deviceId)
          }
        })
      })
      .catch(_err => {
        setHasNoMicPermissions(true)
      })
  }, [])

  const initializeWaveSurfer = useCallback(() => {
    if (waveSurferRef.current === null) return
    if (wavesurfer) wavesurfer.destroy()

    const ws = WaveSurfer.create({
      container: waveSurferRef.current,
      waveColor: theme.colors.primary,
      progressColor: theme.colors.bodyText,
      height: WAVEFORM_HEIGHT - 2 * WAVEFORM_PADDING,
      barWidth: BAR_WIDTH,
      barGap: BAR_GAP,
      barRadius: BAR_RADIUS,
      cursorWidth: CURSOR_WIDTH,
    })

    ws.on("timeupdate", time => {
      setProgressTime(formatTime(time * 1000)) // get from seconds to milliseconds
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
        // This color is hardcoded because I've spent an hour trying to get it to work
        // with the theme and I'm giving up for now. The complications arise due to the
        // way wavesurfer is using these colors. Specifically, the progress color "tints" the wave color
        // and the opacity of this wave color is not being respected, so to make things work for now hardcoding
        // this color that looks "okay" on both themes.
        waveColor: "#A5A5AA",
      })
    })

    recordPlugin.on("record-progress", time => {
      setRecordingTime(formatTime(time))
    })

    setWavesurfer(ws)
    setRecordPlugin(recordPlugin)

    return () => {
      if (wavesurfer) wavesurfer.destroy()
    }
  }, [theme])

  useEffect(() => {
    initializeWaveSurfer()
  }, [initializeWaveSurfer])

  const onClickPlayPause = useCallback(() => {
    wavesurfer && wavesurfer.playPause()

    // This is because we want the time to be the duration of the audio when they stop recording,
    // but once they start playing it, we want it to be the current time. So, once they start playing it
    // we'll start keeping track of the playback time from that point onwards (until re-recording).
    setShouldUpdatePlaybackTime(true)

    // to get the pause button to show
    forceRerender()
  }, [wavesurfer])

  const startRecording = useCallback(() => {
    if (!recordPlugin || !activeAudioDeviceId || !wavesurfer) {
      return
    }

    const deviceId = activeAudioDeviceId
    if (deviceId == null) {
      return
    }

    wavesurfer.setOptions({
      waveColor: theme.colors.primary,
    })

    recordPlugin.startRecording({ deviceId: activeAudioDeviceId }).then(() => {
      // Update the record button to show the user that they can stop recording
      forceRerender()
    })
  }, [activeAudioDeviceId, recordPlugin, theme, wavesurfer])

  const stopRecording = useCallback(() => {
    if (!recordPlugin) return

    recordPlugin.stopRecording()
  }, [recordPlugin])

  const handleClear = useCallback(() => {
    if (wavesurfer == null || deleteFileUrl == null) {
      return
    }
    setRecordingUrl(null)
    wavesurfer.empty()
    uploadClient.deleteFile(deleteFileUrl)
    setProgressTime(STARTING_TIME_STRING)
    setRecordingTime(STARTING_TIME_STRING)
    setDeleteFileUrl(null)
    setShouldUpdatePlaybackTime(false)
    if (recordingUrl != null) {
      URL.revokeObjectURL(recordingUrl)
    }
  }, [deleteFileUrl, recordingUrl, uploadClient, wavesurfer])

  // Note: these can't be memoized due to the reliance on calling .isRecording() & .isPlaying()
  const isPlayingOrRecording = Boolean(
    (recordPlugin && recordPlugin.isRecording()) ||
      (wavesurfer && wavesurfer.isPlaying())
  )

  const showPlaceholder = Boolean(
    !(recordPlugin && recordPlugin.isRecording()) &&
      !recordingUrl &&
      !hasNoMicPermissions
  )

  const showNoMicPermissionsOrPlaceholder = useMemo(
    () => Boolean(hasNoMicPermissions || showPlaceholder),
    [hasNoMicPermissions, showPlaceholder]
  )

  return (
    <StyledAudioInputContainerDiv>
      <WidgetLabel
        label={element.label}
        disabled={hasNoMicPermissions}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
      ></WidgetLabel>
      <StyledWaveformContainerDiv data-testid="stAudioInput">
        <Toolbar
          isFullScreen={false}
          disableFullscreenMode={true}
          target={StyledWaveformContainerDiv}
        >
          {deleteFileUrl && (
            <ToolbarAction
              label="Clear recording"
              icon={Delete}
              onClick={handleClear}
              data-testid="stAudioInputClearRecordingButton"
            />
          )}
        </Toolbar>
        <ActionButton
          hasNoMicPermissions={hasNoMicPermissions}
          recordPlugin={recordPlugin}
          recordingUrl={recordingUrl}
          wavesurfer={wavesurfer}
          startRecording={startRecording}
          stopRecording={stopRecording}
          onClickPlayPause={onClickPlayPause}
        />
        <StyledWaveformInnerDiv>
          {showPlaceholder && <Placeholder />}
          {hasNoMicPermissions && <NoMicPermissions />}
          <StyledWaveSurferDiv
            ref={waveSurferRef}
            show={!showNoMicPermissionsOrPlaceholder}
          />
        </StyledWaveformInnerDiv>
        <StyledWaveformTimeCode
          isPlayingOrRecording={isPlayingOrRecording}
          data-testid="StyledWaveformTimeCode"
        >
          {shouldUpdatePlaybackTime ? progressTime : recordingTime}
        </StyledWaveformTimeCode>
      </StyledWaveformContainerDiv>
    </StyledAudioInputContainerDiv>
  )
}

export default withTheme(AudioInput)
