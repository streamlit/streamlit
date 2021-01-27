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
import Button, { ButtonProps } from "components/shared/Button"
import { Theme } from "theme"
import { transparentize } from "color2k"
import { StyledModalButton } from "./styled-components"

export interface ModalHeaderProps {
  children: ReactNode
}

function ModalHeader({ children }: ModalHeaderProps): ReactElement {
  const { colors, fonts, fontSizes, spacing }: Theme = useTheme()

  return (
    <UIModalHeader
      style={{
        marginTop: spacing.none,
        marginLeft: spacing.none,
        marginRight: spacing.none,
        marginBottom: spacing.none,
        paddingTop: spacing.lg,
        paddingRight: spacing.lg,
        paddingBottom: spacing.lg,
        paddingLeft: spacing.lg,
        borderBottom: `1px solid ${colors.lightGray}`,
        fontFamily: fonts.sansSerif,
        fontSize: fontSizes.lg,
        margin: spacing.none,
        fontWeight: 300,
        lineHeight: 1.5,
        textTransform: "none",
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
        paddingTop: spacing.lg,
        paddingRight: spacing.lg,
        paddingBottom: spacing.lg,
        paddingLeft: spacing.lg,
        color: colors.bodyText,
        fontSize: fontSizes.md,
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
        borderTop: `1px solid ${colors.lightGray}`,
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
  const { colors, spacing }: Theme = useTheme()

  return (
    <UIModal
      {...props}
      // From https://baseweb.design/components/modal:
      // Makes modal scrollable while cursor is over the modal's backdrop.
      // Will be removed and implemented as the default behavior in the
      // next major version.
      unstable_ModalBackdropScroll={true}
      overrides={{
        ...props.overrides,
        DialogContainer: {
          style: {
            alignItems: "start",
            paddingTop: "3rem",
          },
        },
        Close: {
          style: {
            top: spacing.lg,
            right: spacing.lg,
            color: transparentize(colors.black, 0.5),
          },
        },
      }}
    />
  )
}

export default Modal
export { ModalHeader, ModalBody, ModalFooter, ModalButton }
