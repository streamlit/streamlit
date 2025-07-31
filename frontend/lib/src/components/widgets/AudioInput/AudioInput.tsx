/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { Delete, FileDownload } from "@emotion-icons/material-outlined"
import isEqual from "lodash/isEqual"
import WaveSurfer from "wavesurfer.js"
import RecordPlugin from "wavesurfer.js/dist/plugins/record"

import { AudioInput as AudioInputProto } from "@streamlit/protobuf"

import Toolbar, { ToolbarAction } from "~lib/components/shared/Toolbar"
import { Placement } from "~lib/components/shared/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget"
import { FormClearHelper } from "~lib/components/widgets/Form"
import { FileUploadClient } from "~lib/FileUploadClient"
import useDownloadUrl from "~lib/hooks/useDownloadUrl"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import useWidgetManagerElementState from "~lib/hooks/useWidgetManagerElementState"
import { blend, convertRemToPx } from "~lib/theme/utils"
import { usePrevious } from "~lib/util/Hooks"
import { uploadFiles } from "~lib/util/uploadFiles"
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
  notNullOrUndefined,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import AudioInputActionButtons from "./AudioInputActionButtons"
import AudioInputErrorState from "./AudioInputErrorState"
import {
  BAR_GAP,
  BAR_RADIUS,
  BAR_WIDTH,
  CURSOR_WIDTH,
  STARTING_TIME_STRING,
  WAVEFORM_PADDING,
} from "./constants"
import convertAudioToWav from "./convertAudioToWav"
import formatTime from "./formatTime"
import NoMicPermissions from "./NoMicPermissions"
import Placeholder from "./Placeholder"
import {
  StyledAudioInputContainerDiv,
  StyledWaveformContainerDiv,
  StyledWaveformInnerDiv,
  StyledWaveformTimeCode,
  StyledWaveSurferDiv,
  StyledWidgetLabelHelp,
} from "./styled-components"
export interface Props {
  element: AudioInputProto
  uploadClient: FileUploadClient
  widgetMgr: WidgetStateManager
  fragmentId?: string
  disabled: boolean
}

const AudioInput: React.FC<Props> = ({
  element,
  uploadClient,
  widgetMgr,
  fragmentId,
  disabled,
}): ReactElement => {
  const theme = useEmotionTheme()
  const previousTheme = usePrevious(theme)
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null)
  const waveSurferRef = useRef<HTMLDivElement | null>(null)
  const [deleteFileUrl, setDeleteFileUrl] = useWidgetManagerElementState<
    string | null
  >({
    widgetMgr,
    id: element.id,
    key: "deleteFileUrl",
    defaultValue: null,
  })
  const [recordPlugin, setRecordPlugin] = useState<RecordPlugin | null>(null)
  // to eventually show the user the available audio devices
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [availableAudioDevices, setAvailableAudioDevices] = useState<
    MediaDeviceInfo[]
  >([])
  const [activeAudioDeviceId, setActiveAudioDeviceId] = useState<
    string | null
  >(null)

  const [recordingUrl, setRecordingUrl] = useWidgetManagerElementState<
    string | null
  >({
    widgetMgr,
    id: element.id,
    key: "recordingUrl",
    defaultValue: null,
  })
  const [, setRerender] = useState(0)
  const forceRerender = (): void => {
    setRerender(prev => prev + 1)
  }
  const [progressTime, setProgressTime] = useState(STARTING_TIME_STRING)

  const [recordingTime, setRecordingTime] =
    useWidgetManagerElementState<string>({
      widgetMgr,
      id: element.id,
      formId: element.formId,
      key: "recordingTime",
      defaultValue: STARTING_TIME_STRING,
    })

  const [shouldUpdatePlaybackTime, setShouldUpdatePlaybackTime] =
    useState(false)
  const [hasNoMicPermissions, setHasNoMicPermissions] = useState(false)
  const [hasRequestedMicPermissions, setHasRequestedMicPermissions] =
    useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isError, setIsError] = useState(false)

  const widgetId = element.id
  const widgetFormId = element.formId

  const transcodeAndUploadFile = useCallback(
    async (blob: Blob) => {
      setIsUploading(true)
      if (notNullOrUndefined(widgetFormId))
        widgetMgr.setFormsWithUploadsInProgress(new Set([widgetFormId]))

      let wavBlob: Blob | undefined = undefined

      if (blob.type === "audio/wav") {
        wavBlob = blob
      } else {
        wavBlob = await convertAudioToWav(blob)
      }

      if (!wavBlob) {
        setIsError(true)
        return
      }

      const url = URL.createObjectURL(wavBlob)
      const timestamp = new Date().toISOString().slice(0, 16).replace(":", "-")
      const file = new File([wavBlob], `${timestamp}_audio.wav`, {
        type: wavBlob.type,
      })

      setRecordingUrl(url)

      void uploadFiles({
        files: [file],
        uploadClient,
        widgetMgr,
        widgetInfo: { id: widgetId, formId: widgetFormId },
        fragmentId,
      })
        .then(({ successfulUploads, failedUploads }) => {
          if (failedUploads.length > 0) {
            setIsError(true)
            return
          }
          const upload = successfulUploads[0]
          if (upload && upload.fileUrl.deleteUrl) {
            setDeleteFileUrl(upload.fileUrl.deleteUrl)
          }
        })
        .finally(() => {
          if (notNullOrUndefined(widgetFormId))
            widgetMgr.setFormsWithUploadsInProgress(new Set())

          setIsUploading(false)
        })
    },
    [
      setRecordingUrl,
      uploadClient,
      widgetMgr,
      widgetId,
      widgetFormId,
      fragmentId,
      setDeleteFileUrl,
    ]
  )

  const handleClear = useCallback(
    ({
      updateWidgetManager,
      deleteFile,
    }: {
      updateWidgetManager: boolean
      deleteFile: boolean
    }) => {
      if (isNullOrUndefined(wavesurfer) || isNullOrUndefined(deleteFileUrl)) {
        return
      }
      setRecordingUrl(null)
      wavesurfer.empty()
      if (deleteFile) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        uploadClient.deleteFile(deleteFileUrl)
      }
      setDeleteFileUrl(null)
      setProgressTime(STARTING_TIME_STRING)
      setRecordingTime(STARTING_TIME_STRING)
      if (updateWidgetManager) {
        widgetMgr.setFileUploaderStateValue(
          element,
          {},
          { fromUi: true },
          fragmentId
        )
      }
      setShouldUpdatePlaybackTime(false)
      if (notNullOrUndefined(recordingUrl)) {
        URL.revokeObjectURL(recordingUrl)
      }
    },
    [
      deleteFileUrl,
      recordingUrl,
      uploadClient,
      wavesurfer,
      element,
      widgetMgr,
      fragmentId,
      setRecordingTime,
      setRecordingUrl,
      setDeleteFileUrl,
    ]
  )

  useEffect(() => {
    if (isNullOrUndefined(widgetFormId)) return

    const formClearHelper = new FormClearHelper()
    formClearHelper.manageFormClearListener(widgetMgr, widgetFormId, () =>
      handleClear({ updateWidgetManager: true, deleteFile: false })
    )

    return () => formClearHelper.disconnect()
  }, [widgetFormId, handleClear, widgetMgr])

  const initializeWaveSurfer = useCallback(() => {
    if (waveSurferRef.current === null) return

    const ws = WaveSurfer.create({
      container: waveSurferRef.current,
      waveColor: recordingUrl
        ? blend(theme.colors.fadedText40, theme.colors.secondaryBg)
        : theme.colors.primary,
      progressColor: theme.colors.bodyText,
      height:
        convertRemToPx(theme.sizes.largestElementHeight) -
        2 * WAVEFORM_PADDING,
      barWidth: BAR_WIDTH,
      barGap: BAR_GAP,
      barRadius: BAR_RADIUS,
      cursorWidth: CURSOR_WIDTH,
      url: recordingUrl ?? undefined,
    })

    ws.on("timeupdate", time => {
      setProgressTime(formatTime(time * 1000)) // get from seconds to milliseconds
    })

    ws.on("pause", () => {
      forceRerender()
    })

    const rp = ws.registerPlugin(
      RecordPlugin.create({
        scrollingWaveform: false,
        renderRecordedAudio: true,
      })
    )

    rp.on("record-end", blob => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      transcodeAndUploadFile(blob)
    })

    rp.on("record-progress", time => {
      setRecordingTime(formatTime(time))
    })

    setWavesurfer(ws)
    setRecordPlugin(rp)

    return () => {
      if (ws) ws.destroy()
      if (rp) rp.destroy()
    }
    // note: intentionally excluding theme so that we don't have to recreate the wavesurfer instance
    // and colors will be updated separately
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcodeAndUploadFile])

  useEffect(() => initializeWaveSurfer(), [initializeWaveSurfer])

  useEffect(() => {
    if (!isEqual(previousTheme, theme)) {
      wavesurfer?.setOptions({
        waveColor: recordingUrl
          ? blend(theme.colors.fadedText40, theme.colors.secondaryBg)
          : theme.colors.primary,
        progressColor: theme.colors.bodyText,
      })
    }
  }, [theme, previousTheme, recordingUrl, wavesurfer])

  const onClickPlayPause = useCallback(() => {
    if (wavesurfer) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      wavesurfer.playPause()
      // This is because we want the time to be the duration of the audio when they stop recording,
      // but once they start playing it, we want it to be the current time. So, once they start playing it
      // we'll start keeping track of the playback time from that point onwards (until re-recording).
      setShouldUpdatePlaybackTime(true)
      // despite the state change above, this is still needed to force a rerender and make the time styling work
      forceRerender()
    }
  }, [wavesurfer])

  const startRecording = useCallback(async () => {
    let audioDeviceId = activeAudioDeviceId

    if (!hasRequestedMicPermissions) {
      // this first part is to ensure we prompt for getting the user's media devices
      await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(() =>
          RecordPlugin.getAvailableAudioDevices().then(devices => {
            setAvailableAudioDevices(devices)
            if (devices.length > 0) {
              const { deviceId } = devices[0]
              setActiveAudioDeviceId(deviceId)
              audioDeviceId = deviceId
            }
          })
        )
        .catch(_err => {
          setHasNoMicPermissions(true)
        })
      setHasRequestedMicPermissions(true)
    }

    if (!recordPlugin || !audioDeviceId || !wavesurfer) {
      return
    }

    wavesurfer.setOptions({
      waveColor: theme.colors.primary,
    })

    if (recordingUrl) {
      handleClear({ updateWidgetManager: false, deleteFile: true })
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    recordPlugin.startRecording({ deviceId: audioDeviceId }).then(() => {
      // Update the record button to show the user that they can stop recording
      forceRerender()
    })
  }, [
    activeAudioDeviceId,
    recordPlugin,
    theme,
    wavesurfer,
    recordingUrl,
    handleClear,
    hasRequestedMicPermissions,
  ])

  const stopRecording = useCallback(() => {
    if (!recordPlugin) return

    recordPlugin.stopRecording()

    wavesurfer?.setOptions({
      // We are blending this color instead of directly using the theme color (fadedText40)
      // because the "faded" part of fadedText40 means introducing some transparency, which
      // causes problems with the progress waveform color because wavesurfer is choosing to
      // tint the waveColor with the progressColor instead of directly setting the progressColor.
      // This means that the low opacity of fadedText40 causes the progress waveform to
      // have the same opacity which makes it impossible to darken it enough to match designs.
      // We fix this by blending the colors to figure out what the resulting color should be at
      // full opacity, and we usee that color to set the waveColor.
      waveColor: blend(theme.colors.fadedText40, theme.colors.secondaryBg),
    })
  }, [recordPlugin, wavesurfer, theme])

  const downloadRecording = useDownloadUrl(recordingUrl, "recording.wav")

  const isRecording = Boolean(recordPlugin?.isRecording())
  const isPlaying = Boolean(wavesurfer?.isPlaying())

  const isPlayingOrRecording = isRecording || isPlaying
  const showPlaceholder = !isRecording && !recordingUrl && !hasNoMicPermissions

  const showNoMicPermissionsOrPlaceholderOrError =
    hasNoMicPermissions || showPlaceholder || isError

  return (
    <StyledAudioInputContainerDiv
      className="stAudioInput"
      data-testid="stAudioInput"
    >
      <WidgetLabel
        label={element.label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
      >
        {element.help && (
          <StyledWidgetLabelHelp>
            <TooltipIcon content={element.help} placement={Placement.TOP} />
          </StyledWidgetLabelHelp>
        )}
      </WidgetLabel>
      <StyledWaveformContainerDiv disabled={disabled}>
        <Toolbar
          isFullScreen={false}
          disableFullscreenMode={true}
          target={StyledWaveformContainerDiv}
        >
          {recordingUrl && (
            <ToolbarAction
              label="Download as WAV"
              icon={FileDownload}
              onClick={() => downloadRecording()}
            />
          )}
          {deleteFileUrl && (
            <ToolbarAction
              label="Clear recording"
              icon={Delete}
              onClick={() =>
                handleClear({ updateWidgetManager: true, deleteFile: true })
              }
            />
          )}
        </Toolbar>
        <AudioInputActionButtons
          isRecording={isRecording}
          isPlaying={isPlaying}
          isUploading={isUploading}
          isError={isError}
          recordingUrlExists={Boolean(recordingUrl)}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          startRecording={startRecording}
          stopRecording={stopRecording}
          onClickPlayPause={onClickPlayPause}
          onClear={() => {
            handleClear({ updateWidgetManager: false, deleteFile: true })
            setIsError(false)
          }}
          disabled={disabled || hasNoMicPermissions}
        />
        <StyledWaveformInnerDiv>
          {isError && <AudioInputErrorState />}
          {showPlaceholder && <Placeholder />}
          {hasNoMicPermissions && <NoMicPermissions />}
          <StyledWaveSurferDiv
            data-testid="stAudioInputWaveSurfer"
            ref={waveSurferRef}
            show={!showNoMicPermissionsOrPlaceholderOrError}
          />
        </StyledWaveformInnerDiv>
        <StyledWaveformTimeCode
          isPlayingOrRecording={isPlayingOrRecording}
          disabled={disabled}
          data-testid="stAudioInputWaveformTimeCode"
        >
          {shouldUpdatePlaybackTime ? progressTime : recordingTime}
        </StyledWaveformTimeCode>
      </StyledWaveformContainerDiv>
    </StyledAudioInputContainerDiv>
  )
}

export default memo(AudioInput)
