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
import {
  Dialog,
  Heading,
  ModalOverlay,
  Modal as RAModal,
} from "react-aria-components"

/**
 * Full-screen backdrop overlay rendered in a portal.
 *
 * overflow-y: auto matches the original BaseUI Root behavior, allowing the
 * dialog panel to grow to its natural height and scroll via the backdrop when
 * content is taller than the viewport. This keeps the body free of any
 * overflow container so that absolutely-positioned element toolbars (which
 * use top: -2.65rem) are never clipped.
 */
export const StyledDialogOverlay = styled(ModalOverlay)(({ theme }) => ({
  position: "fixed",
  inset: 0,
  background: theme.colors.darkenedBgMix25,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  paddingTop: theme.spacing.threeXL,
  paddingBottom: theme.spacing.threeXL,
  zIndex: theme.zIndices.popup,
  overflowY: "auto",
}))

/**
 * The white dialog panel box. Accepts an optional explicit CSS width via $dialogWidth.
 *
 * overflow: hidden clips content to the rounded corners. No maxHeight is set
 * so the panel grows to fit its content; the overlay handles scrolling for
 * very tall dialogs (matching original BaseUI behavior).
 */
export const StyledDialogPanel = styled(RAModal)<{ $dialogWidth?: string }>(
  ({ theme, $dialogWidth }) => ({
    background: theme.colors.bgColor,
    borderRadius: theme.radii.xxl,
    boxShadow: theme.shadows.popover,
    minWidth: theme.sizes.minPopupWidth,
    maxWidth: "100%",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    ...($dialogWidth !== undefined && { width: $dialogWidth }),
  })
)

/**
 * Flex column wrapper that fills the panel and contains the close button,
 * header, body, and footer. Styled as the role="dialog" element.
 *
 * overflow: visible ensures absolutely-positioned toolbar overlays (top: -2.65rem)
 * are not clipped between the body and the panel boundary.
 */
export const StyledDialogInner = styled(Dialog)({
  display: "flex",
  flexDirection: "column",
  overflow: "visible",
})

/** Absolutely-positioned close (×) button in the top-right of the dialog. */
export const StyledDialogClose = styled.button(({ theme }) => ({
  position: "absolute",
  top: `calc(${theme.spacing.twoXL} + ${theme.spacing.xs} - ${theme.spacing.twoXS})`,
  right: theme.spacing.twoXL,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: theme.colors.bodyText,
  padding: theme.spacing.twoXS,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: theme.radii.sm,
  "&:hover": {
    color: theme.colors.fadedText60,
  },
  "&:focus-visible": {
    outline: "none",
    boxShadow: theme.shadows.focusRing,
  },
}))

export const StyledModalHeader = styled(Heading)(({ theme }) => ({
  padding: `${theme.spacing.twoXL} ${theme.spacing.twoXL} ${theme.spacing.md}`,
  margin: 0,
  fontFamily: theme.genericFonts.bodyFont,
  fontSize: theme.fontSizes.xl,
  fontWeight: theme.fontWeights.bold,
  lineHeight: theme.lineHeights.small,
  display: "flex",
  alignItems: "center",
  flexDirection: "row",
  flexShrink: 0,
}))

export const StyledModalBody = styled.div(({ theme }) => ({
  padding: `${theme.spacing.md} ${theme.spacing.twoXL} ${theme.spacing.twoXL}`,
  color: theme.colors.bodyText,
  fontSize: theme.fontSizes.md,
}))

export const StyledModalFooter = styled.div(({ theme }) => ({
  padding: theme.spacing.md,
  flexShrink: 0,
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  flexWrap: "wrap",
}))

export const StyledModalButton = styled.span(({ theme }) => ({
  marginRight: theme.spacing.twoXS,
}))
