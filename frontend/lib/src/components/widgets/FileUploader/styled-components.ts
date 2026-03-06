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
  paddingTop: theme.spacing.none,
  paddingLeft: theme.spacing.none,
  paddingRight: theme.spacing.none,
}))

const baseFileUploaderChips = (_theme: EmotionTheme): CSSObject => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledFileChips as any]: {
    maxHeight: "7.1875rem",
    overflowY: "auto",
  },
})

const compactFileUploader = (theme: EmotionTheme): CSSObject => ({
  [StyledFileDropzoneSection.toString()]: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
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
  [StyledFileChips as any]: {
    flexDirection: "column",
    flexWrap: "nowrap",
    alignItems: "flex-start",
    maxHeight: "none",
    overflowY: "visible",
    gap: theme.spacing.sm,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledFileChipList as any]: {
    display: "flex",
    flexDirection: "column",
    flexWrap: "nowrap",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    maxHeight: "16.9375rem",
    overflowY: "auto",
    width: theme.sizes.full,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledFileChipListItem as any]: {
    width: theme.sizes.full,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  [StyledFileChip as any]: {
    width: theme.sizes.full,
  },
})

interface StyledFileUploaderProps {
  width: number
}
export const StyledFileUploader = styled.div<StyledFileUploaderProps>(
  ({ theme, width }) => ({
    ...baseFileUploaderChips(theme),
    ...(width < convertRemToPx("23rem") ? compactFileUploader(theme) : {}),
  })
)
