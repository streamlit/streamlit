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

export interface StyledFileDropzone {
  isDisabled: boolean
  isDragActive?: boolean
}

export const StyledFileDropzoneSection = styled.section<StyledFileDropzone>(
  ({ isDisabled, isDragActive, theme }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: isDragActive ? "center" : "flex-start",
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.secondaryBg,
    borderRadius: theme.radii.default,
    border: isDragActive
      ? `${theme.sizes.borderWidth} solid ${theme.colors.primary}`
      : theme.colors.widgetBorderColor
        ? `${theme.sizes.borderWidth} solid ${theme.colors.widgetBorderColor}`
        : undefined,
    height: theme.sizes.largestElementHeight,
    color: isDragActive ? theme.colors.primary : "inherit",
    fontWeight: isDragActive ? theme.fontWeights.bold : "inherit",
    ":focus": {
      outline: "none",
    },
    ":focus-visible": {
      boxShadow: `0 0 0 1px ${theme.colors.primary}`,
    },
    cursor: isDisabled ? "not-allowed" : "pointer",
  })
)

export const StyledFileDropzoneInstructions = styled.div(({ theme }) => ({
  alignItems: "center",
  display: "flex",
  paddingLeft: theme.spacing.md,
  flex: "1 1 auto",
  minWidth: 0, // This is crucial for text-overflow: ellipsis to work in flex containers
}))

export const StyledFileDropzoneInstructionsText = styled.span<{
  disabled?: boolean
}>(({ theme, disabled }) => ({
  fontSize: theme.fontSizes.sm,
  color: disabled ? theme.colors.fadedText40 : theme.colors.fadedText60,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}))

export const StyledFileDropzoneButtonWrapper = styled.div({
  flexShrink: 0,
  whiteSpace: "nowrap",
})

export const StyledUploadedFiles = styled.div(({ theme }) => ({
  left: 0,
  right: 0,
  lineHeight: theme.lineHeights.tight,
  paddingTop: theme.spacing.md,
  paddingLeft: theme.spacing.lg,
  paddingRight: theme.spacing.lg,
}))

export const StyledUploadedFilesList = styled.ul(({ theme }) => ({
  listStyleType: "none",
  margin: theme.spacing.none,
  padding: theme.spacing.none,
}))

export const StyledUploadedFilesListItem = styled.li(({ theme }) => ({
  margin: theme.spacing.none,
  padding: theme.spacing.none,
}))

export const StyledUploadedFileData = styled.div({
  display: "flex",
  alignItems: "baseline",
  flex: 1,
  overflow: "hidden",
})

export const StyledUploadedFileName = styled.div(({ theme }) => ({
  marginRight: theme.spacing.sm,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}))

export const StyledUploadedFile = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginBottom: theme.spacing.twoXS,
}))

export const StyledErrorMessage = styled.span(({ theme }) => ({
  marginRight: theme.spacing.twoXS,
}))

export const StyledFileError = styled.small(({ theme }) => ({
  color: theme.colors.red,
  fontSize: theme.fontSizes.sm,
  height: theme.fontSizes.sm,
  lineHeight: theme.fontSizes.sm,
  display: "flex",
  alignItems: "center",
  whiteSpace: "nowrap",
}))

export const StyledFileErrorIcon = styled.span({})

export const StyledFileUploader = styled.div({})
