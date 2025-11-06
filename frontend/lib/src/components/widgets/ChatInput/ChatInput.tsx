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
  ChangeEvent,
  KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  Check,
  Close,
  ErrorOutline,
  Mic,
  Send,
} from "@emotion-icons/material-rounded"
import { Textarea as UITextArea } from "baseui/textarea"
import { useDropzone } from "react-dropzone"

import { useWindowDimensionsContext } from "@streamlit/lib"
import {
  ChatInput as ChatInputProto,
  FileUploaderState as FileUploaderStateProto,
  IChatInputValue,
  IFileURLs,
  UploadedFileInfo as UploadedFileInfoProto,
} from "@streamlit/protobuf"

import { useWaveformController } from "~lib/components/audio"
import { LOG } from "~lib/components/ChatInput/logger"
import Icon, { StyledSpinnerIcon } from "~lib/components/shared/Icon"
import InputInstructions from "~lib/components/shared/InputInstructions/InputInstructions"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip"
import {
  UploadedStatus,
  UploadFileInfo,
} from "~lib/components/widgets/FileUploader/UploadFileInfo"
import { getAccept } from "~lib/components/widgets/FileUploader/utils"
import { FileUploadClient } from "~lib/FileUploadClient"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useTextInputAutoExpand } from "~lib/hooks/useTextInputAutoExpand"
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
import ChatUploadedFiles from "./fileUpload/ChatUploadedFiles"
import { createDropHandler } from "./fileUpload/createDropHandler"
import { createUploadFileHandler } from "./fileUpload/createFileUploadHandler"
import {
  StyledChatAudioWave,
  StyledChatInput,
  StyledChatInputContainer,
  StyledInputInstructionsContainer,
  StyledSendIconButton,
  StyledSendIconButtonContainer,
  StyledWaveformContainer,
} from "./styled-components"

export interface Props {
  disabled: boolean
  element: ChatInputProto
  widgetMgr: WidgetStateManager
  uploadClient: FileUploadClient
  fragmentId?: string
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
}: Props): React.ReactElement {
  const theme = useEmotionTheme()

  const { placeholder, maxChars } = element

  const counterRef = useRef(0)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const processedSetValueRef = useRef(false)
  const waveformContainerRef = useRef<HTMLDivElement>(null)
  const uploadAbortControllerRef = useRef<AbortController | null>(null)

  const { width, elementRef } = useCalculatedDimensions()
  const { innerWidth, innerHeight } = useWindowDimensionsContext()

  // The value specified by the user via the UI. If the user didn't touch this widget's UI, the default value is used.
  const [value, setValue] = useState(element.default)
  const [files, setFiles] = useState<UploadFileInfo[]>([])
  const [fileDragged, setFileDragged] = useState(false)
  const [audioUploading, setAudioUploading] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)

  // Read acceptAudio from the element configuration
  const acceptAudio = element.acceptAudio ?? false

  // Cleanup: abort any in-progress uploads on unmount
  useEffect(() => {
    return () => {
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current.abort()
      }
    }
  }, [])

  const autoExpand = useTextInputAutoExpand({
    textareaRef: chatInputRef,
    dependencies: [placeholder],
  })

  /**
   * @returns True if the user-specified state.value has not yet been synced to
   * the WidgetStateManager.
   */
  const dirty = useMemo(() => {
    if (files.some(f => f.status.type === "uploading")) {
      return false
    }

    return value !== "" || files.length > 0
  }, [files, value])

  const acceptFile = chatInputAcceptFileProtoValueToEnum(element.acceptFile)
  const maxFileSize = sizeConverter(
    element.maxUploadSizeMb,
    FileSize.Megabyte,
    FileSize.Byte
  )

  const addFiles = useCallback(
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
    (fileId: number): void => {
      setFiles(prevFiles => {
        const file = getFile(fileId, prevFiles)
        if (isNullOrUndefined(file)) {
          return prevFiles
        }

        // Handle abort/deletion using shared helper
        deleteUploadedFile(file)

        return prevFiles.filter(fileArg => fileArg.id !== fileId)
      })
    },
    [deleteUploadedFile]
  )

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
    acceptDirectoryFiles: acceptFile === AcceptFileValue.Directory,
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
      onUploadProgress: (e: ProgressEvent, fileId: number) => {
        setFiles(prevFiles => {
          const file = getFile(fileId, prevFiles)
          if (isNullOrUndefined(file) || file.status.type !== "uploading") {
            return prevFiles
          }

          const newProgress = Math.round((e.loaded * 100) / e.total)
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

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: dropHandler,
    multiple:
      acceptFile === AcceptFileValue.Multiple ||
      acceptFile === AcceptFileValue.Directory,
    accept: getAccept(element.fileType),
    maxSize: maxFileSize,
  })

  const submitChatInput = useCallback(
    (audioInfo?: UploadedFileInfoProto): void => {
      // We want the chat input to always be in focus
      // even if the user clicks the submit button
      if (chatInputRef.current) {
        chatInputRef.current.focus()
      }

      // Allow submission if:
      // - dirty=true (user typed text or uploaded files), OR
      // - audioInfo is provided (audio was just recorded and uploaded)
      // Audio bypasses the dirty check because it's uploaded and submitted
      // immediately without being added to the files state.
      if ((!dirty && !audioInfo) || disabled) {
        return
      }

      const filesValue = createChatInputWidgetFilesValue()

      const composedValue: IChatInputValue = {
        data: value,
        fileUploaderState: filesValue,
        audioFileInfo: audioInfo,
      }

      widgetMgr.setChatInputValue(
        element,
        composedValue,
        { fromUi: true },
        fragmentId
      )
      setFiles([])
      setValue("")
      autoExpand.clearScrollHeight()
    },
    [
      dirty,
      disabled,
      value,
      createChatInputWidgetFilesValue,
      widgetMgr,
      element,
      fragmentId,
      autoExpand,
    ]
  )

  // Handle audio approval and upload
  const handleAudioApprove = useCallback(
    async (wav: Blob): Promise<void> => {
      // Convert blob to File
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const audioFile = new File([wav], `audio-${timestamp}.wav`, {
        type: "audio/wav",
      })

      try {
        setAudioUploading(true)

        // 1. Fetch upload URL
        const fileURLsArray = await uploadClient.fetchFileURLs([audioFile])

        if (fileURLsArray.length === 0) {
          throw new Error("Failed to get upload URL for audio file")
        }

        const fileUrls = fileURLsArray[0]

        // 2. Upload audio file with progress tracking
        uploadAbortControllerRef.current = new AbortController()
        await uploadClient.uploadFile(
          {
            formId: "",
            ...element,
          },
          fileUrls.uploadUrl as string,
          audioFile,
          () => {
            // Progress callback - track upload progress (could display percentage if needed)
          },
          uploadAbortControllerRef.current.signal
        )

        // 3. Create audio file info
        const audioInfo = new UploadedFileInfoProto({
          fileId: fileUrls.fileId as string,
          fileUrls,
          name: audioFile.name,
          size: audioFile.size,
        })

        // 4. Submit immediately with audio info
        submitChatInput(audioInfo)
      } catch (error) {
        const errorMessage = "Recording failed"
        LOG.error("Audio upload failed:", error)
        setRecordingError(errorMessage)
        // Refocus on input after error
        if (chatInputRef.current) {
          chatInputRef.current.focus()
        }
      } finally {
        setAudioUploading(false)
      }
    },
    [uploadClient, element, submitChatInput]
  )

  // Memoize events to ensure fresh closures when dependencies change
  const controllerEvents = useMemo(
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
    autoExpand.updateScrollHeight()

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

  return (
    <>
      {acceptFile === AcceptFileValue.None ? null : (
        <ChatUploadedFiles items={[...files]} onDelete={deleteFile} />
      )}
      <StyledChatInputContainer
        className="stChatInput"
        data-testid="stChatInput"
        ref={elementRef}
      >
        {showDropzone ? (
          <ChatFileUploadDropzone
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            acceptFile={acceptFile}
            inputHeight={autoExpand.height}
          />
        ) : (
          <StyledChatInput
            extended={
              autoExpand.isExtended || controller.state === "recording"
            }
          >
            {/* Waveform - always mounted to ensure ref is available for initialization */}
            <StyledWaveformContainer
              isRecording={controller.state === "recording"}
            >
              <StyledChatAudioWave ref={waveformContainerRef} />
            </StyledWaveformContainer>

            {acceptFile === AcceptFileValue.None ||
            controller.state === "recording" ? null : (
              <ChatFileUploadButton
                getRootProps={getRootProps}
                getInputProps={getInputProps}
                acceptFile={acceptFile}
                disabled={disabled}
                theme={theme}
              />
            )}

            {/* Textarea - only shown when not recording */}
            {controller.state !== "recording" && (
              <UITextArea
                inputRef={chatInputRef}
                value={value}
                placeholder={placeholder}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                aria-label={placeholder}
                disabled={disabled}
                rows={1}
                overrides={{
                  Root: {
                    style: {
                      minHeight: theme.sizes.minElementHeight,
                      outline: "none",
                      borderLeftWidth: "0",
                      borderRightWidth: "0",
                      borderTopWidth: "0",
                      borderBottomWidth: "0",
                      borderTopLeftRadius: "0",
                      borderTopRightRadius: "0",
                      borderBottomRightRadius: "0",
                      borderBottomLeftRadius: "0",
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
                      height: autoExpand.height,
                      maxHeight: autoExpand.maxHeight,
                      // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                      paddingLeft: theme.spacing.none,
                      paddingBottom: theme.spacing.sm,
                      paddingTop: theme.spacing.sm,
                      // Calculate the right padding to account for button(s) on the right
                      // Each button is: iconSizes.xl + 2 * spacing.sm (40px total)
                      // When acceptAudio is true, there are 2 buttons (mic + send) = 80px
                      paddingRight: acceptAudio
                        ? `calc(2 * (${theme.iconSizes.xl} + 2 * ${theme.spacing.sm}))`
                        : `calc(${theme.iconSizes.xl} + 2 * ${theme.spacing.sm} + ${theme.spacing.sm})`,
                    },
                  },
                }}
              />
            )}

            {/* Input instructions - hidden during recording */}
            {controller.state !== "recording" &&
              width > theme.breakpoints.hideWidgetDetails && (
                <StyledInputInstructionsContainer acceptAudio={acceptAudio}>
                  <InputInstructions
                    dirty={dirty}
                    value={value}
                    maxLength={maxChars}
                    type="chat"
                    // Chat Input are not able to be used in forms
                    inForm={false}
                  />
                </StyledInputInstructionsContainer>
              )}

            {/* Right-side buttons */}
            <StyledSendIconButtonContainer
              isRecording={controller.state === "recording"}
            >
              {controller.state === "recording" ? (
                <>
                  {/* Cancel button (X icon) */}
                  <StyledSendIconButton
                    onClick={handleRecordingCancel}
                    disabled={disabled}
                    extended={autoExpand.isExtended}
                    data-testid="stChatInputCancelButton"
                  >
                    <Icon content={Close} size="lg" color="inherit" />
                  </StyledSendIconButton>
                  {/* Approve button (✓ icon or spinner during upload) */}
                  <StyledSendIconButton
                    onClick={handleRecordingApproveVoid}
                    disabled={disabled || audioUploading}
                    extended={autoExpand.isExtended}
                    data-testid="stChatInputApproveButton"
                  >
                    {audioUploading ? (
                      <StyledSpinnerIcon size="lg" margin="0" padding="0" />
                    ) : (
                      <Icon content={Check} size="lg" color="inherit" />
                    )}
                  </StyledSendIconButton>
                </>
              ) : (
                <>
                  {/* Mic button */}
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
                            disabled={disabled || audioUploading}
                            extended={autoExpand.isExtended}
                            hasError
                            data-testid="stChatInputMicButton"
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
                          disabled={disabled || audioUploading}
                          extended={autoExpand.isExtended}
                          data-testid="stChatInputMicButton"
                        >
                          <Icon content={Mic} size="xl" color="inherit" />
                        </StyledSendIconButton>
                      )}
                    </>
                  )}
                  {/* Send button */}
                  <StyledSendIconButton
                    onClick={handleSubmit}
                    disabled={!dirty || disabled || audioUploading}
                    extended={autoExpand.isExtended}
                    data-testid="stChatInputSubmitButton"
                  >
                    <Icon content={Send} size="xl" color="inherit" />
                  </StyledSendIconButton>
                </>
              )}
            </StyledSendIconButtonContainer>
          </StyledChatInput>
        )}
      </StyledChatInputContainer>
    </>
  )
}

export default memo(ChatInput)
