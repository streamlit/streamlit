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

function ModalHeader({ children }: ModalHeaderProps): ReactElement {
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
        lineHeight: lineHeights.modalHeader,
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

function ModalBody({ children }: ModalBodyProps): ReactElement {
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

function ModalFooter({ children }: ModalFooterProps): ReactElement {
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

function Modal(props: ModalProps): ReactElement {
  const { spacing, radii, colors }: EmotionTheme = useTheme()

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
        paddingTop: "3rem",
      },
    },
    Dialog: {
      style: {
        borderBottomRightRadius: radii.xxl,
        borderBottomLeftRadius: radii.xxl,
        borderTopRightRadius: radii.xxl,
        borderTopLeftRadius: radii.xxl,
        // make sure the modal is not too small on mobile
        minWidth: "20rem",
      },
    },
    Close: {
      style: {
        top: `calc(${spacing.twoXL} + .375rem)`, // Trying to center the button on the available space.
        right: spacing.twoXL,
      },
    },
  }

  const mergedOverrides = merge(defaultOverrides, props.overrides)

  return <UIModal {...props} overrides={mergedOverrides} />
}

export default Modal
export { ModalHeader, ModalBody, ModalFooter, ModalButton }
