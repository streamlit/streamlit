import React, { ReactNode, ReactElement } from "react"
import {
  Modal as UIModal,
  ModalHeader as UIModalHeader,
  ModalBody as UIModalBody,
  ModalFooter as UIModalFooter,
  ModalButton as UIModalButton,
  ModalProps,
} from "baseui/modal"
import { KIND, ButtonOverrides } from "baseui/button"
import { Kind } from "components/shared/Button"
import { colors, fontStyles } from "lib/widgetTheme"

const { black, gray, grayLighter, primary, primaryA50, white } = colors

export interface ModalHeaderProps {
  children: ReactNode
}

function ModalHeader({ children }: ModalHeaderProps): ReactElement {
  return (
    <UIModalHeader
      style={{
        marginTop: 0,
        marginLeft: 0,
        marginRight: 0,
        marginBottom: 0,
        paddingTop: "1rem",
        paddingRight: "1rem",
        paddingBottom: "1rem",
        paddingLeft: "1rem",
        borderBottom: `1px solid ${grayLighter}`,
        fontFamily: fontStyles.fontFamily,
        fontSize: "1.25rem",
        margin: 0,
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
  return (
    <UIModalBody
      style={{
        width: "100%",
        height: "100%",
        padding: 0,
        color: black,
        fontSize: fontStyles.fontSize,
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
  return (
    <UIModalFooter
      style={{
        marginTop: 0,
        marginLeft: 0,
        marginRight: 0,
        marginBottom: 0,
        paddingTop: "0.75rem",
        paddingRight: "0.75rem",
        paddingBottom: "0.75rem",
        paddingLeft: "0.75rem",
        borderTop: `1px solid ${grayLighter}`,
      }}
    >
      <div className="ModalBody">{children}</div>
    </UIModalFooter>
  )
}

export interface ModalButtonProps {
  kind: Kind
  children: ReactNode
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => any
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
        paddingTop: "0.375rem",
        paddingBottom: "0.375rem",
        paddingLeft: "0.75rem",
        paddingRight: "0.75rem",
        backgroundColor: white,
        borderRadius: "0.75rem",
        lineHeight: "1.5",
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

function Modal(props: ModalProps): ReactElement {
  return (
    <UIModal
      {...props}
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
            top: "1rem",
            right: "1rem",
            color: "rgba(0, 0, 0, 0.5)",
          },
        },
      }}
    />
  )
}

export default Modal
export { ModalHeader, ModalBody, ModalFooter, ModalButton }
