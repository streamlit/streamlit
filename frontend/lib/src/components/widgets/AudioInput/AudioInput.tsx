/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import {
  memo,
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { Delete, FileDownload } from "@emotion-icons/material-outlined"

import type { AudioInput as AudioInputProto } from "@streamlit/protobuf"

import { useWaveformController } from "~lib/components/audio/core/useWaveformController"
import Toolbar, { ToolbarAction } from "~lib/components/shared/Toolbar/Toolbar"
import { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { FormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import type { FileUploadClient } from "~lib/FileUploadClient"
import useDownloadUrl from "~lib/hooks/useDownloadUrl"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import useWidgetManagerElementState from "~lib/hooks/useWidgetManagerElementState"
import { convertRemToPx } from "~lib/theme/utils"
import { plainTextWithBlockGaps } from "~lib/util/plainText"
import { uploadFiles } from "~lib/util/uploadFiles"
import {
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
  notNullOrUndefined,
} from "~lib/util/utils"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

import AudioInputActionButtons from "./AudioInputActionButtons"
import AudioInputErrorState from "./AudioInputErrorState"
import { STARTING_TIME_STRING } from "./constants"
import formatTime from "./formatTime"
import NoMicPermissions from "./NoMicPermissions"
import Placeholder from "./Placeholder"
import {
  StyledAudioInputContainerDiv,
  StyledWaveformContainerDiv,
  StyledWaveformInnerDiv,
  StyledWaveformTimeCode,
  StyledWaveSurferDiv,
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
  const containerRef = useRef<HTMLDivElement>(null)

  const [hasNoMicPermissions, setHasNoMicPermissions] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [progressTime, setProgressTime] = useState(STARTING_TIME_STRING)

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

  const [recordingTime, setRecordingTime] =
    useWidgetManagerElementState<string>({
      widgetMgr,
      id: element.id,
      formId: element.formId,
      key: "recordingTime",
      defaultValue: STARTING_TIME_STRING,
    })

  const uploadAbortControllerRef = useRef<AbortController | null>(null)
  const currentBlobUrlRef = useRef<string | null>(null)
  const playbackTimerRef = useRef<number | null>(null)

  const widgetId = element.id
  const widgetFormId = element.formId

  const transcodeAndUploadFile = useCallback(
    async (wavBlob: Blob) => {
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current.abort()
      }

      const abortController = new AbortController()
      uploadAbortControllerRef.current = abortController

      try {
        setIsUploading(true)
        if (notNullOrUndefined(widgetFormId))
          widgetMgr.setFormsWithUploadsInProgress(new Set([widgetFormId]))

        if (abortController.signal.aborted) {
          return
        }

        let blobUrl: string
        try {
          blobUrl = URL.createObjectURL(wavBlob)
          if (
            currentBlobUrlRef.current &&
            currentBlobUrlRef.current !== blobUrl
          ) {
            URL.revokeObjectURL(currentBlobUrlRef.current)
          }
          currentBlobUrlRef.current = blobUrl
        } catch {
          // Blob URL creation failed - error state will be set below
          setIsError(true)
          setIsUploading(false)
          if (notNullOrUndefined(widgetFormId))
            widgetMgr.setFormsWithUploadsInProgress(new Set())
          return
        }

        if (abortController.signal.aborted) {
          URL.revokeObjectURL(blobUrl)
          currentBlobUrlRef.current = null
          return
        }

        setRecordingUrl(blobUrl)

        const timestamp = new Date()
          .toISOString()
          .slice(0, 16)
          .replaceAll(":", "-")
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
            signal: abortController.signal,
            // on_change="ignore" buffers the value without scheduling a rerun.
            // WidgetStateManager ignores triggerRerun inside forms (the form owns
            // commit timing).
            ...(element.ignoreRerun ? { triggerRerun: false } : {}),
          })

          if (abortController.signal.aborted) {
            return
          }

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
          // File upload failed - set error state unless request was cancelled
          if (!abortController.signal.aborted) {
            setIsError(true)
          }
        } finally {
          if (notNullOrUndefined(widgetFormId))
            widgetMgr.setFormsWithUploadsInProgress(new Set())
          if (!abortController.signal.aborted) {
            setIsUploading(false)
          }
        }
      } catch {
        // Unexpected error during upload process - cleanup and set error state
        if (!abortController.signal.aborted) {
          setIsError(true)
          setIsUploading(false)
        }
        if (notNullOrUndefined(widgetFormId))
          widgetMgr.setFormsWithUploadsInProgress(new Set())
      }
    },
    [
      uploadClient,
      widgetMgr,
      widgetId,
      widgetFormId,
      fragmentId,
      element.ignoreRerun,
      setDeleteFileUrl,
      setRecordingUrl,
    ]
  )

  const controllerRef = useRef<ReturnType<
    typeof useWaveformController
  > | null>(null)

  const controller = useWaveformController({
    containerRef,
    sampleRate: element.sampleRate ?? undefined,
    waveformPadding: convertRemToPx(theme.spacing.twoXS), // Pixels of vertical padding to prevent waveform from touching edges
    events: {
      onPermissionDenied: () => {
        setHasNoMicPermissions(true)
      },
      onError: () => {
        setIsError(true)
      },
      onRecordStart: () => {
        setRecordingTime(STARTING_TIME_STRING)
        setProgressTime(STARTING_TIME_STRING)
      },
      onRecordReady: () => {
        const duration = formatTime(
          controllerRef.current?.playback.getDurationMs() ?? 0
        )
        setRecordingTime(duration)
        setProgressTime(duration)
      },
      onApprove: transcodeAndUploadFile,
      onCancel: () => {
        setRecordingTime(STARTING_TIME_STRING)
        setProgressTime(STARTING_TIME_STRING)
      },
      onProgressMs: (ms: number) => {
        setRecordingTime(formatTime(ms))
      },
      onPlaybackPause: () => {
        setProgressTime(
          formatTime(controllerRef.current?.playback.getCurrentTimeMs() ?? 0)
        )
      },
      onPlaybackFinish: () => {
        setProgressTime(
          formatTime(controllerRef.current?.playback.getDurationMs() ?? 0)
        )
      },
    },
  })

  // Handlers read this ref so they call the latest controller. The hook returns
  // a new object every render.
  controllerRef.current = controller

  const { state, isPlaybackPlaying, playback } = controller

  const handleClear = useCallback(
    async ({
      updateWidgetManager,
      deleteFile,
    }: {
      updateWidgetManager: boolean
      deleteFile: boolean
    }): Promise<void> => {
      const urlToRevoke = recordingUrl

      if (urlToRevoke && currentBlobUrlRef.current === urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke)
        currentBlobUrlRef.current = null
      }

      if (playbackTimerRef.current) {
        cancelAnimationFrame(playbackTimerRef.current)
        playbackTimerRef.current = null
      }

      setRecordingUrl(null)
      setDeleteFileUrl(null)
      setProgressTime(STARTING_TIME_STRING)
      setRecordingTime(STARTING_TIME_STRING)

      controllerRef.current?.cancel()

      if (updateWidgetManager) {
        widgetMgr.setFileUploaderStateValue(
          element.id,
          {},
          {
            formId: element.formId,
            fragmentId,
            fromUser: true,
            // on_change="ignore" buffers the value without scheduling a rerun.
            // WidgetStateManager ignores triggerRerun inside forms (the form owns
            // commit timing).
            ...(element.ignoreRerun ? { triggerRerun: false } : {}),
          }
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
      element,
      widgetMgr,
      fragmentId,
      setRecordingTime,
      setDeleteFileUrl,
      setRecordingUrl,
    ]
  )

  useEffect(() => {
    const updatePlaybackTime = (): void => {
      if (isPlaybackPlaying) {
        setProgressTime(formatTime(playback.getCurrentTimeMs()))
        playbackTimerRef.current = requestAnimationFrame(updatePlaybackTime)
      }
    }

    if (isPlaybackPlaying) {
      playbackTimerRef.current = requestAnimationFrame(updatePlaybackTime)
    } else if (playbackTimerRef.current) {
      cancelAnimationFrame(playbackTimerRef.current)
      playbackTimerRef.current = null
    }

    return () => {
      if (playbackTimerRef.current) {
        cancelAnimationFrame(playbackTimerRef.current)
        playbackTimerRef.current = null
      }
    }
  }, [isPlaybackPlaying, playback])

  useEffect(() => {
    if (!recordingUrl) {
      return
    }

    let cancelled = false
    setProgressTime(recordingTime)

    const loadRecording = async (): Promise<void> => {
      try {
        await playback.load(recordingUrl)
        if (cancelled) {
          return
        }

        const durationMs = playback.getDurationMs()
        if (durationMs > 0) {
          setProgressTime(formatTime(durationMs))
        }
      } catch {
        // Playback loading failed - likely a corrupted recording or browser issue
        if (!cancelled) {
          setIsError(true)
        }
      }
    }

    void loadRecording()

    return () => {
      cancelled = true
    }
  }, [recordingUrl, recordingTime, playback])

  useEffect(() => {
    if (isNullOrUndefined(widgetFormId)) return

    const formClearHelper = new FormClearHelper()
    formClearHelper.manageFormClearListener(widgetMgr, widgetFormId, () => {
      void handleClear({ updateWidgetManager: true, deleteFile: false })
    })

    return () => formClearHelper.disconnect()
  }, [widgetFormId, handleClear, widgetMgr])

  useEffect(() => {
    return () => {
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current.abort()
        uploadAbortControllerRef.current = null
      }
      if (playbackTimerRef.current) {
        cancelAnimationFrame(playbackTimerRef.current)
        playbackTimerRef.current = null
      }
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current)
        currentBlobUrlRef.current = null
      }
    }
  }, [])

  const onClickPlayPause = useCallback(async () => {
    try {
      if (isPlaybackPlaying) {
        const currentTime = playback.getCurrentTimeMs()
        playback.pause()
        setProgressTime(formatTime(currentTime))
      } else if (state === "idle" && recordingUrl) {
        // WaveSurfer can report a tiny non-zero offset (~<100ms) at start of playback.
        // Snap the UI timer back to the canonical start value so the display stays deterministic.
        if (playback.getCurrentTimeMs() <= 100) {
          setProgressTime(STARTING_TIME_STRING)
        }
        await playback.play()
      }
    } catch {
      // Playback control error - set error state for user feedback
      setIsError(true)
    }
  }, [isPlaybackPlaying, recordingUrl, state, playback])

  const startRecording = useCallback(async () => {
    if (recordingUrl) {
      await handleClear({ updateWidgetManager: false, deleteFile: true })
    }

    try {
      setProgressTime(STARTING_TIME_STRING)
      await controllerRef.current?.start()
    } catch {
      // Error handling is done via event listeners
    }
  }, [handleClear, recordingUrl])

  const stopRecording = useCallback(async () => {
    try {
      const current = controllerRef.current
      if (!current) {
        return
      }
      const { blob } = await current.stop()
      await current.approve(blob)
    } catch {
      // Stop recording or approval error - set error state for user feedback
      setIsError(true)
    }
  }, [])

  const downloadRecording = useDownloadUrl(recordingUrl, "recording.wav")

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

  const isRecording = state === "recording"
  const isPlaying = isPlaybackPlaying
  const displayedTime = isRecording ? recordingTime : progressTime
  const showPlaceholder =
    state === "idle" && !hasNoMicPermissions && !recordingUrl
  const showNoMicPermissionsOrPlaceholderOrError =
    hasNoMicPermissions || showPlaceholder || isError

  const labelTextRef = useRef<HTMLSpanElement>(null)
  // Widget labels are markdown; compose rendered plain text into toolbar names,
  // not the markdown source. Observe the visual label node for late markdown
  // (KaTeX/emoji skeletons), matching the image-caption path.
  const [labelContext, setLabelContext] = useState<string | undefined>()
  useLayoutEffect(() => {
    const node = labelTextRef.current
    if (!element.label || !node) {
      setLabelContext(undefined)
      return
    }

    const syncLabelPlainText = (): void => {
      const text = plainTextWithBlockGaps(node)
      setLabelContext(text || undefined)
    }

    syncLabelPlainText()

    const observer = new MutationObserver(syncLabelPlainText)
    observer.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    return () => observer.disconnect()
  }, [element.label])

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
        labelTextRef={labelTextRef}
      >
        {element.help && (
          <WidgetLabelHelpIcon
            content={element.help}
            placement={Placement.TOP}
            label={element.label}
          />
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
              labelContext={labelContext}
            />
          )}
          {deleteFileUrl && (
            <ToolbarAction
              label="Clear recording"
              icon={Delete}
              onClick={handleDeleteClick}
              labelContext={labelContext}
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
          onClickPlayPause={() => void onClickPlayPause()}
          onClear={handleClearWithError}
          disabled={disabled || hasNoMicPermissions}
        />
        <StyledWaveformInnerDiv>
          {isError && <AudioInputErrorState />}
          {showPlaceholder && <Placeholder />}
          {hasNoMicPermissions && <NoMicPermissions />}
          <StyledWaveSurferDiv
            data-testid="stAudioInputWaveSurfer"
            ref={containerRef}
            show={!showNoMicPermissionsOrPlaceholderOrError}
          />
        </StyledWaveformInnerDiv>
        <StyledWaveformTimeCode
          isPlayingOrRecording={isRecording || isPlaying}
          disabled={disabled}
          data-testid="stAudioInputWaveformTimeCode"
        >
          {displayedTime}
        </StyledWaveformTimeCode>
      </StyledWaveformContainerDiv>
    </StyledAudioInputContainerDiv>
  )
}

export default memo(AudioInput)
