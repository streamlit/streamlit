/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactNode, ReactElement, FunctionComponent } from "react"
import { useTheme } from "emotion-theming"
import {
  Modal as UIModal,
  ModalHeader as UIModalHeader,
  ModalBody as UIModalBody,
  ModalFooter as UIModalFooter,
  ModalProps,
} from "baseui/modal"
import Button, { ButtonProps } from "src/components/shared/Button"
import merge from "lodash/merge"
import { Theme } from "src/theme"
import { StyledModalButton } from "./styled-components"

export interface ModalHeaderProps {
  children: ReactNode
}

function ModalHeader({ children }: ModalHeaderProps): ReactElement {
  const { colors, genericFonts, fontSizes, spacing }: Theme = useTheme()

  return (
    <UIModalHeader
      style={{
        marginTop: spacing.none,
        marginLeft: spacing.none,
        marginRight: spacing.none,
        marginBottom: spacing.none,
        paddingTop: spacing.lg,
        paddingRight: spacing.xl,
        paddingBottom: spacing.lg,
        paddingLeft: spacing.xl,
        borderBottom: `1px solid ${colors.fadedText10}`,
        fontFamily: genericFonts.bodyFont,
        fontSize: fontSizes.lg,
        margin: spacing.none,
        lineHeight: 1.5,
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
  const { colors, fontSizes, spacing }: Theme = useTheme()

  return (
    <UIModalBody
      style={{
        marginTop: spacing.none,
        marginLeft: spacing.none,
        marginRight: spacing.none,
        marginBottom: spacing.none,
        paddingTop: spacing.xl,
        paddingRight: spacing.xl,
        paddingBottom: spacing.xl,
        paddingLeft: spacing.xl,
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
  const { colors, spacing }: Theme = useTheme()

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
        borderTop: `1px solid ${colors.fadedText10}`,
      }}
    >
      <div className="ModalBody">{children}</div>
    </UIModalFooter>
  )
}

const ModalButton: FunctionComponent<ButtonProps> = buttonProps => (
  <StyledModalButton>
    <Button {...buttonProps} />
  </StyledModalButton>
)

function Modal(props: ModalProps): ReactElement {
  const { spacing, colors }: Theme = useTheme()
  const defaultOverrides = {
    DialogContainer: {
      style: {
        alignItems: "start",
        paddingTop: "3rem",
      },
    },
    Dialog: {
      style: {
        border: `1px solid ${colors.fadedText10}`,
      },
    },
    Close: {
      style: {
        top: spacing.xl, // Trying to center the button on the available space.
        right: spacing.lg,
      },
    },
  }

  const mergedOverrides = merge(defaultOverrides, props.overrides)

  return (
    <UIModal
      {...props}
      // From https://baseweb.design/components/modal:
      // Makes modal scrollable while cursor is over the modal's backdrop.
      // Will be removed and implemented as the default behavior in the
      // next major version.
      autoFocus={false}
      // From https://baseweb.design/components/modal:
      // Makes modal scrollable while cursor is over the modal's backdrop.
      // Will be removed and implemented as the default behavior in the
      // next major version.
      unstable_ModalBackdropScroll={true}
      overrides={mergedOverrides}
    />
  )
}

export default Modal
export { ModalHeader, ModalBody, ModalFooter, ModalButton }
