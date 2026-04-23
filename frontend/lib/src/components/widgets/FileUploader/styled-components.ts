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

import {
  StyledFileChip,
  StyledFileChipList,
  StyledFileChipListItem,
  StyledFileChips,
} from "~lib/components/shared/UploadedFile/styled-components"
import type { EmotionTheme } from "~lib/theme/types"
import { convertRemToPx } from "~lib/theme/utils"

interface StyledFileDropzone {
  isDisabled: boolean
  isDragActive: boolean
}

export const StyledFileDropzoneSection = styled.section<StyledFileDropzone>(
  ({ isDisabled, isDragActive, theme }) => ({
    position: "relative",
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
    minHeight: theme.sizes.largestElementHeight,
    ":focus": {
      outline: "none",
    },
    ":focus-visible": {
      boxShadow: theme.shadows.focusRingOutline,
    },
    cursor: isDisabled ? "not-allowed" : "pointer",
    ...(isDragActive && {
      boxShadow: `inset 0 0 0 2px ${theme.colors.primary}`,
    }),
  })
)

export const StyledDragDropOverlay = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.spacing.threeXS,
  right: theme.spacing.threeXS,
  bottom: theme.spacing.threeXS,
  left: theme.spacing.threeXS,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: theme.colors.secondaryBg,
  borderRadius: theme.radii.default,
  zIndex: theme.zIndices.priority,
}))

export const StyledDragDropText = styled.span(({ theme }) => ({
  color: theme.colors.primary,
  fontSize: theme.fontSizes.sm,
  fontWeight: theme.fontWeights.extrabold,
}))

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

export const StyledUploadedFiles = styled.div(({ theme }) => ({
  lineHeight: theme.lineHeights.tight,
}))

// Chip height: icon (2rem) + vertical padding (2 x 0.25rem) = 2.5rem
const CHIP_HEIGHT_REM = 2.5
const CHIP_GAP_REM = 0.5

function chipScrollHeight(visibleRows: number): string {
  const fullRows = Math.floor(visibleRows)
  const partial = visibleRows - fullRows
  const height =
    fullRows * CHIP_HEIGHT_REM +
    Math.max(0, fullRows - 1) * CHIP_GAP_REM +
    (partial > 0 ? CHIP_GAP_REM + partial * CHIP_HEIGHT_REM : 0)
  return `${height}rem`
}

const baseFileUploaderChips = (): CSSObject => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Emotion styled components as CSS selectors
  [StyledFileChips as any]: {
    maxHeight: chipScrollHeight(2.25),
    overflowY: "auto",
  },
})

const compactFileUploader = (theme: EmotionTheme): CSSObject => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Emotion styled components as CSS selectors
  [StyledFileDropzoneSection as any]: {
    flexDirection: "column",
    alignItems: "stretch",
    height: "fit-content",
    gap: theme.spacing.md,
  },
  // Base has alignSelf: "center" which centers horizontally in a column layout.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Emotion styled components as CSS selectors
  [StyledFileDropzoneInstructions as any]: {
    alignSelf: "stretch",
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Emotion styled components as CSS selectors
  [StyledFileChips as any]: {
    flexDirection: "column",
    flexWrap: "nowrap",
    alignItems: "flex-start",
    maxHeight: "none",
    overflowY: "visible",
    gap: theme.spacing.sm,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Emotion styled components as CSS selectors
  [StyledFileChipList as any]: {
    display: "flex",
    flexDirection: "column",
    flexWrap: "nowrap",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    maxHeight: chipScrollHeight(5.25),
    overflowY: "auto",
    width: theme.sizes.full,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Emotion styled components as CSS selectors
  [StyledFileChipListItem as any]: {
    width: theme.sizes.full,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Emotion styled components as CSS selectors
  [StyledFileChip as any]: {
    width: theme.sizes.full,
  },
})

interface StyledFileUploaderProps {
  width: number
}
export const StyledFileUploader = styled.div<StyledFileUploaderProps>(
  ({ theme, width }) => ({
    ...baseFileUploaderChips(),
    ...(width < convertRemToPx("23rem") ? compactFileUploader(theme) : {}),
  })
)
