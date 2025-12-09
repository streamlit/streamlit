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

import React, { FC, memo, useCallback } from "react"

import { ErrorOutline } from "@emotion-icons/material-outlined"
import { Cancel } from "@emotion-icons/material-rounded"

import BaseButton, { BaseButtonKind } from "~lib/components/shared/BaseButton"
import Icon, { DynamicIcon } from "~lib/components/shared/Icon"
import { UploadFileInfo } from "~lib/components/widgets/FileUploader/UploadFileInfo"
import { assertNever } from "~lib/util/assertNever"
import { FileSize, getSizeDisplay } from "~lib/util/FileHelper"

import { getFileTypeIcon } from "./getFileTypeIcon"
import {
  StyledChatUploadedFile,
  StyledChatUploadedFileDeleteButton,
  StyledChatUploadedFileError,
  StyledChatUploadedFileIconContainer,
  StyledChatUploadedFileInfo,
  StyledChatUploadedFileName,
  StyledChatUploadedFileSize,
} from "./styled-components"
import { truncateFilename } from "./truncateFilename"

export interface Props {
  fileInfo: UploadFileInfo
  onDelete: (id: number) => void
  onRetry?: (fileInfo: UploadFileInfo) => void
}

export interface ChatUploadedFileIconProps {
  fileInfo: UploadFileInfo
}

export const ChatUploadedFileIcon: FC<ChatUploadedFileIconProps> = ({
  fileInfo,
}) => {
  const { type } = fileInfo.status

  switch (type) {
    case "uploading":
      return (
        <DynamicIcon
          iconValue="spinner"
          testid="stChatInputFileIconSpinner"
          size="lg"
        />
      )
    case "error":
      return (
        <Icon
          content={ErrorOutline}
          size="lg"
          testid="stChatInputFileIconError"
        />
      )
    case "uploaded":
      return <Icon content={getFileTypeIcon(fileInfo.name)} size="lg" />
    default:
      assertNever(type)
      return null
  }
}

const ChatUploadedFile = ({
  fileInfo,
  onDelete,
  onRetry,
}: Props): React.ReactElement => {
  const statusType = fileInfo.status.type
  const isError = statusType === "error"
  const isUploading = statusType === "uploading"
  const canRetry =
    isError && onRetry !== undefined && fileInfo.file !== undefined

  // Extract error message once to avoid duplication
  const errorMessage =
    fileInfo.status.type === "error"
      ? fileInfo.status.errorMessage
      : "Upload failed"

  const handleChipClick = useCallback(() => {
    if (canRetry) {
      onRetry(fileInfo)
    }
  }, [canRetry, onRetry, fileInfo])

  const handleChipKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (canRetry && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault()
        onRetry(fileInfo)
      }
    },
    [canRetry, onRetry, fileInfo]
  )

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDelete(fileInfo.id)
    },
    [onDelete, fileInfo.id]
  )

  // Determine aria-label for delete button based on state
  const deleteButtonAriaLabel = isUploading
    ? `Cancel upload of ${fileInfo.name}`
    : `Remove ${fileInfo.name}`

  // Determine aria-label for the file chip
  const sizeDisplay = getSizeDisplay(fileInfo.size, FileSize.Byte)
  const chipAriaLabel = isError
    ? `${fileInfo.name}, ${errorMessage}`
    : `${fileInfo.name}, ${sizeDisplay}`

  return (
    <StyledChatUploadedFile
      className="stChatInputFile"
      data-testid="stChatInputFile"
      isError={isError}
      isClickable={canRetry}
      onClick={canRetry ? handleChipClick : undefined}
      onKeyDown={canRetry ? handleChipKeyDown : undefined}
      title={canRetry ? "Click to retry upload" : undefined}
      role={canRetry ? "button" : undefined}
      tabIndex={canRetry ? 0 : undefined}
      aria-label={chipAriaLabel}
    >
      <StyledChatUploadedFileIconContainer fileStatus={statusType}>
        <ChatUploadedFileIcon fileInfo={fileInfo} />
      </StyledChatUploadedFileIconContainer>
      <StyledChatUploadedFileInfo>
        <StyledChatUploadedFileName
          className="stChatInputFileName"
          data-testid="stChatInputFileName"
          title={fileInfo.name}
          fileStatus={fileInfo.status}
        >
          {truncateFilename(fileInfo.name)}
        </StyledChatUploadedFileName>
        {isError ? (
          <StyledChatUploadedFileError data-testid="stChatInputFileError">
            {errorMessage}
          </StyledChatUploadedFileError>
        ) : (
          <StyledChatUploadedFileSize>
            {getSizeDisplay(fileInfo.size, FileSize.Byte)}
          </StyledChatUploadedFileSize>
        )}
      </StyledChatUploadedFileInfo>
      <StyledChatUploadedFileDeleteButton data-testid="stChatInputDeleteBtn">
        <BaseButton
          onClick={handleDeleteClick}
          kind={BaseButtonKind.MINIMAL}
          aria-label={deleteButtonAriaLabel}
        >
          <Icon content={Cancel} size="md" />
        </BaseButton>
      </StyledChatUploadedFileDeleteButton>
    </StyledChatUploadedFile>
  )
}

export default memo(ChatUploadedFile)
