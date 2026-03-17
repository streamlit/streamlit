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

import styled, { CSSObject } from "@emotion/styled"

import type { EmotionTheme } from "~lib/theme/types"
import { convertRemToPx } from "~lib/theme/utils"

interface StyledFileDropzone {
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
      // Solid 1px outline (no blur) for dropzone focus
      boxShadow: theme.shadows.focusRingOutline,
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

const compactFileUploader = (theme: EmotionTheme): CSSObject => ({
  [StyledFileDropzoneSection.toString()]: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    height: "auto",
    gap: theme.spacing.sm,
  },
  [StyledFileDropzoneInstructionsFileUploaderIcon.toString()]: {
    display: "none",
  },
  [StyledFileDropzoneInstructionsText.toString()]: {
    marginBottom: theme.spacing.twoXS,
  },
  [StyledUploadedFiles.toString()]: {
    paddingRight: theme.spacing.lg,
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
