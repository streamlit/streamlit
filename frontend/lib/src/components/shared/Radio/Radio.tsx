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

import { memo, ReactElement, useCallback, useEffect, useState } from "react"

import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIconInline } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIconInline"
import { LabelVisibilityOptions } from "~lib/util/utils"

import {
  StyledRadioCaption,
  StyledRadioContent,
  StyledRadioGroup,
  StyledRadioInner,
  StyledRadioItem,
  StyledRadioOuter,
  StyledRadioRow,
} from "./styled-components"

export interface Props {
  disabled: boolean
  horizontal: boolean
  value: number | null
  onChange: (selectedIndex: number) => void
  options: string[]
  captions: string[]
  label?: string
  labelVisibility?: LabelVisibilityOptions
  help?: string
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: Update to match React best practices
  }, [defaultValue])

  const handleChange = useCallback(
    (selectedValue: string): void => {
      const selectedIndex = parseInt(selectedValue, 10)
      setValue(selectedIndex)
      onChange(selectedIndex)
    },
    [onChange]
  )

  const hasCaptions = captions.length > 0
  const hasOptions = options.length > 0
  const cleanedOptions = hasOptions ? options : ["No options to select."]

  // Either the user specified it as disabled or it's disabled because we don't have any options
  const shouldDisable = disabled || !hasOptions

  const spacerNeeded = (caption: string): string => {
    // When captions are provided for only some options in horizontal layout
    // we need to add a spacer for the options without captions
    const spacer = caption === "" && horizontal && hasCaptions
    return spacer ? "&nbsp;" : caption
  }

  return (
    <div className="stRadio" data-testid="stRadio">
      <WidgetLabel
        label={label}
        disabled={shouldDisable}
        labelVisibility={labelVisibility}
      >
        {help && (
          <WidgetLabelHelpIconInline
            content={help}
            placement={Placement.TOP_RIGHT}
            label={label}
          />
        )}
      </WidgetLabel>
      <StyledRadioGroup
        onChange={handleChange}
        value={value !== null ? value.toString() : null}
        isDisabled={shouldDisable}
        orientation={horizontal ? "horizontal" : "vertical"}
        aria-label={label}
        data-testid="stRadioGroup"
        $horizontal={horizontal}
        $hasCaptions={hasCaptions}
      >
        {cleanedOptions.map((option: string, index: number) => (
          <StyledRadioItem
            // eslint-disable-next-line @eslint-react/no-array-index-key
            key={index}
            value={index.toString()}
            data-testid="stRadioOption"
          >
            {({ isSelected, isDisabled }) => (
              <StyledRadioContent $isDisabled={isDisabled}>
                <StyledRadioRow>
                  <StyledRadioOuter
                    $isSelected={isSelected}
                    $isDisabled={isDisabled}
                  >
                    <StyledRadioInner $isSelected={isSelected} />
                  </StyledRadioOuter>
                  <StreamlitMarkdown
                    source={option}
                    allowHTML={false}
                    isLabel
                  />
                </StyledRadioRow>
                {hasCaptions && (
                  <StyledRadioCaption>
                    <StreamlitMarkdown
                      source={spacerNeeded(captions[index])}
                      allowHTML={false}
                      isCaption
                      isLabel
                    />
                  </StyledRadioCaption>
                )}
              </StyledRadioContent>
            )}
          </StyledRadioItem>
        ))}
      </StyledRadioGroup>
    </div>
  )
}

export default memo(Radio)
