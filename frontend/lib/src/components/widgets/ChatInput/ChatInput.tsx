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

import { Send } from "@emotion-icons/material-rounded"
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

import Icon from "~lib/components/shared/Icon"
import InputInstructions from "~lib/components/shared/InputInstructions/InputInstructions"
import {
  UploadedStatus,
  UploadFileInfo,
} from "~lib/components/widgets/FileUploader/UploadFileInfo"
import { getAccept } from "~lib/components/widgets/FileUploader/utils"
import { FileUploadClient } from "~lib/FileUploadClient"
import { useCalculatedWidth } from "~lib/hooks/useCalculatedWidth"
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
  StyledChatInput,
  StyledChatInputContainer,
  StyledInputInstructionsContainer,
  StyledSendIconButton,
  StyledSendIconButtonContainer,
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

  const [width, elementRef] = useCalculatedWidth()
  const { innerWidth, innerHeight } = useWindowDimensionsContext()

  // The value specified by the user via the UI. If the user didn't touch this widget's UI, the default value is used.
  const [value, setValue] = useState(element.default)
  const [files, setFiles] = useState<UploadFileInfo[]>([])
  const [fileDragged, setFileDragged] = useState(false)

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

  const deleteFile = useCallback(
    (fileId: number): void => {
      setFiles(prevFiles => {
        const file = getFile(fileId, prevFiles)
        if (isNullOrUndefined(file)) {
          return prevFiles
        }

        if (file.status.type === "uploading") {
          // Cancel request as the file hasn't been uploaded.
          // However, it may have been received by the server so we'd still
          // send out a request to delete it.
          file.status.abortController.abort()
        }

        if (
          file.status.type === "uploaded" &&
          file.status.fileUrls.deleteUrl
        ) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
          uploadClient.deleteFile(file.status.fileUrls.deleteUrl)
        }

        return prevFiles.filter(fileArg => fileArg.id !== fileId)
      })
    },
    [uploadClient]
  )

  const createChatInputWidgetFilesValue = (): FileUploaderStateProto => {
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
  }

  const getNextLocalFileId = (): number => {
    return counterRef.current++
  }

  const dropHandler = createDropHandler({
    acceptMultipleFiles: acceptFile === AcceptFileValue.Multiple,
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
  })

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: dropHandler,
    multiple: acceptFile === AcceptFileValue.Multiple,
    accept: getAccept(element.fileType),
    maxSize: maxFileSize,
  })

  const handleSubmit = (): void => {
    // We want the chat input to always be in focus
    // even if the user clicks the submit button
    if (chatInputRef.current) {
      chatInputRef.current.focus()
    }

    if (!dirty || disabled) {
      return
    }

    const composedValue: IChatInputValue = {
      data: value,
      fileUploaderState: createChatInputWidgetFilesValue(),
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
  }

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
  }

  useEffect(() => {
    if (element.setValue) {
      // We are intentionally setting this to avoid regularly calling this effect.
      // TODO: Update to match React best practices
      // eslint-disable-next-line react-hooks/react-compiler
      element.setValue = false
      const val = element.value || ""
      setValue(val)
    }
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
          <StyledChatInput extended={autoExpand.isExtended}>
            {acceptFile === AcceptFileValue.None ? null : (
              <ChatFileUploadButton
                getRootProps={getRootProps}
                getInputProps={getInputProps}
                acceptFile={acceptFile}
                disabled={disabled}
                theme={theme}
              />
            )}
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
                    // Calculate the right padding to account for the send icon (iconSizes.xl + 2 * spacing.sm)
                    // and some additional margin between the icon and the text (spacing.sm).
                    paddingRight: `calc(${theme.iconSizes.xl} + 2 * ${theme.spacing.sm} + ${theme.spacing.sm})`,
                  },
                },
              }}
            />
            {/* Hide the character limit in small widget sizes */}
            {width > theme.breakpoints.hideWidgetDetails && (
              <StyledInputInstructionsContainer>
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
            <StyledSendIconButtonContainer>
              <StyledSendIconButton
                onClick={handleSubmit}
                disabled={!dirty || disabled}
                extended={autoExpand.isExtended}
                data-testid="stChatInputSubmitButton"
              >
                <Icon content={Send} size="xl" color="inherit" />
              </StyledSendIconButton>
            </StyledSendIconButtonContainer>
          </StyledChatInput>
        )}
      </StyledChatInputContainer>
    </>
  )
}

export default memo(ChatInput)
