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
import styled from "@emotion/styled"

import { FileStatus } from "~lib/components/widgets/FileUploader/UploadFileInfo"

// A transparent dropzone overlay that covers the ContentArea
export const StyledChatFileUploadDropzone = styled.div(({ theme }) => ({
  backgroundColor: theme.colors.transparent,
  position: "absolute",
  inset: 0,
  zIndex: theme.zIndices.priority,
  borderRadius: theme.radii.chatInput,
}))

export const StyledChatFileUploadDropzoneLabel = styled.div(({ theme }) => ({
  position: "absolute",
  inset: 0, // Cover the area
  border: `${theme.sizes.borderWidth} solid`,
  borderColor: theme.colors.primary,
  borderRadius: theme.radii.chatInput,
  backgroundColor: theme.colors.secondaryBg,
  color: theme.colors.primary,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: theme.fontWeights.bold,
  pointerEvents: "none", // Pass events through to the dropzone
  zIndex: theme.zIndices.priority, // Ensure it's visible
}))

export interface StyledFileUploadButtonProps {
  disabled: boolean
}

export const StyledFileUploadButton = styled.div<StyledFileUploadButtonProps>(
  ({ disabled }) => ({
    pointerEvents: disabled ? "none" : "auto",
  })
)

export const StyledChatUploadedFiles = styled.div(({ theme }) => ({
  lineHeight: theme.lineHeights.tight,
}))

export const StyledUploadedChatFileList = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing.sm, // Figma: 8px gap between file chips
}))

export const StyledUploadedChatFileListItem = styled.div({
  flex: "0 0 auto",
  maxWidth: "100%",
})

export interface StyledChatUploadedFileProps {
  isError?: boolean
  isClickable?: boolean
}

export const StyledChatUploadedFile = styled.div<StyledChatUploadedFileProps>(
  ({ theme, isError, isClickable }) => ({
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    minWidth: "9rem",
    maxWidth: "100%",
    backgroundColor: isError
      ? theme.colors.redBackgroundColor
      : theme.colors.bgColor,
    padding: theme.spacing.twoXS,
    paddingRight: theme.spacing.twoXL, // Extra padding for absolute positioned X button
    borderRadius: theme.radii.default,
    gap: theme.spacing.sm,
    cursor: isClickable ? "pointer" : "default",
  })
)

// Container for filename and size stacked vertically
export const StyledChatUploadedFileInfo = styled.div({
  display: "flex",
  flexDirection: "column",
  minWidth: 0, // Allow text truncation
})

export interface StyledChatUploadedFileIconContainerProps {
  fileStatus: "uploading" | "uploaded" | "error"
}

export const StyledChatUploadedFileIconContainer =
  styled.div<StyledChatUploadedFileIconContainerProps>(
    ({ theme, fileStatus }) => ({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      width: theme.sizes.chatInputFileIconSize,
      height: theme.sizes.chatInputFileIconSize,
      flexShrink: 0,
      ...(fileStatus === "uploaded" && {
        backgroundColor: theme.colors.bodyText,
        color: theme.colors.bgColor,
      }),
      ...(fileStatus === "uploading" && {
        backgroundColor: theme.colors.fadedText10,
        color: theme.colors.fadedText60,
      }),
      ...(fileStatus === "error" && {
        backgroundColor: theme.colors.redBackgroundColor,
        color: theme.colors.redTextColor,
      }),
    })
  )

export interface StyledChatUploadedFileStatusProps {
  fileStatus: FileStatus
}

export const StyledChatUploadedFileName =
  styled.div<StyledChatUploadedFileStatusProps>(({ theme, fileStatus }) => ({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color:
      fileStatus.type === "uploading"
        ? theme.colors.fadedText60
        : theme.colors.bodyText,
  }))

export const StyledChatUploadedFileSize = styled.div(({ theme }) => ({
  color: theme.colors.fadedText60,
  fontSize: theme.fontSizes.sm,
}))

export const StyledChatUploadedFileError = styled.div(({ theme }) => ({
  color: theme.colors.redTextColor,
  fontSize: theme.fontSizes.sm,
}))

export const StyledChatUploadedFileDeleteButton = styled.small(
  ({ theme }) => ({
    position: "absolute",
    top: theme.spacing.twoXS,
    right: theme.spacing.twoXS,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 0,
    // Circular background for the X button
    "& button": {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "fit-content",
      height: "fit-content",
      minHeight: "unset",
      minWidth: "unset",
      maxHeight: "unset",
      maxWidth: "unset",
      borderRadius: "50%",
      backgroundColor: "transparent",
      color: theme.colors.fadedText20,
      padding: 0,
      overflow: "hidden",
      boxSizing: "border-box",
      lineHeight: 0,
      "&:hover": {
        backgroundColor: "transparent",
        color: theme.colors.fadedText40,
      },
    },
  })
)
