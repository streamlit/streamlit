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
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react"

import axios from "axios"

import { useTheme } from "@emotion/react"
import { Send } from "@emotion-icons/material-rounded"
import { Textarea as UITextArea } from "baseui/textarea"

import {
  ChatInput as ChatInputProto,
  IChatInputValue,
} from "@streamlit/lib/src/proto"
import {
  WidgetInfo,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"
import Icon from "@streamlit/lib/src/components/shared/Icon"
import InputInstructions from "@streamlit/lib/src/components/shared/InputInstructions/InputInstructions"
import { hasLightBackgroundColor } from "@streamlit/lib/src/theme"
import { useDropzone } from "react-dropzone"
import { FileRejection } from "react-dropzone"
import zip from "lodash/zip"

import BaseButton, {
  BaseButtonKind,
} from "@streamlit/lib/src/components/shared/BaseButton"
import {
  StyledChatInput,
  StyledChatInputContainer,
  StyledInputInstructionsContainer,
  StyledSendIconButton,
  StyledSendIconButtonContainer,
  StyledVerticalDivider,
} from "./styled-components"

import { FileUploadClient } from "@streamlit/lib/src/FileUploadClient"

import {
  UploadedStatus,
  UploadFileInfo,
  UploadingStatus,
} from "@streamlit/lib/src/components/widgets/FileUploader/UploadFileInfo"

import {
  FileUploader as FileUploaderProto,
  FileUploaderState as FileUploaderStateProto,
  FileURLs as FileURLsProto,
  IFileURLs,
  UploadedFileInfo as UploadedFileInfoProto,
} from "@streamlit/lib/src/proto"
import { set } from "lodash"
import UploadedFiles from "../FileUploader/UploadedFiles"
import { AttachFile } from "@emotion-icons/material-outlined"

export interface Props {
  disabled: boolean
  element: ChatInputProto
  widgetMgr: WidgetStateManager
  width: number
  uploadClient: FileUploadClient
  fragmentId?: string
}

interface CreateDropHandlerParams {
  acceptMultipleFiles: boolean
  uploadClient: FileUploadClient
  uploadFile: (fileURLs: FileURLsProto, file: File) => void
  addFiles: (files: UploadFileInfo[]) => void
  getNextLocalFileId: () => number
  deleteExistingFiles: () => void
  onUploadComplete: () => void
}

const createDropHandler =
  ({
    acceptMultipleFiles,
    uploadClient,
    uploadFile,
    addFiles,
    getNextLocalFileId,
    deleteExistingFiles,
    onUploadComplete,
  }: CreateDropHandlerParams) =>
  (acceptedFiles: File[], rejectedFiles: FileRejection[]): void => {
    // If this is a single-file uploader and multiple files were dropped,
    // all the files will be rejected. In this case, we pull out the first
    // valid file into acceptedFiles, and reject the rest.
    if (
      !acceptMultipleFiles &&
      acceptedFiles.length === 0 &&
      rejectedFiles.length > 1
    ) {
      const firstFileIndex = rejectedFiles.findIndex(
        file =>
          file.errors.length === 1 && file.errors[0].code === "too-many-files"
      )

      if (firstFileIndex >= 0) {
        acceptedFiles.push(rejectedFiles[firstFileIndex].file)
        rejectedFiles.splice(firstFileIndex, 1)
      }
    }

    if (!acceptMultipleFiles && acceptedFiles.length > 0) {
      deleteExistingFiles()
    }

    uploadClient
      .fetchFileURLs(acceptedFiles)
      .then((fileURLsArray: IFileURLs[]) => {
        zip(fileURLsArray, acceptedFiles).forEach(
          ([fileURLs, acceptedFile]) => {
            uploadFile(fileURLs as FileURLsProto, acceptedFile as File)
          }
        )
      })
      .catch((errorMessage: string) => {
        addFiles(
          acceptedFiles.map(f => {
            return new UploadFileInfo(f.name, f.size, getNextLocalFileId(), {
              type: "error",
              errorMessage,
            })
          })
        )
      })

    // Create an UploadFileInfo for each of our rejected files, and add them to
    // our state.
    if (rejectedFiles.length > 0) {
      const rejectedInfos = rejectedFiles.map(rejected => {
        const { file } = rejected
        return new UploadFileInfo(file.name, file.size, getNextLocalFileId(), {
          type: "error",
          errorMessage: "VAY VAY VAY, MAMA JAN!",
        })
      })
      addFiles(rejectedInfos)
    }

    onUploadComplete()
  }

interface CreateUploadFileParams {
  getNextLocalFileId: () => number
  addFiles: (files: UploadFileInfo[]) => void
  updateFile: (id: number, fileInfo: UploadFileInfo) => void
  uploadClient: FileUploadClient
  element: WidgetInfo
  onUploadProgress: (e: ProgressEvent, id: number) => void
  onUploadComplete: (id: number, fileURLs: IFileURLs) => void
}
const createUploadFileHandler =
  ({
    getNextLocalFileId,
    addFiles,
    updateFile,
    uploadClient,
    element,
    onUploadProgress,
    onUploadComplete,
  }: CreateUploadFileParams) =>
  (fileURLs: IFileURLs, file: File): void => {
    // Create an UploadFileInfo for this file and add it to our state.
    const cancelToken = axios.CancelToken.source()
    const uploadingFileInfo = new UploadFileInfo(
      file.name,
      file.size,
      getNextLocalFileId(),
      {
        type: "uploading",
        cancelToken,
        progress: 1,
      }
    )
    addFiles([uploadingFileInfo])

    uploadClient
      .uploadFile(
        {
          formId: "", // TODO[kajarnec] fix this probably with uploadFile refactoring
          ...element,
        },
        fileURLs.uploadUrl as string,
        file,
        e => onUploadProgress(e, uploadingFileInfo.id),
        cancelToken.token
      )
      .then(() => onUploadComplete(uploadingFileInfo.id, fileURLs))
      .catch(err => {
        console.log("ERROR!!!")
        console.error(err)
        // If this was a cancel error, we don't show the user an error -
        // the cancellation was in response to an action they took.
        if (!axios.isCancel(err)) {
          updateFile(
            uploadingFileInfo.id,
            uploadingFileInfo.setStatus({
              type: "error",
              errorMessage: err ? err.toString() : "Unknown error",
            })
          )
        }
      })
  }

// We want to show easily that there's scrolling so we deliberately choose
// a half size.
const MAX_VISIBLE_NUM_LINES = 6.5
// Rounding errors can arbitrarily create scrollbars. We add a rounding offset
// to manage it better.
const ROUNDING_OFFSET = 1

const isEnterKeyPressed = (
  event: KeyboardEvent<HTMLTextAreaElement>
): boolean => {
  // Using keyCode as well due to some different behaviors on Windows
  // https://bugs.chromium.org/p/chromium/issues/detail?id=79407

  const { keyCode, key } = event
  return (
    (key === "Enter" || keyCode === 13 || keyCode === 10) &&
    // Do not send the sentence being composed when Enter is typed into the IME.
    !(event.nativeEvent?.isComposing === true)
  )
}

function ChatInput({
  width,
  element,
  widgetMgr,
  fragmentId,
  uploadClient,
}: Props): React.ReactElement {
  const theme = useTheme()

  // True if the user-specified state.value has not yet been synced to the WidgetStateManager.
  const [dirty, setDirty] = useState(false)
  // The value specified by the user via the UI. If the user didn't touch this widget's UI, the default value is used.
  const [value, setValue] = useState(element.default)
  // The value of the height of the textarea. It depends on a variety of factors including the default height, and autogrowing
  const [scrollHeight, setScrollHeight] = useState(0)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const heightGuidance = useRef({ minHeight: 0, maxHeight: 0 })

  // const filesRef = useRef<UploadFileInfo[]>([]) // TODO [kajarnec] refactor this to use only state
  const [files, setFiles] = useState<UploadFileInfo[]>([])
  const addFiles = (filesToAdd: UploadFileInfo[]) => {
    setFiles(currentFiles => [...currentFiles, ...filesToAdd])
    // filesRef.current = [...filesRef.current, ...filesToAdd]
  }

  const isDirty = (value: string, files: UploadFileInfo[]): boolean => {
    // TODO [kajarnec] add explanatory comment here.
    if (files.some(f => f.status.type === "uploading")) {
      return false
    }
    return value !== "" || files.length > 0
  }

  const updateFile = (
    id: number,
    fileInfo: UploadFileInfo,
    currentFiles: UploadFileInfo[]
  ) => {
    return currentFiles.map(f => (f.id === id ? fileInfo : f))
  }

  const getFile = (
    localFileId: number,
    currentFiles: UploadFileInfo[]
  ): UploadFileInfo | undefined => {
    return currentFiles.find(f => f.id === localFileId)
  }

  const deleteFile = (fileId: number): void => {
    setFiles(files => {
      const file = getFile(fileId, files)
      if (file == null) {
        return files
      }

      if (file.status.type === "uploading") {
        // The file hasn't been uploaded. Let's cancel the request.
        // However, it may have been received by the server so we'll still
        // send out a request to delete.
        file.status.cancelToken.cancel()
      }

      if (file.status.type === "uploaded" && file.status.fileUrls.deleteUrl) {
        uploadClient.deleteFile(file.status.fileUrls.deleteUrl)
      }

      return files.filter(file => file.id !== fileId)
    })
  }

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

  const counterRef = useRef(0)
  const getNextLocalFileId = () => {
    return counterRef.current++
  }

  const dropHandler = createDropHandler({
    acceptMultipleFiles: element.acceptFile === "multiple",
    uploadClient: uploadClient,
    uploadFile: createUploadFileHandler({
      getNextLocalFileId,
      addFiles,
      updateFile: (id, fileInfo) => {
        setFiles(files => updateFile(id, fileInfo, files))
      },
      uploadClient,
      element,
      onUploadProgress: (e, fileId) => {
        setFiles(files => {
          console.log("PROGRESSSS....")
          const file = getFile(fileId, files)
          console.log("THE FILE: ", file)

          if (file == null || file.status.type !== "uploading") {
            return files
          }
          const newProgress = Math.round((e.loaded * 100) / e.total)
          if (file.status.progress === newProgress) {
            return files
          }

          return updateFile(
            fileId,
            file.setStatus({
              type: "uploading",
              cancelToken: file.status.cancelToken,
              progress: newProgress,
            }),
            files
          )
        })
      },
      onUploadComplete: (id, fileUrls) => {
        setFiles(files => {
          console.log("IN ON UPLOAD COMPLETE....")
          console.log("ID: ", id)
          console.log("FILE URL: ", fileUrls)

          const curFile = getFile(id, files)
          if (curFile == null || curFile.status.type !== "uploading") {
            // The file may have been canceled right before the upload
            // completed. In this case, we just bail.
            console.log("JUST BEFORE BAD RETURN :( ")
            return files
          }

          return updateFile(
            curFile.id,
            curFile.setStatus({
              type: "uploaded",
              fileId: fileUrls.fileId as string,
              fileUrls,
            }),
            files
          )
        })
      },
    }),
    addFiles,
    getNextLocalFileId,
    deleteExistingFiles: () => {
      files.forEach(f => deleteFile(f.id))
    },
    onUploadComplete: () => {
      if (chatInputRef.current) {
        chatInputRef.current.focus()
      }
    },
  })

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: dropHandler,
    multiple: element.acceptFile === "multiple",
    accept: element.fileType.length > 0 ? element.fileType : undefined,
  })

  const getScrollHeight = (): number => {
    let scrollHeight = 0
    const { current: textarea } = chatInputRef
    if (textarea) {
      const placeholder = textarea.placeholder
      textarea.placeholder = ""
      textarea.style.height = "auto"
      scrollHeight = textarea.scrollHeight
      textarea.placeholder = placeholder
      textarea.style.height = ""
    }

    return scrollHeight
  }

  const getTextAreaBorderStyle = (): React.CSSProperties =>
    element.acceptFile
      ? { border: "none" }
      : {
          // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
          borderLeftWidth: theme.sizes.borderWidth,
          borderRightWidth: theme.sizes.borderWidth,
          borderTopWidth: theme.sizes.borderWidth,
          borderBottomWidth: theme.sizes.borderWidth,
        }

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
    setDirty(false)
    setFiles([])
    setValue("")
    setScrollHeight(0)
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
    const { value } = e.target
    const { maxChars } = element

    if (maxChars !== 0 && value.length > maxChars) {
      return
    }

    setDirty(isDirty(value, files))
    setValue(value)
    setScrollHeight(getScrollHeight())
  }

  useEffect(() => {
    if (element.setValue) {
      // We are intentionally setting this to avoid regularly calling this effect.
      element.setValue = false
      const val = element.value || ""
      setValue(val)
      setDirty(isDirty(val, files))
    }
  }, [element])

  useEffect(() => {
    setDirty(isDirty(value, files))
  }, [files])

  useEffect(() => {
    if (chatInputRef.current) {
      const { offsetHeight } = chatInputRef.current
      heightGuidance.current.minHeight = offsetHeight
      heightGuidance.current.maxHeight = offsetHeight * MAX_VISIBLE_NUM_LINES
    }
  }, [chatInputRef])

  const { disabled, placeholder, maxChars } = element
  const lightTheme = hasLightBackgroundColor(theme)
  const { minHeight, maxHeight } = heightGuidance.current
  const placeholderColor = lightTheme
    ? theme.colors.gray70
    : theme.colors.gray80

  const isInputExtended =
    scrollHeight > 0 && chatInputRef.current
      ? Math.abs(scrollHeight - minHeight) > ROUNDING_OFFSET
      : false

  return (
    <>
      {files.length > 0 && (
        <UploadedFiles
          items={[...files]}
          pageSize={1}
          onDelete={deleteFile}
          resetOnAdd
          style={{
            paddingLeft: 0,
            paddingRight: 0,
          }}
        />
      )}
      <StyledChatInputContainer
        className="stChatInput"
        data-testid="stChatInput"
        width={width}
      >
        <StyledChatInput>
          {element.acceptFile !== "false" ? (
            <>
              <div {...getRootProps()}>
                <input {...getInputProps()} />
                <BaseButton
                  kind={BaseButtonKind.BORDERLESS_ICON}
                  onClick={() => {}}
                  disabled={disabled}
                >
                  <Icon content={AttachFile} size="base" color="inherit" />
                </BaseButton>
              </div>
              <StyledVerticalDivider />
            </>
          ) : null}
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
                  backgroundColor: theme.colors.transparent,
                  ...getTextAreaBorderStyle(),
                },
              },
              InputContainer: {
                style: {
                  backgroundColor: theme.colors.transparent,
                },
              },
              Input: {
                props: {
                  "data-testid": "stChatInputTextArea",
                },
                style: {
                  lineHeight: theme.lineHeights.inputWidget,
                  backgroundColor: theme.colors.transparent,
                  "::placeholder": {
                    color: placeholderColor,
                  },
                  height: isInputExtended
                    ? `${scrollHeight + ROUNDING_OFFSET}px`
                    : "auto",
                  maxHeight: maxHeight ? `${maxHeight}px` : "none",
                  // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                  paddingLeft: theme.spacing.sm,
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
              extended={isInputExtended}
              data-testid="stChatInputSubmitButton"
            >
              <Icon content={Send} size="xl" color="inherit" />
            </StyledSendIconButton>
          </StyledSendIconButtonContainer>
        </StyledChatInput>
      </StyledChatInputContainer>
    </>
  )
}

export default ChatInput
