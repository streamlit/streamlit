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
import styled from "@emotion/styled"

import { FileStatus } from "./UploadFileInfo"

export const StyledFileChips = styled.div(({ theme }) => ({
  lineHeight: theme.lineHeights.tight,
}))

export const StyledFileChipList = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing.sm,
}))

export const StyledFileChipListItem = styled.div({
  flex: "0 0 auto",
  maxWidth: "100%",
})

export interface StyledFileChipProps {
  isError?: boolean
  isClickable?: boolean
}

export const StyledFileChip = styled.div<StyledFileChipProps>(
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
    paddingRight: theme.spacing.twoXL,
    borderRadius: theme.radii.default,
    gap: theme.spacing.sm,
    cursor: isClickable ? "pointer" : "default",
  })
)

export const StyledFileChipInfo = styled.div({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
})

export interface StyledFileChipIconContainerProps {
  fileStatus: FileStatus["type"]
}

export const StyledFileChipIconContainer =
  styled.div<StyledFileChipIconContainerProps>(({ theme, fileStatus }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.default,
    width: theme.sizes.chatInputFileIconSize,
    height: theme.sizes.chatInputFileIconSize,
    flexShrink: 0,
    overflow: "hidden",
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
  }))

export const StyledFileChipImagePreview = styled.img({
  width: "100%",
  height: "100%",
  objectFit: "cover",
})

export interface StyledFileChipNameProps {
  fileStatus: FileStatus
}

export const StyledFileChipName = styled.div<StyledFileChipNameProps>(
  ({ theme, fileStatus }) => ({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color:
      fileStatus.type === "uploading"
        ? theme.colors.fadedText60
        : theme.colors.bodyText,
  })
)

export const StyledFileChipSize = styled.div(({ theme }) => ({
  color: theme.colors.fadedText60,
  fontSize: theme.fontSizes.sm,
}))

export interface StyledFileChipDeleteButtonProps {
  isError?: boolean
}

export const StyledFileChipDeleteButton =
  styled.small<StyledFileChipDeleteButtonProps>(({ theme, isError }) => ({
    position: "absolute",
    top: theme.spacing.twoXS,
    right: theme.spacing.twoXS,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 0,
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
      color: isError ? theme.colors.redTextColor : theme.colors.fadedText60,
      padding: 0,
      overflow: "hidden",
      boxSizing: "border-box",
      lineHeight: 0,
      "&:hover": {
        backgroundColor: "transparent",
        color: isError ? theme.colors.redColor : theme.colors.bodyText,
      },
    },
  }))

/* eslint-disable streamlit-custom/no-hardcoded-theme-values */
// Visually hidden but accessible to screen readers
// Uses standard CSS visually-hidden pattern (hardcoded values required)
export const StyledVisuallyHidden = styled.span({
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
})
/* eslint-enable streamlit-custom/no-hardcoded-theme-values */
