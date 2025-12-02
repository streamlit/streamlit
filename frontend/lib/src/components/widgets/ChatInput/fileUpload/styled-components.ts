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

export interface StyledFileUploadButtonContainerProps {
  disabled: boolean
}

export const StyledFileUploadButtonContainer =
  styled.div<StyledFileUploadButtonContainerProps>(({ disabled }) => ({
    display: "flex",
    alignItems: "center",
    height: "100%",
    cursor: disabled ? "not-allowed" : "auto",
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
})

export const StyledChatUploadedFile = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  backgroundColor: theme.colors.bgColor,
  padding: theme.spacing.sm,
  borderRadius: theme.radii.default,
  gap: theme.spacing.sm,
}))

export const StyledChatUploadedFileIcon = styled.div(({ theme }) => ({
  color: theme.colors.fadedText60,
}))

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
  marginRight: theme.spacing.md,
  color: theme.colors.fadedText60,
}))

export const StyledChatUploadedFileDeleteButton = styled.small(
  ({ theme }) => ({
    display: "flex",
    alignItems: "center",
    maxHeight: theme.sizes.smallElementHeight,
    color: theme.colors.fadedText60,
    "& :hover": {
      color: theme.colors.bodyText,
    },
  })
)
