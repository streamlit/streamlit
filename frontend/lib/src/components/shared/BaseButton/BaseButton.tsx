/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
  StyledGhostButton,
  StyledHeaderButton,
  StyledHeaderNoPaddingButton,
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
  StyledTertiaryFormSubmitButton,
} from "./styled-components"
type HTMLBtnAttrs = React.ButtonHTMLAttributes<HTMLButtonElement>
type MergedBaseButtonProps = BaseButtonPropsT & HTMLBtnAttrs
function BaseButton(props: Readonly<MergedBaseButtonProps>): ReactElement {
  const {
    kind,
    size,
    disabled,
    onClick,
    onKeyDown,
    tabIndex,
    containerWidth,
    children,
    autoFocus,
    ...rest
  } = props

  let ComponentType = StyledPrimaryButton

  if (kind === BaseButtonKind.SECONDARY) {
    ComponentType = StyledSecondaryButton
  } else if (kind === BaseButtonKind.TERTIARY) {
    ComponentType = StyledTertiaryButton
  } else if (kind === BaseButtonKind.GHOST) {
    ComponentType = StyledGhostButton
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
  } else if (kind === BaseButtonKind.TERTIARY_FORM_SUBMIT) {
    ComponentType = StyledTertiaryFormSubmitButton
  } else if (kind === BaseButtonKind.HEADER_BUTTON) {
    ComponentType = StyledHeaderButton
  } else if (kind === BaseButtonKind.HEADER_NO_PADDING) {
    ComponentType = StyledHeaderNoPaddingButton
  } else if (kind === BaseButtonKind.ELEMENT_TOOLBAR) {
    ComponentType = StyledElementToolbarButton
  }
  const isActivationKey = (e: React.KeyboardEvent<HTMLButtonElement>) =>
    e.key === "Enter" || e.key === " " || e.key === "Space" || e.key === "Spacebar"

  const handleDisabledEvent = (
    e: React.SyntheticEvent,
    checkKey?: (e: React.KeyboardEvent<HTMLButtonElement>) => boolean
  ): boolean => {
    if (!disabled) return false
    if (!checkKey || checkKey(e as React.KeyboardEvent<HTMLButtonElement>)) {
      e.preventDefault()
      e.stopPropagation()
      return true
    }
    return false
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (handleDisabledEvent(e)) return
    onClick?.(e)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (handleDisabledEvent(e, isActivationKey)) return
    onKeyDown?.(e)
  }

  return (
    <ComponentType
      {...rest}
      kind={kind}
      size={size ?? BaseButtonSize.MEDIUM}
      containerWidth={containerWidth || false}
      disabled={disabled || false}
      aria-disabled={disabled || false}
      tabIndex={disabled ? -1 : (tabIndex ?? 0)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      autoFocus={autoFocus || false}
      data-testid={props["data-testid"] ?? `stBaseButton-${kind}`}
      aria-label={props["aria-label"] ?? ""}
    >
      {children}
    </ComponentType>
  )
}
export type BaseButtonProps = MergedBaseButtonProps
export { BaseButtonKind, BaseButtonSize }
export default BaseButton
