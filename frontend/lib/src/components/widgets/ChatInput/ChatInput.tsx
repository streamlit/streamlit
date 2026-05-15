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
  ChangeEvent,
  KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { MicNone, Videocam } from "@emotion-icons/material-outlined"
import {
  ArrowUpward,
  Check,
  Close,
  ErrorOutline,
  Pause,
  PlayArrow,
} from "@emotion-icons/material-rounded"
import type { AxiosProgressEvent } from "axios"
import { Textarea as UITextArea } from "baseui/textarea"
import { useDropzone } from "react-dropzone"

import { useWindowDimensionsContext } from "@streamlit/lib"
import {
  ChatInput as ChatInputProto,
  FileUploaderState as FileUploaderStateProto,
  IChatInputValue,
  IFileURLs,
  streamlit,
  UploadedFileInfo as UploadedFileInfoProto,
} from "@streamlit/protobuf"

import { useWaveformController } from "~lib/components/audio/core/useWaveformController"
import { LOG } from "~lib/components/ChatInput/logger"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import Icon from "~lib/components/shared/Icon/Icon"
import InputInstructions from "~lib/components/shared/InputInstructions/InputInstructions"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import UploadedFileChips from "~lib/components/shared/UploadedFile/UploadedFileChips"
import {
  UploadedStatus,
  UploadFileInfo,
} from "~lib/components/shared/UploadedFile/UploadFileInfo"
import { getAccept } from "~lib/components/widgets/FileUploader/utils"
import { FileUploadClient } from "~lib/FileUploadClient"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useTextInputAutoExpand } from "~lib/hooks/useTextInputAutoExpand"
import type { EmotionTheme } from "~lib/theme/types"
import { convertRemToPx } from "~lib/theme/utils"
import { FileSize, sizeConverter } from "~lib/util/FileHelper"
import { isEnterKeyPressed } from "~lib/util/inputUtils"
import {
  AcceptFileValue,
  chatInputAcceptFileProtoValueToEnum,
  isNullOrUndefined,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import ChatFileUploadButton from "./fileUpload/ChatFileUploadButton"
import ChatFileUploadDropzone from "./fileUpload/ChatFileUploadDropzone"
import { createDropHandler } from "./fileUpload/createDropHandler"
import { createUploadFileHandler } from "./fileUpload/createFileUploadHandler"
import {
  StyledChatAudioWave,
  StyledChatInput,
  StyledChatInputContainer,
  StyledFilesArea,
  StyledInputInstructions,
  StyledInputRow,
  StyledLeftCluster,
  StyledPendingMediaChip,
  StyledPendingMediaChipRemove,
  StyledRecordingIndicator,
  StyledRightCluster,
  StyledSendIconButton,
  StyledTextareaWrapper,
  StyledToolbarRow,
  StyledVideoPausedOverlay,
  StyledVideoPreviewContainer,
  StyledWaveformContainer,
} from "./styled-components"

/**
 * Creates the UITextArea overrides configuration for the chat input.
 *
 * @param theme - The Emotion theme for accessing design tokens
 * @param autoExpand - Auto-expand configuration with height and maxHeight
 * @param rootLayoutStyle - Layout-specific style for Root (e.g., flex or width)
 * @param minHeightOverride - Optional minimum height override from heightConfig
 * @param useFixedHeight - When true, use 100% height instead of autoExpand (for stretch/pixel height modes)
 */
function createTextAreaOverrides(
  theme: EmotionTheme,
  autoExpand: { height: string; maxHeight: string; isExtended: boolean },
  rootLayoutStyle: Record<string, string | number>,
  minHeightOverride?: string,
  useFixedHeight?: boolean
): React.ComponentProps<typeof UITextArea>["overrides"] {
  return {
    Root: {
      style: {
        minHeight: minHeightOverride ?? theme.sizes.chatInputTextareaMinHeight,
        outline: "none",
        borderLeftWidth: "0",
        borderRightWidth: "0",
        borderTopWidth: "0",
        borderBottomWidth: "0",
        borderTopLeftRadius: "0",
        borderTopRightRadius: "0",
        borderBottomRightRadius: "0",
        borderBottomLeftRadius: "0",
        ...rootLayoutStyle,
      },
    },
    Input: {
      props: {
        "data-testid": "stChatInputTextArea",
      },
      style: {
        fontWeight: theme.fontWeights.normal,
        lineHeight: theme.lineHeights.inputWidget,
        "::placeholder": {
          color: theme.colors.fadedText60,
        },
        // When useFixedHeight is true (stretch/pixel height mode), fill the container
        // Otherwise, use autoExpand values for dynamic expansion
        height: useFixedHeight
          ? "100%"
          : autoExpand.isExtended
            ? autoExpand.height
            : "auto",
        maxHeight: useFixedHeight ? "none" : autoExpand.maxHeight,
        overflowY: "auto",
        paddingLeft: theme.spacing.none,
        paddingRight: theme.spacing.none,
        paddingBottom: theme.spacing.twoXS,
        paddingTop: theme.spacing.twoXS,
        width: "100%",
      },
    },
  }
}

export interface Props {
  disabled: boolean
  element: ChatInputProto
  widgetMgr: WidgetStateManager
  uploadClient: FileUploadClient
  fragmentId?: string
  heightConfig?: streamlit.IHeightConfig | null
}

const updateFile = (
  id: number,
  fileInfo: UploadFileInfo,
  currentFiles: UploadFileInfo[]
): UploadFileInfo[] => currentFiles.map(f => (f.id === id ? fileInfo : f))

const getFile = (
  localFileId: number,
  currentFiles: UploadFileInfo[]
): UploadFileInfo | undefined => currentFiles.find(f => f.id === localFileId)

function ChatInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
  uploadClient,
  heightConfig,
}: Props): React.ReactElement {
  const theme = useEmotionTheme()

  const { placeholder, maxChars } = element

  const counterRef = useRef(0)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const processedSetValueRef = useRef(false)
  const waveformContainerRef = useRef<HTMLDivElement>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const uploadAbortControllerRef = useRef<AbortController | null>(null)
  const videoApprovedRef = useRef<boolean>(false)

  const { width, elementRef } = useCalculatedDimensions()
  const { innerWidth, innerHeight } = useWindowDimensionsContext()

  // The value specified by the user via the UI. If the user didn't touch this widget's UI, the default value is used.
  const [value, setValue] = useState(element.default)
  const [files, setFiles] = useState<UploadFileInfo[]>([])
  const [fileDragged, setFileDragged] = useState(false)
  const [audioUploading, setAudioUploading] = useState(false)
  const [videoUploading, setVideoUploading] = useState(false)
  const [isVideoRecording, setIsVideoRecording] = useState(false)
  const [isVideoPaused, setIsVideoPaused] = useState(false)
  const [pendingAudio, setPendingAudio] =
    useState<UploadedFileInfoProto | null>(null)
  const [pendingVideo, setPendingVideo] =
    useState<UploadedFileInfoProto | null>(null)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [isStacked, setIsStacked] = useState(false)

  // Forces dropzone to remount when files are cleared
  const [dropzoneResetCounter, setDropzoneResetCounter] = useState(0)

  const acceptAudio = element.acceptAudio ?? false
  const acceptVideo = element.acceptVideo ?? false

  useEffect(() => {
    const video = videoPreviewRef.current
    if (!videoStream || !video) {
      return
    }
    video.srcObject = videoStream
    // Safari ignores autoPlay when srcObject is used; force .play().
    video.play().catch(error => {
      LOG.error("Video preview play failed:", error)
    })
  }, [videoStream])

  const stopAllTracks = useCallback((stream: MediaStream | null) => {
    if (!stream) return
    for (const track of stream.getTracks()) {
      if (track.readyState !== "ended") {
        track.stop()
      }
    }
  }, [])

  // Cleanup: abort any in-progress uploads on unmount
  useEffect(() => {
    return () => {
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current.abort()
      }
      stopAllTracks(streamRef.current)
    }
  }, [stopAllTracks])

  // Track if we've done the initial height calculation with a valid width.
  // This prevents unnecessary recalculations on every window resize.
  const hasInitializedWithWidthRef = useRef(false)

  const autoExpand = useTextInputAutoExpand({
    textareaRef: chatInputRef,
    dependencies: [placeholder, isStacked],
  })
  const { updateScrollHeight } = autoExpand

  // Recalculate height once when width first becomes available (ResizeObserver is async).
  useLayoutEffect(() => {
    if (width > 0 && !hasInitializedWithWidthRef.current) {
      hasInitializedWithWidthRef.current = true
      updateScrollHeight()
    }
  }, [width, updateScrollHeight])

  // Cache font string and available width for text measurement
  // These values only change on mount or resize, not on every keystroke
  const fontStringRef = useRef<string>("")
  const availableWidthRef = useRef<number>(0)

  // Reusable canvas for text measurement - avoids creating new canvas on every keystroke
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null)

  // Helper to measure textarea dimensions and cache font/width values
  const updateMeasurements = useCallback(
    (textarea: HTMLTextAreaElement): void => {
      const computedStyle = getComputedStyle(textarea)
      fontStringRef.current = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`

      const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0
      const paddingRight = parseFloat(computedStyle.paddingRight) || 0
      availableWidthRef.current =
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Safe: runs inside ResizeObserver callback or useLayoutEffect after paint
        textarea.clientWidth - paddingLeft - paddingRight
    },
    []
  )

  // Measure textarea when it becomes visible (e.g., after recording ends)
  // useLayoutEffect runs synchronously after DOM mutations, guaranteeing the ref exists
  // This is more reliable than setTimeout which has no timing guarantees
  useLayoutEffect(() => {
    const textarea = chatInputRef.current
    if (!textarea) {
      return
    }

    // Measure immediately
    updateMeasurements(textarea)

    // Set up ResizeObserver for future resizes
    const observer = new ResizeObserver(() => updateMeasurements(textarea))
    observer.observe(textarea)

    return () => observer.disconnect()
  }, [updateMeasurements, isStacked])

  // Manage stacked layout mode transitions
  // Switch to stacked when text fills the available width
  useEffect(() => {
    if (value === "") {
      setIsStacked(false)
      return
    }

    if (isStacked) {
      return
    }

    const textarea = chatInputRef.current
    if (!textarea) {
      return
    }

    // If measurements aren't cached yet, compute them now
    if (availableWidthRef.current <= 0 || !fontStringRef.current) {
      updateMeasurements(textarea)
    }

    // Still no measurements? Can't determine layout
    if (availableWidthRef.current <= 0 || !fontStringRef.current) {
      return
    }

    // Canvas measureText is cheap - doesn't force reflow
    // Reuse canvas element to avoid GC churn on every keystroke
    if (!measureCanvasRef.current) {
      measureCanvasRef.current = document.createElement("canvas")
      measureCtxRef.current = measureCanvasRef.current.getContext("2d")
    }
    const ctx = measureCtxRef.current
    if (ctx) {
      ctx.font = fontStringRef.current
      const textWidth = ctx.measureText(value).width

      // Switch to stacked when text width approaches available width
      // Use a small buffer (10px) to trigger before text actually touches the edge
      if (textWidth > availableWidthRef.current - 10) {
        setIsStacked(true)
      }
    }
  }, [value, isStacked, updateMeasurements])

  /**
   * @returns True if the user-specified state.value has not yet been synced to
   * the WidgetStateManager.
   */
  const dirty = useMemo(() => {
    if (files.some(f => f.status.type === "uploading")) {
      return false
    }

    return (
      value !== "" ||
      files.length > 0 ||
      pendingAudio !== null ||
      pendingVideo !== null
    )
  }, [files, value, pendingAudio, pendingVideo])

  const acceptFile = chatInputAcceptFileProtoValueToEnum(element.acceptFile)
  const maxFileSize = sizeConverter(
    element.maxUploadSizeMb,
    FileSize.Megabyte,
    FileSize.Byte
  )

  const addFiles = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- setFiles is a stable setter
    (filesToAdd: UploadFileInfo[]): void =>
      setFiles(currentFiles => [...currentFiles, ...filesToAdd]),
    []
  )

  const deleteUploadedFile = useCallback(
    (file: UploadFileInfo): void => {
      // Abort ongoing upload if file is still uploading
      if (file.status.type === "uploading") {
        file.status.abortController.abort()
      }

      // Delete file from server if it was successfully uploaded
      if (file.status.type === "uploaded" && file.status.fileUrls.deleteUrl) {
        // Fire-and-forget deletion - errors are not critical to user flow
        uploadClient
          .deleteFile(file.status.fileUrls.deleteUrl)
          .catch(error => {
            // Log deletion errors for observability, but don't block the user
            // File may already be deleted or server unavailable
            LOG.error("Failed to delete file from server:", error)
          })
      }
    },
    [uploadClient]
  )

  const deleteFile = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- setFiles and setDropzoneResetCounter are stable setters
    (fileId: number): void => {
      setFiles(prevFiles => {
        const file = getFile(fileId, prevFiles)
        if (isNullOrUndefined(file)) {
          return prevFiles
        }

        deleteUploadedFile(file)

        const newFiles = prevFiles.filter(fileArg => fileArg.id !== fileId)

        // Reset dropzone when all files are cleared
        if (newFiles.length === 0) {
          setDropzoneResetCounter(c => c + 1)
        }

        return newFiles
      })
    },
    [deleteUploadedFile]
  )

  // Reference to dropHandler for retry functionality
  // This is set after dropHandler is created below
  const dropHandlerRef = useRef<
    ((acceptedFiles: File[], rejectedFiles: never[]) => void) | null
  >(null)

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- dropHandlerRef is a ref, setFiles is a stable setter
  const handleRetry = useCallback((fileInfo: UploadFileInfo): void => {
    if (!fileInfo.file || fileInfo.status.type !== "error") {
      return
    }

    // Remove the failed file from state
    setFiles(prevFiles => prevFiles.filter(f => f.id !== fileInfo.id))

    // Re-trigger the upload using the drop handler
    if (dropHandlerRef.current) {
      dropHandlerRef.current([fileInfo.file], [])
    }
  }, [])

  const createChatInputWidgetFilesValue =
    useCallback((): FileUploaderStateProto => {
      const uploadedFileInfo: UploadedFileInfoProto[] = files
        .filter(f => f.status.type === "uploaded")
        .map(f => {
          const { name, size, status } = f
          const { fileId, fileUrls } = status as UploadedStatus
          return new UploadedFileInfoProto({
            fileId,
            fileUrls,
            name,
            size,
          })
        })

      return new FileUploaderStateProto({ uploadedFileInfo })
    }, [files])

  const getNextLocalFileId = (): number => {
    return counterRef.current++
  }

  const dropHandler = createDropHandler({
    acceptMultipleFiles:
      acceptFile === AcceptFileValue.Multiple ||
      acceptFile === AcceptFileValue.Directory,
    maxFileSize: maxFileSize,
    uploadClient: uploadClient,
    uploadFile: createUploadFileHandler({
      getNextLocalFileId,
      addFiles,
      updateFile: (id: number, fileInfo: UploadFileInfo) => {
        setFiles(prevFiles => updateFile(id, fileInfo, prevFiles))
      },
      uploadClient,
      element,
      onUploadProgress: (e: AxiosProgressEvent, fileId: number) => {
        setFiles(prevFiles => {
          const file = getFile(fileId, prevFiles)
          if (isNullOrUndefined(file) || file.status.type !== "uploading") {
            return prevFiles
          }

          const newProgress = e.total
            ? Math.round((e.loaded * 100) / e.total)
            : 0
          if (file.status.progress === newProgress) {
            return prevFiles
          }

          return updateFile(
            fileId,
            file.setStatus({
              type: "uploading",
              abortController: file.status.abortController,
              progress: newProgress,
            }),
            prevFiles
          )
        })
      },
      onUploadComplete: (id: number, fileUrls: IFileURLs) => {
        setFiles(prevFiles => {
          const curFile = getFile(id, prevFiles)
          if (
            isNullOrUndefined(curFile) ||
            curFile.status.type !== "uploading"
          ) {
            // The file may have been canceled right before the upload
            // completed. In this case, we just bail.
            return prevFiles
          }

          return updateFile(
            curFile.id,
            curFile.setStatus({
              type: "uploaded",
              fileId: fileUrls.fileId as string,
              fileUrls,
            }),
            prevFiles
          )
        })
      },
    }),
    addFiles,
    getNextLocalFileId,
    deleteExistingFiles: () => files.forEach(f => deleteFile(f.id)),
    onUploadComplete: () => {
      if (chatInputRef.current) {
        chatInputRef.current.focus()
      }
    },
    element,
  })

  // Store dropHandler in ref for retry functionality
  dropHandlerRef.current = dropHandler

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: dropHandler,
    multiple:
      acceptFile === AcceptFileValue.Multiple ||
      acceptFile === AcceptFileValue.Directory,
    accept: getAccept(element.fileType),
    maxSize: maxFileSize,
    // Disable the File System Access API to avoid browser-specific issues
    // with drag-and-drop uploads (see issue #6176 and FileDropzone usage).
    useFsAccessApi: false,
  })

  const submitChatInput = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- chatInputRef is a ref; setFiles/setValue/setIsStacked/setDropzoneResetCounter are stable setters
    (): void => {
      // We want the chat input to always be in focus
      // even if the user clicks the submit button
      if (chatInputRef.current) {
        chatInputRef.current.focus()
      }

      if (!dirty || disabled) {
        return
      }

      const filesValue = createChatInputWidgetFilesValue()

      const composedValue: IChatInputValue = {
        data: value,
        fileUploaderState: filesValue,
        audioFileInfo: pendingAudio ?? undefined,
        videoFileInfo: pendingVideo ?? undefined,
      }

      widgetMgr.setChatInputValue(
        element,
        composedValue,
        { fromUi: true },
        fragmentId
      )

      // Reset dropzone when files are cleared on submit
      if (files.length > 0) {
        setDropzoneResetCounter(c => c + 1)
      }

      setFiles([])
      setValue("")
      setPendingAudio(null)
      setPendingVideo(null)
      setIsStacked(false)
      autoExpand.clearScrollHeight()
    },
    [
      dirty,
      disabled,
      value,
      files.length,
      pendingAudio,
      pendingVideo,
      createChatInputWidgetFilesValue,
      widgetMgr,
      element,
      fragmentId,
      autoExpand,
    ]
  )

  const uploadMediaToPending = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- refs to abort/input; pending+error setters are stable
    async (
      file: File,
      kind: "audio" | "video",
      setUploading: (uploading: boolean) => void
    ): Promise<void> => {
      try {
        setUploading(true)

        const fileURLsArray = await uploadClient.fetchFileURLs([file])
        if (fileURLsArray.length === 0) {
          throw new Error(`Failed to get upload URL for ${kind} file`)
        }
        const fileUrls = fileURLsArray[0]

        uploadAbortControllerRef.current = new AbortController()
        await uploadClient.uploadFile(
          { formId: "", ...element },
          fileUrls.uploadUrl as string,
          file,
          () => {},
          uploadAbortControllerRef.current.signal
        )

        const info = new UploadedFileInfoProto({
          fileId: fileUrls.fileId as string,
          fileUrls,
          name: file.name,
          size: file.size,
        })

        if (kind === "audio") {
          setPendingAudio(info)
        } else {
          setPendingVideo(info)
        }
      } catch (error) {
        LOG.error(`${kind} upload failed:`, error)
        setRecordingError(
          kind === "audio" ? "Recording failed" : "Video recording failed"
        )
        if (chatInputRef.current) {
          chatInputRef.current.focus()
        }
      } finally {
        setUploading(false)
      }
    },
    [uploadClient, element]
  )

  const handleAudioApprove = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- chatInputRef and uploadAbortControllerRef are refs; setAudioUploading and setRecordingError are stable setters
    async (wav: Blob): Promise<void> => {
      // Convert blob to File
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const audioFile = new File([wav], `audio-${timestamp}.wav`, {
        type: "audio/wav",
      })
      await uploadMediaToPending(audioFile, "audio", setAudioUploading)
    },
    [uploadMediaToPending]
  )

  const handleVideoApprove = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- setVideoUploading is a stable setter
    async (videoBlob: Blob): Promise<void> => {
      // Strip ";codecs=..." — browsers emit different suffixes per container.
      const mimeType =
        (videoBlob.type || "video/webm").split(";")[0].trim() || "video/webm"
      const extension = mimeType.includes("mp4") ? "mp4" : "webm"
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")

      const videoFile = new File(
        [videoBlob],
        `video-${timestamp}.${extension}`,
        { type: mimeType }
      )
      await uploadMediaToPending(videoFile, "video", setVideoUploading)
    },
    [uploadMediaToPending]
  )

  const startVideoRecording = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- media refs; video/recording setters are stable
    async () => {
      if (typeof MediaRecorder === "undefined") {
        setRecordingError("Video recording is not supported in this browser")
        return
      }

      try {
        setRecordingError(null)

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        streamRef.current = stream
        setVideoStream(stream)

        const mimeType = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4",
        ].find(type => MediaRecorder.isTypeSupported(type))

        if (!mimeType) {
          stopAllTracks(stream)
          streamRef.current = null
          setVideoStream(null)
          setRecordingError("No supported video format in this browser")
          return
        }

        const recorder = new MediaRecorder(stream, { mimeType })
        const chunks: Blob[] = []

        recorder.ondataavailable = e => {
          if (e.data.size > 0) {
            chunks.push(e.data)
          }
        }

        recorder.onstop = async () => {
          const approved = videoApprovedRef.current
          videoApprovedRef.current = false
          if (approved) {
            const blob = new Blob(chunks, { type: recorder.mimeType })
            await handleVideoApprove(blob)
          }
          stopAllTracks(stream)
          streamRef.current = null
          setVideoStream(null)
        }

        videoApprovedRef.current = false
        mediaRecorderRef.current = recorder
        recorder.start()
        setIsVideoRecording(true)
      } catch (error) {
        LOG.error("Video recording start failed:", error)
        setRecordingError("Could not access camera")
      }
    },
    [handleVideoApprove, stopAllTracks]
  )

  const stopVideoRecording = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- media refs; video setters are stable
    (approved: boolean) => {
      if (mediaRecorderRef.current && isVideoRecording) {
        videoApprovedRef.current = approved
        mediaRecorderRef.current.stop()
        setIsVideoRecording(false)
        setIsVideoPaused(false)
      }
    },
    [isVideoRecording]
  )

  const handleVideoCancel = useCallback(() => {
    stopVideoRecording(false)
  }, [stopVideoRecording])

  const handleVideoApproveAction = useCallback(() => {
    stopVideoRecording(true)
  }, [stopVideoRecording])

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- ref + stable setter
  const handleVideoPause = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder?.state !== "recording") return
    recorder.pause()
    setIsVideoPaused(true)
  }, [])

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- ref + stable setter
  const handleVideoResume = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder?.state !== "paused") return
    recorder.resume()
    setIsVideoPaused(false)
  }, [])

  const handleVideoClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (!acceptVideo || disabled || isVideoRecording) {
        return
      }
      void startVideoRecording()
    },
    [acceptVideo, disabled, isVideoRecording, startVideoRecording]
  )

  // Memoize events to ensure fresh closures when dependencies change
  const controllerEvents = useMemo(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- setRecordingError is a stable setter
    () => ({
      onApprove: handleAudioApprove,
      onPermissionDenied: () => {
        const errorMessage = "Microphone access denied"
        setRecordingError(errorMessage)
        LOG.error("Permission denied:", errorMessage)
      },
      onError: (error: Error) => {
        const errorMessage = "Recording failed"
        setRecordingError(errorMessage)
        LOG.error("Recording error:", error)
      },
      onRecordStart: () => {
        setRecordingError(null)
      },
    }),
    [handleAudioApprove]
  )

  // Create waveform controller for audio recording
  const controller = useWaveformController({
    containerRef: waveformContainerRef,
    sampleRate: element.audioSampleRate ?? undefined,
    events: controllerEvents,
  })

  const handleSubmit = useCallback((): void => {
    submitChatInput()
  }, [submitChatInput])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    const { metaKey, ctrlKey, shiftKey } = e
    const shouldSubmit =
      isEnterKeyPressed(e) && !shiftKey && !ctrlKey && !metaKey

    if (shouldSubmit) {
      e.preventDefault()

      handleSubmit()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    const { value: targetValue } = e.target

    if (maxChars !== 0 && targetValue.length > maxChars) {
      return
    }

    setValue(targetValue)
    updateScrollHeight()

    // Clear recording error when user starts typing
    if (recordingError) {
      setRecordingError(null)
    }
  }

  const handleMicClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (!acceptAudio || disabled || controller.state === "recording") {
        return
      }

      await controller.start()
    },
    [acceptAudio, disabled, controller]
  )

  const handleRecordingCancel = useCallback(() => {
    controller.cancel()
    if (chatInputRef.current) {
      chatInputRef.current.focus()
    }
  }, [controller])

  const handleRecordingApprove = useCallback(async () => {
    const { blob } = await controller.stop()
    await controller.approve(blob)
  }, [controller])

  // Void wrappers for async handlers to satisfy eslint
  const handleMicClickVoid = useCallback(
    (e: React.MouseEvent) => {
      void handleMicClick(e)
    },
    [handleMicClick]
  )

  const handleRecordingApproveVoid = useCallback(() => {
    void handleRecordingApprove()
  }, [handleRecordingApprove])

  const focusInput = useCallback(() => {
    if (chatInputRef.current) {
      chatInputRef.current.focus()
    }
  }, [])

  // Handle setValue command from backend
  // This runs when element.setValue is true, indicating the backend wants to set a new value
  useEffect(() => {
    if (element.setValue && !processedSetValueRef.current) {
      // Mark this setValue as processed to avoid re-processing
      processedSetValueRef.current = true
      const val = element.value || ""
      setValue(val)
    }
  }, [element.setValue, element.value])

  // Reset the processed flag when element reference changes (new widget instance)
  useEffect(() => {
    processedSetValueRef.current = false
  }, [element])

  useEffect(() => {
    const handleDragEnter = (event: DragEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (!fileDragged && event.dataTransfer?.types.includes("Files")) {
        setFileDragged(true)
      }
    }

    const handleDragLeave = (event: DragEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (fileDragged) {
        // This check prevents the dropzone from flickering since the dragleave
        // event could fire when user is dragging within the window
        if (
          (event.clientX <= 0 && event.clientY <= 0) ||
          (event.clientX >= innerWidth && event.clientY >= innerHeight)
        ) {
          setFileDragged(false)
        }
      }
    }

    const handleDrop = (event: DragEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (fileDragged) {
        setFileDragged(false)
      }
    }

    window.addEventListener("dragover", handleDragEnter)
    window.addEventListener("drop", handleDrop)
    window.addEventListener("dragleave", handleDragLeave)

    return () => {
      window.removeEventListener("dragover", handleDragEnter)
      window.removeEventListener("drop", handleDrop)
      window.removeEventListener("dragleave", handleDragLeave)
    }
  }, [fileDragged, innerWidth, innerHeight])

  const showDropzone = acceptFile !== AcceptFileValue.None && fileDragged
  const isRecording = controller.state === "recording"

  const showInstructions =
    !isRecording &&
    width > convertRemToPx(theme.breakpoints.hideWidgetDetails) &&
    maxChars > 0

  // Calculate minimum height for the textarea based on heightConfig.
  // Subtracts container padding and border from pixel height to get inner textarea height.
  const textareaMinHeight = useMemo((): string | undefined => {
    if (!heightConfig || heightConfig.useContent) {
      return undefined
    }
    if (heightConfig.useStretch) {
      return "100%"
    }
    if (heightConfig.pixelHeight && heightConfig.pixelHeight > 0) {
      const borderWidth = parseInt(theme.sizes.borderWidth, 10) || 1
      const containerPadding =
        convertRemToPx(theme.spacing.md) * 2 + borderWidth * 2
      const adjustedHeight = Math.max(
        0,
        heightConfig.pixelHeight - containerPadding
      )
      return `${adjustedHeight}px`
    }
    return undefined
  }, [heightConfig, theme.sizes.borderWidth, theme.spacing.md])
  const isStretchHeight = heightConfig?.useStretch ?? false
  // Height is explicitly configured via props (stretch or pixel), not from dynamic expansion
  const hasConfiguredHeight =
    isStretchHeight || (heightConfig?.pixelHeight ?? 0) > 0
  // Buttons should stick to bottom when:
  // - height is explicitly configured (stretch or pixel), OR
  // - textarea has dynamically expanded beyond single-line (user added newlines)
  const hasExpandedHeight = hasConfiguredHeight || autoExpand.isExtended

  return (
    <StyledChatInputContainer
      className="stChatInput"
      data-testid="stChatInput"
      ref={elementRef}
      isStretchHeight={isStretchHeight}
    >
      <StyledChatInput isStretchHeight={isStretchHeight}>
        {/* Dropzone overlay - shown when dragging files over */}
        {showDropzone && (
          <ChatFileUploadDropzone
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            acceptFile={acceptFile}
          />
        )}

        {/* Files area - shown above input row when files are uploaded */}
        {acceptFile !== AcceptFileValue.None && files.length > 0 && (
          <StyledFilesArea>
            <UploadedFileChips
              items={[...files]}
              onDelete={deleteFile}
              onRetry={handleRetry}
            />
          </StyledFilesArea>
        )}

        {(pendingAudio || pendingVideo) && (
          <StyledFilesArea>
            {pendingAudio && (
              <StyledPendingMediaChip data-testid="stChatInputPendingAudio">
                <Icon content={MicNone} size="md" color="inherit" />
                <span>{pendingAudio.name}</span>
                <StyledPendingMediaChipRemove
                  onClick={() => setPendingAudio(null)}
                  aria-label="Remove audio recording"
                >
                  <Icon content={Close} size="md" color="inherit" />
                </StyledPendingMediaChipRemove>
              </StyledPendingMediaChip>
            )}
            {pendingVideo && (
              <StyledPendingMediaChip data-testid="stChatInputPendingVideo">
                <Icon content={Videocam} size="md" color="inherit" />
                <span>{pendingVideo.name}</span>
                <StyledPendingMediaChipRemove
                  onClick={() => setPendingVideo(null)}
                  aria-label="Remove video recording"
                >
                  <Icon content={Close} size="md" color="inherit" />
                </StyledPendingMediaChipRemove>
              </StyledPendingMediaChip>
            )}
          </StyledFilesArea>
        )}

        {isVideoRecording && (
          <StyledVideoPreviewContainer>
            {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- local-only camera preview without playback controls */}
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "100%",
                borderRadius: theme.radii.default,
                transform: "scaleX(-1)",
                filter: isVideoPaused ? "blur(8px)" : "none",
                transition: "filter 200ms ease",
              }}
            />
            {!isVideoPaused && <StyledRecordingIndicator />}
            {isVideoPaused && (
              <StyledVideoPausedOverlay>
                <Icon content={Pause} size="threeXL" color="inherit" />
              </StyledVideoPausedOverlay>
            )}
          </StyledVideoPreviewContainer>
        )}

        {/* Main row - contains textarea and button clusters
            When expanded (hasExpandedHeight): column layout with textarea above toolbar row
            When not expanded: row layout (inline or stacked via flex-wrap)
            When recording: waveform replaces textarea inline with cancel/approve buttons */}
        <StyledInputRow
          isStacked={isStacked}
          hasExpandedHeight={hasExpandedHeight && !isRecording}
        >
          {/* Textarea - rendered first in expanded mode (column layout) */}
          {!isRecording && (
            <StyledTextareaWrapper
              isStacked={isStacked}
              hasExpandedHeight={hasExpandedHeight}
            >
              <UITextArea
                inputRef={chatInputRef}
                value={value}
                placeholder={placeholder}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                aria-label={placeholder}
                disabled={disabled}
                rows={1}
                aria-describedby={
                  showInstructions ? "stChatInputInstructions" : undefined
                }
                overrides={createTextAreaOverrides(
                  theme,
                  autoExpand,
                  {
                    width: "100%",
                    ...(hasExpandedHeight ? { flex: 1 } : {}),
                  },
                  textareaMinHeight,
                  hasConfiguredHeight
                )}
              />
            </StyledTextareaWrapper>
          )}

          {/* Toolbar/buttons section - wrapped in StyledToolbarRow when expanded */}
          {hasExpandedHeight && !isRecording ? (
            <StyledToolbarRow>
              <StyledLeftCluster hasExpandedHeight>
                {acceptFile !== AcceptFileValue.None && (
                  <ChatFileUploadButton
                    key={dropzoneResetCounter}
                    onDrop={dropHandler}
                    multiple={
                      acceptFile === AcceptFileValue.Multiple ||
                      acceptFile === AcceptFileValue.Directory
                    }
                    accept={getAccept(element.fileType)}
                    maxSize={maxFileSize}
                    acceptFile={acceptFile}
                    disabled={disabled}
                    fileTypes={element.fileType}
                  />
                )}
              </StyledLeftCluster>

              <StyledRightCluster>
                {showInstructions && (
                  <StyledInputInstructions
                    onClick={focusInput}
                    id="stChatInputInstructions"
                  >
                    <InputInstructions
                      dirty={dirty}
                      value={value}
                      maxLength={maxChars}
                      type="chat"
                      inForm={false}
                      className="stChatInputInstructions"
                    />
                  </StyledInputInstructions>
                )}
                {acceptVideo &&
                  (isVideoRecording ? (
                    <>
                      <StyledSendIconButton
                        onClick={handleVideoCancel}
                        disabled={disabled}
                        data-testid="stChatInputVideoCancelButton"
                        aria-label="Cancel video recording"
                      >
                        <Icon content={Close} size="lg" color="inherit" />
                      </StyledSendIconButton>
                      <StyledSendIconButton
                        onClick={
                          isVideoPaused ? handleVideoResume : handleVideoPause
                        }
                        disabled={disabled}
                        data-testid="stChatInputVideoPauseButton"
                        aria-label={
                          isVideoPaused
                            ? "Resume video recording"
                            : "Pause video recording"
                        }
                      >
                        <Icon
                          content={isVideoPaused ? PlayArrow : Pause}
                          size="lg"
                          color="inherit"
                        />
                      </StyledSendIconButton>
                      <StyledSendIconButton
                        onClick={handleVideoApproveAction}
                        disabled={disabled || videoUploading}
                        data-testid="stChatInputVideoApproveButton"
                        aria-label="Approve video recording"
                      >
                        {videoUploading ? (
                          <DynamicIcon size="lg" iconValue="spinner" />
                        ) : (
                          <Icon content={Check} size="lg" color="inherit" />
                        )}
                      </StyledSendIconButton>
                    </>
                  ) : (
                    <StyledSendIconButton
                      onClick={handleVideoClick}
                      disabled={
                        disabled ||
                        videoUploading ||
                        audioUploading ||
                        pendingVideo !== null
                      }
                      data-testid="stChatInputVideoButton"
                      aria-label="Start video recording"
                    >
                      <Icon content={Videocam} size="xl" color="inherit" />
                    </StyledSendIconButton>
                  ))}
                {acceptAudio && (
                  <>
                    {recordingError ? (
                      <Tooltip
                        content={recordingError}
                        placement={Placement.TOP}
                        error
                      >
                        <StyledSendIconButton
                          onClick={handleMicClickVoid}
                          disabled={
                            disabled || audioUploading || pendingAudio !== null
                          }
                          hasError
                          data-testid="stChatInputMicButton"
                          aria-label="Start recording"
                        >
                          <Icon
                            content={ErrorOutline}
                            size="xl"
                            color="inherit"
                          />
                        </StyledSendIconButton>
                      </Tooltip>
                    ) : (
                      <StyledSendIconButton
                        onClick={handleMicClickVoid}
                        disabled={
                          disabled || audioUploading || pendingAudio !== null
                        }
                        data-testid="stChatInputMicButton"
                        aria-label="Start recording"
                      >
                        <Icon content={MicNone} size="xl" color="inherit" />
                      </StyledSendIconButton>
                    )}
                  </>
                )}
                <StyledSendIconButton
                  onClick={handleSubmit}
                  disabled={
                    !dirty ||
                    disabled ||
                    audioUploading ||
                    videoUploading ||
                    isVideoRecording
                  }
                  data-testid="stChatInputSubmitButton"
                  aria-label="Send message"
                  primary
                >
                  <Icon content={ArrowUpward} size="lg" color="inherit" />
                </StyledSendIconButton>
              </StyledRightCluster>
            </StyledToolbarRow>
          ) : (
            <>
              <StyledLeftCluster hasExpandedHeight={false}>
                {acceptFile !== AcceptFileValue.None && !isRecording && (
                  <ChatFileUploadButton
                    key={dropzoneResetCounter}
                    onDrop={dropHandler}
                    multiple={
                      acceptFile === AcceptFileValue.Multiple ||
                      acceptFile === AcceptFileValue.Directory
                    }
                    accept={getAccept(element.fileType)}
                    maxSize={maxFileSize}
                    acceptFile={acceptFile}
                    disabled={disabled}
                    fileTypes={element.fileType}
                  />
                )}
              </StyledLeftCluster>

              {/* Waveform - shown inline when recording */}
              <StyledWaveformContainer isRecording={isRecording}>
                <StyledChatAudioWave ref={waveformContainerRef} />
              </StyledWaveformContainer>

              <StyledRightCluster>
                {isRecording ? (
                  <>
                    <StyledSendIconButton
                      onClick={handleRecordingCancel}
                      disabled={disabled}
                      data-testid="stChatInputCancelButton"
                      aria-label="Cancel recording"
                    >
                      <Icon content={Close} size="lg" color="inherit" />
                    </StyledSendIconButton>
                    <StyledSendIconButton
                      onClick={handleRecordingApproveVoid}
                      disabled={disabled || audioUploading}
                      data-testid="stChatInputApproveButton"
                      aria-label="Submit recording"
                    >
                      {audioUploading ? (
                        <DynamicIcon size="lg" iconValue="spinner" />
                      ) : (
                        <Icon content={Check} size="lg" color="inherit" />
                      )}
                    </StyledSendIconButton>
                  </>
                ) : (
                  <>
                    {showInstructions && (
                      <StyledInputInstructions
                        onClick={focusInput}
                        id="stChatInputInstructions"
                      >
                        <InputInstructions
                          dirty={dirty}
                          value={value}
                          maxLength={maxChars}
                          type="chat"
                          inForm={false}
                          className="stChatInputInstructions"
                        />
                      </StyledInputInstructions>
                    )}
                    {acceptVideo &&
                      (isVideoRecording ? (
                        <>
                          <StyledSendIconButton
                            onClick={handleVideoCancel}
                            disabled={disabled}
                            data-testid="stChatInputVideoCancelButton"
                            aria-label="Cancel video recording"
                          >
                            <Icon content={Close} size="lg" color="inherit" />
                          </StyledSendIconButton>
                          <StyledSendIconButton
                            onClick={
                              isVideoPaused
                                ? handleVideoResume
                                : handleVideoPause
                            }
                            disabled={disabled}
                            data-testid="stChatInputVideoPauseButton"
                            aria-label={
                              isVideoPaused
                                ? "Resume video recording"
                                : "Pause video recording"
                            }
                          >
                            <Icon
                              content={isVideoPaused ? PlayArrow : Pause}
                              size="lg"
                              color="inherit"
                            />
                          </StyledSendIconButton>
                          <StyledSendIconButton
                            onClick={handleVideoApproveAction}
                            disabled={disabled || videoUploading}
                            data-testid="stChatInputVideoApproveButton"
                            aria-label="Approve video recording"
                          >
                            {videoUploading ? (
                              <DynamicIcon size="lg" iconValue="spinner" />
                            ) : (
                              <Icon
                                content={Check}
                                size="lg"
                                color="inherit"
                              />
                            )}
                          </StyledSendIconButton>
                        </>
                      ) : (
                        <StyledSendIconButton
                          onClick={handleVideoClick}
                          disabled={
                            disabled ||
                            videoUploading ||
                            audioUploading ||
                            pendingVideo !== null
                          }
                          data-testid="stChatInputVideoButton"
                          aria-label="Start video recording"
                        >
                          <Icon content={Videocam} size="xl" color="inherit" />
                        </StyledSendIconButton>
                      ))}
                    {acceptAudio && (
                      <>
                        {recordingError ? (
                          <Tooltip
                            content={recordingError}
                            placement={Placement.TOP}
                            error
                          >
                            <StyledSendIconButton
                              onClick={handleMicClickVoid}
                              disabled={
                                disabled ||
                                audioUploading ||
                                pendingAudio !== null
                              }
                              hasError
                              data-testid="stChatInputMicButton"
                              aria-label="Start recording"
                            >
                              <Icon
                                content={ErrorOutline}
                                size="xl"
                                color="inherit"
                              />
                            </StyledSendIconButton>
                          </Tooltip>
                        ) : (
                          <StyledSendIconButton
                            onClick={handleMicClickVoid}
                            disabled={
                              disabled ||
                              audioUploading ||
                              pendingAudio !== null
                            }
                            data-testid="stChatInputMicButton"
                            aria-label="Start recording"
                          >
                            <Icon
                              content={MicNone}
                              size="xl"
                              color="inherit"
                            />
                          </StyledSendIconButton>
                        )}
                      </>
                    )}
                    <StyledSendIconButton
                      onClick={handleSubmit}
                      disabled={
                        !dirty ||
                        disabled ||
                        audioUploading ||
                        videoUploading ||
                        isVideoRecording
                      }
                      data-testid="stChatInputSubmitButton"
                      aria-label="Send message"
                      primary
                    >
                      <Icon content={ArrowUpward} size="lg" color="inherit" />
                    </StyledSendIconButton>
                  </>
                )}
              </StyledRightCluster>
            </>
          )}
        </StyledInputRow>
      </StyledChatInput>
    </StyledChatInputContainer>
  )
}

export default memo(ChatInput)
