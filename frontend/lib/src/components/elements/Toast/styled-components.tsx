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
import { Button } from "react-aria-components"
import {
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastRegion as ToastRegion,
} from "react-aria-components/Toast"

import { hasLightBackgroundColor } from "~lib/theme/getColors"

export const StyledToastRegion = styled(ToastRegion)(({ theme }) => ({
  position: "fixed",
  top: theme.sizes.headerHeight,
  right: 0,
  display: "flex",
  flexDirection: "column",
  zIndex: theme.zIndices.toast,
  outline: "none",
  marginLeft: theme.spacing.lg,
  marginRight: theme.spacing.lg,
  "&[data-focus-visible]": {
    boxShadow: theme.shadows.focusRing,
  },
  // React Aria renders an <ol> inside the region — reverse its order
  // so the most recently added toast appears at the top.
  // Scope to the direct child only; toast bodies may contain markdown <ol>s.
  "> ol": {
    display: "flex",
    flexDirection: "column-reverse",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
})) as typeof ToastRegion

export const StyledToast = styled(Toast)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: theme.spacing.md,
  width: theme.sizes.toastWidth,
  marginTop: theme.spacing.sm,
  borderRadius: theme.radii.default,
  paddingTop: theme.spacing.lg,
  paddingBottom: theme.spacing.lg,
  paddingLeft: theme.spacing.twoXL,
  paddingRight: theme.spacing.twoXL,
  backgroundColor: theme.colors.bgColor,
  filter: hasLightBackgroundColor(theme)
    ? "brightness(0.98)"
    : "brightness(1.2)",
  color: theme.colors.bodyText,
  boxShadow: theme.shadows.popover,
  outline: "none",
  "&[data-focus-visible]": {
    boxShadow: theme.shadows.focusRing,
  },
})) as typeof Toast

export const StyledCloseButton = styled(Button)(({ theme }) => ({
  color: theme.colors.fadedText40,
  background: "none",
  border: "none",
  cursor: "pointer",
  flexShrink: 0,
  alignSelf: "flex-start",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  marginRight: `calc(-1 * ${theme.spacing.lg} / 2)`,
  borderRadius: theme.radii.sm,
  "&[data-hovered]": {
    color: theme.colors.bodyText,
  },
  "&[data-focus-visible]": {
    outline: "none",
    boxShadow: theme.shadows.focusRing,
  },
}))

export const StyledViewButton = styled.button(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  lineHeight: theme.lineHeights.base,
  color: theme.colors.fadedText60,
  backgroundColor: theme.colors.transparent,
  fontFamily: "inherit",
  margin: theme.spacing.none,
  border: "none",
  boxShadow: "none",
  padding: theme.spacing.none,
  "&:hover, &:active, &:focus": {
    border: "none",
    outline: "none",
    boxShadow: "none",
  },
  "&:hover": {
    color: theme.colors.primary,
  },
}))

export const StyledToastWrapper = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: theme.spacing.lg,
  flex: 1,
  minWidth: 0,

  "> span": {
    marginTop: theme.spacing.twoXS,
  },
}))

export const StyledMessageWrapper = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.sm,
  alignItems: "start",
  // Align text to the center of the icon when only 1 line.
  justifyContent: "center",
  overflow: "hidden",
  minHeight: "100%",
  fontSize: theme.fontSizes.sm,
  lineHeight: theme.lineHeights.base,
}))

interface StyledClampedTextProps {
  clamped: boolean
}

export const StyledClampedText = styled.div<StyledClampedTextProps>(
  ({ clamped }) => ({
    ...(clamped && {
      display: "-webkit-box",
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    }),
  })
)
