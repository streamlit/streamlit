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

import isPropValid from "@emotion/is-prop-valid"
import styled from "@emotion/styled"
import {
  Dialog,
  Heading,
  ModalOverlay,
  Modal as RAModal,
} from "react-aria-components"

/** `"center"` is a floating modal; `"left"` / `"right"` are full-height drawers. */
export type ModalPosition = "left" | "center" | "right"

const isSideDrawer = (position: ModalPosition): boolean =>
  position === "left" || position === "right"

// React Aria forwards unknown props to the DOM; drop emotion transient `$` props.
const shouldForwardNonTransientProp = (prop: string): boolean =>
  !prop.startsWith("$")

// String tags replace emotion's default is-prop-valid filter when a custom
// shouldForwardProp is set, so keep both the HTML allowlist and `$` drop.
const shouldForwardValidNonTransientProp = (prop: string): boolean =>
  isPropValid(prop) && !prop.startsWith("$")

/**
 * Full-screen backdrop overlay rendered in a portal.
 *
 * overflow-y: auto allows the dialog panel to grow to its natural height and
 * scroll via the backdrop when content is taller than the viewport. This keeps
 * the body free of any overflow container so that absolutely-positioned element
 * toolbars (which use top: -2.65rem) are never clipped.
 *
 * Side drawers are viewport-tall, so the overlay does not scroll; overflow
 * moves inside the panel instead.
 */
export const StyledDialogOverlay = styled(ModalOverlay, {
  shouldForwardProp: shouldForwardNonTransientProp,
})<{ $position?: ModalPosition }>(({ theme, $position = "center" }) => {
  const isDrawer = isSideDrawer($position)
  return {
    position: "fixed",
    inset: 0,
    background: theme.colors.darkenedBgMix25,
    display: "flex",
    zIndex: theme.zIndices.modal,
    ...(isDrawer
      ? {
          alignItems: "stretch",
          justifyContent: $position === "left" ? "flex-start" : "flex-end",
          paddingTop: theme.spacing.none,
          paddingBottom: theme.spacing.none,
          overflowY: "hidden",
        }
      : {
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: theme.spacing.threeXL,
          paddingBottom: theme.spacing.threeXL,
          overflowY: "auto",
        }),
  }
})

/**
 * The white dialog panel box. Accepts an optional explicit CSS width via $dialogWidth.
 *
 * overflow: hidden clips content to the rounded corners. No maxHeight is set
 * so the panel grows to fit its content; the overlay handles scrolling for
 * very tall dialogs.
 *
 * Side drawers are full height and flush to the viewport with square
 * corners so they read as a sheet, not a floating card.
 */
export const StyledDialogPanel = styled(RAModal, {
  shouldForwardProp: shouldForwardNonTransientProp,
})<{ $dialogWidth?: string; $position?: ModalPosition }>(({
  theme,
  $dialogWidth,
  $position = "center",
}) => {
  const isDrawer = isSideDrawer($position)
  // Centered dialogs keep a minimum viewport gutter (one lg on each side).
  // Drawers are flush, so they cap at 100%.
  const maxWidth = isDrawer
    ? "100%"
    : `calc(100% - ${theme.spacing.lg} - ${theme.spacing.lg})`
  return {
    outline: "none",
    background: theme.colors.bgColor,
    boxShadow: theme.shadows.popover,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    margin: isDrawer ? theme.spacing.none : theme.spacing.lg,
    // Cap minWidth so the panel can shrink below minPopupWidth on very narrow
    // screens instead of overflowing the viewport.
    minWidth: `min(${theme.sizes.minPopupWidth}, ${maxWidth})`,
    maxWidth,
    ...($dialogWidth !== undefined && { width: $dialogWidth }),
    ...(isDrawer
      ? {
          height: "100%",
          borderRadius: 0,
        }
      : {
          borderRadius: theme.radii.xxl,
        }),
  }
})

/**
 * Flex column wrapper that fills the panel and contains the close button,
 * header, body, and footer. Styled as the role="dialog" element.
 *
 * overflow: visible ensures absolutely-positioned toolbar overlays (top: -2.65rem)
 * are not clipped between the body and the panel boundary.
 *
 * Side drawers fill the panel height so the body can scroll instead.
 */
export const StyledDialogInner = styled(Dialog, {
  shouldForwardProp: shouldForwardNonTransientProp,
})<{ $position?: ModalPosition }>(({ $position = "center" }) => ({
  outline: "none",
  display: "flex",
  flexDirection: "column",
  overflow: "visible",
  ...(isSideDrawer($position) && {
    flex: 1,
    minHeight: 0,
    height: "100%",
  }),
}))

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

export const StyledModalBody = styled("div", {
  shouldForwardProp: shouldForwardValidNonTransientProp,
})<{ $position?: ModalPosition }>(({ theme, $position = "center" }) => ({
  padding: `${theme.spacing.md} ${theme.spacing.twoXL} ${theme.spacing.twoXL}`,
  color: theme.colors.bodyText,
  fontSize: theme.fontSizes.md,
  ...(isSideDrawer($position) && {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
  }),
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
