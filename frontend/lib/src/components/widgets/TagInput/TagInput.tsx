/**
 * Copyright (c) Streamlit Inc.8-2022) Snowflake Inc. (2022-2025)
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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { uniqueId } from "lodash-es"

import { TagInput as TagInputProto } from "@streamlit/protobuf"

import { Placement } from "~lib/components/shared/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "~lib/components/widgets/BaseWidget"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledInput,
  StyledInputWrapper,
  StyledScreenReaderAnnouncement,
  StyledTagInput,
  StyledTagInputContainer,
} from "./styled-components"
import Tag from "./Tag"
import TagInputSuggestions from "./TagInputSuggestions"

export interface Props {
  disabled: boolean
  element: TagInputProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

type TagInputValue = string[]

const getStateFromWidgetMgr = (
  widgetMgr: WidgetStateManager,
  element: TagInputProto
): TagInputValue | undefined => {
  return widgetMgr.getStringArrayValue(element)
}

const getDefaultStateFromProto = (element: TagInputProto): TagInputValue => {
  return element.default ?? []
}

const getCurrStateFromProto = (element: TagInputProto): TagInputValue => {
  return element.value ?? []
}

const updateWidgetMgrState = (
  element: TagInputProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<TagInputValue>,
  fragmentId?: string
): void => {
  widgetMgr.setStringArrayValue(
    element,
    valueWithSource.value,
    { fromUi: valueWithSource.fromUi },
    fragmentId
  )
}

const TagInput: React.FC<Props> = props => {
  const { element, widgetMgr, fragmentId, disabled: propsDisabled } = props

  const [id] = useState(() => uniqueId("tag_input_"))
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Local state for input value and suggestions
  const [inputValue, setInputValue] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [highlightedTag, setHighlightedTag] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")

  // Track previous tags for detecting changes
  const prevTagsRef = useRef<string[]>([])

  // Widget state management
  const [tags, setTagsWithSource] = useBasicWidgetState<
    TagInputValue,
    TagInputProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
  })

  const disabled = propsDisabled || element.disabled
  const maxTags = element.maxTags || 0
  const allowDuplicates = element.allowDuplicates || false
  const options = element.options || []
  const placeholder = element.placeholder || ""

  // Announce tag changes to screen readers
  useEffect(() => {
    const prevTags = prevTagsRef.current

    if (prevTags.length < tags.length) {
      // Tag was added
      const addedTags = tags.filter(tag => !prevTags.includes(tag))
      if (addedTags.length > 0) {
        const tagCount = tags.length
        const tagWord = tagCount === 1 ? "tag" : "tags"
        setAnnouncement(
          `${addedTags.join(", ")} added. ${tagCount} ${tagWord} total.`
        )
      }
    } else if (prevTags.length > tags.length) {
      // Tag was removed
      const removedTags = prevTags.filter(tag => !tags.includes(tag))
      if (removedTags.length > 0) {
        const tagCount = tags.length
        const tagWord = tagCount === 1 ? "tag" : "tags"
        const countMessage =
          tagCount === 0
            ? "No tags remaining."
            : `${tagCount} ${tagWord} remaining.`
        setAnnouncement(`${removedTags.join(", ")} removed. ${countMessage}`)
      }
    }

    prevTagsRef.current = tags
  }, [tags])

  // Check if max tags limit is reached
  const isMaxTagsReached = maxTags > 0 && tags.length >= maxTags

  // Filter suggestions based on input value
  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim() || options.length === 0) {
      return []
    }
    const lowerInput = inputValue.toLowerCase()
    return options.filter(option => {
      const matchesInput = option.toLowerCase().includes(lowerInput)
      const notAlreadySelected = allowDuplicates || !tags.includes(option)
      return matchesInput && notAlreadySelected
    })
  }, [inputValue, options, tags, allowDuplicates])

  // Show suggestions when input is focused and there are filtered suggestions
  const showSuggestions = isFocused && filteredSuggestions.length > 0

  // Validate and add a tag
  const addTag = useCallback(
    (tagValue: string): boolean => {
      const trimmedValue = tagValue.trim()

      // Reject whitespace-only tags
      if (!trimmedValue) {
        return false
      }

      // Check max tags limit
      if (isMaxTagsReached) {
        return false
      }

      // Check for duplicates
      if (!allowDuplicates && tags.includes(trimmedValue)) {
        // Highlight the existing tag briefly
        setHighlightedTag(trimmedValue)
        setTimeout(() => setHighlightedTag(null), 1000)
        return false
      }

      setTagsWithSource({
        value: [...tags, trimmedValue],
        fromUi: true,
      })
      return true
    },
    [tags, isMaxTagsReached, allowDuplicates, setTagsWithSource]
  )

  // Remove a tag
  const removeTag = useCallback(
    (tagValue: string) => {
      setTagsWithSource({
        value: tags.filter(tag => tag !== tagValue),
        fromUi: true,
      })
    },
    [tags, setTagsWithSource]
  )

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value

      // Check for comma delimiter
      if (value.includes(",")) {
        const parts = value.split(",")
        // Add all parts except the last one (which might be incomplete)
        parts.slice(0, -1).forEach(part => {
          addTag(part)
        })
        // Keep the last part in the input
        setInputValue(parts[parts.length - 1])
      } else {
        setInputValue(value)
      }
      setSelectedSuggestionIndex(0)
    },
    [addTag]
  )

  // Handle paste event
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData("text")

      // Check if pasted text contains delimiters
      if (pastedText.includes(",") || pastedText.includes("\n")) {
        e.preventDefault()
        const parts = pastedText.split(/[,\n]/)
        parts.forEach(part => {
          addTag(part)
        })
      }
    },
    [addTag]
  )

  // Handle key down events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case "Enter":
          e.preventDefault()
          if (
            showSuggestions &&
            filteredSuggestions[selectedSuggestionIndex]
          ) {
            // Select the highlighted suggestion
            if (addTag(filteredSuggestions[selectedSuggestionIndex])) {
              setInputValue("")
            }
          } else if (inputValue.trim()) {
            // Add the current input as a tag
            if (addTag(inputValue)) {
              setInputValue("")
            }
          }
          break

        case "Tab":
          if (inputValue.trim()) {
            e.preventDefault()
            if (
              showSuggestions &&
              filteredSuggestions[selectedSuggestionIndex]
            ) {
              if (addTag(filteredSuggestions[selectedSuggestionIndex])) {
                setInputValue("")
              }
            } else if (addTag(inputValue)) {
              setInputValue("")
            }
          }
          break

        case "Backspace":
          if (!inputValue && tags.length > 0) {
            // Remove the last tag when backspace is pressed on empty input
            removeTag(tags[tags.length - 1])
          }
          break

        case "ArrowDown":
          if (showSuggestions) {
            e.preventDefault()
            setSelectedSuggestionIndex(prev =>
              Math.min(prev + 1, filteredSuggestions.length - 1)
            )
          }
          break

        case "ArrowUp":
          if (showSuggestions) {
            e.preventDefault()
            setSelectedSuggestionIndex(prev => Math.max(prev - 1, 0))
          }
          break

        case "Escape":
          if (showSuggestions) {
            e.preventDefault()
            setInputValue("")
          }
          break
      }
    },
    [
      inputValue,
      tags,
      showSuggestions,
      filteredSuggestions,
      selectedSuggestionIndex,
      addTag,
      removeTag,
    ]
  )

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      if (addTag(suggestion)) {
        setInputValue("")
        inputRef.current?.focus()
      }
    },
    [addTag]
  )

  // Handle suggestion hover
  const handleSuggestionHover = useCallback((index: number) => {
    setSelectedSuggestionIndex(index)
  }, [])

  // Handle container click to focus input
  const handleContainerClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  // Handle focus/blur
  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    // Delay blur to allow click on suggestions
    setTimeout(() => {
      setIsFocused(false)
      setSelectedSuggestionIndex(0)
    }, 150)
  }, [])

  return (
    <StyledTagInput
      className="stTagInput"
      data-testid="stTagInput"
      ref={containerRef}
    >
      {/* Screen reader announcement for tag changes */}
      <StyledScreenReaderAnnouncement
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="stTagInputAnnouncement"
      >
        {announcement}
      </StyledScreenReaderAnnouncement>

      <WidgetLabel
        label={element.label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
        htmlFor={id}
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

      <StyledTagInputContainer
        $isFocused={isFocused}
        $disabled={disabled}
        onClick={handleContainerClick}
        role="list"
        aria-label={element.label}
        data-testid="stTagInputContainer"
      >
        {tags.map((tag, index) => (
          <Tag
            key={`${tag}-${index}`}
            value={tag}
            disabled={disabled}
            highlighted={tag === highlightedTag}
            onRemove={removeTag}
            index={index}
          />
        ))}

        <StyledInputWrapper>
          <StyledInput
            ref={inputRef}
            id={id}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={tags.length === 0 ? placeholder : ""}
            disabled={disabled || isMaxTagsReached}
            $disabled={disabled || isMaxTagsReached}
            aria-label={element.label}
            aria-autocomplete={options.length > 0 ? "list" : undefined}
            aria-controls={
              showSuggestions ? "tag-input-suggestions" : undefined
            }
            aria-expanded={showSuggestions}
            data-testid="stTagInputField"
          />
        </StyledInputWrapper>
      </StyledTagInputContainer>

      {showSuggestions && (
        <TagInputSuggestions
          suggestions={filteredSuggestions}
          selectedIndex={selectedSuggestionIndex}
          onSelect={handleSuggestionSelect}
          onHover={handleSuggestionHover}
        />
      )}
    </StyledTagInput>
  )
}

export default memo(TagInput)
