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

import { act, screen, waitFor, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { getLogger } from "loglevel"

import {
  LabelVisibility as LabelVisibilityProto,
  TextInput as TextInputProto,
} from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import TextInput, { Props } from "./TextInput"

const getProps = (
  elementProps: Partial<TextInputProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: TextInputProto.create({
    id: "text-input-id",
    label: "Label",
    default: "",
    placeholder: "Placeholder",
    type: TextInputProto.Type.DEFAULT,
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...widgetProps,
})

describe("TextInput widget", () => {
  beforeEach(() => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [190],
    })
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    expect(textInput).toBeInTheDocument()
  })

  it("shows a label", () => {
    const props = getProps()
    render(<TextInput {...props} />)

    const widgetLabel = screen.getByText(`${props.element.label}`)
    expect(widgetLabel).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.HIDDEN,
      },
    })

    render(<TextInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<TextInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("shows a placeholder", () => {
    const props = getProps()
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    expect(textInput).toHaveAttribute("placeholder", props.element.placeholder)
  })

  it("handles default text input type properly", () => {
    const defaultProps = getProps({ type: TextInputProto.Type.DEFAULT })
    render(<TextInput {...defaultProps} />)
    const textInput = screen.getByRole("textbox")
    expect(textInput).toHaveAttribute("type", "text")
    // Check that no show/hide button renders
    const textInputContainer = screen.getByTestId("stTextInputRootElement")
    const showButton = within(textInputContainer).queryByRole("button")
    expect(showButton).not.toBeInTheDocument()
  })

  it("handles password text input type properly", () => {
    const passwordProps = getProps({ type: TextInputProto.Type.PASSWORD })
    render(<TextInput {...passwordProps} />)
    const passwordTextInput = screen.getByPlaceholderText("Placeholder")
    expect(passwordTextInput).toHaveAttribute("type", "password")
    // Check for the show/hide button
    const textInputContainer = screen.getByTestId("stTextInputRootElement")
    const showButton = within(textInputContainer).getByRole("button")
    expect(showButton).toBeInTheDocument()
  })

  it.each([
    [TextInputProto.Type.DEFAULT, "text"],
    [TextInputProto.Type.PASSWORD, "password"],
    [TextInputProto.Type.EMAIL, "email"],
    [TextInputProto.Type.URL, "url"],
    [TextInputProto.Type.PHONE, "tel"],
    [TextInputProto.Type.SEARCH, "search"],
  ])(
    "maps proto type %s to the correct native input type",
    (protoType, expectedDomType) => {
      const props = getProps({ type: protoType })
      render(<TextInput {...props} />)
      // Password inputs don't have the textbox role, so query by placeholder.
      const input = screen.getByPlaceholderText("Placeholder")
      expect(input).toHaveAttribute("type", expectedDomType)
    }
  )

  it("sets enterKeyHint='search' only for the search type", () => {
    const searchProps = getProps({ type: TextInputProto.Type.SEARCH })
    const { unmount } = render(<TextInput {...searchProps} />)
    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "enterkeyhint",
      "search"
    )
    unmount()

    const defaultProps = getProps({ type: TextInputProto.Type.DEFAULT })
    render(<TextInput {...defaultProps} />)
    expect(screen.getByRole("textbox")).not.toHaveAttribute("enterkeyhint")
  })

  it("does not mark email inputs invalid via native constraint validation", async () => {
    const user = userEvent.setup()
    const props = getProps({ type: TextInputProto.Type.EMAIL })
    render(<TextInput {...props} />)

    const input = screen.getByRole("textbox")
    await user.type(input, "not-an-email")
    await user.click(document.body)

    // `validationBehavior="aria"` keeps React Aria from reflecting the native
    // `typeMismatch` into `data-invalid`; the regex `validate` mechanism is the
    // single source of the invalid state. Without a `validateRegex`, no error
    // treatment should appear at all.
    expect(input).not.toHaveAttribute("data-invalid")
    expect(input).not.toHaveAttribute("aria-invalid")
    expect(
      screen.queryByTestId("stTextInputErrorIcon")
    ).not.toBeInTheDocument()
  })

  it("uses Streamlit validate for email type, not native constraint UI", async () => {
    const user = userEvent.setup()
    // Product path: EMAIL + the shipped default regex/message.
    const props = getProps({
      type: TextInputProto.Type.EMAIL,
      validateRegex: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
      validateMessage: "Enter a valid email address.",
    })
    render(<TextInput {...props} />)

    const input = screen.getByRole("textbox")
    await user.type(input, "not-an-email")
    await user.click(document.body)

    // Single Streamlit error treatment via the regex `validate` channel.
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(screen.getAllByTestId("stTextInputErrorIcon")).toHaveLength(1)
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid email address."
    )
  })

  describe("search clear button", () => {
    it("shows the clear button only for search inputs holding a value", async () => {
      const user = userEvent.setup()
      const props = getProps({ type: TextInputProto.Type.SEARCH })
      render(<TextInput {...props} />)

      // Empty search input: no clear button yet.
      expect(
        screen.queryByTestId("stTextInputClearButton")
      ).not.toBeInTheDocument()

      await user.type(screen.getByRole("searchbox"), "laptops")
      expect(screen.getByTestId("stTextInputClearButton")).toBeVisible()
    })

    it("does not show the clear button for non-search types", async () => {
      const user = userEvent.setup()
      const props = getProps({ type: TextInputProto.Type.DEFAULT })
      render(<TextInput {...props} />)

      await user.type(screen.getByRole("textbox"), "laptops")
      expect(
        screen.queryByTestId("stTextInputClearButton")
      ).not.toBeInTheDocument()
    })

    it("clears the value and hides the button when clicked", async () => {
      const user = userEvent.setup()
      const props = getProps({ type: TextInputProto.Type.SEARCH })
      const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
      render(<TextInput {...props} />)
      // Ignore the mount-time registration call so we can assert clear commits
      // without a preceding blur of the dirty value.
      setStringValueSpy.mockClear()

      const searchbox = screen.getByRole<HTMLInputElement>("searchbox")
      await user.type(searchbox, "laptops")

      // Typing alone must not commit — `preventFocusLoss` on the clear button
      // exists so mousedown does not blur-commit "laptops" before clear.
      expect(setStringValueSpy).not.toHaveBeenCalled()

      await user.click(screen.getByTestId("stTextInputClearButton"))

      expect(searchbox.value).toBe("")
      expect(
        screen.queryByTestId("stTextInputClearButton")
      ).not.toBeInTheDocument()
      // Exactly one commit: the cleared empty value (never the pre-clear text).
      expect(setStringValueSpy).toHaveBeenCalledTimes(1)
      expect(setStringValueSpy).toHaveBeenCalledWith(props.element.id, "", {
        formId: props.element.formId,
        fragmentId: undefined,
        fromUser: true,
      })
    })

    it("does not show the clear button when disabled", async () => {
      const user = userEvent.setup()
      const props = getProps(
        { type: TextInputProto.Type.SEARCH, default: "laptops" },
        { disabled: true }
      )
      render(<TextInput {...props} />)

      // Even with a value present, a disabled search input has no clear button.
      expect(screen.getByRole<HTMLInputElement>("searchbox").value).toBe(
        "laptops"
      )
      await user.click(document.body)
      expect(
        screen.queryByTestId("stTextInputClearButton")
      ).not.toBeInTheDocument()
    })
  })

  it("toggles password visibility when show/hide button is clicked", async () => {
    const user = userEvent.setup()
    const props = getProps({ type: TextInputProto.Type.PASSWORD })
    render(<TextInput {...props} />)

    const passwordInput = screen.getByPlaceholderText("Placeholder")
    expect(passwordInput).toHaveAttribute("type", "password")

    const showButton = screen.getByRole("button", { name: "Show password" })
    await user.click(showButton)

    expect(passwordInput).toHaveAttribute("type", "text")
    expect(
      screen.getByRole("button", { name: "Hide password" })
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Hide password" }))
    expect(passwordInput).toHaveAttribute("type", "password")
  })

  it("activates password toggle via keyboard (Tab + Space)", async () => {
    const user = userEvent.setup()
    const props = getProps({ type: TextInputProto.Type.PASSWORD })
    render(<TextInput {...props} />)

    const passwordInput = screen.getByPlaceholderText("Placeholder")
    expect(passwordInput).toHaveAttribute("type", "password")

    // Focus the input then Tab to the toggle button
    await user.click(passwordInput)
    await user.tab()

    const toggleButton = screen.getByRole("button", { name: "Show password" })
    expect(toggleButton).toHaveFocus()

    // Activate via Space (standard for toggle buttons)
    await user.keyboard(" ")
    expect(passwordInput).toHaveAttribute("type", "text")
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveFocus()
  })

  it("tabbing from input to password toggle does not commit a dirty value", async () => {
    const user = userEvent.setup()
    const props = getProps({ type: TextInputProto.Type.PASSWORD })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const passwordInput = screen.getByPlaceholderText("Placeholder")

    // Type to make the value dirty
    await user.type(passwordInput, "secret")
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1) // mount only

    // Tab to the toggle — focus leaves the input but stays within the widget
    await user.tab()
    const toggleButton = screen.getByRole("button", { name: "Show password" })
    expect(toggleButton).toHaveFocus()

    // No commit should have happened — dirty value is still pending
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("password toggle is disabled when the widget is disabled", () => {
    const props = getProps(
      { type: TextInputProto.Type.PASSWORD },
      { disabled: true }
    )
    render(<TextInput {...props} />)

    const toggleButton = screen.getByRole("button", { name: "Show password" })
    expect(toggleButton).toBeDisabled()
  })

  it("handles TextInputProto.autocomplete", () => {
    let props = getProps()
    const { unmount } = render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")
    expect(textInput).toHaveAttribute("autoComplete", "")
    // unmount the initial component
    unmount()

    props = getProps({ autocomplete: "one-time-password" })
    render(<TextInput {...props} />)
    const autocompleteTextInput = screen.getByRole("textbox")
    expect(autocompleteTextInput).toHaveAttribute(
      "autoComplete",
      "one-time-password"
    )
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.id,
      props.element.default,
      { formId: props.element.formId, fragmentId: undefined, fromUser: false }
    )
  })

  it("can pass fragmentId to setStringValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.id,
      props.element.default,
      {
        formId: props.element.formId,
        fragmentId: "myFragmentId",
        fromUser: false,
      }
    )
  })

  it("has correct className", () => {
    const props = getProps()
    render(<TextInput {...props} />)
    const textInput = screen.getByTestId("stTextInput")

    expect(textInput).toHaveClass("stTextInput")
  })

  it("can be disabled", () => {
    const props = getProps({}, { disabled: true })
    render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")
    expect(textInput).toBeDisabled()
  })

  it("sets widget value on blur", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.type(textInput, "testing")
    // Blur the input
    await user.tab()

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.id,
      "testing",
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )
  })

  it("sets widget value when enter is pressed", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")

    // Simulate the full interaction chain (focus → keydown → keyup).
    await user.click(textInput)
    await user.keyboard("testing{Enter}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element.id,
      "testing",
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )
  })

  it("does not sync widget value when value did not change", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)

    // Simulate the full interaction chain (focus → keydown → keyup).
    await user.click(textInput)
    await user.keyboard("testing{Enter}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element.id,
      "testing",
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(2)

    // losing focus after value changed triggers a server sync
    await user.click(textInput)
    await user.keyboard("moreTesting")
    // click somewhere to lose focus on the input
    await user.click(document.body)

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element.id,
      "testingmoreTesting",
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(3)

    // focusing and clicking enter again without changing the value does
    // not trigger a server-sync and, thus, no re-run
    await user.click(textInput)
    await user.keyboard("{enter}")
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(3)

    // focusing and losing focus without changing the value does
    // not trigger a server-sync and, thus, no re-run
    await user.click(textInput)
    await user.click(document.body)
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(3)
  })

  it("doesn't set widget value when not dirty", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.keyboard("{Enter}")

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)

    textInput.blur()
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("limits input length if max_chars is passed", async () => {
    const user = userEvent.setup()
    const props = getProps({ maxChars: 10 })
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.type(textInput, "0123456789")
    expect(textInput).toHaveValue("0123456789")

    await user.type(textInput, "a")
    expect(textInput).toHaveValue("0123456789")
  })

  it("does update widget value on text changes when inside of a form", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "formId" })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)

    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.type(textInput, "TEST")
    expect(textInput).toHaveValue("TEST")

    textInput.focus()
    expect(
      await screen.findByText("Press Enter to submit form")
    ).toBeInTheDocument()

    expect(setStringValueSpy).toHaveBeenCalledWith(props.element.id, "TEST", {
      formId: props.element.formId,
      fragmentId: undefined,
      fromUser: true,
    })
  })

  it("does not update widget value on text changes when outside of a form", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.type(textInput, "TEST")
    expect(textInput).toHaveValue("TEST")

    textInput.focus()
    expect(await screen.findByText("Press Enter to apply")).toBeInTheDocument()

    // Check that the last call was in componentDidMount.
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element.id,
      props.element.default,
      { formId: props.element.formId, fragmentId: undefined, fromUser: false }
    )
  })

  it("resets its value when form is cleared", async () => {
    const user = userEvent.setup()
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")
    // Change the widget value
    await user.type(textInput, "TEST")

    act(() => {
      // "Submit" the form
      props.widgetMgr.submitForm("form", undefined)
    })

    // Our widget should be reset, and the widgetMgr should be updated
    expect(textInput).toHaveValue(props.element.default)
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element.id,
      props.element.default,
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )
  })

  it("shows Input Instructions on dirty state by default", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<TextInput {...props} />)

    // Trigger dirty state
    const textInput = screen.getByRole("textbox")
    await user.click(textInput)
    await user.keyboard("TEST")

    expect(screen.getByText("Press Enter to apply")).toBeVisible()
  })

  it("shows Input Instructions if in form that allows submit on enter", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)

    render(<TextInput {...props} />)

    // Trigger dirty state
    const textInput = screen.getByRole("textbox")
    await user.click(textInput)
    await user.keyboard("TEST")

    expect(screen.getByText("Press Enter to submit form")).toBeVisible()
  })

  // For this scenario https://github.com/streamlit/streamlit/issues/7079
  it("shows Input Instructions if focused again in form that allows submit on enter", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)

    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.type(textInput, "TEST")

    // Remove focus
    act(() => {
      textInput.blur()
    })
    await waitFor(() => {
      expect(screen.queryByTestId("InputInstructions")).not.toBeInTheDocument()
    })

    // Then focus again
    act(() => {
      textInput.focus()
    })
    expect(await screen.findByText("Press Enter to submit form")).toBeVisible()
  })

  it("hides Input Instructions if in form that doesn't allow submit on enter", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(false)

    render(<TextInput {...props} />)

    // Trigger dirty state
    const textInput = screen.getByRole("textbox")
    await user.type(textInput, "TEST")

    expect(screen.queryByTestId("InputInstructions")).toHaveTextContent("")
  })

  it("hides Please enter to apply text when width is smaller than 180px", async () => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [100],
    })
    const user = userEvent.setup()
    const props = getProps({}, {})
    render(<TextInput {...props} />)

    // Focus on input
    const textInput = screen.getByRole("textbox")
    await user.click(textInput)

    expect(screen.queryByTestId("InputInstructions")).not.toBeInTheDocument()
  })

  it("shows Please enter to apply text when width is bigger than 180px", async () => {
    const user = userEvent.setup()
    const props = getProps({}, {})
    render(<TextInput {...props} />)

    // Focus on input
    const textInput = screen.getByRole("textbox")
    await user.click(textInput)

    expect(screen.getByTestId("InputInstructions")).toBeInTheDocument()
  })

  it("focuses input when clicking label", async () => {
    const props = getProps()
    render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")
    expect(textInput).not.toHaveFocus()
    const label = screen.getByText(props.element.label)
    const user = userEvent.setup()
    await user.click(label)
    expect(textInput).toHaveFocus()
  })

  it("ensures id doesn't change on rerender", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<TextInput {...props} />)

    const textInputLabel1 = screen.getByTestId("stWidgetLabel")
    const forId1 = textInputLabel1.getAttribute("for")

    // Make some change to cause a rerender
    const textInput = screen.getByRole("textbox")
    await user.type(textInput, "0123456789")
    expect(textInput).toHaveValue("0123456789")

    const textInputLabel2 = screen.getByTestId("stWidgetLabel")
    const forId2 = textInputLabel2.getAttribute("for")

    expect(forId2).toBe(forId1)
  })

  it("handles an emoji icon", () => {
    const props = getProps({ icon: "🔎" })
    render(<TextInput {...props} />)
    // Dynamic Icon parent element
    expect(screen.getByTestId("stTextInputIcon")).toBeInTheDocument()
    // Element rendering emoji icon
    const emojiIcon = screen.getByTestId("stIconEmoji")
    expect(emojiIcon).toHaveTextContent("🔎")
  })

  it("handles a material icon", () => {
    const props = getProps({ icon: ":material/search:" })
    render(<TextInput {...props} />)
    // Dynamic Icon parent element
    expect(screen.getByTestId("stTextInputIcon")).toBeInTheDocument()
    // Element rendering material icon
    const materialIcon = screen.getByTestId("stIconMaterial")
    expect(materialIcon).toHaveTextContent("search")
  })

  it("does not show a validation error on initial render", () => {
    const props = getProps({ validateRegex: "^[a-z]+$" })
    render(<TextInput {...props} />)

    expect(
      screen.queryByTestId("stTextInputErrorIcon")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("stTooltipErrorHoverTarget")
    ).not.toBeInTheDocument()
  })

  it("shows an error and blocks blur commits for invalid values outside a form", async () => {
    const user = userEvent.setup()
    const props = getProps({ validateRegex: "^[a-z]+$" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.type(textInput, "123")
    await user.click(document.body)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("stTextInputErrorIcon")).toBeVisible()
    expect(textInput).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid input. Must match pattern: /^[a-z]+$/su"
    )
  })

  it("shows an error and blocks enter commits for invalid values outside a form", async () => {
    const user = userEvent.setup()
    const props = getProps({ validateRegex: "^[a-z]+$" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.click(textInput)
    await user.keyboard("123{Enter}")

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("stTextInputErrorIcon")).toBeVisible()
  })

  it("clears user errors while typing and commits valid values", async () => {
    const user = userEvent.setup()
    const props = getProps({ validateRegex: "^[a-z]+$" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.type(textInput, "123")
    await user.click(document.body)

    expect(screen.getByTestId("stTextInputErrorIcon")).toBeVisible()

    await user.clear(textInput)
    expect(
      screen.queryByTestId("stTextInputErrorIcon")
    ).not.toBeInTheDocument()

    await user.type(textInput, "abc")
    await user.click(document.body)

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element.id,
      "abc",
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )
    expect(
      screen.queryByTestId("stTextInputErrorIcon")
    ).not.toBeInTheDocument()
    expect(textInput).not.toHaveAttribute("aria-invalid")
  })

  it("allows empty strings to bypass validation", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "abc", validateRegex: "^[a-z]+$" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.clear(textInput)
    await user.click(document.body)

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element.id,
      "",
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )
    expect(
      screen.queryByTestId("stTextInputErrorIcon")
    ).not.toBeInTheDocument()
  })

  it("shows a custom validation message", async () => {
    const user = userEvent.setup()
    const props = getProps({
      validateRegex: "^[a-z]+$",
      validateMessage: "Lowercase only",
    })
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.type(textInput, "123")
    await user.click(document.body)

    const errorIcon = screen.getByTestId("stTooltipErrorHoverTarget")
    await user.hover(errorIcon)

    const tooltip = await screen.findByTestId("stTooltipErrorContent")
    expect(tooltip).toHaveTextContent("Lowercase only")
    expect(tooltip).not.toHaveTextContent("^[a-z]+$")
  })

  it("keeps the shown error message in sync when only validateMessage changes", async () => {
    const user = userEvent.setup()
    const props = getProps({
      validateRegex: "^[a-z]+$",
      validateMessage: "Old message",
    })
    const { rerender } = render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.type(textInput, "123")
    await user.click(document.body)

    expect(screen.getByRole("alert")).toHaveTextContent("Old message")

    // Changing only the message keeps the widget identity stable (only the
    // regex is part of the widget ID), so the component is re-rendered rather
    // than remounted. The still-invalid input must immediately reflect the new
    // message without the user re-triggering validation.
    const updatedElement = TextInputProto.create({
      ...props.element,
      validateMessage: "New message",
    })
    rerender(<TextInput {...props} element={updatedElement} />)

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("New message")
    expect(alert).not.toHaveTextContent("Old message")
  })

  it("exposes the validation message to assistive tech via aria-describedby", async () => {
    const user = userEvent.setup()
    const props = getProps({
      validateRegex: "^[a-z]+$",
      validateMessage: "Lowercase only",
    })
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    expect(textInput).not.toHaveAttribute("aria-describedby")

    await user.type(textInput, "123")
    await user.click(document.body)

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Lowercase only")
    expect(textInput).toHaveAttribute("aria-describedby", alert.id)
  })

  it("shows invalid regex errors immediately and logs them", async () => {
    const user = userEvent.setup()
    const logErrorSpy = vi.spyOn(getLogger("TextInput"), "error")
    const props = getProps({ validateRegex: "[" })
    render(<TextInput {...props} />)

    expect(screen.getByTestId("stTextInputErrorIcon")).toBeVisible()
    expect(logErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid validate regex: [.")
    )

    const errorIcon = screen.getByTestId("stTooltipErrorHoverTarget")
    await user.hover(errorIcon)

    const tooltip = await screen.findByTestId("stTooltipErrorContent")
    expect(tooltip).toHaveTextContent("Invalid validate regex: [.")
  })

  it("allows clearing the input when the validate regex is invalid", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: "abc", validateRegex: "[" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    // Config error is still shown, but empty commits must not be blocked.
    expect(screen.getByTestId("stTextInputErrorIcon")).toBeVisible()

    const textInput = screen.getByRole("textbox")
    await user.clear(textInput)
    await user.click(document.body)

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element.id,
      "",
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )
  })

  it("does not validate on blur inside a form", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form", validateRegex: "^[a-z]+$" })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.type(textInput, "123")
    await user.click(document.body)

    expect(setStringValueSpy).toHaveBeenLastCalledWith(
      props.element.id,
      "123",
      {
        formId: props.element.formId,
        fragmentId: undefined,
        fromUser: true,
      }
    )
    expect(
      screen.queryByTestId("stTextInputErrorIcon")
    ).not.toBeInTheDocument()
  })

  it("blocks form submission when submit is attempted with invalid input", async () => {
    const user = userEvent.setup()
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    const props = getProps(
      { formId: "form", validateRegex: "^[a-z]+$" },
      { widgetMgr }
    )
    render(<TextInput {...props} />)

    await user.type(screen.getByRole("textbox"), "123")

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })

    expect(sendRerunBackMsg).not.toHaveBeenCalled()
    expect(screen.getByTestId("stTextInputErrorIcon")).toBeVisible()
  })

  it("deregisters the form submit validator on unmount", async () => {
    const user = userEvent.setup()
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    const props = getProps(
      { formId: "form", validateRegex: "^[a-z]+$" },
      { widgetMgr }
    )
    const { unmount } = render(<TextInput {...props} />)

    // Enter an invalid value so the registered validator blocks submission.
    await user.type(screen.getByRole("textbox"), "123")
    act(() => {
      widgetMgr.submitForm("form", undefined)
    })
    expect(sendRerunBackMsg).not.toHaveBeenCalled()

    // After unmount, the validator must be removed so it no longer blocks the
    // form (otherwise a stale validator would permanently break submission).
    unmount()
    act(() => {
      widgetMgr.submitForm("form", undefined)
    })
    expect(sendRerunBackMsg).toHaveBeenCalledTimes(1)
  })

  it("blocks enter-to-submit when the form value is invalid", async () => {
    const user = userEvent.setup()
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    vi.spyOn(widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)
    const props = getProps(
      { formId: "form", validateRegex: "^[a-z]+$" },
      { widgetMgr }
    )
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.click(textInput)
    await user.keyboard("123{Enter}")

    expect(sendRerunBackMsg).not.toHaveBeenCalled()
    expect(screen.getByTestId("stTextInputErrorIcon")).toBeVisible()
  })

  it("commits the latest valid form value during submit validation", async () => {
    const user = userEvent.setup()
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    const props = getProps(
      { formId: "form", validateRegex: "^[a-z]+$" },
      { widgetMgr }
    )
    const setStringValueSpy = vi.spyOn(widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    await user.type(screen.getByRole("textbox"), "abcd")
    setStringValueSpy.mockClear()

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })

    expect(setStringValueSpy).toHaveBeenCalledWith(props.element.id, "abcd", {
      formId: props.element.formId,
      fragmentId: undefined,
      fromUser: true,
    })
    expect(sendRerunBackMsg).toHaveBeenCalledWith(
      {
        widgets: [{ id: props.element.id, stringValue: "abcd" }],
      },
      undefined,
      undefined,
      undefined
    )
  })

  it("clears validation errors when a clear-on-submit form resets", async () => {
    const user = userEvent.setup()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(),
    })
    widgetMgr.setFormSubmitBehaviors("form", true)
    const props = getProps(
      { formId: "form", validateRegex: "^[a-z]+$" },
      { widgetMgr }
    )
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.type(textInput, "123")
    act(() => {
      widgetMgr.submitForm("form", undefined)
    })
    expect(screen.getByTestId("stTextInputErrorIcon")).toBeVisible()

    await user.clear(textInput)
    await user.type(textInput, "abcd")
    act(() => {
      widgetMgr.submitForm("form", undefined)
    })

    expect(textInput).toHaveValue(props.element.default)
    expect(
      screen.queryByTestId("stTextInputErrorIcon")
    ).not.toBeInTheDocument()
  })
})

describe("TextInput query param binding", () => {
  it("registers query param binding on mount when queryParamKey is set", () => {
    const props = getProps({ queryParamKey: "my_text" })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<TextInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_text",
      "string_value",
      props.element.default,
      true,
      undefined
    )
  })

  it("unregisters query param binding on unmount", () => {
    const props = getProps({ queryParamKey: "my_text" })
    const unregisterSpy = vi.spyOn(
      props.widgetMgr,
      "unregisterQueryParamBinding"
    )

    const { unmount } = render(<TextInput {...props} />)

    // Clear any calls from React Strict Mode's initial mount/unmount/remount cycle
    unregisterSpy.mockClear()

    unmount()

    expect(props.widgetMgr.unregisterQueryParamBinding).toHaveBeenCalledWith(
      props.element.id
    )
  })

  it("does not register query param binding when queryParamKey is not set", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<TextInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).not.toHaveBeenCalled()
  })

  it("registers query param binding with custom default value", () => {
    const props = getProps({
      queryParamKey: "search",
      default: "initial search",
    })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<TextInput {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "search",
      "string_value",
      "initial search",
      true,
      undefined
    )
  })
})

describe("on_change='ignore' mode", () => {
  it("passes triggerRerun: false when ignoreRerun is true", async () => {
    const user = userEvent.setup()
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    const props = getProps({ ignoreRerun: true }, { widgetMgr })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextInput {...props} />)
    setStringValueSpy.mockClear()
    sendRerunBackMsg.mockClear()

    await user.type(screen.getByRole("textbox"), "testing{Enter}")

    expect(setStringValueSpy).toHaveBeenCalledWith(
      props.element.id,
      "testing",
      {
        formId: props.element.formId,
        fragmentId: undefined,
        fromUser: true,
        triggerRerun: false,
      }
    )
    expect(sendRerunBackMsg).not.toHaveBeenCalled()
  })

  it("does not pass triggerRerun when ignoreRerun is false", async () => {
    const user = userEvent.setup()
    const props = getProps({ ignoreRerun: false })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextInput {...props} />)
    setStringValueSpy.mockClear()

    await user.type(screen.getByRole("textbox"), "testing{Enter}")

    expect(setStringValueSpy).toHaveBeenCalledWith(
      props.element.id,
      "testing",
      {
        formId: props.element.formId,
        fragmentId: undefined,
        fromUser: true,
      }
    )
  })

  it("forwards triggerRerun: false inside a form", async () => {
    const user = userEvent.setup()
    const props = getProps({
      ignoreRerun: true,
      formId: "testForm",
    })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextInput {...props} />)
    setStringValueSpy.mockClear()

    await user.type(screen.getByRole("textbox"), "a")

    expect(setStringValueSpy).toHaveBeenCalledWith(props.element.id, "a", {
      formId: "testForm",
      fragmentId: undefined,
      fromUser: true,
      triggerRerun: false,
    })
  })

  it("does not commit on keystroke outside a form when ignoreRerun is true", async () => {
    const user = userEvent.setup()
    const props = getProps({ ignoreRerun: true })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextInput {...props} />)
    setStringValueSpy.mockClear()

    await user.type(screen.getByRole("textbox"), "hello")

    expect(setStringValueSpy).not.toHaveBeenCalled()
  })

  it("passes triggerRerun: false when search clear is clicked", async () => {
    const user = userEvent.setup()
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    const props = getProps(
      {
        ignoreRerun: true,
        type: TextInputProto.Type.SEARCH,
      },
      { widgetMgr }
    )
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextInput {...props} />)
    setStringValueSpy.mockClear()
    sendRerunBackMsg.mockClear()

    const searchbox = screen.getByRole<HTMLInputElement>("searchbox")
    await user.type(searchbox, "laptops")
    expect(setStringValueSpy).not.toHaveBeenCalled()

    await user.click(screen.getByTestId("stTextInputClearButton"))

    expect(setStringValueSpy).toHaveBeenCalledWith(props.element.id, "", {
      formId: props.element.formId,
      fragmentId: undefined,
      fromUser: true,
      triggerRerun: false,
    })
    expect(sendRerunBackMsg).not.toHaveBeenCalled()
  })
})
