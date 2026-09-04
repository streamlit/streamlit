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
  StyledRadioButton,
  StyledRadioCaption,
  StyledRadioCaptionSpacer,
  StyledRadioField,
  StyledRadioGroup,
  StyledRadioInner,
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

  // An all-blank captions list must lay out exactly like no captions at all, so
  // blank entries don't count. Gates the vertical group's gap and the horizontal
  // spacers; captioning only some options is supported.
  const hasCaptions = captions.some(caption => caption.trim() !== "")
  const hasOptions = options.length > 0
  const cleanedOptions = hasOptions ? options : ["No options to select."]

  // Either the user specified it as disabled or it's disabled because we don't have any options
  const shouldDisable = disabled || !hasOptions

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
        {cleanedOptions.map((option: string, index: number) => {
          // A missing or whitespace-only caption counts as no caption: `captions`
          // need not be as long as `options`, and the backend passes whitespace
          // through unchanged. Either would otherwise point `aria-describedby` at
          // content with nothing to announce.
          const rawCaption = captions[index] ?? ""
          const caption = rawCaption.trim() === "" ? "" : rawCaption

          // In a horizontal group, an option without a caption still needs that
          // vertical space reserved, or its label stops lining up with the
          // captioned options'.
          const needsSpacer = caption === "" && horizontal && hasCaptions

          return (
            <StyledRadioField
              // eslint-disable-next-line @eslint-react/no-array-index-key
              key={index}
              value={index.toString()}
            >
              <StyledRadioButton data-testid="stRadioOption">
                {({ isSelected, isDisabled }) => (
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
                )}
              </StyledRadioButton>
              {caption !== "" && (
                <StyledRadioCaption
                  slot="description"
                  elementType="div"
                  data-testid="stRadioCaption"
                >
                  <StreamlitMarkdown
                    source={caption}
                    allowHTML={false}
                    isCaption
                    isLabel
                  />
                </StyledRadioCaption>
              )}
              {needsSpacer && (
                <StyledRadioCaptionSpacer
                  aria-hidden="true"
                  data-testid="stRadioCaptionSpacer"
                >
                  <StreamlitMarkdown
                    source="&nbsp;"
                    allowHTML={false}
                    isCaption
                    isLabel
                  />
                </StyledRadioCaptionSpacer>
              )}
            </StyledRadioField>
          )
        })}
      </StyledRadioGroup>
    </div>
  )
}

export default memo(Radio)
