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

import React, { memo, useCallback, useEffect, useRef } from "react"

import {
  StyledSuggestionItem,
  StyledSuggestionsContainer,
} from "./styled-components"

export interface TagInputSuggestionsProps {
  /** Filtered suggestions to display */
  suggestions: string[]
  /** Currently selected suggestion index */
  selectedIndex: number
  /** Callback when a suggestion is selected */
  onSelect: (suggestion: string) => void
  /** Callback when the selected index changes via mouse hover */
  onHover: (index: number) => void
}

const TagInputSuggestions: React.FC<TagInputSuggestionsProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
  onHover,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLDivElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      const container = containerRef.current
      const selected = selectedRef.current
      const containerRect = container.getBoundingClientRect()
      const selectedRect = selected.getBoundingClientRect()

      if (selectedRect.bottom > containerRect.bottom) {
        selected.scrollIntoView({ block: "nearest" })
      } else if (selectedRect.top < containerRect.top) {
        selected.scrollIntoView({ block: "nearest" })
      }
    }
  }, [selectedIndex])

  const handleClick = useCallback(
    (suggestion: string) => {
      onSelect(suggestion)
    },
    [onSelect]
  )

  const handleMouseEnter = useCallback(
    (index: number) => {
      onHover(index)
    },
    [onHover]
  )

  if (suggestions.length === 0) {
    return null
  }

  return (
    <StyledSuggestionsContainer
      ref={containerRef}
      role="listbox"
      data-testid="stTagInputSuggestions"
    >
      {suggestions.map((suggestion, index) => (
        <StyledSuggestionItem
          key={suggestion}
          ref={index === selectedIndex ? selectedRef : null}
          role="option"
          aria-selected={index === selectedIndex}
          $isSelected={index === selectedIndex}
          onClick={() => handleClick(suggestion)}
          onMouseEnter={() => handleMouseEnter(index)}
          data-testid={`stTagInputSuggestion-${index}`}
        >
          {suggestion}
        </StyledSuggestionItem>
      ))}
    </StyledSuggestionsContainer>
  )
}

export default memo(TagInputSuggestions)
