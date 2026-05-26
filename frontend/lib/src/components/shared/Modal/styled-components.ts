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

/** Full-screen backdrop overlay rendered in a portal. */
export const StyledDialogOverlay = styled(ModalOverlay)(({ theme }) => ({
  position: "fixed",
  inset: 0,
  background: theme.colors.darkenedBgMix25,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  paddingTop: theme.spacing.threeXL,
  zIndex: theme.zIndices.popup,
}))

/** The white dialog panel box. Accepts an optional explicit CSS width via $dialogWidth. */
export const StyledDialogPanel = styled(RAModal)<{ $dialogWidth?: string }>(
  ({ theme, $dialogWidth }) => ({
    background: theme.colors.bgColor,
    borderRadius: theme.radii.xxl,
    boxShadow: theme.shadows.popover,
    minWidth: theme.sizes.minPopupWidth,
    maxWidth: "100%",
    maxHeight: "80vh",
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
 * flex: 0 1 auto — takes natural content height (no forced grow), shrinks when
 * the panel hits its max-height so the body scroll region activates.
 */
export const StyledDialogInner = styled(Dialog)({
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  flex: "0 1 auto",
  minHeight: 0,
})

/** Absolutely-positioned close (×) button in the top-right of the dialog. */
export const StyledDialogClose = styled.button(({ theme }) => ({
  position: "absolute",
  top: `calc(${theme.spacing.twoXL} + ${theme.spacing.xs})`,
  right: theme.spacing.twoXL,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: theme.colors.fadedText60,
  padding: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: theme.radii.sm,
  "&:hover": {
    color: theme.colors.bodyText,
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
  overflowY: "auto",
  flex: 1,
  minHeight: 0,
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
