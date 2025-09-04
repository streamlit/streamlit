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

  // If sample_rate is not specified (null), the recorder will use browser default
  const targetSampleRate = element.sampleRate || null

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
          return
        }

        const url = URL.createObjectURL(wavBlob)
        const timestamp = new Date()
          .toISOString()
          .slice(0, 16)
          .replace(":", "-")
        const file = new File([wavBlob], `${timestamp}_audio.wav`, {
          type: wavBlob.type,
        })

        setRecordingUrl(url)

        uploadFiles({
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
            // Clear error state on successful upload
            setIsError(false)
            const upload = successfulUploads[0]
            if (upload && upload.fileUrl.deleteUrl) {
              setDeleteFileUrl(upload.fileUrl.deleteUrl)
            }
          })
          .catch(() => {
            setIsError(true)
          })
          .finally(() => {
            if (notNullOrUndefined(widgetFormId))
              widgetMgr.setFormsWithUploadsInProgress(new Set())

            setIsUploading(false)
          })
      } catch {
        setIsError(true)
        setIsUploading(false)
        if (notNullOrUndefined(widgetFormId))
          widgetMgr.setFormsWithUploadsInProgress(new Set())
      }
    },
    [
      setRecordingUrl,
      uploadClient,
      widgetMgr,
      widgetId,
      widgetFormId,
      fragmentId,
      setDeleteFileUrl,
      targetSampleRate,
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
        uploadClient.deleteFile(deleteFileUrl).catch(() => {
          // Silently handle deletion errors as they're not critical
        })
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

  const recordPluginRef = useRef<RecordPlugin | null>(null)
  const recordedBlobRef = useRef<Blob | null>(null)

  const initializeRecordPlugin = useCallback(() => {
    if (!wavesurfer || recordPluginRef.current) return

    // Initialize the Record plugin
    const recordOptions: Record<string, unknown> = {
      renderRecordedAudio: false, // Don't pre-render waveform to avoid layout shift
      scrollingWaveform: false,
      mimeType: "audio/webm", // Use WebM for better browser support
    }

    try {
      const record = wavesurfer.registerPlugin(
        RecordPlugin.create(recordOptions)
      )
      recordPluginRef.current = record

      // Update recording time during recording
      record.on("record-progress", (time: number) => {
        // WaveSurfer Record plugin gives time in milliseconds already!
        setRecordingTime(formatTime(time))
      })

      // Handle recording end event - this is where we get the blob!
      record.on("record-end", (blob: Blob) => {
        // Process the blob directly here
        if (blob && blob instanceof Blob) {
          // Store the blob in a ref so we can process it in stopRecording
          recordedBlobRef.current = blob
        }
      })

      // Plugin initialized successfully
    } catch (err) {
      // Permission errors will be caught here for WebKit
      if (err instanceof Error && err.message.includes("Permission")) {
        setHasNoMicPermissions(true)
      }
    }
  }, [wavesurfer, setRecordingTime])

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
      // Don't set URL here - we'll load it separately
    })

    ws.on("timeupdate", time => {
      setProgressTime(formatTime(time * 1000)) // get from seconds to milliseconds
    })

    ws.on("pause", () => {
      forceRerender()
    })

    setWavesurfer(ws)

    return () => {
      if (ws) ws.destroy()
    }
    // note: intentionally excluding theme so that we don't have to recreate the wavesurfer instance
    // and colors will be updated separately
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSampleRate])

  useEffect(() => initializeWaveSurfer(), [initializeWaveSurfer])

  // Initialize record plugin when wavesurfer is ready
  useEffect(() => {
    if (wavesurfer && !recordPluginRef.current) {
      initializeRecordPlugin()
    }
  }, [wavesurfer, initializeRecordPlugin])

  // Load recording when URL changes
  useEffect(() => {
    if (wavesurfer && recordingUrl) {
      void wavesurfer.load(recordingUrl)
    }
  }, [wavesurfer, recordingUrl])

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
      void wavesurfer.playPause().catch(() => {
        // Handle playback errors
        setIsError(true)
      })
      // This is because we want the time to be the duration of the audio when they stop recording,
      // but once they start playing it, we want it to be the current time. So, once they start playing it
      // we'll start keeping track of the playback time from that point onwards (until re-recording).
      setShouldUpdatePlaybackTime(true)
      // despite the state change above, this is still needed to force a rerender and make the time styling work
      forceRerender()
    }
  }, [wavesurfer])

  const startRecording = useCallback(async () => {
    if (!hasRequestedMicPermissions) {
      setHasRequestedMicPermissions(true)

      // Explicitly request microphone permission for WebKit compatibility
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        setHasNoMicPermissions(true)
        return
      }
    }

    if (recordingUrl) {
      handleClear({ updateWidgetManager: false, deleteFile: true })
    }

    try {
      // Use WaveSurfer's record plugin for visualization
      if (recordPluginRef.current) {
        // Prepare audio constraints for getUserMedia
        // Sample rate is set here, not in MediaRecorder options
        const audioConstraints: MediaTrackConstraints = targetSampleRate
          ? {
              sampleRate: { ideal: targetSampleRate },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            }
          : {} // Default constraints

        await recordPluginRef.current.startRecording(audioConstraints)
        setRecordingTime("00:00")
        forceRerender()
      } else if (!hasNoMicPermissions) {
        setIsError(true)
      }
    } catch (err) {
      // Check if it's a permission error
      if (err instanceof Error && err.message.includes("Permission")) {
        setHasNoMicPermissions(true)
      } else {
        setIsError(true)
      }
    }
  }, [
    recordingUrl,
    handleClear,
    hasRequestedMicPermissions,
    setRecordingTime,
    hasNoMicPermissions,
    targetSampleRate,
  ])

  const stopRecording = useCallback(async () => {
    return new Promise<void>((resolve, reject) => {
      if (!recordPluginRef.current) {
        setIsError(true)
        reject(new Error("Record plugin not initialized"))
        return
      }

      // Set up one-time listener for the record-end event
      const handleRecordEnd = (blob: Blob): void => {
        // Clean up the listener
        recordPluginRef.current?.un("record-end", handleRecordEnd)

        if (blob && blob instanceof Blob && blob.size > 0) {
          // Process the blob
          transcodeAndUploadFile(blob)
            .then(() => {
              recordedBlobRef.current = null
              resolve()
            })
            .catch(error => {
              setIsError(true)
              reject(error instanceof Error ? error : new Error(String(error)))
            })
        } else {
          setIsError(true)
          reject(new Error("Invalid or empty recording blob"))
        }
      }

      // Register the listener before stopping
      recordPluginRef.current.on("record-end", handleRecordEnd)

      // Stop the recording - this will trigger the record-end event
      try {
        recordPluginRef.current.stopRecording()
      } catch (err) {
        recordPluginRef.current?.un("record-end", handleRecordEnd)
        setIsError(true)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }, [transcodeAndUploadFile])

  const downloadRecording = useDownloadUrl(recordingUrl, "recording.wav")

  const isRecording = recordPluginRef.current?.isRecording() || false
  const isPlaying = Boolean(wavesurfer?.isPlaying())

  const isPlayingOrRecording = isRecording || isPlaying
  // Show placeholder when not recording and no recording exists
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
          startRecording={() => {
            void startRecording()
          }}
          stopRecording={() => {
            void stopRecording()
          }}
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
