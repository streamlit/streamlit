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

import React, { useCallback, useEffect, useRef, useState } from "react"

import { type ProvideEditorCallback } from "@glideapps/glide-data-grid"
import { DatePickerType } from "@glideapps/glide-data-grid-cells"
import moment from "moment"

import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

/**
 * Custom editor for DatePickerCell that supports custom date formats.
 * This editor uses a text input instead of the browser's native date input,
 * allowing users to enter dates in the format specified by the column config.
 *
 * This editor is used when a DatePickerCell has a custom format (not "localized",
 * "distance", "iso8601", or when no format is provided).
 */
export const DateTextCellEditor: ReturnType<
  ProvideEditorCallback<DatePickerType>
> = ({ value, onChange, onFinishedEditing, theme }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const { colors, fontSizes, spacing } = useEmotionTheme()

  const cellData = value.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userFormat = (cellData as any)?.userFormat as string | undefined
  const displayDate = cellData.displayDate || ""
  const currentDate = cellData.date

  const [inputValue, setInputValue] = useState<string>(() => {
    return currentDate && displayDate ? displayDate : ""
  })

  // Focus the input when the editor opens
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  /**
   * Parse the user input according to the format and convert to Date object.
   * Returns null if the input is invalid or cannot be parsed.
   */
  const parseDateInput = useCallback(
    (input: string, format: string): Date | null => {
      if (!input?.trim()) {
        return null
      }

      if (
        format === "localized" ||
        format === "distance" ||
        format === "iso8601"
      ) {
        return null
      }

      try {
        // Use strict mode to ensure exact format matching
        const parsed = moment(input.trim(), format, true)
        if (parsed.isValid()) {
          // Convert to UTC date (since dates are stored in UTC)
          return parsed.utc().toDate()
        }
      } catch {
        // Parsing failed
      }

      return null
    },
    []
  )

  /**
   * Handle input change - validate and update the cell if valid.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setInputValue(newValue)
      setError(null)

      if (!userFormat) {
        return
      }

      // If input is empty, allow it (will be handled as null)
      if (!newValue?.trim()) {
        return
      }

      // Try to parse the input
      const parsedDate = parseDateInput(newValue, userFormat)
      if (parsedDate) {
        // Valid date: update the cell
        const updatedCell: DatePickerType = {
          ...value,
          data: {
            ...cellData,
            date: parsedDate,
            displayDate: newValue,
          },
        }
        onChange(updatedCell)
      } else {
        // Invalid date: show error but don't update cell yet
        setError("Invalid date format")
      }
    },
    [userFormat, parseDateInput, value, cellData, onChange]
  )

  /**
   * Handle blur - finalize the edit or show error if invalid.
   */
  const handleBlur = useCallback(() => {
    if (!inputValue?.trim()) {
      // Empty input: set to null if allowed
      if (!value.data.min) {
        const updatedCell: DatePickerType = {
          ...value,
          data: {
            ...cellData,
            date: null,
            displayDate: "",
          },
        }
        onChange(updatedCell)
        onFinishedEditing(undefined)
      } else {
        // Required field - restore original value
        setInputValue(displayDate)
        setError("Date is required")
      }
      return
    }

    if (!userFormat) {
      onFinishedEditing(undefined)
      return
    }

    const parsedDate = parseDateInput(inputValue, userFormat)
    if (parsedDate) {
      // Valid date - ensure cell is updated
      const updatedCell: DatePickerType = {
        ...value,
        data: {
          ...cellData,
          date: parsedDate,
          displayDate: inputValue,
        },
      }
      onChange(updatedCell)
      onFinishedEditing(updatedCell)
    } else {
      // Invalid - restore original value
      setInputValue(displayDate)
      setError(`Invalid date. Expected format: ${userFormat}`)
      // Keep editor open to let user fix it
    }
  }, [
    inputValue,
    userFormat,
    parseDateInput,
    value,
    cellData,
    displayDate,
    onChange,
    onFinishedEditing,
  ])

  /**
   * Handle key down - commit on Enter, cancel on Escape.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleBlur()
      } else if (e.key === "Escape") {
        e.preventDefault()
        // Restore original value
        setInputValue(displayDate)
        setError(null)
        onFinishedEditing(undefined)
      }
    },
    [displayDate, handleBlur, onFinishedEditing]
  )

  // Get theme colors - use provided theme or fallback to emotion theme
  const bgColor = theme?.bgCell ?? colors.bgColor
  const textColor = theme?.textDark ?? colors.bodyText
  const borderColor = theme?.borderColor ?? colors.fadedText10
  const errorColor = colors.redTextColor

  return (
    <div
      style={{
        padding: `${spacing.twoXS}px ${spacing.xs}px`,
        backgroundColor: bgColor,
        border: `1px solid ${error ? errorColor : borderColor}`,
        borderRadius: "none",
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={userFormat || "YYYY-MM-DD"}
        style={{
          width: "100%",
          backgroundColor: "transparent",
          border: "none",
          outline: "none",
          color: error ? errorColor : textColor,
          fontSize: fontSizes.md,
          fontFamily: "inherit",
          padding: 0,
        }}
        data-testid="date-text-cell-editor"
      />
      {error && (
        <div
          style={{
            fontSize: fontSizes.sm,
            color: errorColor,
            marginTop: spacing.twoXS,
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
