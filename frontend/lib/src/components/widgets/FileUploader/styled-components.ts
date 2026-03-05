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
    alignItems: "flex-start",
    padding: theme.spacing.md,
    backgroundColor: theme.colors.secondaryBg,
    borderRadius: theme.radii.default,
    border: theme.colors.widgetBorderColor
      ? `${theme.sizes.borderWidth} solid ${theme.colors.widgetBorderColor}`
      : undefined,
    height: "auto",
    ":focus": {
      outline: "none",
    },
    ":focus-visible": {
      boxShadow: theme.shadows.focusRingOutline,
    },
    cursor: isDisabled ? "not-allowed" : "pointer",
  })
)

export const StyledFileDropzoneInstructions = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  textAlign: "left",
  alignSelf: "center",
  minWidth: 0,
  flex: 1,
})

export const StyledFileDropzoneInstructionsSubtext = styled.span<{
  disabled?: boolean
}>(({ theme, disabled }) => ({
  fontSize: theme.fontSizes.sm,
  color: disabled ? theme.colors.fadedText40 : theme.colors.fadedText60,
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}))

export const StyledFileDropzoneInstructionsColumn = styled.div({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  maxWidth: "100%",
})

export const StyledButtonNoWrapContainer = styled.span({
  whiteSpace: "nowrap",
})

export const StyledUploadedInline = styled.div(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing.sm,
  width: "auto",
  justifyContent: "flex-start",
}))

export const StyledUploadedInlineContent = styled.div(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-start",
  flexWrap: "wrap",
  gap: theme.spacing.sm,
  width: "auto",
  "& > *": {
    display: "inline-flex",
  },
}))

export const StyledUploadedFiles = styled.div(({ theme }) => ({
  lineHeight: theme.lineHeights.tight,
  paddingTop: theme.spacing.none,
  paddingLeft: theme.spacing.none,
  paddingRight: theme.spacing.none,
}))

const compactFileUploader = (theme: EmotionTheme): CSSObject => ({
  [StyledFileDropzoneSection.toString()]: {
    display: "flex",
    flexDirection: "column",
    alignItems: "left",
    height: "fit-content",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledFileDropzoneInstructions as any]: {
    width: theme.sizes.full,
    height: "fit-content",
    marginLeft: theme.spacing.none,
    marginRight: theme.spacing.none,
    justifyContent: "left",
    textAlign: "left",
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledUploadedInline as any]: {
    width: "auto",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledUploadedInlineContent as any]: {
    width: "auto",
    justifyContent: "flex-start",
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
