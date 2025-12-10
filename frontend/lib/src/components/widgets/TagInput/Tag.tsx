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

import React, { memo, useCallback } from "react"

import {
  StyledTag,
  StyledTagRemoveButton,
  StyledTagText,
} from "./styled-components"

export interface TagProps {
  /** The text content of the tag */
  value: string
  /** Whether the tag is disabled */
  disabled: boolean
  /** Whether the tag should be highlighted (e.g., for duplicate indication) */
  highlighted?: boolean
  /** Callback when the remove button is clicked */
  onRemove: (value: string) => void
  /** Index of the tag for accessibility */
  index: number
}

const Tag: React.FC<TagProps> = ({
  value,
  disabled,
  highlighted = false,
  onRemove,
  index,
}) => {
  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) {
        onRemove(value)
      }
    },
    [disabled, onRemove, value]
  )

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        (e.key === "Enter" ||
          e.key === " " ||
          e.key === "Delete" ||
          e.key === "Backspace") &&
        !disabled
      ) {
        e.preventDefault()
        onRemove(value)
      }
    },
    [disabled, onRemove, value]
  )

  const handleButtonKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !disabled) {
        e.preventDefault()
        onRemove(value)
      }
    },
    [disabled, onRemove, value]
  )

  return (
    <StyledTag
      role="listitem"
      data-testid="stTagInputTag"
      $disabled={disabled}
      $highlighted={highlighted}
      aria-label={`Tag: ${value}. Press Delete or Backspace to remove.`}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleTagKeyDown}
    >
      <StyledTagText title={value}>{value}</StyledTagText>
      <StyledTagRemoveButton
        type="button"
        $disabled={disabled}
        onClick={handleRemoveClick}
        onKeyDown={handleButtonKeyDown}
        disabled={disabled}
        aria-label={`Remove ${value}`}
        tabIndex={-1}
        data-testid={`stTagInputRemoveButton-${index}`}
      >
        <svg
          width="1em"
          height="1em"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
        </svg>
      </StyledTagRemoveButton>
    </StyledTag>
  )
}

export default memo(Tag)
