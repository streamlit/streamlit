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

import React, {
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react"

import { useTheme } from "@emotion/react"
import { ALIGN, RadioGroup, Radio as UIRadio } from "baseui/radio"

import {
  StyledWidgetLabelHelpInline,
  WidgetLabel,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { LabelVisibilityOptions } from "@streamlit/lib/src/util/utils"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown"

export interface Props {
  disabled: boolean
  horizontal: boolean
  width?: number
  value: number | null
  onChange: (selectedIndex: number) => any
  options: any[]
  captions: any[]
  label?: string
  labelVisibility?: LabelVisibilityOptions
  help?: string
}

function Radio({
  disabled,
  horizontal,
  width,
  value,
  onChange,
  options,
  captions,
  label,
  labelVisibility,
  help,
}: Readonly<Props>): ReactElement {
  const [internalValue, setInternalValue] = useState(value ?? null)

  useEffect(() => {
    if (value === internalValue) {
      return
    }

    setInternalValue(value ?? null)

    // Exclude internalValue from the dependency list on purpose to avoid a loop.
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [value])

  const onChangeCallback = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const selectedIndex = parseInt(e.target.value, 10)
      setInternalValue(selectedIndex)
      onChange(selectedIndex) // Needs to happen later, no?
    },
    [onChange]
  )

  const theme = useTheme()
  const { colors, radii } = theme
  const style = { width }
  const optionsCopy = [...options]
  const hasCaptions = captions.length > 0

  const spacerNeeded = (caption: string): string => {
    // When captions are provided for only some options in horizontal
    // layout we need to add a spacer for the options without captions
    const spacer = caption == "" && horizontal && hasCaptions
    return spacer ? "&nbsp;" : caption
  }

  if (optionsCopy.length === 0) {
    optionsCopy.push("No options to select.")
    disabled = true
  }

  return (
    <div className="stRadio" data-testid="stRadio" style={style}>
      <WidgetLabel
        label={label}
        disabled={disabled}
        labelVisibility={labelVisibility}
      >
        {help && (
          <StyledWidgetLabelHelpInline>
            <TooltipIcon content={help} placement={Placement.TOP_RIGHT} />
          </StyledWidgetLabelHelpInline>
        )}
      </WidgetLabel>
      <RadioGroup
        onChange={onChangeCallback}
        value={internalValue !== null ? internalValue.toString() : undefined}
        disabled={disabled}
        align={horizontal ? ALIGN.horizontal : ALIGN.vertical}
        aria-label={label}
        data-testid="stRadioGroup"
        overrides={{
          RadioGroupRoot: {
            style: {
              gap: hasCaptions ? theme.spacing.sm : theme.spacing.none,
              minHeight: theme.sizes.minElementHeight,
            },
          },
        }}
      >
        {optionsCopy.map((option: string, index: number) => (
          <UIRadio
            key={index}
            value={index.toString()}
            overrides={{
              Root: {
                style: ({
                  $isFocusVisible,
                }: {
                  $isFocusVisible: boolean
                }) => ({
                  marginBottom: theme.spacing.none,
                  marginTop: theme.spacing.none,
                  marginRight: hasCaptions
                    ? theme.spacing.sm
                    : theme.spacing.lg,
                  // Make left and right padding look the same visually.
                  paddingLeft: theme.spacing.none,
                  alignItems: "start",
                  paddingRight: theme.spacing.threeXS,
                  backgroundColor: $isFocusVisible
                    ? colors.darkenedBgMix25
                    : "",
                  borderTopLeftRadius: radii.md,
                  borderTopRightRadius: radii.md,
                  borderBottomLeftRadius: radii.md,
                  borderBottomRightRadius: radii.md,
                }),
              },
              RadioMarkOuter: {
                style: ({ $checked }: { $checked: boolean }) => ({
                  width: theme.sizes.checkbox,
                  height: theme.sizes.checkbox,
                  marginTop: "0.35rem",
                  marginRight: theme.spacing.none,
                  marginLeft: theme.spacing.none,
                  backgroundColor:
                    $checked && !disabled
                      ? colors.primary
                      : colors.fadedText40,
                }),
              },
              RadioMarkInner: {
                style: ({ $checked }: { $checked: boolean }) => ({
                  height: $checked
                    ? "6px"
                    : `calc(${theme.sizes.checkbox} - ${theme.spacing.threeXS})`,
                  width: $checked
                    ? "6px"
                    : `calc(${theme.sizes.checkbox} - ${theme.spacing.threeXS})`,
                }),
              },
              Label: {
                style: {
                  color: disabled ? colors.fadedText40 : colors.bodyText,
                  position: "relative",
                  top: theme.spacing.px,
                },
              },
            }}
          >
            <StreamlitMarkdown
              source={option}
              allowHTML={false}
              isLabel
              largerLabel
            />
            {hasCaptions && (
              <StreamlitMarkdown
                source={spacerNeeded(captions[index])}
                allowHTML={false}
                isCaption
                isLabel
              />
            )}
          </UIRadio>
        ))}
      </RadioGroup>
    </div>
  )
}

export default memo(Radio)
