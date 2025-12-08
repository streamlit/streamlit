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

import React from "react"

import { GridCellKind } from "@glideapps/glide-data-grid"
import { DatePickerType } from "@glideapps/glide-data-grid-cells"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import { render } from "~lib/test_util"

import { DateTextCellEditor } from "./DateTextCellEditor"

// Type assertion to fix TypeScript issue with ReturnType<ProvideEditorCallback>
const DateTextCellEditorComponent = DateTextCellEditor as React.FC<{
  value: DatePickerType
  onChange: (value: DatePickerType) => void
  onFinishedEditing: (value?: DatePickerType) => void
  theme?: unknown
}>

describe("DateTextCellEditor", () => {
  const mockOnChange = vi.fn()
  const mockOnFinishedEditing = vi.fn()

  const createMockCell = (
    date: Date | null = null,
    displayDate: string = "",
    userFormat: string = "YYYY-MM-DD",
    required: boolean = false
  ): DatePickerType => {
    return {
      kind: GridCellKind.Custom,
      allowOverlay: true,
      copyData: "",
      readonly: false,
      contentAlign: "left",
      style: "normal",
      data: {
        kind: "date-picker-cell",
        date,
        displayDate,
        format: "date",
        step: "1",
        userFormat,
        required,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Initialization", () => {
    it("renders with initial display date", () => {
      const cell = createMockCell(
        new Date("2024-05-19"),
        "19.05.2024",
        "DD.MM.YYYY"
      )
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      expect(input).toHaveValue("19.05.2024")
    })

    it("renders with empty value when no date is provided", () => {
      const cell = createMockCell(null, "", "YYYY-MM-DD")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      expect(input).toHaveValue("")
    })

    it("shows placeholder with user format", () => {
      const cell = createMockCell(null, "", "DD.MM.YYYY")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      expect(input).toHaveAttribute("placeholder", "DD.MM.YYYY")
    })

    it("shows default placeholder when no format is provided", () => {
      const cell = createMockCell(null, "", "")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      expect(input).toHaveAttribute("placeholder", "YYYY-MM-DD")
    })
  })

  describe("Date Parsing", () => {
    it("parses valid date in YYYY-MM-DD format", async () => {
      const cell = createMockCell(null, "", "YYYY-MM-DD")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.type(input, "2024-05-19")

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })

      const lastCall =
        mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]
      const updatedCell = lastCall[0]
      expect(updatedCell.data.date).toBeInstanceOf(Date)
      expect(updatedCell.data.displayDate).toBe("2024-05-19")
    })

    it("parses valid date in DD.MM.YYYY format", async () => {
      const cell = createMockCell(null, "", "DD.MM.YYYY")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.type(input, "19.05.2024")

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })

      const lastCall =
        mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]
      const updatedCell = lastCall[0]
      expect(updatedCell.data.date).toBeInstanceOf(Date)
      expect(updatedCell.data.displayDate).toBe("19.05.2024")
    })

    it("parses valid date in MM/DD/YYYY format", async () => {
      const cell = createMockCell(null, "", "MM/DD/YYYY")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.type(input, "05/19/2024")

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })

      const lastCall =
        mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]
      const updatedCell = lastCall[0]
      expect(updatedCell.data.date).toBeInstanceOf(Date)
      expect(updatedCell.data.displayDate).toBe("05/19/2024")
    })

    it("rejects invalid date format", async () => {
      const cell = createMockCell(
        new Date("2024-05-19"),
        "19.05.2024",
        "DD.MM.YYYY"
      )
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.clear(input)
      await userEvent.type(input, "2024-05-19") // Wrong format for DD.MM.YYYY

      await waitFor(() => {
        expect(
          screen.getByText(
            /Invalid date format. Expected format: DD\.MM\.YYYY/
          )
        ).toBeInTheDocument()
      })

      expect(input).toHaveAttribute("aria-invalid", "true")
    })

    it("rejects invalid dates like Feb 30", async () => {
      const cell = createMockCell(null, "", "YYYY-MM-DD")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.type(input, "2024-02-30") // Invalid date

      await waitFor(() => {
        expect(
          screen.getByText(/Invalid date format. Expected format: YYYY-MM-DD/)
        ).toBeInTheDocument()
      })
    })
  })

  describe("Real-time Validation", () => {
    it("shows error immediately when invalid format is entered", async () => {
      const cell = createMockCell(null, "", "DD.MM.YYYY")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.type(input, "invalid")

      await waitFor(() => {
        expect(
          screen.getByText(
            /Invalid date format. Expected format: DD\.MM\.YYYY/
          )
        ).toBeInTheDocument()
      })
    })

    it("clears error when valid date is entered", async () => {
      const cell = createMockCell(null, "", "DD.MM.YYYY")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.type(input, "invalid")

      await waitFor(() => {
        expect(
          screen.getByText(
            /Invalid date format. Expected format: DD\.MM\.YYYY/
          )
        ).toBeInTheDocument()
      })

      await userEvent.clear(input)
      await userEvent.type(input, "19.05.2024")

      await waitFor(() => {
        expect(
          screen.queryByText("Invalid date format")
        ).not.toBeInTheDocument()
      })
    })

    it("updates cell immediately when valid date is entered", async () => {
      const cell = createMockCell(null, "", "YYYY-MM-DD")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.type(input, "2024-05-19")

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })
    })
  })

  describe("Blur Behavior", () => {
    it("commits valid date on blur", async () => {
      const cell = createMockCell(null, "", "YYYY-MM-DD")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.type(input, "2024-05-19")
      fireEvent.blur(input)

      await waitFor(() => {
        expect(mockOnFinishedEditing).toHaveBeenCalled()
      })

      const lastCall = mockOnFinishedEditing.mock.calls[0]
      expect(lastCall[0]).toBeDefined()
      expect(lastCall[0]?.data.date).toBeInstanceOf(Date)
    })

    it("allows empty input when field is not required", async () => {
      const cell = createMockCell(
        new Date("2024-05-19"),
        "2024-05-19",
        "YYYY-MM-DD",
        false
      )
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.clear(input)
      fireEvent.blur(input)

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })

      const lastCall =
        mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]
      expect(lastCall[0].data.date).toBeNull()
      expect(lastCall[0].data.displayDate).toBe("")
    })

    it("restores original value when required field is empty on blur", async () => {
      const cell = createMockCell(
        new Date("2024-05-19"),
        "2024-05-19",
        "YYYY-MM-DD",
        true
      )
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.clear(input)
      fireEvent.blur(input)

      await waitFor(() => {
        expect(mockOnFinishedEditing).toHaveBeenCalledWith(undefined)
      })

      expect(input).toHaveValue("2024-05-19") // Original value restored
    })

    it("restores original value on blur with invalid date", async () => {
      const cell = createMockCell(
        new Date("2024-05-19"),
        "19.05.2024",
        "DD.MM.YYYY"
      )
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.clear(input)
      await userEvent.type(input, "invalid")
      fireEvent.blur(input)

      await waitFor(() => {
        expect(mockOnFinishedEditing).toHaveBeenCalledWith(undefined)
      })

      expect(input).toHaveValue("19.05.2024") // Original value restored
    })
  })

  describe("Keyboard Shortcuts", () => {
    it("commits changes on Enter key", async () => {
      const cell = createMockCell(null, "", "YYYY-MM-DD")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.type(input, "2024-05-19")
      const preventDefault = vi.fn()
      // eslint-disable-next-line testing-library/prefer-user-event
      fireEvent.keyDown(input, { key: "Enter", preventDefault })

      await waitFor(() => {
        expect(mockOnFinishedEditing).toHaveBeenCalled()
      })
    })

    it("cancels changes on Escape key", async () => {
      const cell = createMockCell(
        new Date("2024-05-19"),
        "2024-05-19",
        "YYYY-MM-DD"
      )
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.clear(input)
      await userEvent.type(input, "2024-06-20")
      const preventDefault = vi.fn()
      // eslint-disable-next-line testing-library/prefer-user-event
      fireEvent.keyDown(input, { key: "Escape", preventDefault })

      await waitFor(() => {
        expect(mockOnFinishedEditing).toHaveBeenCalledWith(undefined)
      })

      expect(input).toHaveValue("2024-05-19") // Original value restored
    })

    it("clears error on Escape key", async () => {
      const cell = createMockCell(
        new Date("2024-05-19"),
        "19.05.2024",
        "DD.MM.YYYY"
      )
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.clear(input)
      await userEvent.type(input, "invalid")

      await waitFor(() => {
        expect(
          screen.getByText(
            /Invalid date format. Expected format: DD\.MM\.YYYY/
          )
        ).toBeInTheDocument()
      })

      const preventDefault = vi.fn()
      // eslint-disable-next-line testing-library/prefer-user-event
      fireEvent.keyDown(input, { key: "Escape", preventDefault })

      await waitFor(() => {
        expect(
          screen.queryByText("Invalid date format")
        ).not.toBeInTheDocument()
      })
    })
  })

  describe("Accessibility", () => {
    it("sets aria-invalid when error is present", async () => {
      const cell = createMockCell(null, "", "DD.MM.YYYY")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      expect(input).toHaveAttribute("aria-invalid", "false")

      await userEvent.type(input, "invalid")

      await waitFor(() => {
        expect(input).toHaveAttribute("aria-invalid", "true")
      })
    })

    it("sets aria-describedby when error is present", async () => {
      const cell = createMockCell(null, "", "DD.MM.YYYY")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      expect(input).not.toHaveAttribute("aria-describedby")

      await userEvent.type(input, "invalid")

      await waitFor(() => {
        expect(input).toHaveAttribute("aria-describedby", "date-error")
      })
    })

    it("renders error message with role alert", async () => {
      const cell = createMockCell(null, "", "DD.MM.YYYY")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.type(input, "invalid")

      await waitFor(() => {
        const errorMessage = screen.getByRole("alert")
        expect(errorMessage).toBeInTheDocument()
        expect(errorMessage).toHaveTextContent(/Invalid date format/)
        expect(errorMessage).toHaveAttribute("id", "date-error")
      })
    })
  })

  describe("Edge Cases", () => {
    it("handles leap year dates correctly", async () => {
      const cell = createMockCell(null, "", "YYYY-MM-DD")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.type(input, "2024-02-29") // 2024 is a leap year

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })

      const lastCall =
        mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]
      expect(lastCall[0].data.date).toBeInstanceOf(Date)
    })

    it("rejects non-leap year Feb 29", async () => {
      const cell = createMockCell(null, "", "YYYY-MM-DD")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.type(input, "2023-02-29") // 2023 is not a leap year

      await waitFor(() => {
        expect(
          screen.getByText(/Invalid date format. Expected format: YYYY-MM-DD/)
        ).toBeInTheDocument()
      })
    })

    it("handles empty string format gracefully", async () => {
      const cell = createMockCell(null, "", "")
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.type(input, "2024-05-19")
      fireEvent.blur(input)

      // Should finish editing without validation when no format is provided
      await waitFor(() => {
        expect(mockOnFinishedEditing).toHaveBeenCalled()
      })
    })

    it("handles whitespace-only input", async () => {
      const cell = createMockCell(
        new Date("2024-05-19"),
        "2024-05-19",
        "YYYY-MM-DD",
        false
      )
      render(
        <DateTextCellEditorComponent
          value={cell}
          onChange={mockOnChange}
          onFinishedEditing={mockOnFinishedEditing}
        />
      )

      const input = screen.getByTestId("date-text-cell-editor")
      await userEvent.clear(input)
      await userEvent.type(input, "   ") // Only whitespace
      fireEvent.blur(input)

      // Should treat as empty and allow if not required
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })

      const lastCall =
        mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]
      expect(lastCall[0].data.date).toBeNull()
    })
  })
})
