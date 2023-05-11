/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React, { ReactElement } from "react"
import {
  BaseButtonProps as BaseButtonPropsT,
  BaseButtonKind,
  BaseButtonSize,
  StyledBorderlessIconButton,
  StyledIconButton,
  StyledLinkButton,
  StyledMinimalButton,
  StyledPrimaryButton,
  StyledSecondaryButton,
  StyledTertiaryButton,
  StyledPrimaryFormSubmitButton,
  StyledSecondaryFormSubmitButton,
  StyledHeaderButton,
} from "./styled-components"

function BaseButton({
  kind,
  size,
  disabled,
  onClick,
  fluidWidth,
  children,
  autoFocus,
}: BaseButtonPropsT): ReactElement {
  let ComponentType = StyledPrimaryButton

  if (kind === BaseButtonKind.SECONDARY) {
    ComponentType = StyledSecondaryButton
  } else if (kind === BaseButtonKind.TERTIARY) {
    ComponentType = StyledTertiaryButton
  } else if (kind === BaseButtonKind.LINK) {
    ComponentType = StyledLinkButton
  } else if (kind === BaseButtonKind.ICON) {
    ComponentType = StyledIconButton
  } else if (kind === BaseButtonKind.BORDERLESS_ICON) {
    ComponentType = StyledBorderlessIconButton
  } else if (kind === BaseButtonKind.MINIMAL) {
    ComponentType = StyledMinimalButton
  } else if (kind === BaseButtonKind.PRIMARY_FORM_SUBMIT) {
    ComponentType = StyledPrimaryFormSubmitButton
  } else if (kind === BaseButtonKind.SECONDARY_FORM_SUBMIT) {
    ComponentType = StyledSecondaryFormSubmitButton
  } else if (kind === BaseButtonKind.HEADER_BUTTON) {
    ComponentType = StyledHeaderButton
  }

  return (
    <ComponentType
      kind={kind}
      size={size || BaseButtonSize.MEDIUM}
      fluidWidth={fluidWidth || false}
      disabled={disabled || false}
      onClick={onClick || (() => {})}
      autoFocus={autoFocus || false}
    >
      {children}
    </ComponentType>
  )
}
export type BaseButtonProps = BaseButtonPropsT
export { BaseButtonKind, BaseButtonSize }
export default BaseButton
