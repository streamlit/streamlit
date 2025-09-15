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
  // Track current blob URL for cleanup
  const currentBlobUrlRef = useRef<string | null>(null)
  const [deleteFileUrl, setDeleteFileUrl] = useWidgetManagerElementState<
    string | null
  >({
    widgetMgr,
    id: element.id,
    key: "deleteFileUrl",
    defaultValue: null,
  })

  const [recordingUrl, setRecordingUrl] = useWidgetManagerElementState<
    string | null
  >({
    widgetMgr,
    id: element.id,
    key: "recordingUrl",
    defaultValue: null,
  })

  const [, setRerender] = useState(0)
  const forceRerender = useCallback((): void => {
    setRerender(prev => prev + 1)
  }, [])
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

  const targetSampleRate = element.sampleRate || null

  const recordPluginRef = useRef<RecordPlugin | null>(null)
  const recordPluginHandlersRef = useRef<{
    handleRecordProgress?: (time: number) => void
  }>({})

  const transcodeAndUploadFile = useCallback(
    async (blob: Blob) => {
      try {
        setIsUploading(true)
        if (notNullOrUndefined(widgetFormId))
          widgetMgr.setFormsWithUploadsInProgress(new Set([widgetFormId]))

        let wavBlob: Blob | undefined = undefined

        if (blob.type === "audio/wav") {
          wavBlob = blob
        } else {
          wavBlob = await convertAudioToWav(
            blob,
            targetSampleRate || undefined
          )
        }

        if (!wavBlob) {
          setIsError(true)
          setIsUploading(false)
          if (notNullOrUndefined(widgetFormId))
            widgetMgr.setFormsWithUploadsInProgress(new Set())
          return
        }

        let blobUrl: string
        try {
          blobUrl = URL.createObjectURL(wavBlob)
          // Track the new blob URL and revoke the old one if it exists
          if (
            currentBlobUrlRef.current &&
            currentBlobUrlRef.current !== blobUrl
          ) {
            URL.revokeObjectURL(currentBlobUrlRef.current)
          }
          currentBlobUrlRef.current = blobUrl
        } catch {
          setIsError(true)
          setIsUploading(false)
          if (notNullOrUndefined(widgetFormId))
            widgetMgr.setFormsWithUploadsInProgress(new Set())
          return
        }

        setRecordingUrl(blobUrl)

        if (wavesurfer) {
          void wavesurfer.load(blobUrl)
          wavesurfer.setOptions({
            interact: true,
            waveColor: blend(
              theme.colors.fadedText40,
              theme.colors.secondaryBg
            ),
            progressColor: theme.colors.bodyText,
          })
        }

        const timestamp = new Date()
          .toISOString()
          .slice(0, 16)
          .replace(/:/g, "-")
        const file = new File([wavBlob], `${timestamp}_audio.wav`, {
          type: wavBlob.type,
        })

        try {
          const { successfulUploads, failedUploads } = await uploadFiles({
            files: [file],
            uploadClient,
            widgetMgr,
            widgetInfo: { id: widgetId, formId: widgetFormId },
            fragmentId,
          })

          if (failedUploads.length > 0) {
            setIsError(true)
            return
          }

          setIsError(false)
          const upload = successfulUploads[0]
          if (upload?.fileUrl?.deleteUrl) {
            setDeleteFileUrl(upload.fileUrl.deleteUrl)
          }
        } catch {
          setIsError(true)
        } finally {
          if (notNullOrUndefined(widgetFormId))
            widgetMgr.setFormsWithUploadsInProgress(new Set())
          setIsUploading(false)
        }
      } catch {
        setIsError(true)
        setIsUploading(false)
        if (notNullOrUndefined(widgetFormId))
          widgetMgr.setFormsWithUploadsInProgress(new Set())
      }
    },
    [
      uploadClient,
      widgetMgr,
      wavesurfer,
      widgetId,
      widgetFormId,
      fragmentId,
      setDeleteFileUrl,
      targetSampleRate,
      setRecordingUrl,
      theme.colors.fadedText40,
      theme.colors.secondaryBg,
      theme.colors.bodyText,
    ]
  )

  const handleClear = useCallback(
    async ({
      updateWidgetManager,
      deleteFile,
    }: {
      updateWidgetManager: boolean
      deleteFile: boolean
    }): Promise<void> => {
      if (isNullOrUndefined(wavesurfer)) {
        return
      }

      const urlToRevoke = recordingUrl

      // Clean up the blob URL when clearing
      if (urlToRevoke && currentBlobUrlRef.current === urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke)
        currentBlobUrlRef.current = null
      }

      setRecordingUrl(null)
      setDeleteFileUrl(null)
      setProgressTime(STARTING_TIME_STRING)
      setRecordingTime(STARTING_TIME_STRING)
      setShouldUpdatePlaybackTime(false)

      wavesurfer.empty()

      if (updateWidgetManager) {
        widgetMgr.setFileUploaderStateValue(
          element,
          {},
          { fromUi: true },
          fragmentId
        )
      }

      if (deleteFile && deleteFileUrl) {
        try {
          await uploadClient.deleteFile(deleteFileUrl)
        } catch {
          // Silently handle deletion errors
        }
      }

      if (notNullOrUndefined(urlToRevoke)) {
        URL.revokeObjectURL(urlToRevoke)
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
      setDeleteFileUrl,
      setRecordingUrl,
    ]
  )

  useEffect(() => {
    if (isNullOrUndefined(widgetFormId)) return

    const formClearHelper = new FormClearHelper()
    formClearHelper.manageFormClearListener(widgetMgr, widgetFormId, () => {
      void handleClear({ updateWidgetManager: true, deleteFile: false })
    })

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
      interact: true,
    })

    ws.on("timeupdate", time => {
      setProgressTime(formatTime(time * 1000)) // get from seconds to milliseconds
    })

    ws.on("pause", () => {
      forceRerender()
    })

    setWavesurfer(ws)

    if (recordingUrl) {
      void ws.load(recordingUrl)
      ws.setOptions({
        interact: true,
      })
    }

    const recordOptions: Record<string, unknown> = {
      renderRecordedAudio: false,
      scrollingWaveform: false,
      mimeType: "audio/webm",
    }

    try {
      const record = ws.registerPlugin(RecordPlugin.create(recordOptions))
      recordPluginRef.current = record

      const handleRecordProgress = (time: number): void => {
        setRecordingTime(formatTime(time))
      }

      record.on("record-progress", handleRecordProgress)

      recordPluginHandlersRef.current = {
        handleRecordProgress,
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError")
      ) {
        setHasNoMicPermissions(true)
      }
    }

    return () => {
      if (recordPluginRef.current) {
        if (recordPluginRef.current.isRecording()) {
          recordPluginRef.current.stopRecording()
        }
        const handlers = recordPluginHandlersRef.current
        if (handlers.handleRecordProgress) {
          recordPluginRef.current.un(
            "record-progress",
            handlers.handleRecordProgress
          )
        }
        recordPluginRef.current.destroy()
        recordPluginRef.current = null
        recordPluginHandlersRef.current = {}
      }
      if (ws) ws.destroy()
    }
  }, [
    theme,
    setProgressTime,
    forceRerender,
    recordingUrl,
    setRecordingTime,
    setHasNoMicPermissions,
  ])

  useEffect(() => {
    const cleanup = initializeWaveSurfer()
    return cleanup
  }, [initializeWaveSurfer])

  // Note: We don't revoke blob URLs on unmount because they need to persist
  // across component remounts. They'll be cleaned up when:
  // 1. User records a new audio (old one is revoked)
  // 2. User explicitly clears the recording
  // 3. Page unloads (browser handles this)

  useEffect(() => {
    if (!isEqual(previousTheme, theme)) {
      wavesurfer?.setOptions({
        waveColor: recordingUrl
          ? blend(theme.colors.fadedText40, theme.colors.secondaryBg)
          : theme.colors.primary,
        progressColor: theme.colors.bodyText,
        interact: true,
      })
    }
  }, [theme, previousTheme, recordingUrl, wavesurfer])

  const onClickPlayPause = useCallback(() => {
    if (!wavesurfer) return

    const handlePlayPause = async (): Promise<void> => {
      try {
        await wavesurfer.playPause()
      } catch {
        setIsError(true)
      }
      // This is because we want the time to be the duration of the audio when they stop recording,
      // but once they start playing it, we want it to be the current time. So, once they start playing it
      // we'll start keeping track of the playback time from that point onwards (until re-recording).
      setShouldUpdatePlaybackTime(true)
      // despite the state change above, this is still needed to force a rerender and make the time styling work
      forceRerender()
    }

    void handlePlayPause()
  }, [wavesurfer, forceRerender])

  const startRecording = useCallback(async () => {
    if (!hasRequestedMicPermissions) {
      setHasRequestedMicPermissions(true)

      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        })
      } catch {
        setHasNoMicPermissions(true)
        return
      } finally {
        // Always stop tracks if we got a stream, even if an error occurred
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
        }
      }
    }

    if (recordingUrl) {
      await handleClear({ updateWidgetManager: false, deleteFile: true })
    }

    if (recordPluginRef.current && wavesurfer) {
      wavesurfer.setOptions({
        waveColor: theme.colors.primary,
      })

      const audioConstraints: MediaTrackConstraints = targetSampleRate
        ? {
            sampleRate: { ideal: targetSampleRate },
          }
        : {} // Default constraints

      try {
        await recordPluginRef.current.startRecording(audioConstraints)
        setRecordingTime(formatTime(0))
        forceRerender()
      } catch (err) {
        if (
          err instanceof Error &&
          (err.name === "NotAllowedError" ||
            err.name === "PermissionDeniedError")
        ) {
          setHasNoMicPermissions(true)
        } else {
          setIsError(true)
        }
      }
    } else if (!hasNoMicPermissions) {
      setIsError(true)
    }
  }, [
    hasRequestedMicPermissions,
    setRecordingTime,
    hasNoMicPermissions,
    targetSampleRate,
    wavesurfer,
    theme.colors.primary,
    forceRerender,
    recordingUrl,
    handleClear,
  ])

  const waitForRecordEnd = useCallback(
    (plugin: RecordPlugin): Promise<Blob> => {
      return new Promise<Blob>((resolve, reject) => {
        const handleRecordEnd = (blob: Blob): void => {
          plugin.un("record-end", handleRecordEnd)

          if (blob && blob instanceof Blob && blob.size > 0) {
            resolve(blob)
          } else {
            reject(new Error("Invalid or empty recording blob"))
          }
        }

        plugin.on("record-end", handleRecordEnd)

        plugin.stopRecording()
      })
    },
    []
  )

  const stopRecording = useCallback(async () => {
    const recordPlugin = recordPluginRef.current
    if (!recordPlugin?.isRecording()) {
      return
    }

    try {
      const blob = await waitForRecordEnd(recordPlugin)
      await transcodeAndUploadFile(blob)

      if (wavesurfer) {
        // We are blending this color instead of directly using the theme color (fadedText40)
        // because the "faded" part of fadedText40 means introducing some transparency, which
        // causes problems with the progress waveform color because wavesurfer is choosing to
        // tint the waveColor with the progressColor instead of directly setting the progressColor.
        // This means that the low opacity of fadedText40 causes the progress waveform to
        // have the same opacity which makes it impossible to darken it enough to match designs.
        // We fix this by blending the colors to figure out what the resulting color should be at
        // full opacity, and we use that color to set the waveColor.
        wavesurfer.setOptions({
          waveColor: blend(theme.colors.fadedText40, theme.colors.secondaryBg),
          progressColor: theme.colors.bodyText,
        })
      }
    } catch {
      setIsError(true)
    }
  }, [transcodeAndUploadFile, wavesurfer, theme, waitForRecordEnd])

  const downloadRecording = useDownloadUrl(recordingUrl, "recording.wav")

  const isRecording = recordPluginRef.current?.isRecording() || false
  const isPlaying = Boolean(wavesurfer?.isPlaying())

  const isPlayingOrRecording = isRecording || isPlaying

  const showPlaceholder = !isRecording && !recordingUrl && !hasNoMicPermissions

  const showNoMicPermissionsOrPlaceholderOrError =
    hasNoMicPermissions || showPlaceholder || isError

  const handleStartRecording = useCallback(() => {
    void startRecording()
  }, [startRecording])

  const handleStopRecording = useCallback(() => {
    void stopRecording()
  }, [stopRecording])

  const handleClearWithError = useCallback(() => {
    void handleClear({ updateWidgetManager: false, deleteFile: true })
    setIsError(false)
  }, [handleClear])

  const handleDownloadClick = useCallback(() => {
    downloadRecording()
  }, [downloadRecording])

  const handleDeleteClick = useCallback(() => {
    void handleClear({
      updateWidgetManager: true,
      deleteFile: true,
    })
  }, [handleClear])

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
              onClick={handleDownloadClick}
            />
          )}
          {deleteFileUrl && (
            <ToolbarAction
              label="Clear recording"
              icon={Delete}
              onClick={handleDeleteClick}
            />
          )}
        </Toolbar>
        <AudioInputActionButtons
          isRecording={isRecording}
          isPlaying={isPlaying}
          isUploading={isUploading}
          isError={isError}
          recordingUrlExists={Boolean(recordingUrl)}
          startRecording={handleStartRecording}
          stopRecording={handleStopRecording}
          onClickPlayPause={onClickPlayPause}
          onClear={handleClearWithError}
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
