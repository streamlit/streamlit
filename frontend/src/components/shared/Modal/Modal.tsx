import React, { ReactNode, ReactElement, FunctionComponent } from "react"
import {
  Modal as UIModal,
  ModalHeader as UIModalHeader,
  ModalBody as UIModalBody,
  ModalFooter as UIModalFooter,
  ModalProps,
} from "baseui/modal"
import Button, { ButtonProps } from "components/shared/Button"
import { colors, fontStyles } from "lib/widgetTheme"

const { black, grayLighter } = colors

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
        marginTop: 0,
        marginLeft: 0,
        marginRight: 0,
        marginBottom: 0,
        paddingTop: "1rem",
        paddingRight: "1rem",
        paddingBottom: "1rem",
        paddingLeft: "1rem",
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

const ModalButton: FunctionComponent<ButtonProps> = buttonProps => (
  <span style={{ marginRight: "0.25rem" }}>
    <Button {...buttonProps} />
  </span>
)

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
