/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import {
  FocusEvent,
  InputHTMLAttributes,
  KeyboardEvent,
  ReactElement,
  ReactNode,
  Ref,
} from "react"

import { ErrorOutline } from "@emotion-icons/material-outlined"
import { Cancel } from "@emotion-icons/material-rounded"
import { TextField } from "react-aria-components"

import {
  DynamicIcon,
  isMaterialIcon,
} from "~lib/components/shared/Icon/DynamicIcon"
import Icon from "~lib/components/shared/Icon/Icon"
import InputInstructions from "~lib/components/shared/InputInstructions/InputInstructions"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { LabelVisibilityOptions } from "~lib/util/utils"

import {
  StyledClearButton,
  StyledEndEnhancers,
  StyledErrorEnhancer,
  StyledInputElement,
  StyledInputInstructionsContainer,
  StyledInputRoot,
  StyledPasswordToggle,
  StyledSpinnerEnhancer,
  StyledStartEnhancer,
  StyledVisuallyHidden,
} from "./styled-components"

export type AutocompleteInputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | "role"
  | "aria-expanded"
  | "aria-activedescendant"
  | "aria-controls"
  | "aria-autocomplete"
  | "aria-busy"
  | "onKeyDown"
  | "onKeyDownCapture"
  | "onFocus"
  | "onBlur"
>

export interface TextInputControlProps {
  inputRef: Ref<HTMLInputElement>
  setOverlayReference?: (node: HTMLDivElement | null) => void
  extraInputProps?: AutocompleteInputProps
  id: string
  errorId: string
  label: string
  help?: string
  required: boolean
  disabled: boolean
  labelVisibility?: LabelVisibilityOptions
  icon?: string
  displayedError: string | null
  uiValue: string | null
  placeholder?: string
  inputType: string
  enterKeyHint?: "search"
  autoComplete?: string
  focused: boolean
  showClearButton: boolean
  showPasswordToggle: boolean
  showPassword: boolean
  showInstructions: boolean
  dirty: boolean
  maxChars: number
  inForm: boolean
  allowEnterToSubmit: boolean
  busy: boolean
  statusMessage: string | null
  onFocus: () => void
  onBlur: (e: FocusEvent<HTMLInputElement>) => void
  onChange: (e: { target: { value: string } }) => void
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  onCompositionStart: () => void
  onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement>) => void
  onClear: () => void
  onToggleShowPassword: () => void
  livePendingAck?: ReactNode
}

const EMPTY_AUTOCOMPLETE_INPUT_PROPS: AutocompleteInputProps = {}

/**
 * Prevents a pointer-down on an adjacent control from stealing focus from the
 * input, which would otherwise commit a dirty value via blur. Module-level so
 * the reference is stable across renders.
 */
export function preventFocusLoss(e: { preventDefault: () => void }): void {
  e.preventDefault()
}

/**
 * Presentational text-input field. Always rendered as the same component type
 * with a stable `key="field"` from the parent so toggling the autocomplete
 * sibling does not remount the real `<input>`.
 */
export function TextInputControl({
  inputRef,
  setOverlayReference,
  extraInputProps = EMPTY_AUTOCOMPLETE_INPUT_PROPS,
  id,
  errorId,
  label,
  help,
  required,
  disabled,
  labelVisibility,
  icon,
  displayedError,
  uiValue,
  placeholder,
  inputType,
  enterKeyHint,
  autoComplete,
  focused,
  showClearButton,
  showPasswordToggle,
  showPassword,
  showInstructions,
  dirty,
  maxChars,
  inForm,
  allowEnterToSubmit,
  busy,
  statusMessage,
  onFocus,
  onBlur,
  onChange,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  onClear,
  onToggleShowPassword,
  livePendingAck,
}: TextInputControlProps): ReactElement {
  const theme = useEmotionTheme()
  const {
    onFocus: extraOnFocus,
    onBlur: extraOnBlur,
    onKeyDown: extraOnKeyDown,
    onKeyDownCapture: extraOnKeyDownCapture,
    ...extraAriaProps
  } = extraInputProps

  return (
    <>
      {livePendingAck}
      <WidgetLabel
        label={label}
        disabled={disabled}
        required={required}
        labelVisibility={labelVisibility}
        htmlFor={id}
      >
        {help && <WidgetLabelHelpIcon content={help} label={label} />}
      </WidgetLabel>
      {/*
       * Keep React Aria out of native constraint validation so a native
       * `type="email"`/`"url"` `typeMismatch` does not create a second invalid
       * state alongside our regex `validate` tooltip. TextInput already owns
       * `aria-invalid` and the error UI, so we also deliberately do NOT set
       * `isInvalid` here.
       */}
      <TextField isDisabled={disabled} validationBehavior="aria">
        <StyledInputRoot
          data-testid="stTextInputRootElement"
          ref={setOverlayReference}
          $isFocused={focused}
          $hasIcon={!!icon}
          $hasError={Boolean(displayedError)}
        >
          {icon && (
            <StyledStartEnhancer $isMaterialIcon={isMaterialIcon(icon)}>
              <DynamicIcon
                data-testid="stTextInputIcon"
                iconValue={icon}
                size="base"
              />
            </StyledStartEnhancer>
          )}
          <StyledInputElement
            id={id}
            data-testid="stTextInputField"
            aria-label={label}
            aria-required={required ? true : undefined}
            aria-invalid={displayedError ? true : undefined}
            aria-describedby={displayedError ? errorId : undefined}
            value={uiValue ?? ""}
            placeholder={placeholder}
            type={showPassword ? "text" : inputType}
            enterKeyHint={enterKeyHint}
            autoComplete={autoComplete}
            {...extraAriaProps}
            onFocus={e => {
              extraOnFocus?.(e)
              onFocus()
            }}
            onBlur={e => {
              extraOnBlur?.(e)
              onBlur(e)
            }}
            onChange={onChange}
            onKeyDown={e => {
              extraOnKeyDown?.(e)
              if (!e.defaultPrevented) {
                onKeyDown(e)
              }
            }}
            onKeyDownCapture={extraOnKeyDownCapture}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            ref={inputRef}
          />
          <StyledEndEnhancers>
            {busy && (
              <StyledSpinnerEnhancer data-testid="stTextInputSuggestionsSpinner">
                <DynamicIcon
                  iconValue="spinner"
                  size="base"
                  aria-hidden="true"
                />
              </StyledSpinnerEnhancer>
            )}
            {displayedError && (
              <StyledErrorEnhancer data-testid="stTextInputErrorIcon">
                <Tooltip
                  content={displayedError}
                  placement={Placement.TOP_RIGHT}
                  error
                >
                  <Icon content={ErrorOutline} size="base" />
                </Tooltip>
              </StyledErrorEnhancer>
            )}
            {showClearButton && (
              <StyledClearButton
                type="button"
                data-testid="stTextInputClearButton"
                aria-label="Clear entry"
                tabIndex={-1}
                onMouseDown={preventFocusLoss}
                onClick={onClear}
              >
                <Cancel size={theme.iconSizes.base} aria-hidden="true" />
              </StyledClearButton>
            )}
            {showPasswordToggle && (
              <StyledPasswordToggle
                type="button"
                onMouseDown={preventFocusLoss}
                onClick={onToggleShowPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                disabled={disabled}
              >
                <DynamicIcon
                  iconValue={
                    showPassword
                      ? ":material/visibility_off:"
                      : ":material/visibility:"
                  }
                  size="base"
                />
              </StyledPasswordToggle>
            )}
          </StyledEndEnhancers>
        </StyledInputRoot>
      </TextField>
      {displayedError && (
        <StyledVisuallyHidden id={errorId} role="alert">
          {displayedError}
        </StyledVisuallyHidden>
      )}
      <StyledVisuallyHidden role="status">
        {statusMessage ?? ""}
      </StyledVisuallyHidden>
      {showInstructions && (
        <StyledInputInstructionsContainer
          $hasErrorIcon={Boolean(displayedError)}
          $hasClearButton={showClearButton}
          $hasPasswordToggle={showPasswordToggle}
          $hasSpinner={busy}
        >
          <InputInstructions
            dirty={dirty}
            value={uiValue ?? ""}
            maxLength={maxChars}
            inForm={inForm}
            allowEnterToSubmit={allowEnterToSubmit}
          />
        </StyledInputInstructionsContainer>
      )}
    </>
  )
}
