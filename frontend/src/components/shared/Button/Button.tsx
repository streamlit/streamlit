import React, { ReactElement } from "react"
import {
  ButtonProps as ButtonPropsT,
  Kind,
  Size,
  StyledBorderlessIconButton,
  StyledIconButton,
  StyledLinkButton,
  StyledMinimalButton,
  StyledPrimaryButton,
  StyledSecondaryButton,
  StyledFormSubmitButton,
  StyledHeaderButton,
} from "./styled-components"

function Button({
  kind,
  size,
  disabled,
  onClick,
  fluidWidth,
  children,
  autoFocus,
}: ButtonPropsT): ReactElement {
  let ComponentType = StyledPrimaryButton

  if (kind === Kind.SECONDARY) {
    ComponentType = StyledSecondaryButton
  } else if (kind === Kind.LINK) {
    ComponentType = StyledLinkButton
  } else if (kind === Kind.ICON) {
    ComponentType = StyledIconButton
  } else if (kind === Kind.BORDERLESS_ICON) {
    ComponentType = StyledBorderlessIconButton
  } else if (kind === Kind.MINIMAL) {
    ComponentType = StyledMinimalButton
  } else if (kind === Kind.FORM_SUBMIT) {
    ComponentType = StyledFormSubmitButton
  } else if (kind === Kind.HEADER_BUTTON) {
    ComponentType = StyledHeaderButton
  }

  return (
    <ComponentType
      kind={kind}
      size={size || Size.MEDIUM}
      fluidWidth={fluidWidth || false}
      disabled={disabled || false}
      onClick={onClick || (() => {})}
      autoFocus={autoFocus || false}
    >
      {children}
    </ComponentType>
  )
}
export type ButtonProps = ButtonPropsT
export { Kind, Size }
export default Button
