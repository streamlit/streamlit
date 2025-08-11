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

import React, {
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
import uniqueId from "lodash/uniqueId"

import { NumberInput as NumberInputProto } from "@streamlit/protobuf"

import Icon, { DynamicIcon } from "~lib/components/shared/Icon"
import InputInstructions from "~lib/components/shared/InputInstructions/InputInstructions"
import { Placement } from "~lib/components/shared/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "~lib/components/widgets/BaseWidget"
import { useFormClearHelper } from "~lib/components/widgets/Form"
import { useCalculatedWidth } from "~lib/hooks/useCalculatedWidth"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme"
import {
  isInForm,
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
  notNullOrUndefined,
} from "~lib/util/utils"
import { Source, WidgetStateManager } from "~lib/WidgetStateManager"

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
  getInitialValue,
  getStep,
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
    id: elementId,
    formId: elementFormId,
    default: elementDefault,
    format: elementFormat,
    icon,
    min,
    max,
  } = element

  const [width, elementRef] = useCalculatedWidth()

  const [step, setStep] = useState<number>(() => getStep(element))
  const initialValue = getInitialValue({ element, widgetMgr })
  const [dirty, setDirty] = useState(false)
  const [value, setValue] = useState<number | null>(initialValue)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const id = useRef(uniqueId("number_input_"))

  const formattedValue = useMemo(() => {
    return formatValue({
      value,
      dataType: elementDataType,
      format: elementFormat,
      step,
    })
  }, [value, elementDataType, elementFormat, step])

  const canDec = canDecrement(value, step, min)
  const canInc = canIncrement(value, step, max)

  const inForm = isInForm({ formId: elementFormId })
  // Allows form submission on Enter & displays Enter instructions, or if not in form and state is dirty
  const allowEnterToSubmit = inForm
    ? widgetMgr.allowFormEnterToSubmit(elementFormId)
    : dirty
  // Hide input instructions for small widget sizes.
  const shouldShowInstructions =
    isFocused && width > theme.breakpoints.hideWidgetDetails

  // Update the step if the props change
  useEffect(() => {
    setStep(getStep({ step: element.step, dataType: element.dataType }))
  }, [element.dataType, element.step])

  const commitValue = useCallback(
    ({
      value: valueArg,
      source,
    }: {
      value: number | null
      source: Source
    }) => {
      if (notNullOrUndefined(valueArg) && (min > valueArg || valueArg > max)) {
        inputRef.current?.reportValidity()
      } else {
        const newValue = valueArg ?? elementDefault ?? null

        switch (elementDataType) {
          case NumberInputProto.DataType.INT:
            widgetMgr.setIntValue(
              { id: elementId, formId: elementFormId },
              newValue,
              source,
              fragmentId
            )
            break
          case NumberInputProto.DataType.FLOAT:
            widgetMgr.setDoubleValue(
              { id: elementId, formId: elementFormId },
              newValue,
              source,
              fragmentId
            )
            break
          default:
            throw new Error("Invalid data type")
        }

        setDirty(false)
        setValue(newValue)
      }
    },
    [
      min,
      max,
      inputRef,
      widgetMgr,
      fragmentId,
      elementDataType,
      elementId,
      elementFormId,
      elementDefault,
    ]
  )

  const onBlur = useCallback((): void => {
    if (dirty) {
      commitValue({ value, source: { fromUi: true } })
    }
    setIsFocused(false)
  }, [dirty, value, commitValue])

  const onFocus = useCallback((): void => {
    setIsFocused(true)
  }, [])

  const updateFromProtobuf = useCallback((): void => {
    const { value: elementValue } = element
    element.setValue = false
    setValue(elementValue ?? null)
    commitValue({ value: elementValue ?? null, source: { fromUi: false } })
  }, [element, commitValue])

  // on component mount, we want to update the value from protobuf if setValue is true, otherwise commit current value
  useEffect(() => {
    if (element.setValue) {
      updateFromProtobuf()
    } else {
      commitValue({ value, source: { fromUi: false } })
    }

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

    // I don't want to run this effect on every render, only on mount.
    // Additionally, it's okay if commitValue changes, because we only call
    // it once in the beginning anyways.
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [])

  // update from protobuf whenever component updates if element.setValue is truthy
  if (element.setValue) {
    updateFromProtobuf()
  }

  const clearable = isNullOrUndefined(element.default) && !disabled

  const onFormCleared = useCallback(() => {
    const newValue = element.default ?? null
    setValue(newValue)
    commitValue({ value: newValue, source: { fromUi: true } })
  }, [element])

  useFormClearHelper({
    element,
    widgetMgr,
    onFormCleared,
  })

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { value: targetValue } = e.target

    if (targetValue === "") {
      setDirty(true)
      setValue(null)
    } else {
      let numValue: number

      if (element.dataType === NumberInputProto.DataType.INT) {
        numValue = parseInt(targetValue, 10)
      } else {
        numValue = parseFloat(targetValue)
      }

      setDirty(true)
      setValue(numValue)
    }
  }

  const increment = useCallback(() => {
    if (canInc) {
      setDirty(true)
      commitValue({ value: (value ?? min) + step, source: { fromUi: true } })
    }
  }, [value, min, step, canInc])

  const decrement = useCallback(() => {
    if (canDec) {
      setDirty(true)
      commitValue({ value: (value ?? max) - step, source: { fromUi: true } })
    }
  }, [value, max, step, canDec])

  const onKeyDown = useCallback(
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

  const onKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      if (e.key === "Enter") {
        if (dirty) {
          commitValue({ value, source: { fromUi: true } })
        }
        if (widgetMgr.allowFormEnterToSubmit(elementFormId)) {
          widgetMgr.submitForm(elementFormId, fragmentId)
        }
      }
    },
    [dirty, value, commitValue, widgetMgr, elementFormId, fragmentId]
  )

  // Material icons need to be larger to render similar size of emojis,
  // and we change their text color
  const isMaterialIcon = icon?.startsWith(":material")
  const dynamicIconSize = isMaterialIcon ? "lg" : "base"

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
        htmlFor={id.current}
      >
        {element.help && (
          <StyledWidgetLabelHelp>
            <TooltipIcon
              content={element.help}
              placement={Placement.TOP_RIGHT}
            />
          </StyledWidgetLabelHelp>
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
          onBlur={onBlur}
          onFocus={onFocus}
          onChange={onChange}
          onKeyPress={onKeyPress}
          onKeyDown={onKeyDown}
          clearable={clearable}
          clearOnEscape={clearable}
          disabled={disabled}
          aria-label={element.label}
          startEnhancer={
            element.icon && (
              <DynamicIcon
                data-testid="stNumberInputIcon"
                iconValue={element.icon}
                size={dynamicIconSize}
              />
            )
          }
          id={id.current}
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
                      color: theme.colors.darkGray,
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
                color: isMaterialIcon ? theme.colors.fadedText60 : "inherit",
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
                color={canDec ? "inherit" : theme.colors.disabled}
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
                color={canInc ? "inherit" : theme.colors.disabled}
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
