/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { FunctionComponent, ReactElement, ReactNode } from "react"

import { useTheme } from "@emotion/react"
import {
  ModalProps,
  SIZE,
  Modal as UIModal,
  ModalBody as UIModalBody,
  ModalFooter as UIModalFooter,
  ModalHeader as UIModalHeader,
} from "baseui/modal"
import merge from "lodash/merge"

import BaseButton, {
  BaseButtonProps,
} from "@streamlit/lib/src/components/shared/BaseButton"
import { EmotionTheme } from "@streamlit/lib/src/theme"

import { StyledModalButton } from "./styled-components"

export interface ModalHeaderProps {
  children: ReactNode
}

function ModalHeader({ children }: Readonly<ModalHeaderProps>): ReactElement {
  const {
    genericFonts,
    fontSizes,
    spacing,
    fontWeights,
    lineHeights,
  }: EmotionTheme = useTheme()

  return (
    <UIModalHeader
      style={{
        marginTop: spacing.none,
        marginLeft: spacing.none,
        marginRight: spacing.none,
        marginBottom: spacing.none,
        paddingTop: spacing.twoXL,
        paddingRight: spacing.twoXL,
        paddingBottom: spacing.md,
        paddingLeft: spacing.twoXL,
        fontFamily: genericFonts.bodyFont,
        fontSize: fontSizes.xl,
        fontWeight: fontWeights.bold,
        margin: spacing.none,
        lineHeight: lineHeights.small,
        textTransform: "none",
        display: "flex",
        alignItems: "center",
        maxHeight: "80vh",
        flexDirection: "row",
      }}
    >
      {children}
    </UIModalHeader>
  )
}

export interface ModalBodyProps {
  children: ReactNode
}

function ModalBody({ children }: Readonly<ModalBodyProps>): ReactElement {
  const { colors, fontSizes, spacing }: EmotionTheme = useTheme()

  return (
    <UIModalBody
      style={{
        marginTop: spacing.none,
        marginLeft: spacing.none,
        marginRight: spacing.none,
        marginBottom: spacing.none,
        paddingTop: spacing.md,
        paddingRight: spacing.twoXL,
        paddingBottom: spacing.twoXL,
        paddingLeft: spacing.twoXL,
        color: colors.bodyText,
        fontSize: fontSizes.md,
        overflowY: "auto",
      }}
    >
      {children}
    </UIModalBody>
  )
}

export interface ModalFooterProps {
  children: ReactNode
}

function ModalFooter({ children }: Readonly<ModalFooterProps>): ReactElement {
  const { spacing }: EmotionTheme = useTheme()

  return (
    <UIModalFooter
      style={{
        marginTop: spacing.none,
        marginLeft: spacing.none,
        marginRight: spacing.none,
        marginBottom: spacing.none,
        paddingTop: spacing.md,
        paddingRight: spacing.md,
        paddingBottom: spacing.md,
        paddingLeft: spacing.md,
      }}
    >
      <div>{children}</div>
    </UIModalFooter>
  )
}

const ModalButton: FunctionComponent<
  React.PropsWithChildren<BaseButtonProps>
> = buttonProps => (
  <StyledModalButton>
    <BaseButton {...buttonProps} />
  </StyledModalButton>
)

export type StreamlitModalProps = Omit<ModalProps, "size"> & {
  size?: "auto" | "default" | "full"
}

/**
 * Maps our own StreamlitModal size to the Baseweb Modal size or a calculated string.
 * This abstraction allows us later to swap the Baseweb Modal size without touching
 * the other components again.
 *
 * @param size the StreamlitModal size to be mapped
 * @param width the width of the modal if 'full' size is selected
 * @param padding the padding added to the modal if 'full' size is selected
 * @returns the Baseweb Modal comaptible size
 */
export function calculateModalSize(
  size: StreamlitModalProps["size"],
  width?: string,
  padding?: string
): ModalProps["size"] {
  if (size === "full" && width && padding) {
    // This is the same width incl. padding as the AppView container is using 704px (736px (= contentMaxWidth) - 32px padding).
    // The dialog's total left and right padding is 48px. So the dialog needs a total width of 752px (=704px + 48px).
    // The used calculation here makes the relation to the app content width more comprehendable than hardcoding.
    // Note that a Modal has max-width:100%, so it looks good on mobile independent of the calculated size here.
    const paddingDifferenceDialogAndAppView = padding // the dialog has 0.5rem more padding left and right => 1rem
    return `calc(${width} + ${paddingDifferenceDialogAndAppView})`
  } else if (size === "auto") {
    return SIZE.auto
  }

  return SIZE.default
}

function Modal(props: StreamlitModalProps): ReactElement {
  const { spacing, radii, colors, sizes }: EmotionTheme = useTheme()

  const defaultOverrides = {
    Root: {
      style: {
        background: colors.darkenedBgMix25,
      },
      props: {
        className: "stDialog",
        "data-testid": "stDialog",
      },
    },
    DialogContainer: {
      style: {
        alignItems: "start",
        paddingTop: spacing.threeXL,
      },
    },
    Dialog: {
      style: {
        borderBottomRightRadius: radii.xxl,
        borderBottomLeftRadius: radii.xxl,
        borderTopRightRadius: radii.xxl,
        borderTopLeftRadius: radii.xxl,
        // make sure the modal is not too small on mobile
        minWidth: sizes.minPopupWidth,
      },
    },
    Close: {
      style: {
        top: `calc(${spacing.twoXL} + .375rem)`, // Trying to center the button on the available space.
        right: spacing.twoXL,
      },
    },
  }

  const modalSize: ModalProps["size"] = calculateModalSize(
    props.size,
    sizes.contentMaxWidth,
    spacing.lg
  )
  const mergedOverrides = merge(defaultOverrides, props.overrides)
  const overridenProps = { ...props, size: modalSize }
  return <UIModal {...overridenProps} overrides={mergedOverrides} />
}

export default Modal
export { ModalHeader, ModalBody, ModalFooter, ModalButton }
