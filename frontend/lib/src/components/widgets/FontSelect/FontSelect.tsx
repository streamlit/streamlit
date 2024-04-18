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

/**
 * @file A searchable, clearable, lazy-loading font select component.
 *
 * @module FontSelect
 */
import React, { useCallback, useEffect, useMemo, useState } from "react"
import debounce from "lodash/debounce"

import Select from "react-select"
import type { Props as ReactSelectProps, ActionMeta } from "react-select"
import makeAnimated from "react-select/animated"

import Option from "./Option"
import type { OptionProps } from "./Option"
import { useFont } from "./contexts/FontContext"
import type { FontCategories, FontOptionProps } from "./types/FontTypes"

type BaseProps = ReactSelectProps<FontOptionProps, boolean>

/**
 * @typedef FontSelectProps
 */
export interface FontSelectProps extends BaseProps {
  fontCategory?: FontCategories
  isAnimated?: boolean
  pageSize?: number
  options?: FontOptionProps[]
}

/**
 * Select dropdown component that pulls a font list from the Google Fonts API.
 *
 * @prop {String} fontCategory The category of the font allows for filtered lists.
 * @prop {Boolean} isAnimated Will add `react-select` animations to the select input.
 * @prop {Number} pageSize The max number of font family options loaded to the list per request.
 * @prop {FontOptionProps[]} options Any custom options to be added. Will be joined and sorted with the API fetched options.
 *                                   Options can contain groups options. Groups can only be one level deep.
 */
const FontSelect: React.FC<FontSelectProps> = ({
  fontCategory = "all",
  isAnimated = false,
  pageSize = 20,
  options = [],
  ...props
}) => {
  const { fontOptions, selectedFonts, setSelectedFonts, isLoading } = useFont()
  const fullOptionsList = useMemo(
    () => [...options, ...fontOptions],
    [options, fontOptions]
  )
  const [visibleOptions, setVisibleOptions] = useState<FontOptionProps[]>([])
  const [inputValue, setInputValue] = useState<string | null>("")

  // Load initial or updated font options
  useEffect(() => {
    setVisibleOptions(fullOptionsList.slice(0, pageSize))
  }, [fullOptionsList, pageSize])

  /**
   * Fetch more fonts from the list of available options. Filters based on input value.
   */
  const fetchMoreFonts = useCallback(
    (input = "") => {
      const filteredOptions = input
        ? fullOptionsList.filter(option =>
            option.label.toLowerCase().includes(input.toLowerCase())
          )
        : fullOptionsList
      const nextPageOptions = filteredOptions.slice(
        0,
        visibleOptions.length + pageSize
      )
      setVisibleOptions(nextPageOptions)
    },
    [fullOptionsList, pageSize, visibleOptions.length]
  )

  /**
   * Update the values selected and visible in the input field.
   */
  const handleFontChange = useCallback(
    (
      newSelectedOptions: FontOptionProps[] | null,
      actionMeta: ActionMeta<FontOptionProps>
    ) => {
      setSelectedFonts(newSelectedOptions || [])
      props.onChange?.(newSelectedOptions, actionMeta)
    },
    [setSelectedFonts, props]
  )

  /**
   * Debounced search/filter functionality.
   */
  const handleInputChange = useCallback(
    debounce(
      (
        newInputValue: string | null,
        actionMeta: ActionMeta<FontOptionProps>
      ) => {
        setInputValue(newInputValue)
        fetchMoreFonts(newInputValue)
        props.onInputChange?.(newInputValue, actionMeta)
      },
      300
    ),
    [fetchMoreFonts, props]
  )

  /**
   * Only loads more fonts if not in search mode.
   */
  const onMenuScrollToBottom = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      if (!inputValue) fetchMoreFonts()
      props.onMenuScrollToBottom?.(event)
    },
    [inputValue, fetchMoreFonts, props]
  )

  /**
   * Adds animated components to the Select component when prop is set.
   */
  const AnimatedComponents = useMemo(() => {
    return isAnimated ? makeAnimated() : {}
  }, [isAnimated])

  return (
    <Select
      isClearable
      isLoading={isLoading}
      placeholder="Select fonts..."
      value={selectedFonts}
      noOptionsMessage={() => "No fonts found"}
      {...props}
      components={{ ...AnimatedComponents, Option, ...props.components }}
      onChange={handleFontChange}
      onInputChange={handleInputChange}
      onMenuScrollToBottom={onMenuScrollToBottom}
      options={visibleOptions}
    />
  )
}

/**
 * Wrap the `FontSelect` compoenent to add the context for API access.
 * This is the default export for this component.
 *
 * Fort testing purposes only. The Provider should be implemented at a higher level to ensure that the context is available where needed and that it's not loaded in multiple instances.
 *
 * TODO: Remove this section before final PR.
 */
// const FontSelectWrapper: React.FC<FontSelectProps> = props => (
//   <FontProvider>
//     <FontSelect {...props} />
//   </FontProvider>
// )

function areEqual(prevProps: FontSelectProps, nextProps: FontSelectProps) {
  return (
    prevProps.fontCategory === nextProps.fontCategory &&
    prevProps.isAnimated === nextProps.isAnimated &&
    prevProps.pageSize === nextProps.pageSize &&
    prevProps.options === nextProps.options
  )
}

export default React.memo(FontSelect, areEqual)
