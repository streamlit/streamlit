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
  useRef,
  useState,
} from "react"

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

interface RadioOptionProps {
  index: number
  option: string
  /** Empty when this option has no caption. */
  caption: string
  /** When true, renders a blank caption line so horizontal rows stay aligned. */
  needsSpacer: boolean
  /**
   * The whole group is disabled. Only the caption reads this; the label and the
   * circle use React Aria's per-option state instead.
   */
  isDisabled: boolean
}

/**
 * One option in the group: the clickable label, plus the caption when the option
 * has one. Each option is its own component so it can own the input ref that its
 * caption's click handler needs — `RadioField` takes a `RefObject`, and hooks
 * cannot run inside a loop.
 */
function RadioOption({
  index,
  option,
  caption,
  needsSpacer,
  isDisabled,
}: Readonly<RadioOptionProps>): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * Selects this option when its caption is clicked. The caption sits outside the
   * label, so nothing native does this. It stays a plain pointer target — no
   * role, no tab stop — because the radio input is already the accessible
   * control.
   */
  const handleCaptionClick = useCallback((): void => {
    // A click that ends a text selection should not also change the selection.
    // getSelection() can be null, so compare against false rather than negating.
    if (window.getSelection()?.isCollapsed === false) {
      return
    }

    // Go through the input rather than reimplementing a label click, which keeps
    // React Aria the only thing deciding what a selection means: it ignores a
    // selection that changes nothing, so this cannot rerun the script for a
    // no-op, and a disabled input ignores the click outright.
    inputRef.current?.click()

    // A programmatic click does not run the browser's focus steps, so move focus
    // explicitly — otherwise arrow keys do nothing until the group is tabbed
    // back into.
    inputRef.current?.focus()
  }, [])

  return (
    <StyledRadioField value={index.toString()} inputRef={inputRef}>
      <StyledRadioButton data-testid="stRadioOption">
        {({ isSelected: isChecked, isDisabled: isOptionDisabled }) => (
          <StyledRadioRow>
            <StyledRadioOuter
              $isSelected={isChecked}
              $isDisabled={isOptionDisabled}
            >
              <StyledRadioInner $isSelected={isChecked} />
            </StyledRadioOuter>
            <StreamlitMarkdown source={option} allowHTML={false} isLabel />
          </StyledRadioRow>
        )}
      </StyledRadioButton>
      {caption !== "" && (
        <StyledRadioCaption
          slot="description"
          elementType="div"
          data-testid="stRadioCaption"
          onClick={handleCaptionClick}
          $isDisabled={isDisabled}
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
          data-testid="stRadioSpacer"
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
          // `captions` is not required to be as long as `options`, so an index
          // past its end reads as a missing caption rather than `undefined`.
          const caption = captions[index] ?? ""

          return (
            <RadioOption
              // eslint-disable-next-line @eslint-react/no-array-index-key
              key={index}
              index={index}
              option={option}
              caption={caption}
              // Only horizontal rows with partial captions need the space kept.
              needsSpacer={caption === "" && horizontal && hasCaptions}
              isDisabled={shouldDisable}
            />
          )
        })}
      </StyledRadioGroup>
    </div>
  )
}

export default memo(Radio)
