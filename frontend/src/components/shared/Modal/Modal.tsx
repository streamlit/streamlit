import React, { ReactNode, ReactElement } from "react"
import {
  Modal,
  ModalHeader as UIModalHeader,
  ModalBody as UIModalBody,
  ModalFooter,
  ModalButton as UIModalButton,
} from "baseui/modal"
import { KIND, ButtonOverrides } from "baseui/button"
import { Kind } from "components/shared/Button"
import { SCSS_VARS } from "autogen/scssVariables"

import "./Modal.scss"

const black = SCSS_VARS.$black
const gray = SCSS_VARS.$gray
const grayLighter = SCSS_VARS["$gray-lighter"]
const primary = SCSS_VARS.$primary
const primaryA50 = SCSS_VARS["$primary-a50"]
const textMargin = SCSS_VARS["$font-size-sm"]
const white = SCSS_VARS.$white

export interface ModalHeaderProps {
  children: ReactNode
}

function ModalHeader({ children }: ModalHeaderProps): ReactElement {
  return (
    <UIModalHeader>
      <span className="ModalTitle">{children}</span>
    </UIModalHeader>
  )
}

export interface ModalBodyProps {
  children: ReactNode
}

function ModalBody({ children }: ModalBodyProps): ReactElement {
  return (
    <UIModalBody>
      <div className="ModalBody">{children}</div>
    </UIModalBody>
  )
}

export interface ModalButtonProps {
  kind: Kind
  children: ReactNode
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => any
}

function ModalButton({
  children,
  kind,
  onClick,
}: ModalButtonProps): ReactElement {
  const isPrimary = kind === Kind.PRIMARY
  const overrides: ButtonOverrides = {
    BaseButton: {
      style: {
        fontWeight: "normal",
        paddingTop: textMargin,
        paddingBottom: textMargin,
        paddingLeft: textMargin,
        paddingRight: textMargin,
        backgroundColor: white,
        color: black,
        // We shouldn't mix shorthand properties with longhand -- which usually
        // means we should use longhand for everything. But BaseUI's Button
        // actually uses the shorthand "border" property, so that's what I'm
        // using here too.
        border: isPrimary ? `1px solid ${grayLighter}` : "none",
        ":hover": {
          borderColor: isPrimary ? primary : "transparent",
          backgroundColor: "transparent",
          color: primary,
        },
        ":focus": {
          backgroundColor: white,
          borderColor: primary,
          boxShadow: `0 0 0 0.2rem ${primaryA50}`,
          color: primary,
          outline: "none",
        },
        ":active": {
          color: white,
          backgroundColor: primary,
        },
        ":disabled": {
          backgroundColor: grayLighter,
          borderColor: "transparent",
          color: gray,
        },
        ":hover:disabled": {
          backgroundColor: grayLighter,
          borderColor: "transparent",
          color: gray,
        },
      },
    },
  }

  const buttonKind = isPrimary ? KIND.primary : KIND.tertiary

  return (
    <UIModalButton kind={buttonKind} onClick={onClick} overrides={overrides}>
      {children}
    </UIModalButton>
  )
}

export default Modal
export { ModalHeader, ModalBody, ModalFooter, ModalButton }
