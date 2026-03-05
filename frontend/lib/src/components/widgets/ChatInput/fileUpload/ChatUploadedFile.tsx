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

import { FC, memo, useCallback, useId } from "react"

import { ErrorOutline } from "@emotion-icons/material-outlined"
import { Cancel } from "@emotion-icons/material-rounded"

import BaseButton, { BaseButtonKind } from "~lib/components/shared/BaseButton"
import Icon, { DynamicIcon } from "~lib/components/shared/Icon"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip"
import { UploadFileInfo } from "~lib/components/shared/UploadedFile/UploadFileInfo"
import { assertNever } from "~lib/util/assertNever"
import { FileSize, getSizeDisplay } from "~lib/util/FileHelper"

import { getFileTypeIcon } from "./getFileTypeIcon"
import {
  StyledChatUploadedFile,
  StyledChatUploadedFileDeleteButton,
  StyledChatUploadedFileIconContainer,
  StyledChatUploadedFileImagePreview,
  StyledChatUploadedFileInfo,
  StyledChatUploadedFileName,
  StyledChatUploadedFileSize,
  StyledVisuallyHidden,
} from "./styled-components"
import { truncateFilename } from "./truncateFilename"
import { useImagePreview } from "./useImagePreview"

export interface Props {
  fileInfo: UploadFileInfo
  onDelete: (id: number) => void
  onRetry?: (fileInfo: UploadFileInfo) => void
}

export interface ChatUploadedFileIconProps {
  fileInfo: UploadFileInfo
  imagePreviewUrl: string | null
}

export const ChatUploadedFileIcon: FC<ChatUploadedFileIconProps> = ({
  fileInfo,
  imagePreviewUrl,
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
      if (imagePreviewUrl) {
        return (
          <StyledChatUploadedFileImagePreview
            src={imagePreviewUrl}
            alt={fileInfo.name}
            data-testid="stChatInputFileImagePreview"
          />
        )
      }
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

  // Generate unique ID for aria-describedby linking
  const errorId = useId()

  // Create image preview URL for image files
  const imagePreviewUrl = useImagePreview(fileInfo.file, fileInfo.name)

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
  // Keep aria-label stable (name + size) regardless of error state to avoid
  // double-announcing errors - screen readers get error info via aria-invalid
  // and the visually hidden error message linked by aria-describedby
  const sizeDisplay = getSizeDisplay(fileInfo.size, FileSize.Byte)
  const chipAriaLabel = `${fileInfo.name}, ${sizeDisplay}`

  const fileChip = (
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
      aria-invalid={isError || undefined}
      aria-describedby={isError ? errorId : undefined}
    >
      <StyledChatUploadedFileIconContainer fileStatus={statusType}>
        <ChatUploadedFileIcon
          fileInfo={fileInfo}
          imagePreviewUrl={imagePreviewUrl}
        />
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
        <StyledChatUploadedFileSize>
          {getSizeDisplay(fileInfo.size, FileSize.Byte)}
        </StyledChatUploadedFileSize>
      </StyledChatUploadedFileInfo>
      <StyledChatUploadedFileDeleteButton
        data-testid="stChatInputDeleteBtn"
        isError={isError}
      >
        <BaseButton
          onClick={handleDeleteClick}
          kind={BaseButtonKind.MINIMAL}
          aria-label={deleteButtonAriaLabel}
        >
          <Icon content={Cancel} size="md" />
        </BaseButton>
      </StyledChatUploadedFileDeleteButton>
      {/*
        Accessibility: Error messages are shown in a tooltip on hover, but tooltips
        are portals rendered outside this component and use accessibilityType="tooltip",
        which assistive tech treats as supplementary info. To meet WCAG 3.3.1 (Error
        Identification), we include a visually hidden element with role="alert" that
        screen readers announce immediately, linked via aria-describedby above.
      */}
      {isError && (
        <StyledVisuallyHidden id={errorId} role="alert">
          Error: {errorMessage}
        </StyledVisuallyHidden>
      )}
    </StyledChatUploadedFile>
  )

  if (isError) {
    return (
      <Tooltip content={errorMessage} placement={Placement.TOP} error>
        {fileChip}
      </Tooltip>
    )
  }

  return fileChip
}

export default memo(ChatUploadedFile)
