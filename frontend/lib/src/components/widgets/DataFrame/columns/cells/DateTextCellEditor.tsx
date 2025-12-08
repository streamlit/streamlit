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
 * "distance", or "iso8601") or when using the default format (i.e., when no format is provided).
 */
export const DateTextCellEditor: ReturnType<
  ProvideEditorCallback<DatePickerType>
> = ({ value, onChange, onFinishedEditing, theme }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const { colors, fontSizes, spacing } = useEmotionTheme()

  const cellData = value.data
  interface DatePickerCellDataWithFormat {
    kind: "date-picker-cell"
    userFormat?: string
    required?: boolean
  }
  function hasUserFormat(data: unknown): data is DatePickerCellDataWithFormat {
    return (
      typeof data === "object" &&
      data !== null &&
      (data as { kind?: unknown }).kind === "date-picker-cell"
    )
  }
  const cellDataUnknown = cellData as unknown
  const cellDataWithFormat = hasUserFormat(cellDataUnknown)
    ? cellDataUnknown
    : null
  const userFormat = cellDataWithFormat?.userFormat
  const isRequired = cellDataWithFormat?.required === true
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
        const parsed = moment(input.trim(), format, true)
        if (parsed.isValid()) {
          return parsed.utc().toDate()
        }
      } catch {
        // Ignore parsing errors
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

      if (!newValue?.trim()) {
        return
      }

      const parsedDate = parseDateInput(newValue, userFormat)
      if (parsedDate) {
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
        const errorMessage = isRequired
          ? `Invalid date format. Date is required. Expected format: ${userFormat}`
          : `Invalid date format. Expected format: ${userFormat}`
        setError(errorMessage)
      }
    },
    [userFormat, isRequired, parseDateInput, value, cellData, onChange]
  )

  /**
   * Handle blur - finalize the edit or restore original value if invalid.
   */
  const handleBlur = useCallback(() => {
    if (!inputValue?.trim()) {
      if (!isRequired) {
        const updatedCell: DatePickerType = {
          ...value,
          data: {
            ...cellData,
            date: null,
            displayDate: "",
          },
        }
        onChange(updatedCell)
        onFinishedEditing(updatedCell)
      } else {
        setInputValue(displayDate)
        setError(null)
        onFinishedEditing(undefined)
      }
      return
    }

    if (!userFormat) {
      onFinishedEditing(undefined)
      return
    }

    const parsedDate = parseDateInput(inputValue, userFormat)
    if (parsedDate) {
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
      setInputValue(displayDate)
      setError(null)
      onFinishedEditing(undefined)
    }
  }, [
    inputValue,
    userFormat,
    isRequired,
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
        setInputValue(displayDate)
        setError(null)
        onFinishedEditing(undefined)
      }
    },
    [displayDate, handleBlur, onFinishedEditing]
  )

  const bgColor = theme?.bgCell ?? colors.bgColor
  const textColor = theme?.textDark ?? colors.bodyText
  const borderColor = theme?.borderColor ?? colors.fadedText10
  const errorColor = colors.redTextColor

  const errorId = "date-error"
  return (
    <div
      style={{
        padding: `${spacing.twoXS}px ${spacing.xs}px`,
        backgroundColor: bgColor,
        border: `1px solid ${error ? errorColor : borderColor}`,
        borderRadius: 0,
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
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
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
          id={errorId}
          role="alert"
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
