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

import React, { ReactElement } from "react"

import {
  BaseButtonKind,
  BaseButtonProps as BaseButtonPropsT,
  BaseButtonSize,
  StyledBorderlessIconButton,
  StyledBorderlessIconButtonActive,
  StyledElementToolbarButton,
  StyledHeaderButton,
  StyledHeaderNoPaddingButton,
  StyledIconButton,
  StyledLinkButton,
  StyledMinimalButton,
  StyledPillsButton,
  StyledPillsButtonActive,
  StyledPrimaryButton,
  StyledPrimaryFormSubmitButton,
  StyledSecondaryButton,
  StyledSecondaryFormSubmitButton,
  StyledSegmentedControlButton,
  StyledSegmentedControlButtonActive,
  StyledTertiaryButton,
} from "./styled-components"

function BaseButton(props: Readonly<BaseButtonPropsT>): ReactElement {
  const { kind, size, disabled, onClick, fluidWidth, children, autoFocus } =
    props

  let ComponentType = StyledPrimaryButton

  if (kind === BaseButtonKind.SECONDARY) {
    ComponentType = StyledSecondaryButton
  } else if (kind === BaseButtonKind.TERTIARY) {
    ComponentType = StyledTertiaryButton
  } else if (kind === BaseButtonKind.LINK) {
    ComponentType = StyledLinkButton
  } else if (kind === BaseButtonKind.ICON) {
    ComponentType = StyledIconButton
  } else if (kind === BaseButtonKind.PILLS) {
    ComponentType = StyledPillsButton
  } else if (kind === BaseButtonKind.PILLS_ACTIVE) {
    ComponentType = StyledPillsButtonActive
  } else if (kind === BaseButtonKind.SEGMENTED_CONTROL) {
    ComponentType = StyledSegmentedControlButton
  } else if (kind === BaseButtonKind.SEGMENTED_CONTROL_ACTIVE) {
    ComponentType = StyledSegmentedControlButtonActive
  } else if (kind === BaseButtonKind.BORDERLESS_ICON) {
    ComponentType = StyledBorderlessIconButton
  } else if (kind === BaseButtonKind.BORDERLESS_ICON_ACTIVE) {
    ComponentType = StyledBorderlessIconButtonActive
  } else if (kind === BaseButtonKind.MINIMAL) {
    ComponentType = StyledMinimalButton
  } else if (kind === BaseButtonKind.PRIMARY_FORM_SUBMIT) {
    ComponentType = StyledPrimaryFormSubmitButton
  } else if (kind === BaseButtonKind.SECONDARY_FORM_SUBMIT) {
    ComponentType = StyledSecondaryFormSubmitButton
  } else if (kind === BaseButtonKind.HEADER_BUTTON) {
    ComponentType = StyledHeaderButton
  } else if (kind === BaseButtonKind.HEADER_NO_PADDING) {
    ComponentType = StyledHeaderNoPaddingButton
  } else if (kind === BaseButtonKind.ELEMENT_TOOLBAR) {
    ComponentType = StyledElementToolbarButton
  }

  return (
    <ComponentType
      kind={kind}
      size={size ?? BaseButtonSize.MEDIUM}
      fluidWidth={fluidWidth || false}
      disabled={disabled || false}
      onClick={onClick || (() => {})}
      autoFocus={autoFocus || false}
      data-testid={props["data-testid"] ?? `stBaseButton-${kind}`}
      aria-label={props["aria-label"] ?? ""}
    >
      {children}
    </ComponentType>
  )
}
export type BaseButtonProps = BaseButtonPropsT
export { BaseButtonKind, BaseButtonSize }
export default BaseButton
