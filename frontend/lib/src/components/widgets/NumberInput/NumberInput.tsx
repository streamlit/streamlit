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
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import { Cancel } from "@emotion-icons/material-rounded"
import { Minus, Plus } from "@emotion-icons/open-iconic"
import { TextField } from "react-aria-components"

import { NumberInput as NumberInputProto } from "@streamlit/protobuf"

import {
  DynamicIcon,
  isMaterialIcon,
} from "~lib/components/shared/Icon/DynamicIcon"
import Icon from "~lib/components/shared/Icon/Icon"
import InputInstructions from "~lib/components/shared/InputInstructions/InputInstructions"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import { useBasicWidgetState } from "~lib/hooks/useBasicWidgetState"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme/utils"
import {
  isInForm,
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
  notNullOrUndefined,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledClearButton,
  StyledInputContainer,
  StyledInputControl,
  StyledInputControls,
  StyledInputElement,
  StyledInstructionsContainer,
  StyledStartEnhancer,
} from "./styled-components"
import {
  canDecrement,
  canIncrement,
  formatValue,
  getCurrStateFromProto,
  getDefaultStateFromProto,
  getStateFromWidgetMgr,
  getStep,
  preciseStepArithmetic,
  updateWidgetMgrState,
} from "./utils"

export interface Props {
  disabled: boolean
  element: NumberInputProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

const NumberInput: React.FC<Props> = ({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement => {
  const theme = useEmotionTheme()

  const {
    dataType: elementDataType,
    formId: elementFormId,
    default: elementDefault,
    format: elementFormat,
    icon,
    min,
    max,
  } = element

  const { width, elementRef } = useCalculatedDimensions()

  const step = useMemo(
    () => getStep({ step: element.step, dataType: element.dataType }),
    [element.step, element.dataType]
  )

  // Helper to format a numeric value with the current format settings
  const formatCurrentValue = useCallback(
    (val: number | null) =>
      formatValue({
        value: val,
        dataType: elementDataType,
        format: elementFormat,
        step,
      }),
    [elementDataType, elementFormat, step]
  )

  // Local ephemeral state - dirty and formattedValue need refs for onFormCleared
  const [dirty, setDirty] = useState(false)

  // Formatted value is state because the user can type intermediate values (like "1." for float)
  // Initialize with the correctly formatted initial value to avoid double render
  const [formattedValue, setFormattedValue] = useState<string | null>(() => {
    const initialValue =
      getStateFromWidgetMgr(widgetMgr, element) ?? elementDefault ?? null
    return formatValue({
      value: initialValue,
      dataType: elementDataType,
      format: elementFormat,
      step,
    })
  })

  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "double_value" as const,
        clearable: isNullOrUndefined(element.default),
      }
    : undefined

  // Use useBasicWidgetState for core value management
  const [value, setValueWithSource] = useBasicWidgetState<
    number | null,
    NumberInputProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    formClearBehavior: "resetValueAndRunCallback",
    onFormCleared: useCallback(() => {
      // Reset dirty state and formatted value when form is cleared
      const newValue = elementDefault ?? null
      setDirty(false)
      setFormattedValue(formatCurrentValue(newValue))
    }, [elementDefault, formatCurrentValue]),
    queryParamBinding,
  })

  // Additional local state for UI interactions
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  const inForm = isInForm({ formId: elementFormId })
  // Allows form submission on Enter & displays Enter instructions, or if not in form and state is dirty
  const allowEnterToSubmit = inForm
    ? widgetMgr.allowFormEnterToSubmit(elementFormId)
    : dirty
  // Hide input instructions for small widget sizes.
  const shouldShowInstructions =
    isFocused && width > convertRemToPx(theme.breakpoints.hideWidgetDetails)

  // Sync formatted value when the core value changes from the backend.
  // This Effect is justified because it synchronizes with an external system:
  // the backend value changes via useBasicWidgetState (from st.session_state updates,
  // form resets, or setValue calls). We can't compute this during render because:
  // 1. When dirty=true, formattedValue comes from user input (e.g., typing "1.")
  // 2. When dirty=false, formattedValue comes from the backend value
  // This is the recommended pattern for syncing with external systems per React docs.
  useEffect(() => {
    if (!dirty) {
      setFormattedValue(formatCurrentValue(value))
    }
  }, [value, dirty, formatCurrentValue])

  // Commit a value: validate, update widget manager, and sync to URL
  const commitValue = useCallback(
    ({
      value: valueArg,
      fromUi,
    }: {
      value: number | null
      fromUi: boolean
    }) => {
      // Validate range and show browser validation message if out of range
      if (notNullOrUndefined(valueArg) && (min > valueArg || valueArg > max)) {
        inputRef.current?.reportValidity()
        return
      }

      const newValue = valueArg ?? elementDefault ?? null

      setValueWithSource({ value: newValue, fromUi })

      setDirty(false)
      setFormattedValue(formatCurrentValue(newValue))
    },
    [min, max, elementDefault, formatCurrentValue, setValueWithSource]
  )

  // When the widget has no default, the user can clear the value to null.
  // `clearable` is false when disabled, so the clear button is never shown in that state.
  const clearable = isNullOrUndefined(element.default) && !disabled

  const handleClear = useCallback(() => {
    commitValue({ value: null, fromUi: true })
  }, [commitValue])

  const handleFocus = useCallback((): void => {
    setIsFocused(true)
  }, [])

  // Prevent scroll wheel from changing the value
  useEffect(() => {
    const numberInput = inputRef.current
    if (numberInput) {
      const preventScroll: EventListener = (e): void => {
        e.preventDefault()
      }

      // Issue #8867: Disable wheel events on the input to avoid accidental changes
      // caused by scrolling.
      numberInput.addEventListener("wheel", preventScroll)

      return () => {
        numberInput.removeEventListener("wheel", preventScroll)
      }
    }
    return undefined
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const { value: targetValue } = e.target

      if (targetValue === "") {
        setDirty(true)
        setFormattedValue(null)
      } else {
        setDirty(true)
        setFormattedValue(targetValue)

        // We don't call setValueWithSource here because we want to allow
        // intermediate values (like "1." for floats). The value is committed
        // on blur or enter.
      }
    },
    []
  )

  // Parse the current formatted value to get the numeric value for increment/decrement
  const currentNumericValue = useMemo(() => {
    if (formattedValue === null || formattedValue === "") {
      return null
    }
    if (element.dataType === NumberInputProto.DataType.INT) {
      const parsed = parseInt(formattedValue, 10)
      return isNaN(parsed) ? null : parsed
    }
    const parsed = parseFloat(formattedValue)
    return isNaN(parsed) ? null : parsed
  }, [formattedValue, element.dataType])

  // Calculate button enabled states based on the currently displayed value, not the committed value
  const canDec = canDecrement(currentNumericValue, step, min)
  const canInc = canIncrement(currentNumericValue, step, max)

  const handleBlur = useCallback((): void => {
    if (dirty) {
      // Use currentNumericValue (parsed from formattedValue) not value (from useBasicWidgetState)
      // because value isn't updated until commit, but the user has typed a new value
      commitValue({ value: currentNumericValue, fromUi: true })
    }
    setIsFocused(false)
  }, [dirty, currentNumericValue, commitValue])

  const increment = useCallback(() => {
    if (canInc) {
      const newValue = preciseStepArithmetic(
        currentNumericValue ?? min,
        step,
        "add"
      )
      commitValue({ value: newValue, fromUi: true })
    }
  }, [currentNumericValue, min, step, canInc, commitValue])

  const decrement = useCallback(() => {
    if (canDec) {
      const newValue = preciseStepArithmetic(
        currentNumericValue ?? max,
        step,
        "subtract"
      )
      commitValue({ value: newValue, fromUi: true })
    }
  }, [currentNumericValue, max, step, canDec, commitValue])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      const { key } = e

      switch (key) {
        case "ArrowUp":
          e.preventDefault()
          increment()
          break
        case "ArrowDown":
          e.preventDefault()
          decrement()
          break
        case "Escape":
          // Replaces BaseWeb's clearOnEscape — clear the value when widget has no default.
          if (clearable) {
            e.preventDefault()
            handleClear()
          }
          break
        case "Enter":
          if (dirty) {
            // When committing, if currentNumericValue is null (empty input),
            // commitValue will fall back to elementDefault
            commitValue({ value: currentNumericValue, fromUi: true })
          }
          if (widgetMgr.allowFormEnterToSubmit(elementFormId)) {
            widgetMgr.submitForm(elementFormId, fragmentId)
          }
          break
        default:
      }
    },
    [
      increment,
      decrement,
      clearable,
      handleClear,
      dirty,
      currentNumericValue,
      commitValue,
      widgetMgr,
      elementFormId,
      fragmentId,
    ]
  )

  // Adjust breakpoint for icon so the total width of the input element
  // is same when input controls hidden
  const iconAdjustment =
    // Account for icon size + its left/right padding
    convertRemToPx(theme.iconSizes.base) +
    2 * convertRemToPx(theme.spacing.twoXS)

  const hideControlsBreakpoint = convertRemToPx(
    theme.breakpoints.hideNumberInputControls
  )
  const numberInputControlBreakpoint = icon
    ? hideControlsBreakpoint + iconAdjustment
    : hideControlsBreakpoint

  return (
    <div
      className="stNumberInput"
      data-testid="stNumberInput"
      ref={elementRef}
    >
      <WidgetLabel
        label={element.label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
        htmlFor={id}
      >
        {element.help && (
          <WidgetLabelHelpIcon content={element.help} label={element.label} />
        )}
      </WidgetLabel>
      {/*
       * We use React Aria's generic TextField rather than NumberField as
       * NumberField manages display formatting exclusively through
       * Intl.NumberFormat (formatOptions), which is incompatible with the
       * printf-style format strings supported by st.number_input's `format`
       * parameter (e.g. "%0.2f", "%e", "%g").
       */}
      <TextField isDisabled={disabled} aria-label={element.label}>
        <StyledInputContainer
          $isFocused={isFocused}
          data-testid="stNumberInputContainer"
        >
          {element.icon && (
            <StyledStartEnhancer
              $isMaterialIcon={isMaterialIcon(element.icon)}
            >
              <DynamicIcon
                data-testid="stNumberInputIcon"
                iconValue={element.icon}
                size="base"
              />
            </StyledStartEnhancer>
          )}
          <StyledInputElement
            ref={inputRef}
            id={id}
            data-testid="stNumberInputField"
            type="number"
            // Omit inputMode here — the native browser default for type="number"
            // already provides the right mobile keyboard. The original BaseWeb
            // code set inputMode="" to undo BaseWeb's own override to "text" (#8867).
            step={step}
            min={min}
            max={max}
            value={formattedValue ?? ""}
            placeholder={element.placeholder}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          {clearable && notNullOrUndefined(formattedValue) && (
            <StyledClearButton
              type="button"
              data-testid="stNumberInputClearButton"
              aria-label="Clear value"
              // Plain <button> does not inherit isDisabled from React Aria's
              // TextField context — must be passed explicitly.
              disabled={disabled}
              tabIndex={-1}
              // Prevent mousedown from moving focus away from the input before
              // the click fires. Without this, handleBlur commits the current
              // dirty value first, causing a spurious extra Streamlit rerun.
              onMouseDown={e => e.preventDefault()}
              onClick={handleClear}
            >
              <Cancel size={theme.iconSizes.base} aria-hidden="true" />
            </StyledClearButton>
          )}
          {/* Show the increment/decrement controls only when there is sufficient room. */}
          {width > numberInputControlBreakpoint && (
            <StyledInputControls>
              <StyledInputControl
                type="button"
                data-testid="stNumberInputStepDown"
                aria-label="Decrement"
                onClick={decrement}
                disabled={!canDec || disabled}
                tabIndex={-1}
              >
                <Icon
                  content={Minus}
                  size="xs"
                  color={canDec ? "inherit" : theme.colors.fadedText40}
                />
              </StyledInputControl>
              <StyledInputControl
                type="button"
                data-testid="stNumberInputStepUp"
                aria-label="Increment"
                onClick={increment}
                disabled={!canInc || disabled}
                tabIndex={-1}
              >
                <Icon
                  content={Plus}
                  size="xs"
                  color={canInc ? "inherit" : theme.colors.fadedText40}
                />
              </StyledInputControl>
            </StyledInputControls>
          )}
        </StyledInputContainer>
      </TextField>
      {shouldShowInstructions && (
        <StyledInstructionsContainer clearable={clearable}>
          <InputInstructions
            dirty={dirty}
            value={formattedValue ?? ""}
            inForm={inForm}
            allowEnterToSubmit={allowEnterToSubmit}
          />
        </StyledInstructionsContainer>
      )}
    </div>
  )
}

export default memo(NumberInput)
