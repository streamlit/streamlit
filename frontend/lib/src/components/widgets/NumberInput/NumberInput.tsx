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

import React, { useRef, useState } from "react"
import { Plus, Minus } from "@emotion-icons/open-iconic"
import { withTheme } from "@emotion/react"
import { sprintf } from "sprintf-js"

import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import { logWarning } from "@streamlit/lib/src/util/log"
import { NumberInput as NumberInputProto } from "@streamlit/lib/src/proto"
import { breakpoints } from "@streamlit/lib/src/theme/primitives/breakpoints"
import {
  WidgetStateManager,
  Source,
} from "@streamlit/lib/src/WidgetStateManager"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import Icon from "@streamlit/lib/src/components/shared/Icon"
import { Input as UIInput } from "baseui/input"
import InputInstructions from "@streamlit/lib/src/components/shared/InputInstructions/InputInstructions"
import {
  WidgetLabel,
  StyledWidgetLabelHelp,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import {
  isInForm,
  labelVisibilityProtoValueToEnum,
  isNullOrUndefined,
  notNullOrUndefined,
} from "@streamlit/lib/src/util/utils"

import {
  StyledInputContainer,
  StyledInputControl,
  StyledInputControls,
  StyledInstructionsContainer,
} from "./styled-components"
import uniqueId from "lodash/uniqueId"

export interface Props {
  disabled: boolean
  element: NumberInputProto
  widgetMgr: WidgetStateManager
  width: number
  theme: EmotionTheme
  fragmentId?: string
}

export interface State {
  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   */
  dirty: boolean

  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: number | null

  /**
   * The value with applied format that is going to be shown to the user
   */
  formattedValue: string | null

  /**
   * True if the input is selected
   */
  isFocused: boolean
}

/**
 * Return a string property from an element. If the string is
 * null or empty, return undefined instead.
 */
function getNonEmptyString(
  value: string | null | undefined
): string | undefined {
  return value == null || value === "" ? undefined : value
}

export const NumberInput = ({
  disabled,
  element,
  widgetMgr,
  width,
  theme,
  fragmentId,
}: Props) => {
  const initialValue = getInitialValue({ element, widgetMgr })
  const [dirty, setDirty] = React.useState(false)
  const [value, setValue] = React.useState<number | null>(initialValue)
  const [formattedValue, setFormattedValue] = React.useState<string | null>(
    formatValue(initialValue, element)
  )
  const [isFocused, setIsFocused] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const formClearHelper = React.useRef(new FormClearHelper())
  const id = React.useRef(uniqueId("number_input_"))

  console.log({ value, dirty, formattedValue })

  const getStep = () => {
    const { step } = element

    if (step) {
      return step
    }
    if (element.dataType === NumberInputProto.DataType.INT) {
      return 1
    }
    return 0.01
  }

  const getMin = () => {
    return element.hasMin ? element.min : -Infinity
  }

  const getMax = () => {
    return element.hasMax ? element.max : +Infinity
  }

  const step = getStep()
  const min = getMin()
  const max = getMax()
  const canDec = canDecrement(value, step, min)
  const canInc = canIncrement(value, step, max)

  // /** Commit state.value to the WidgetStateManager. */
  // private commitWidgetValue = (source: Source): void => {
  //   const { value } = this.state
  //   const { element, widgetMgr, fragmentId } = this.props
  //   const data = this.props.element

  //   const min = this.getMin()
  //   const max = this.getMax()

  //   if (notNullOrUndefined(value) && (min > value || value > max)) {
  //     const node = this.inputRef.current
  //     if (node) {
  //       node.reportValidity()
  //     }
  //   } else {
  //     const valueToBeSaved = value ?? data.default ?? null

  //     if (this.isIntData()) {
  //       widgetMgr.setIntValue(element, valueToBeSaved, source, fragmentId)
  //     } else {
  //       widgetMgr.setDoubleValue(element, valueToBeSaved, source, fragmentId)
  //     }

  //     this.setState({
  //       dirty: false,
  //       value: valueToBeSaved,
  //       formattedValue: this.formatValue(valueToBeSaved),
  //     })
  //   }
  // }

  const commitValue = React.useCallback(
    ({ value, source }: { value: number | null; source: Source }) => {
      // console.log("committing valueee")
      console.log({ value })
      if (notNullOrUndefined(value) && (min > value || value > max)) {
        // console.log("value is not null or undefined")
        const node = inputRef.current
        if (node) {
          node.reportValidity()
        }
      } else {
        // console.log("value is null or undefined")
        const valueToBeSaved = value ?? element.default ?? null

        switch (element.dataType) {
          case NumberInputProto.DataType.INT:
            widgetMgr.setIntValue(element, valueToBeSaved, source, fragmentId)
            break
          case NumberInputProto.DataType.FLOAT:
            widgetMgr.setDoubleValue(
              element,
              valueToBeSaved,
              source,
              fragmentId
            )
            break
          default:
            throw new Error("Invalid data type")
        }

        setDirty(false)
        setValue(valueToBeSaved)
        setFormattedValue(formatValue(valueToBeSaved, element))
      }
    },
    [value, min, max, inputRef, element, widgetMgr, fragmentId]
  )

  const onBlur = () => {
    if (dirty) {
      commitValue({ value, source: { fromUi: true } })
    }
    setIsFocused(false)
  }

  const onFocus = () => {
    setIsFocused(true)
  }

  React.useEffect(() => {
    if (element.setValue) {
      updateFromProtobuf()
    } else {
      commitValue({ value, source: { fromUi: false } })
    }

    return () => {
      formClearHelper.current.disconnect()
    }
  }, [])

  React.useEffect(() => {
    if (element.setValue) {
      updateFromProtobuf()
    }
  })

  const updateFromProtobuf = () => {
    const { value } = element
    element.setValue = false
    setValue(value ?? null)
    setFormattedValue(formatValue(value ?? null, element))
    commitValue({ value: value ?? null, source: { fromUi: false } })
  }

  const clearable = isNullOrUndefined(element.default) && !disabled

  // todo what should this be behind?
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
  ) => {
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

  const modifyValueUsingStep = (modifier: "increment" | "decrement") => {
    return () => {
      console.log("modifier", modifier)
      console.log({ modifier, value, step, min, max, canDec, canInc })
      switch (modifier) {
        case "increment":
          if (canInc) {
            console.log("incrementing!!!")
            setDirty(true)
            setValue(prevValue => {
              console.log("settingValue")
              console.log({ prevValue })
              const newValue = (prevValue ?? min) + step
              console.log({ newValue })
              commitValue({ value: newValue, source: { fromUi: true } })
              return newValue
            })
          }
          break
        case "decrement":
          if (canDec) {
            setDirty(true)
            setValue(prevValue => {
              console.log("settingValue")
              console.log({ prevValue })
              const newValue = (prevValue ?? max) - step
              console.log({ newValue })
              commitValue({ value: newValue, source: { fromUi: true } })
              return newValue
            })
          }
          break
        default:
      }
    }
  }

  const onKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { key } = e

    switch (key) {
      case "ArrowUp":
        e.preventDefault()
        modifyValueUsingStep("increment")()
        break
      case "ArrowDown":
        e.preventDefault()
        modifyValueUsingStep("decrement")()
        break
      default:
    }
  }

  const onKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter") {
      if (dirty) {
        commitValue({ value, source: { fromUi: true } })
      }
      if (isInForm(element)) {
        widgetMgr.submitForm(element.formId, fragmentId)
      }
    }
  }

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

        {width > breakpoints.hideNumberInputControls && (
          <StyledInputControls>
            <StyledInputControl
              className="step-down"
              data-testid="stNumberInput-StepDown"
              onClick={modifyValueUsingStep("decrement")}
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
              onClick={modifyValueUsingStep("increment")}
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

function getInitialValue(
  props: Pick<Props, "element" | "widgetMgr">
): number | null {
  const isIntData = props.element.dataType === NumberInputProto.DataType.INT
  const storedValue = isIntData
    ? props.widgetMgr.getIntValue(props.element)
    : props.widgetMgr.getDoubleValue(props.element)
  return storedValue ?? props.element.default ?? null
}

const formatValue = (
  value: number | null,
  element: NumberInputProto
): string | null => {
  if (isNullOrUndefined(value)) {
    return null
  }

  const { format, step } = element
  let formatString = getNonEmptyString(format)

  if (formatString == null) {
    const strStep = step.toString()
    if (
      element.dataType === NumberInputProto.DataType.FLOAT &&
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

const canDecrement = (
  value: number | null,
  step: number,
  min: number
): boolean => {
  if (isNullOrUndefined(value)) {
    return false
  }
  return value - step >= min
}

const canIncrement = (
  value: number | null,
  step: number,
  max: number
): boolean => {
  if (isNullOrUndefined(value)) {
    return false
  }
  return value + step <= max
}

export default withTheme(NumberInput)
