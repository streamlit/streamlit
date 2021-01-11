import React, { ReactElement } from "react"
import {
  ButtonProps as ButtonPropsT,
  Kind,
  Size,
  StyledIconButton,
  StyledLinkButton,
  StyledMinimalButton,
  StyledPrimaryButton,
  StyledSecondaryButton,
  StyledFormSubmitHasPendingChangesButton,
  StyledFormSubmitNoPendingChangesButton,
} from "./styled-components"

function Button({
  kind,
  size,
  disabled,
  onClick,
  fluidWidth,
  children,
}: ButtonPropsT): ReactElement {
  let ComponentType = StyledPrimaryButton

  if (kind === Kind.SECONDARY) {
    ComponentType = StyledSecondaryButton
  } else if (kind === Kind.LINK) {
    ComponentType = StyledLinkButton
  } else if (kind === Kind.ICON) {
    ComponentType = StyledIconButton
  } else if (kind === Kind.MINIMAL) {
    ComponentType = StyledMinimalButton
  } else if (kind === Kind.FORM_SUBMIT_HAS_PENDING_CHANGES) {
    ComponentType = StyledFormSubmitHasPendingChangesButton
  } else if (kind === Kind.FORM_SUBMIT_NO_PENDING_CHANGES) {
    ComponentType = StyledFormSubmitNoPendingChangesButton
  }

  return (
    <ComponentType
      kind={kind}
      size={size || Size.MEDIUM}
      fluidWidth={fluidWidth || false}
      disabled={disabled || false}
      onClick={onClick || (() => {})}
    >
      {children}
    </ComponentType>
  )
}
export type ButtonProps = ButtonPropsT
export { Kind, Size }
export default Button
