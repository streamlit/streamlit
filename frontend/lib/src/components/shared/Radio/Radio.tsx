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
  useState,
} from "react"

import { ALIGN, RadioGroup, Radio as UIRadio } from "baseui/radio"

import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { Placement } from "~lib/components/shared/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import {
  StyledWidgetLabelHelpInline,
  WidgetLabel,
} from "~lib/components/widgets/BaseWidget"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { addCssUnit, convertRemToPx, EmotionTheme } from "~lib/theme"
import { LabelVisibilityOptions } from "~lib/util/utils"

export interface Props {
  disabled: boolean
  horizontal: boolean
  value: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  onChange: (selectedIndex: number) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  options: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  captions: any[]
  label?: string
  labelVisibility?: LabelVisibilityOptions
  help?: string
}

function getRadioInnerSizes(theme: EmotionTheme): [string, string] {
  // If checked, the radio inner circle should fill 37.5% of the total radio size.
  // If not checked, it should show a border of spacing.threeXS.

  // However, fractional pixels could cause the radio border to look uneven. This happens
  // when (checkbox - threeXS) in rem is not an integer number of pixels. To avoid this,
  // we round the number converted from rem to pixels then add back the unit.
  const checkboxSize = parseFloat(theme.sizes.checkbox)
  const threeXSSpacing = parseFloat(theme.spacing.threeXS)

  const outerSize = convertRemToPx(checkboxSize.toString())
  const checkedInnerSize = Math.round(outerSize * 0.375)

  let innerSize = Math.round(
    convertRemToPx((checkboxSize - threeXSSpacing).toString())
  )
  // If rounding makes the inner size larger than the checkbox, reduce it by 1px
  if (innerSize >= outerSize) {
    innerSize -= 1
  }

  return [addCssUnit(checkedInnerSize, "px"), addCssUnit(innerSize, "px")]
}

function Radio({
  disabled,
  horizontal,
  value: defaultValue,
  onChange,
  options,
  captions,
  label,
  labelVisibility,
  help,
}: Readonly<Props>): ReactElement {
  const [value, setValue] = useState(defaultValue ?? null)

  useEffect(() => {
    if (defaultValue === value) {
      return
    }

    setValue(defaultValue ?? null)

    // Exclude value from the dependency list on purpose to avoid a loop.
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [defaultValue])

  const onChangeCallback = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const selectedIndex = parseInt(e.target.value, 10)
      setValue(selectedIndex)
      onChange(selectedIndex) // Needs to happen later, no?
    },
    [onChange]
  )

  const theme = useEmotionTheme()
  const hasCaptions = captions.length > 0
  const hasOptions = options.length > 0
  const cleanedOptions = hasOptions ? options : ["No options to select."]

  // Either the user specified it as disabled or it's disabled because we don't have any options
  const shouldDisable = disabled || !hasOptions

  const spacerNeeded = (caption: string): string => {
    // When captions are provided for only some options in horizontal
    // layout we need to add a spacer for the options without captions
    const spacer = caption == "" && horizontal && hasCaptions
    return spacer ? "&nbsp;" : caption
  }

  const [checkedRadioInnerSize, radioInnerSize] = getRadioInnerSizes(theme)

  return (
    <div className="stRadio" data-testid="stRadio">
      <WidgetLabel
        label={label}
        disabled={shouldDisable}
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
        value={value !== null ? value.toString() : undefined}
        disabled={shouldDisable}
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
        {cleanedOptions.map((option: string, index: number) => (
          <UIRadio
            // TODO: Update to match React best practices
            // eslint-disable-next-line @eslint-react/no-array-index-key
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
                    ? theme.colors.darkenedBgMix25
                    : "",
                }),
              },
              RadioMarkOuter: {
                style: ({ $checked }: { $checked: boolean }) => ({
                  width: theme.sizes.checkbox,
                  height: theme.sizes.checkbox,
                  // The margin top is needed to align the radio buttons
                  // with the text label baseline.
                  // The text label has a line-height of 1.6
                  // making the font height around 1.6rem
                  // while the radio icon has a height of 1rem.
                  //eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values
                  marginTop: "0.35rem",
                  marginRight: theme.spacing.none,
                  marginLeft: theme.spacing.none,
                  backgroundColor:
                    $checked && !shouldDisable
                      ? theme.colors.primary
                      : theme.colors.fadedText40,
                }),
              },
              RadioMarkInner: {
                style: ({ $checked }: { $checked: boolean }) => ({
                  height: $checked ? checkedRadioInnerSize : radioInnerSize,
                  width: $checked ? checkedRadioInnerSize : radioInnerSize,
                }),
              },
              Label: {
                style: {
                  color: shouldDisable
                    ? theme.colors.fadedText40
                    : theme.colors.bodyText,
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
