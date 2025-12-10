/**
 * Copyright (c) Streamlit I18-2022) Snowflake Inc. (2022-2025)
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

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  TagInput as TagInputProto,
} from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import TagInput, { Props } from "./TagInput"

const getProps = (
  elementProps: Partial<TagInputProto> = {},
  widgetProps: Partial<Props> = {}
): Props => {
  return {
    element: TagInputProto.create({
      id: "test-tag-input",
      label: "Test Label",
      default: [],
      options: [],
      help: "",
      formId: "",
      value: [],
      setValue: false,
      disabled: false,
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.VISIBLE,
      },
      maxTags: 0,
      placeholder: "Add tags...",
      allowDuplicates: false,
      ...elementProps,
    }),
    widgetMgr: new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(),
    }),
    disabled: false,
    ...widgetProps,
  }
}

describe("TagInput widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<TagInput {...props} />)

    expect(screen.getByTestId("stTagInput")).toBeInTheDocument()
  })

  it("renders with label", () => {
    const props = getProps({ label: "My Tags" })
    render(<TagInput {...props} />)

    expect(screen.getByText("My Tags")).toBeInTheDocument()
  })

  it("renders with placeholder", () => {
    const props = getProps({ placeholder: "Enter tags here" })
    render(<TagInput {...props} />)

    expect(screen.getByPlaceholderText("Enter tags here")).toBeInTheDocument()
  })

  it("renders with initial tags", () => {
    const props = getProps({ default: ["tag1", "tag2", "tag3"] })
    render(<TagInput {...props} />)

    expect(screen.getByText("tag1")).toBeInTheDocument()
    expect(screen.getByText("tag2")).toBeInTheDocument()
    expect(screen.getByText("tag3")).toBeInTheDocument()
  })

  it("renders in disabled state", () => {
    const props = getProps({ disabled: true })
    render(<TagInput {...props} />)

    const input = screen.getByTestId("stTagInputField")
    expect(input).toBeDisabled()
  })

  it("renders with help tooltip", () => {
    const props = getProps({ help: "This is help text" })
    render(<TagInput {...props} />)

    // Help icon should be present
    expect(screen.getByTestId("stTooltipIcon")).toBeInTheDocument()
  })

  describe("Tag creation", () => {
    it("adds tag on Enter key", async () => {
      const user = userEvent.setup()
      const props = getProps()
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      await user.type(input, "new-tag{Enter}")

      expect(screen.getByText("new-tag")).toBeInTheDocument()
    })

    it("adds tag on Tab key", async () => {
      const user = userEvent.setup()
      const props = getProps()
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      await user.type(input, "tab-tag")
      await user.tab()

      expect(screen.getByText("tab-tag")).toBeInTheDocument()
    })

    it("adds tag on comma delimiter", async () => {
      const user = userEvent.setup()
      const props = getProps()
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      await user.type(input, "comma-tag,")

      expect(screen.getByText("comma-tag")).toBeInTheDocument()
    })

    it("clears input after adding tag", async () => {
      const user = userEvent.setup()
      const props = getProps()
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      await user.type(input, "test{Enter}")

      expect(input.value).toBe("")
    })
  })

  describe("Tag removal", () => {
    it("removes tag on remove button click", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["tag1", "tag2"] })
      render(<TagInput {...props} />)

      expect(screen.getByText("tag1")).toBeInTheDocument()

      const removeButton = screen.getByTestId("stTagInputRemoveButton-0")
      await user.click(removeButton)

      expect(screen.queryByText("tag1")).not.toBeInTheDocument()
      expect(screen.getByText("tag2")).toBeInTheDocument()
    })

    it("removes last tag on Backspace with empty input", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["tag1", "tag2"] })
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      await user.click(input)
      await user.keyboard("{Backspace}")

      expect(screen.getByText("tag1")).toBeInTheDocument()
      expect(screen.queryByText("tag2")).not.toBeInTheDocument()
    })
  })

  describe("Validation", () => {
    it("rejects whitespace-only tags", async () => {
      const user = userEvent.setup()
      const props = getProps()
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      await user.type(input, "   {Enter}")

      expect(screen.queryAllByTestId("stTagInputTag")).toHaveLength(0)
    })

    it("rejects duplicate tags by default", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["existing"] })
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      await user.type(input, "existing{Enter}")

      // Should still only have one tag
      expect(screen.getAllByTestId("stTagInputTag")).toHaveLength(1)
    })

    it("allows duplicate tags when allowDuplicates is true", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["existing"], allowDuplicates: true })
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      await user.type(input, "existing{Enter}")

      expect(screen.getAllByTestId("stTagInputTag")).toHaveLength(2)
    })

    it("enforces max_tags limit", async () => {
      const user = userEvent.setup()
      const props = getProps({ default: ["tag1", "tag2"], maxTags: 2 })
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      await user.type(input, "tag3{Enter}")

      // Should still only have 2 tags
      expect(screen.getAllByTestId("stTagInputTag")).toHaveLength(2)
      expect(screen.queryByText("tag3")).not.toBeInTheDocument()
    })
  })

  describe("Suggestions", () => {
    it("shows suggestions when typing", async () => {
      const user = userEvent.setup()
      const props = getProps({ options: ["apple", "banana", "cherry"] })
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      await user.type(input, "a")

      expect(screen.getByTestId("stTagInputSuggestions")).toBeInTheDocument()
      expect(screen.getByText("apple")).toBeInTheDocument()
      expect(screen.getByText("banana")).toBeInTheDocument()
    })

    it("filters suggestions based on input", async () => {
      const user = userEvent.setup()
      const props = getProps({ options: ["apple", "banana", "cherry"] })
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      await user.type(input, "ch")

      expect(screen.getByText("cherry")).toBeInTheDocument()
      expect(screen.queryByText("apple")).not.toBeInTheDocument()
      expect(screen.queryByText("banana")).not.toBeInTheDocument()
    })

    it("selects suggestion on click", async () => {
      const user = userEvent.setup()
      const props = getProps({ options: ["apple", "banana", "cherry"] })
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      await user.type(input, "app")

      const suggestion = screen.getByTestId("stTagInputSuggestion-0")
      await user.click(suggestion)

      expect(screen.getByText("apple")).toBeInTheDocument()
    })

    it("navigates suggestions with arrow keys", async () => {
      const user = userEvent.setup()
      const props = getProps({ options: ["apple", "apricot", "avocado"] })
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      await user.type(input, "a")

      // Navigate down
      await user.keyboard("{ArrowDown}")
      await user.keyboard("{Enter}")

      expect(screen.getByText("apricot")).toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("has proper ARIA attributes on container", () => {
      const props = getProps({ label: "Tags" })
      render(<TagInput {...props} />)

      const container = screen.getByTestId("stTagInputContainer")
      expect(container).toHaveAttribute("role", "list")
      expect(container).toHaveAttribute("aria-label", "Tags")
    })

    it("has proper ARIA attributes on tags", () => {
      const props = getProps({ default: ["tag1"] })
      render(<TagInput {...props} />)

      const tag = screen.getByTestId("stTagInputTag")
      expect(tag).toHaveAttribute("role", "listitem")
    })

    it("has proper ARIA attributes on input", () => {
      const props = getProps({ label: "Tags", options: ["option1"] })
      render(<TagInput {...props} />)

      const input = screen.getByTestId("stTagInputField")
      expect(input).toHaveAttribute("aria-label", "Tags")
    })
  })
})
