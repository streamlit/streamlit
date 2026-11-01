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
  type ReactElement,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react"

import { isNullOrEmptyString } from "@streamlit/utils"

import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIconInline } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIconInline"
import type { LabelVisibilityOptions } from "~lib/util/utils"

import {
  StyledRadioButton,
  StyledRadioCaption,
  StyledRadioCaptionSpacer,
  StyledRadioCard,
  StyledRadioCardField,
  StyledRadioCardIndicator,
  StyledRadioCardRow,
  StyledRadioCardTitle,
  StyledRadioField,
  StyledRadioGroup,
  StyledRadioInner,
  StyledRadioOuter,
  StyledRadioRow,
} from "./styled-components"

/**
 * Visual style of the options: a list of radio buttons (`"default"`) or one
 * bordered, selectable card per option (`"cards"`).
 */
export type RadioType = "default" | "cards"

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
  /** Visual style of the options. Defaults to `"default"`. */
  type?: RadioType
  /**
   * Whether the widget has a definite width (`width="stretch"` or pixels),
   * so the cards in a horizontal row get equal widths that fill it. Unused by
   * the default style.
   */
  containerWidth?: boolean
}

interface RadioIndicatorProps {
  isSelected: boolean
  isHovered: boolean
  isDisabled: boolean
}

/** The radio circle, shared by both styles. */
function RadioIndicator({
  isSelected,
  isHovered,
  isDisabled,
}: Readonly<RadioIndicatorProps>): ReactElement {
  return (
    <StyledRadioOuter
      $isSelected={isSelected}
      $isHovered={isHovered}
      $isDisabled={isDisabled}
    >
      <StyledRadioInner $isSelected={isSelected} $isDisabled={isDisabled} />
    </StyledRadioOuter>
  )
}

interface RadioCaptionProps {
  caption: string
  /** Renders links as plain text, for captions inside a clickable card. */
  disableLinks?: boolean
}

/**
 * The caption, rendered as React Aria's `description` slot of the enclosing
 * `RadioField`. Blank captions render nothing.
 */
function RadioCaption({
  caption,
  disableLinks = false,
}: Readonly<RadioCaptionProps>): ReactElement | null {
  if (caption === "") {
    return null
  }

  return (
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
        disableLinks={disableLinks}
      />
    </StyledRadioCaption>
  )
}

interface RadioCardOptionProps {
  value: string
  option: string
  caption: string
  /** Id of the title element, which labels the option's input. */
  titleId: string
  /** Whether the title is semibold, which the group uses when it has captions. */
  isEmphasized: boolean
}

/**
 * One option of a card group (`type="cards"`). The caption sits inside the
 * card's label so the whole card is one click target. Labelling the input by
 * the title alone keeps the caption out of the accessible name; it remains the
 * description.
 *
 * Links in the title and caption render as plain text, as in button labels:
 * React Aria cancels clicks inside the label, and a focusable link there would
 * select the card on Enter instead of opening.
 */
function RadioCardOption({
  value,
  option,
  caption,
  titleId,
  isEmphasized,
}: Readonly<RadioCardOptionProps>): ReactElement {
  return (
    <StyledRadioCardField value={value} aria-labelledby={titleId}>
      <StyledRadioCard data-testid="stRadioOption">
        {({ isSelected, isHovered, isDisabled }) => (
          <>
            <StyledRadioCardRow>
              <StyledRadioCardIndicator data-testid="stRadioCardIndicator">
                <RadioIndicator
                  isSelected={isSelected}
                  isHovered={isHovered}
                  isDisabled={isDisabled}
                />
              </StyledRadioCardIndicator>
              <StyledRadioCardTitle id={titleId} $isEmphasized={isEmphasized}>
                <StreamlitMarkdown
                  source={option}
                  allowHTML={false}
                  isLabel
                  disableLinks
                />
              </StyledRadioCardTitle>
            </StyledRadioCardRow>
            <RadioCaption caption={caption} disableLinks />
          </>
        )}
      </StyledRadioCard>
    </StyledRadioCardField>
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
  type = "default",
  containerWidth = false,
}: Readonly<Props>): ReactElement {
  const [value, setValue] = useState(defaultValue ?? null)
  const isCards = type === "cards"
  // Unique per group, so card title ids never collide across groups.
  const titleBaseId = useId()

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
      const selectedIndex = Number.parseInt(selectedValue, 10)
      setValue(selectedIndex)
      onChange(selectedIndex)
    },
    [onChange]
  )

  const hasOptions = options.length > 0
  const cleanedOptions = hasOptions ? options : ["No options to select."]

  // Only captions that line up with a user option apply. Extra entries and the
  // no-options placeholder are ignored.
  const optionCaptions = captions
    .slice(0, options.length)
    // A whitespace-only caption counts as no caption, which keeps
    // `aria-describedby` off content with nothing to announce: captioning only
    // part of a group is supported, and the backend passes whitespace through
    // unchanged.
    .map(caption => (caption.trim() === "" ? "" : caption))

  // True when any option has a non-blank caption, so an all-blank list lays out
  // like no captions.
  const hasCaptions = optionCaptions.some(caption => caption !== "")

  // Either the user specified it as disabled or it's disabled because we don't have any options
  const shouldDisable = disabled || !hasOptions

  return (
    <div className="stRadio" data-testid="stRadio">
      <WidgetLabel
        label={label}
        disabled={shouldDisable}
        labelVisibility={labelVisibility}
      >
        {!isNullOrEmptyString(help) && (
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
        $isCards={isCards}
        $containerWidth={containerWidth}
      >
        {cleanedOptions.map((option: string, index: number) => {
          const caption = optionCaptions[index] ?? ""

          if (isCards) {
            return (
              <RadioCardOption
                // eslint-disable-next-line @eslint-react/no-array-index-key
                key={index}
                value={index.toString()}
                option={option}
                caption={caption}
                titleId={`${titleBaseId}-title-${index}`}
                isEmphasized={hasCaptions}
              />
            )
          }

          // In a horizontal group, an option without a caption still needs that
          // vertical space reserved, or its label stops lining up with the
          // captioned ones.
          const needsSpacer = caption === "" && horizontal && hasCaptions

          return (
            <StyledRadioField
              // eslint-disable-next-line @eslint-react/no-array-index-key
              key={index}
              value={index.toString()}
            >
              <StyledRadioButton data-testid="stRadioOption">
                {({ isSelected, isHovered, isDisabled }) => (
                  <StyledRadioRow>
                    <RadioIndicator
                      isSelected={isSelected}
                      isHovered={isHovered}
                      isDisabled={isDisabled}
                    />
                    <StreamlitMarkdown
                      source={option}
                      allowHTML={false}
                      isLabel
                    />
                  </StyledRadioRow>
                )}
              </StyledRadioButton>
              <RadioCaption caption={caption} />
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
