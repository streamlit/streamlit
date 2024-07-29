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

import { Minus, Plus } from "@emotion-icons/open-iconic"
import { withTheme } from "@emotion/react"
import { sprintf } from "sprintf-js"
import { Input as UIInput } from "baseui/input"
import uniqueId from "lodash/uniqueId"

import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import { logWarning } from "@streamlit/lib/src/util/log"
import { NumberInput as NumberInputProto } from "@streamlit/lib/src/proto"
import { breakpoints } from "@streamlit/lib/src/theme/primitives/breakpoints"
import {
  Source,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import Icon from "@streamlit/lib/src/components/shared/Icon"
import InputInstructions from "@streamlit/lib/src/components/shared/InputInstructions/InputInstructions"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import {
  isInForm,
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
  notNullOrUndefined,
} from "@streamlit/lib/src/util/utils"

import {
  StyledInputContainer,
  StyledInputControl,
  StyledInputControls,
  StyledInstructionsContainer,
} from "./styled-components"

/**
 * Return a string property from an element. If the string is
 * null or empty, return undefined instead.
 */
function getNonEmptyString(
  value: string | null | undefined
): string | undefined {
  return value == null || value === "" ? undefined : value
}

/**
 * This function returns the initial value for the NumberInput widget
 * via the widget manager.
 */
const getInitialValue = (
  props: Pick<Props, "element" | "widgetMgr">
): number | null => {
  const isIntData = props.element.dataType === NumberInputProto.DataType.INT
  const storedValue = isIntData
    ? props.widgetMgr.getIntValue(props.element)
    : props.widgetMgr.getDoubleValue(props.element)
  return storedValue ?? props.element.default ?? null
}

const getStep = ({
  step,
  dataType,
}: Pick<NumberInputProto, "step" | "dataType">): number => {
  if (step) {
    return step
  }
  if (dataType === NumberInputProto.DataType.INT) {
    return 1
  }
  return 0.01
}

/**
 * Utilizes the sprintf library to format a number value
 * according to a given format string.
 */
export const formatValue = ({
  value,
  format,
  step,
  dataType,
}: {
  value: number | null
  format?: string | null
  step?: number
  dataType: NumberInputProto.DataType
}): string | null => {
  if (isNullOrUndefined(value)) {
    return null
  }

  let formatString = getNonEmptyString(format)

  if (formatString == null && step != null) {
    const strStep = step.toString()
    if (
      dataType === NumberInputProto.DataType.FLOAT &&
      step !== 0 &&
      strStep.includes(".")
    ) {
      const decimalPlaces = strStep.split(".")[1].length
      formatString = `%0.${decimalPlaces}f`
    }
  }

  if (formatString == null) {
    return value.toString()
  }

  try {
    return sprintf(formatString, value)
  } catch (e) {
    logWarning(`Error in sprintf(${formatString}, ${value}): ${e}`)
    return String(value)
  }
}

export const canDecrement = (
  value: number | null,
  step: number,
  min: number
): boolean => {
  if (isNullOrUndefined(value)) {
    return false
  }
  return value - step >= min
}

export const canIncrement = (
  value: number | null,
  step: number,
  max: number
): boolean => {
  if (isNullOrUndefined(value)) {
    return false
  }
  return value + step <= max
}

export interface Props {
  disabled: boolean
  element: NumberInputProto
  widgetMgr: WidgetStateManager
  width: number
  theme: EmotionTheme
  fragmentId?: string
}

export const NumberInput: React.FC<Props> = ({
  disabled,
  element,
  widgetMgr,
  width,
  theme,
  fragmentId,
}: Props): ReactElement => {
  const {
    dataType: elementDataType,
    id: elementId,
    formId: elementFormId,
    default: elementDefault,
    format: elementFormat,
  } = element
  const min = element.hasMin ? element.min : -Infinity
  const max = element.hasMax ? element.max : +Infinity

  const [step, setStep] = React.useState<number>(getStep(element))
  const initialValue = getInitialValue({ element, widgetMgr })
  const [dirty, setDirty] = React.useState(false)
  const [value, setValue] = React.useState<number | null>(initialValue)
  const [formattedValue, setFormattedValue] = React.useState<string | null>(
    formatValue({ value: initialValue, ...element, step })
  )
  const [isFocused, setIsFocused] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const formClearHelper = React.useRef(new FormClearHelper())
  const id = React.useRef(uniqueId("number_input_"))

  const canDec = canDecrement(value, step, min)
  const canInc = canIncrement(value, step, max)

  // update the step if the props change
  React.useEffect(() => {
    setStep(getStep({ step: element.step, dataType: element.dataType }))
  }, [element.dataType, element.step])

  const commitValue = React.useCallback(
    ({ value, source }: { value: number | null; source: Source }) => {
      if (notNullOrUndefined(value) && (min > value || value > max)) {
        inputRef.current?.reportValidity()
      } else {
        const newValue = value ?? elementDefault ?? null

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
        setFormattedValue(
          formatValue({
            value: newValue,
            dataType: elementDataType,
            format: elementFormat,
            step,
          })
        )
      }
    },
    [
      min,
      max,
      inputRef,
      widgetMgr,
      fragmentId,
      step,
      elementDataType,
      elementId,
      elementFormId,
      elementDefault,
      elementFormat,
    ]
  )

  const onBlur = (): void => {
    if (dirty) {
      commitValue({ value, source: { fromUi: true } })
    }
    setIsFocused(false)
  }

  const onFocus = (): void => {
    setIsFocused(true)
  }

  const updateFromProtobuf = (): void => {
    const { value } = element
    element.setValue = false
    setValue(value ?? null)
    setFormattedValue(formatValue({ value: value ?? null, ...element, step }))
    commitValue({ value: value ?? null, source: { fromUi: false } })
  }

  // on component mount, we want to update the value from protobuf if setValue is true, otherwise commit current value
  React.useEffect(() => {
    const formClearHelperCopy = formClearHelper.current
    if (element.setValue) {
      updateFromProtobuf()
    } else {
      commitValue({ value, source: { fromUi: false } })
    }

    return () => {
      formClearHelperCopy.disconnect()
    }

    // I don't want to run this effect on every render, only on mount.
    // Additionally, it's okay if commitValue changes, because we only call
    // it once in the beginning anyways.
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [])

  // update from protobuf whenever component updates if element.setValue is truthy
  if (element.setValue) {
    updateFromProtobuf()
  }

  const clearable = isNullOrUndefined(element.default) && !disabled

  formClearHelper.current.manageFormClearListener(
    widgetMgr,
    element.formId,
    () => {
      setValue(element.default ?? null)
      commitValue({ value, source: { fromUi: true } })
    }
  )

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { value } = e.target

    if (value === "") {
      setDirty(true)
      setValue(null)
      setFormattedValue(null)
    } else {
      let numValue: number

      if (element.dataType === NumberInputProto.DataType.INT) {
        numValue = parseInt(value, 10)
      } else {
        numValue = parseFloat(value)
      }

      setDirty(true)
      setValue(numValue)
      setFormattedValue(value)
    }
  }

  const increment = React.useCallback(() => {
    if (canInc) {
      setDirty(true)
      commitValue({ value: (value ?? min) + step, source: { fromUi: true } })
    }
  }, [value, min, step, canInc])

  const decrement = React.useCallback(() => {
    if (canDec) {
      setDirty(true)
      commitValue({ value: (value ?? max) - step, source: { fromUi: true } })
    }
  }, [value, max, step, canDec])

  const onKeyDown = React.useCallback(
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

  const onKeyPress = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      if (e.key === "Enter") {
        if (dirty) {
          commitValue({ value, source: { fromUi: true } })
        }
        if (isInForm({ formId: elementFormId })) {
          widgetMgr.submitForm(elementFormId, fragmentId)
        }
      }
    },
    [dirty, value, commitValue, widgetMgr, elementFormId, fragmentId]
  )

  return (
    <div
      className="stNumberInput"
      data-testid="stNumberInput"
      style={{ width }}
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
          onBlur={() => onBlur()}
          onFocus={() => onFocus()}
          onChange={e => onChange(e)}
          onKeyPress={e => onKeyPress(e)}
          onKeyDown={e => onKeyDown(e)}
          clearable={clearable}
          clearOnEscape={clearable}
          disabled={disabled}
          aria-label={element.label}
          id={id.current}
          overrides={{
            ClearIcon: {
              props: {
                overrides: {
                  Svg: {
                    style: {
                      color: theme.colors.darkGray,
                      // Since the close icon is an SVG, and we can't control its viewbox nor its attributes,
                      // Let's use a scale transform effect to make it bigger.
                      // The width property only enlarges its bounding box, so it's easier to click.
                      transform: "scale(1.4)",
                      width: theme.spacing.twoXL,
                      marginRight: "-1.25em",
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
                "data-testid": "stNumberInput-Input",
                step: step,
                min: min,
                max: max,
              },
              style: {
                lineHeight: theme.lineHeights.inputWidget,
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                paddingRight: theme.spacing.sm,
                paddingLeft: theme.spacing.sm,
                paddingBottom: theme.spacing.sm,
                paddingTop: theme.spacing.sm,
              },
            },
            InputContainer: {
              style: () => ({
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
              }),
            },
            Root: {
              style: () => ({
                // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
                borderLeftWidth: 0,
                borderRightWidth: 0,
                borderTopWidth: 0,
                borderBottomWidth: 0,
              }),
            },
          }}
        />
        {/* We only want to show the increment/decrement controls when there is sufficient room to display the value and these controls. */}
        {width > breakpoints.hideNumberInputControls && (
          <StyledInputControls>
            <StyledInputControl
              className="step-down"
              data-testid="stNumberInput-StepDown"
              onClick={decrement}
              disabled={!canDec || disabled}
              tabIndex={-1}
            >
              <Icon
                content={Minus}
                size="xs"
                color={canDec ? "inherit" : "disabled"}
              />
            </StyledInputControl>
            <StyledInputControl
              className="step-up"
              data-testid="stNumberInput-StepUp"
              onClick={increment}
              disabled={!canInc || disabled}
              tabIndex={-1}
            >
              <Icon
                content={Plus}
                size="xs"
                color={canInc ? "inherit" : "disabled"}
              />
            </StyledInputControl>
          </StyledInputControls>
        )}
      </StyledInputContainer>
      {/* Hide the "Please enter to apply" text in small widget sizes */}
      {width > breakpoints.hideWidgetDetails && (
        <StyledInstructionsContainer clearable={clearable}>
          <InputInstructions
            dirty={dirty}
            value={formattedValue ?? ""}
            inForm={isInForm({ formId: element.formId })}
          />
        </StyledInstructionsContainer>
      )}
    </div>
  )
}

export default withTheme(NumberInput)
