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
      props.element,
      props.element.default,
      { fromUi: false },
      undefined
    )
  })

  it("can pass fragmentId to setStringValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      "myFragmentId"
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
      props.element,
      "testing",
      {
        fromUi: true,
      },
      undefined
    )
  })

  it.each([
    { preFill: false, expectedValue: "TEST", label: "without prior typing" },
    {
      preFill: true,
      expectedValue: "autofilled-value",
      label: "after user typing",
    },
  ])(
    "commits programmatic DOM value changes on blur $label",
    async ({ preFill, expectedValue }) => {
      const user = userEvent.setup()
      const props = getProps()
      const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
      render(<TextInput {...props} />)

      // First call happens on mount.
      expect(setStringValueSpy).toHaveBeenCalledTimes(1)

      const textInput = screen.getByRole<HTMLInputElement>("textbox")
      await user.click(textInput)

      if (preFill) {
        await user.type(textInput, "typed-value")
      }

      // Simulate password manager autofill by setting the DOM value directly.
      textInput.value = expectedValue
      await user.tab()

      await waitFor(() => {
        expect(setStringValueSpy).toHaveBeenCalledTimes(2)
      })

      expect(setStringValueSpy).toHaveBeenLastCalledWith(
        props.element,
        expectedValue,
        { fromUi: true },
        undefined
      )
    }
  )

  it("does not commit programmatic blur value changes that exceed maxChars", async () => {
    const user = userEvent.setup()
    const props = getProps({ maxChars: 3 })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    // First call happens on mount.
    expect(setStringValueSpy).toHaveBeenCalledTimes(1)

    const textInput = screen.getByRole<HTMLInputElement>("textbox")
    await user.click(textInput)

    // Simulate password manager autofill with a value that violates maxChars.
    textInput.value = "TOOLONG"
    await user.tab()

    await waitFor(() => {
      // onBlur reconciliation should reject this value and avoid committing.
      expect(setStringValueSpy).toHaveBeenCalledTimes(1)
    })
    expect(textInput).toHaveValue("")
  })

  it("detects programmatic value changes via native input events", async () => {
    const user = userEvent.setup()
    const props = getProps()
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    // First call happens on mount.
    expect(setStringValueSpy).toHaveBeenCalledTimes(1)

    const textInput = screen.getByRole<HTMLInputElement>("textbox")
    await user.click(textInput)

    // Simulate password manager autofill by setting the DOM value directly,
    // but dispatch a non-bubbling input event that React's delegated listener
    // won't see. Our native event listener should still catch this.
    textInput.value = "TEST"
    act(() => {
      textInput.dispatchEvent(new Event("input", { bubbles: false }))
    })

    // Pressing Enter should commit if the widget was marked dirty.
    await user.keyboard("{Enter}")

    await waitFor(() => {
      expect(setStringValueSpy).toHaveBeenCalledTimes(2)
    })

    expect(setStringValueSpy).toHaveBeenLastCalledWith(
      props.element,
      "TEST",
      { fromUi: true },
      undefined
    )
  })

  it("syncs non-bubbling native input changes immediately in forms without waiting for timers", () => {
    vi.useFakeTimers()
    try {
      const props = getProps({ formId: "formId" })
      const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
      render(<TextInput {...props} />)

      const textInput = screen.getByRole<HTMLInputElement>("textbox")
      expect(setStringValueSpy).toHaveBeenCalledTimes(1)

      act(() => {
        textInput.value = "TEST"
        textInput.dispatchEvent(new Event("input", { bubbles: false }))
      })

      // In forms, we should immediately sync to widget state for non-bubbling
      // native changes without waiting for deferred timeout reconciliation.
      expect(setStringValueSpy).toHaveBeenCalledTimes(2)
      expect(setStringValueSpy).toHaveBeenLastCalledWith(
        props.element,
        "TEST",
        { fromUi: true },
        undefined
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it("rejects over-max native programmatic changes and restores the DOM value", () => {
    vi.useFakeTimers()
    try {
      const props = getProps({ formId: "formId", maxChars: 3 })
      const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
      render(<TextInput {...props} />)
      const textInput = screen.getByRole<HTMLInputElement>("textbox")

      // First call happens on mount.
      expect(setStringValueSpy).toHaveBeenCalledTimes(1)

      textInput.value = "TOOLONG"
      act(() => {
        textInput.dispatchEvent(new Event("input", { bubbles: false }))
      })
      act(() => {
        vi.runAllTimers()
      })

      // Overflow value should be ignored and immediately reverted.
      expect(setStringValueSpy).toHaveBeenCalledTimes(1)
      expect(textInput).toHaveValue("")
    } finally {
      vi.useRealTimers()
    }
  })

  it("ignores non-bubbling native input events when disabled", () => {
    vi.useFakeTimers()
    try {
      const props = getProps({ formId: "formId" }, { disabled: true })
      const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
      render(<TextInput {...props} />)
      const textInput = screen.getByRole<HTMLInputElement>("textbox")

      // First call happens on mount.
      expect(setStringValueSpy).toHaveBeenCalledTimes(1)

      // If native listeners were attached while disabled, this event would mark
      // the input dirty and trigger an immediate form-state update.
      textInput.value = "TEST"
      act(() => {
        textInput.dispatchEvent(new Event("input", { bubbles: false }))
      })
      act(() => {
        vi.runAllTimers()
      })

      expect(setStringValueSpy).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not double-process bubbling input events handled by React", () => {
    vi.useFakeTimers()
    try {
      const props = getProps({ formId: "formId" })
      const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
      render(<TextInput {...props} />)

      const textInput = screen.getByRole<HTMLInputElement>("textbox")

      // Mount call + one onChange for the bubbling input event.
      expect(setStringValueSpy).toHaveBeenCalledTimes(1)
      textInput.value = "A"
      act(() => {
        textInput.dispatchEvent(new Event("input", { bubbles: true }))
      })

      // Flush deferred native reconciliation to verify it does not emit
      // another synthetic change for standard bubbling input events.
      act(() => {
        vi.runAllTimers()
      })

      expect(setStringValueSpy).toHaveBeenCalledTimes(2)
      expect(setStringValueSpy).toHaveBeenLastCalledWith(
        props.element,
        "A",
        { fromUi: true },
        undefined
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not re-register native listeners on each keystroke", async () => {
    const addEventListenerSpy = vi.spyOn(
      HTMLInputElement.prototype,
      "addEventListener"
    )
    const removeEventListenerSpy = vi.spyOn(
      HTMLInputElement.prototype,
      "removeEventListener"
    )
    try {
      const user = userEvent.setup()
      const props = getProps()
      const { unmount } = render(<TextInput {...props} />)
      const textInput = screen.getByRole<HTMLInputElement>("textbox")

      await user.type(textInput, "abc")

      const nativeEventTypes = new Set(["input", "change"])
      const addCallsForInput = addEventListenerSpy.mock.calls.filter(
        (call, index) =>
          addEventListenerSpy.mock.contexts[index] === textInput &&
          nativeEventTypes.has(String(call[0]))
      )
      const removeCallsForInput = removeEventListenerSpy.mock.calls.filter(
        (call, index) =>
          removeEventListenerSpy.mock.contexts[index] === textInput &&
          nativeEventTypes.has(String(call[0]))
      )

      expect(addCallsForInput).toHaveLength(2)
      expect(removeCallsForInput).toHaveLength(0)

      unmount()

      const removeCallsAfterUnmount = removeEventListenerSpy.mock.calls.filter(
        (call, index) =>
          removeEventListenerSpy.mock.contexts[index] === textInput &&
          nativeEventTypes.has(String(call[0]))
      )
      expect(removeCallsAfterUnmount).toHaveLength(2)
    } finally {
      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    }
  })

  it("sets widget value when enter is pressed", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")

    // userEvent necessary to trigger onKeyPress
    // fireEvent only dispatches DOM events vs. simulating full interactions
    await user.click(textInput)
    await user.keyboard("testing{Enter}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("does not sync widget value when value did not change", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)

    // userEvent necessary to trigger onKeyPress
    // fireEvent only dispatches DOM events vs. simulating full interactions
    await user.click(textInput)
    await user.keyboard("testing{Enter}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      },
      undefined
    )
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(2)

    // losing focus after value changed triggers a server sync
    await user.click(textInput)
    await user.keyboard("moreTesting")
    // click somewhere to lose focus on the input
    await user.click(document.body)

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "testingmoreTesting",
      {
        fromUi: true,
      },
      undefined
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

    expect(setStringValueSpy).toHaveBeenCalledWith(
      props.element,
      "TEST",
      {
        fromUi: true,
      },
      undefined
    )
    expect(setStringValueSpy).toHaveBeenCalledTimes(5)
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
      props.element,
      props.element.default,
      {
        fromUi: false,
      },
      undefined
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
      props.element,
      props.element.default,
      {
        fromUi: true,
      },
      undefined
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
