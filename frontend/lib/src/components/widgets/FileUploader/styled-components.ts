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

import styled, { CSSObject } from "@emotion/styled"

import { convertRemToPx, EmotionTheme } from "~lib/theme"

export interface StyledFileDropzone {
  isDisabled: boolean
}

export const StyledFileDropzoneSection = styled.section<StyledFileDropzone>(
  ({ isDisabled, theme }) => ({
    display: "flex",
    gap: theme.spacing.lg,
    alignItems: "center",
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.secondaryBg,
    borderRadius: theme.radii.default,
    border: theme.colors.widgetBorderColor
      ? `${theme.sizes.borderWidth} solid ${theme.colors.widgetBorderColor}`
      : undefined,
    height: theme.sizes.largestElementHeight,
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
  marginRight: "auto",
  alignItems: "center",
  display: "flex",
  gap: theme.spacing.lg,
  // Ensure flex children can shrink and allow text truncation
  minWidth: 0,
  width: "100%",
}))

export const StyledFileDropzoneInstructionsFileUploaderIcon = styled.span(
  ({ theme }) => ({
    color: theme.colors.darkenedBgMix100,
  })
)

export const StyledFileDropzoneInstructionsText = styled.span<{
  disabled?: boolean
}>(({ theme, disabled }) => ({
  color: disabled ? theme.colors.fadedText40 : theme.colors.bodyText,
}))

export const StyledFileDropzoneInstructionsSubtext = styled.span<{
  disabled?: boolean
}>(({ theme, disabled }) => ({
  fontSize: theme.fontSizes.sm,
  color: disabled ? theme.colors.fadedText40 : theme.colors.fadedText60,
  // Ellipsis requires a block formatting context and constrained width
  display: "block",
  textOverflow: "ellipsis",
  overflow: "hidden",
  whiteSpace: "nowrap",
  maxWidth: "100%",
}))

export const StyledFileDropzoneInstructionsColumn = styled.div({
  display: "flex",
  flexDirection: "column",
  // Allow child text to shrink inside flex layouts for proper ellipsis
  minWidth: 0,
  maxWidth: "100%",
})

export const StyledButtonNoWrapContainer = styled.span({
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

export const StyledUploadedFileData = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "baseline",
  flex: 1,
  paddingLeft: theme.spacing.lg,
  overflow: "hidden",
}))

export const StyledUploadedFileName = styled.div<{ disabled?: boolean }>(
  ({ theme, disabled }) => ({
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.twoXS,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: disabled ? theme.colors.fadedText40 : theme.colors.bodyText,
  })
)

export const StyledUploadedFile = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginBottom: theme.spacing.twoXS,
}))

export const StyledErrorMessage = styled.span(({ theme }) => ({
  marginRight: theme.spacing.twoXS,
}))

export const StyledFileIcon = styled.div<{ disabled?: boolean }>(
  ({ theme, disabled }) => ({
    display: "flex",
    padding: theme.spacing.twoXS,
    color: disabled ? theme.colors.fadedText40 : theme.colors.darkenedBgMix100,
  })
)

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

const compactFileUploader = (theme: EmotionTheme): CSSObject => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledFileDropzoneSection as any]: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    height: "auto",
    gap: theme.spacing.sm,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledFileDropzoneInstructionsFileUploaderIcon as any]: {
    display: "none",
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledFileDropzoneInstructionsText as any]: {
    marginBottom: theme.spacing.twoXS,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledUploadedFiles as any]: {
    paddingRight: theme.spacing.lg,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledUploadedFile as any]: {
    maxWidth: "inherit",
    flex: 1,
    alignItems: "flex-start",
    marginBottom: theme.spacing.sm,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledUploadedFileName as any]: {
    width: theme.sizes.full,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledUploadedFileData as any]: {
    flexDirection: "column",
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledFileError as any]: {
    height: "auto",
    whiteSpace: "initial",
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledFileErrorIcon as any]: {
    display: "none",
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledUploadedFilesListItem as any]: {
    margin: theme.spacing.none,
    padding: theme.spacing.none,
  },
})

interface StyledFileUploaderProps {
  width: number
}
export const StyledFileUploader = styled.div<StyledFileUploaderProps>(
  ({ theme, width }) => {
    if (width < convertRemToPx("23rem")) {
      return compactFileUploader(theme)
    }
  }
)
