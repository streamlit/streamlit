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
