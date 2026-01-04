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
  useMemo,
  useRef,
  useState,
} from "react"

import { Minus, Plus } from "@emotion-icons/open-iconic"
import { Input as UIInput } from "baseui/input"
import { uniqueId } from "lodash-es"

import { NumberInput as NumberInputProto } from "@streamlit/protobuf"

import Icon, { DynamicIcon, isMaterialIcon } from "~lib/components/shared/Icon"
import InputInstructions from "~lib/components/shared/InputInstructions/InputInstructions"
import {
  WidgetLabel,
  WidgetLabelHelpIcon,
} from "~lib/components/widgets/BaseWidget"
import { useBasicWidgetState } from "~lib/hooks/useBasicWidgetState"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme"
import {
  isInForm,
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
  notNullOrUndefined,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledInputContainer,
  StyledInputControl,
  StyledInputControls,
  StyledInstructionsContainer,
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
    onFormCleared: useCallback(() => {
      // Reset dirty state and formatted value when form is cleared
      const newValue = elementDefault ?? null
      setDirty(false)
      setFormattedValue(formatCurrentValue(newValue))
    }, [elementDefault, formatCurrentValue]),
  })

  // Additional local state for UI interactions
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const [id] = useState(() => uniqueId("number_input_"))

  const inForm = isInForm({ formId: elementFormId })
  // Allows form submission on Enter & displays Enter instructions, or if not in form and state is dirty
  const allowEnterToSubmit = inForm
    ? widgetMgr.allowFormEnterToSubmit(elementFormId)
    : dirty
  // Hide input instructions for small widget sizes.
  const shouldShowInstructions =
    isFocused && width > theme.breakpoints.hideWidgetDetails

  // Sync formatted value when the core value changes from the backend.
  // This Effect is justified because it synchronizes with an external system:
  // the backend value changes via useBasicWidgetState (from st.session_state updates,
  // form resets, or setValue calls). We can't compute this during render because:
  // 1. When dirty=true, formattedValue comes from user input (e.g., typing "1.")
  // 2. When dirty=false, formattedValue comes from the backend value
  // This is the recommended pattern for syncing with external systems per React docs.
  useEffect(() => {
    if (!dirty) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with external backend value
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
  }, [])

  const clearable = isNullOrUndefined(element.default) && !disabled

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
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
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
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
        default:
      }
    },
    [increment, decrement]
  )

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      if (e.key === "Enter") {
        if (dirty) {
          // When committing, if currentNumericValue is null (empty input),
          // commitValue will fall back to elementDefault
          commitValue({ value: currentNumericValue, fromUi: true })
        }
        if (widgetMgr.allowFormEnterToSubmit(elementFormId)) {
          widgetMgr.submitForm(elementFormId, fragmentId)
        }
      }
    },
    [
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
    convertRemToPx(theme.iconSizes.lg) +
    2 * convertRemToPx(theme.spacing.twoXS)
  const numberInputControlBreakpoint = icon
    ? theme.breakpoints.hideNumberInputControls + iconAdjustment
    : theme.breakpoints.hideNumberInputControls

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
      <StyledInputContainer
        className={isFocused ? "focused" : ""}
        data-testid="stNumberInputContainer"
      >
        <UIInput
          type="number"
          inputRef={inputRef}
          value={formattedValue ?? ""}
          placeholder={element.placeholder}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          onKeyDown={handleKeyDown}
          clearable={clearable}
          clearOnEscape={clearable}
          disabled={disabled}
          aria-label={element.label}
          startEnhancer={
            element.icon && (
              <DynamicIcon
                data-testid="stNumberInputIcon"
                iconValue={element.icon}
                size="lg"
              />
            )
          }
          id={id}
          overrides={{
            ClearIconContainer: {
              style: {
                padding: 0,
              },
            },
            ClearIcon: {
              props: {
                overrides: {
                  Svg: {
                    style: {
                      color: theme.colors.grayTextColor,
                      // setting this width and height makes the clear-icon align with dropdown arrows of other input fields
                      padding: theme.spacing.threeXS,
                      height: theme.sizes.clearIconSize,
                      width: theme.sizes.clearIconSize,
                      ":hover": {
                        fill: theme.colors.bodyText,
                      },
                    },
                  },
                },
              },
            },
            Input: {
              props: {
                "data-testid": "stNumberInputField",
                step: step,
                min: min,
                max: max,
                // We specify the type as "number" to have numeric keyboard on mobile devices.
                // We also set inputMode to "" since by default BaseWeb sets "text",
                // and for "decimal" / "numeric" IOS shows keyboard without a minus sign.
                type: "number",
                inputMode: "",
              },
              style: {
                fontWeight: theme.fontWeights.normal,
                lineHeight: theme.lineHeights.inputWidget,
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                paddingRight: theme.spacing.sm,
                paddingLeft: theme.spacing.md,
                paddingBottom: theme.spacing.sm,
                paddingTop: theme.spacing.sm,
                "::placeholder": {
                  color: theme.colors.fadedText60,
                },
              },
            },
            InputContainer: {
              style: () => ({
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
              }),
            },
            Root: {
              style: {
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                borderLeftWidth: 0,
                borderRightWidth: 0,
                borderTopWidth: 0,
                borderBottomWidth: 0,
                paddingRight: 0,
                paddingLeft: icon ? theme.spacing.sm : 0,
              },
            },
            StartEnhancer: {
              style: {
                paddingLeft: 0,
                paddingRight: 0,
                // Keeps emoji icons from being cut off on the right
                minWidth: theme.iconSizes.lg,
                // Material icons color changed as inactionable
                color: isMaterialIcon(icon)
                  ? theme.colors.fadedText60
                  : "inherit",
              },
            },
          }}
        />
        {/* We only want to show the increment/decrement controls when there is sufficient room to display the value and these controls. */}
        {width > numberInputControlBreakpoint && (
          <StyledInputControls>
            <StyledInputControl
              data-testid="stNumberInputStepDown"
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
              data-testid="stNumberInputStepUp"
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
