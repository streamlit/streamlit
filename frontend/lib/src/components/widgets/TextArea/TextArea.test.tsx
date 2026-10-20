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

import { act, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  Element,
  LabelVisibility as LabelVisibilityProto,
  TextArea as TextAreaProto,
} from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import TextArea, { type Props } from "./TextArea"

// Mock Element for tests
class MockElement implements Element {
  constructor() {}

  toJSON(): MockElement {
    return this
  }
}

const getProps = (
  elementProps: Partial<TextAreaProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: TextAreaProto.create({
    id: "1",
    label: "Label",
    default: "",
    placeholder: "Placeholder",
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  outerElement: new MockElement(),
  ...widgetProps,
})

describe("TextArea widget", () => {
  beforeEach(() => {
    // Default wider than hideWidgetDetails (180px) so Input Instructions tests
    // do not depend on a leaked useResizeObserver mock from another case.
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [400],
    })
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    expect(textArea).toBeInTheDocument()
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.id,
      props.element.default,
      { formId: props.element.formId, fragmentId: undefined, fromUser: false }
    )
  })

  it("can pass fragmentId to setStringValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

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
    render(<TextArea {...props} />)
    const textArea = screen.getByTestId("stTextArea")

    expect(textArea).toHaveClass("stTextArea")
  })

  it("renders a label", () => {
    const props = getProps()
    render(<TextArea {...props} />)

    const widgetLabel = screen.getByText(`${props.element.label}`)
    expect(widgetLabel).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<TextArea {...props} />)
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
    render(<TextArea {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("has a default value", () => {
    const props = getProps()
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    expect(textArea).toHaveValue(props.element.default)
  })

  it("renders a placeholder", () => {
    const props = getProps()
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    expect(textArea).toHaveAttribute("placeholder", props.element.placeholder)
  })

  it("can be disabled", () => {
    const props = getProps({}, { disabled: true })
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    expect(textArea).toBeDisabled()
  })

  it("sets widget value on blur", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "testing")
    // Blur the textarea
    await user.tab()

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.id,
      "testing",
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )
  })

  it("sets widget value when ctrl+enter is pressed", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "testing")
    await user.keyboard("{Control>}{Enter}")

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.id,
      "testing",
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )
  })

  it("limits the length if max_chars is passed", async () => {
    const user = userEvent.setup()
    const props = getProps({
      maxChars: 10,
    })
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "0123456789")
    expect(textArea).toHaveValue("0123456789")

    await user.type(textArea, "a")
    expect(textArea).toHaveValue("0123456789")
  })

  it("does not update widget value on text changes when outside of a form", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "TEST")

    // Check that the last call was in componentDidMount.
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element.id,
      props.element.default,
      { formId: props.element.formId, fragmentId: undefined, fromUser: false }
    )
  })

  it("hides Please enter to apply text when width is smaller than 180px", async () => {
    const user = userEvent.setup()
    const props = getProps({}, {})
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [100],
    })

    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.click(textArea)

    expect(screen.queryByTestId("InputInstructions")).not.toBeInTheDocument()
  })

  it("shows Please enter to apply text when width is bigger than 180px", async () => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [190],
    })

    const user = userEvent.setup()
    const props = getProps({}, {})
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.click(textArea)

    expect(screen.getByTestId("InputInstructions")).toBeInTheDocument()
  })

  it.each([
    ["stretch", { useStretch: true }, "100%"],
    ["content", { useContent: true }, "auto"],
    ["pixel", { pixelHeight: 200 }, "auto"],
  ])(
    "only fills its element container with %s height",
    (_label, heightConfig, expectedHeight) => {
      render(
        <TextArea
          {...getProps({}, { outerElement: new Element({ heightConfig }) })}
        />
      )

      const container = screen.getByTestId("stTextArea")
      expect(container).toHaveStyle({ height: expectedHeight })
      // Keeps the input instructions anchored to the field.
      expect(container).toHaveStyle({ position: "relative" })
    }
  )

  it("initializes auto-expand height once width is available", () => {
    const resizeObserverSpy = vi
      .spyOn(UseResizeObserver, "useResizeObserver")
      .mockReturnValue({
        elementRef: { current: null },
        values: [0],
      })

    const props = getProps(
      {},
      {
        outerElement: new Element({ heightConfig: { useContent: true } }),
      }
    )
    const { rerender } = render(<TextArea {...props} />)

    expect(screen.getByRole("textbox")).toHaveStyle({ height: "2.5rem" })

    // Restorable getter spy (same pattern as Toast.test.tsx). Do not spy
    // `Element.prototype` here — that name is the protobuf Element import.
    // Install measurable heights only after the zero-width mount so this
    // pins TextArea's width-gated layout effect, not the auto-expand hook's
    // initial measurement.
    const scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(120)
    const offsetHeightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(40)

    try {
      resizeObserverSpy.mockReturnValue({
        elementRef: { current: null },
        values: [400],
      })
      // TextArea is memoized, so identical props would skip the rerender
      // that should pick up the new observed width.
      rerender(<TextArea {...props} fragmentId="after-width" />)

      // 121px = scrollHeight 120 + ROUNDING_OFFSET 1
      expect(screen.getByRole("textbox")).toHaveStyle({ height: "121px" })
    } finally {
      scrollHeightSpy.mockRestore()
      offsetHeightSpy.mockRestore()
    }
  })

  it("resets its value when form is cleared", async () => {
    const user = userEvent.setup()
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextArea {...props} />)

    // Change the widget value
    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "TEST")
    expect(textArea).toHaveValue("TEST")

    // "Submit" the form
    act(() => {
      props.widgetMgr.submitForm("form", undefined)
    })

    // Our widget should be reset, and the widgetMgr should be updated
    await waitFor(() => expect(textArea).toHaveValue(props.element.default))
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element.id,
      props.element.default,
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )
  })

  it("shows Input Instructions on dirty state when not in form (by default)", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<TextArea {...props} />)

    // Trigger dirty state
    const textArea = screen.getByRole("textbox")
    await user.click(textArea)
    await user.keyboard("TEST")

    expect(screen.getByText("Press ⌘+Enter to apply")).toBeVisible()
  })

  it("shows Input Instructions if in form that allows submit on enter", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)

    render(<TextArea {...props} />)

    // Trigger dirty state
    const textArea = screen.getByRole("textbox")
    await user.click(textArea)
    await user.keyboard("TEST")

    expect(screen.getByText("Press ⌘+Enter to submit form")).toBeVisible()
  })

  // For this scenario https://github.com/streamlit/streamlit/issues/7079
  it("shows Input Instructions if focused again in form that allows submit on enter", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)

    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.click(textArea)
    await user.keyboard("TEST")

    // Remove focus
    act(() => {
      textArea.blur()
    })
    await waitFor(() => {
      expect(screen.queryByTestId("InputInstructions")).not.toBeInTheDocument()
    })

    // Then focus again
    act(() => {
      textArea.focus()
    })
    await waitFor(() => {
      expect(screen.getByText("Press ⌘+Enter to submit form")).toBeVisible()
    })
  })

  it("hides Input Instructions if in form that doesn't allow submit on enter", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(false)

    render(<TextArea {...props} />)

    // Trigger dirty state
    const textArea = screen.getByRole("textbox")
    await user.click(textArea)
    await user.keyboard("TEST")

    expect(screen.queryByTestId("InputInstructions")).toHaveTextContent("")
  })

  it("focuses input when clicking label", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<TextArea {...props} />)
    const textArea = screen.getByRole("textbox")
    expect(textArea).not.toHaveFocus()
    const label = screen.getByText(props.element.label)
    await user.click(label)
    expect(textArea).toHaveFocus()
  })

  describe("on mac", () => {
    Object.defineProperty(navigator, "platform", {
      value: "MacIntel",
      writable: true,
    })

    it("sets widget value when ⌘+enter is pressed", async () => {
      const user = userEvent.setup()
      const props = getProps()
      vi.spyOn(props.widgetMgr, "setStringValue")
      render(<TextArea {...props} />)
      const textArea = screen.getByRole("textbox")
      await user.type(textArea, "testing")
      await user.keyboard("{Meta>}{Enter}")

      expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
        props.element.id,
        "testing",
        { formId: props.element.formId, fragmentId: undefined, fromUser: true }
      )
    })
  })

  it("ensures id doesn't change on rerender", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<TextArea {...props} />)

    const textAreaLabel1 = screen.getByTestId("stWidgetLabel")
    const forId1 = textAreaLabel1.getAttribute("for")

    // Make some change to cause a rerender
    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "testing")
    act(() => {
      textArea.blur()
    })

    const textAreaLabel2 = screen.getByTestId("stWidgetLabel")
    const forId2 = textAreaLabel2.getAttribute("for")

    expect(forId2).toBe(forId1)
  })
})

describe("TextArea required", () => {
  const REQUIRED_MESSAGE = "This field is required."

  beforeEach(() => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [400],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createWidgetMgr(): {
    sendRerunBackMsg: ReturnType<typeof vi.fn>
    widgetMgr: WidgetStateManager
  } {
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    return { sendRerunBackMsg, widgetMgr }
  }

  function expectRequiredError(textArea: HTMLElement): void {
    expect(screen.getByTestId("stTextAreaErrorIcon")).toBeVisible()
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(REQUIRED_MESSAGE)
    expect(textArea).toHaveAttribute("aria-invalid", "true")
    expect(textArea).toHaveAttribute(
      "aria-describedby",
      alert.getAttribute("id")
    )
  }

  function expectNoRequiredError(textArea: HTMLElement): void {
    expect(screen.queryByTestId("stTextAreaErrorIcon")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(textArea).not.toHaveAttribute("aria-invalid")
    expect(textArea).not.toHaveAttribute("aria-describedby")
  }

  it("does not show a required error on initial render", () => {
    render(<TextArea {...getProps({ required: true })} />)

    const textArea = screen.getByRole("textbox")
    expect(textArea).toHaveAttribute("aria-required", "true")
    expectNoRequiredError(textArea)
  })

  it("sets aria-required only when required is true", () => {
    const { unmount } = render(<TextArea {...getProps({ required: true })} />)
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-required",
      "true"
    )
    unmount()

    render(<TextArea {...getProps({ required: false })} />)
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-required")
  })

  it("shows the required marker when the label is visible", () => {
    render(<TextArea {...getProps({ required: true })} />)

    expect(screen.getByTestId("stWidgetLabelRequired")).toHaveTextContent(
      "(required)"
    )
  })

  it.each([
    ["hidden", LabelVisibilityProto.LabelVisibilityOptions.HIDDEN],
    ["collapsed", LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED],
  ])(
    "omits the required marker when the label is %s",
    (_name, labelVisibility) => {
      render(
        <TextArea
          {...getProps({
            required: true,
            labelVisibility: { value: labelVisibility },
          })}
        />
      )

      expect(
        screen.queryByTestId("stWidgetLabelRequired")
      ).not.toBeInTheDocument()
      expect(screen.getByRole("textbox")).toHaveAttribute(
        "aria-required",
        "true"
      )
    }
  )

  it("blocks an empty blur outside a form", async () => {
    const user = userEvent.setup()
    const props = getProps({ required: true, default: "hello" })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)
    setStringValueSpy.mockClear()

    const textArea = screen.getByRole("textbox")
    await user.clear(textArea)
    await user.tab()

    expect(setStringValueSpy).not.toHaveBeenCalled()
    expect(textArea).toHaveValue("")
    expectRequiredError(textArea)
    expect(props.widgetMgr.getStringValue(props.element)).toBe("hello")
  })

  it("re-measures an auto-height field when the required error appears", async () => {
    const user = userEvent.setup()
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40)
    const scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(40)
    render(
      <TextArea
        {...getProps(
          { required: true, default: "hello" },
          {
            outerElement: new Element({ heightConfig: { useContent: true } }),
          }
        )}
      />
    )

    const textArea = screen.getByRole("textbox")
    await user.clear(textArea)
    expect(textArea).not.toHaveStyle({ height: "121px" })

    // The error's right padding can re-wrap the placeholder onto more lines
    // without changing the value.
    scrollHeightSpy.mockReturnValue(120)
    await user.tab()

    expectRequiredError(textArea)
    // 121px = scrollHeight 120 + ROUNDING_OFFSET 1
    expect(textArea).toHaveStyle({ height: "121px" })
  })

  it.each([
    ["Ctrl+Enter", "{Control>}{Enter}{/Control}"],
    ["Cmd+Enter", "{Meta>}{Enter}{/Meta}"],
  ])("blocks an empty %s outside a form", async (_name, keys) => {
    const user = userEvent.setup()
    const props = getProps({ required: true, default: "hello" })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)
    setStringValueSpy.mockClear()

    const textArea = screen.getByRole("textbox")
    await user.clear(textArea)
    await user.keyboard(keys)

    expect(setStringValueSpy).not.toHaveBeenCalled()
    expectRequiredError(textArea)
  })

  it.each([
    ["blur", async (user: ReturnType<typeof userEvent.setup>) => user.tab()],
    [
      "Ctrl+Enter",
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.keyboard("{Control>}{Enter}{/Control}"),
    ],
  ])(
    "does not show a required error on an unedited %s",
    async (_name, commit) => {
      const user = userEvent.setup()
      const props = getProps({ required: true })
      const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
      render(<TextArea {...props} />)
      setStringValueSpy.mockClear()

      const textArea = screen.getByRole("textbox")
      await user.click(textArea)
      await commit(user)

      expectNoRequiredError(textArea)
      expect(setStringValueSpy).not.toHaveBeenCalled()
    }
  )

  it("blocks an empty blur after editing a field whose last accepted value is empty", async () => {
    const user = userEvent.setup()
    const props = getProps({ required: true })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)
    setStringValueSpy.mockClear()

    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "x")
    await user.clear(textArea)
    await user.tab()

    expect(setStringValueSpy).not.toHaveBeenCalled()
    expectRequiredError(textArea)
  })

  it("blocks a whitespace-only commit", async () => {
    const user = userEvent.setup()
    const props = getProps({ required: true })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)
    setStringValueSpy.mockClear()

    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "  {Enter} ")
    expect(textArea).toHaveValue("  \n ")
    await user.tab()

    expect(setStringValueSpy).not.toHaveBeenCalled()
    expectRequiredError(textArea)
  })

  it("hides the error while editing and shows it again on the next empty commit", async () => {
    const user = userEvent.setup()
    const props = getProps({ required: true, default: "hello" })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)
    setStringValueSpy.mockClear()

    const textArea = screen.getByRole("textbox")
    await user.clear(textArea)
    await user.tab()
    expectRequiredError(textArea)

    await user.type(textArea, "a")
    expectNoRequiredError(textArea)
    expect(setStringValueSpy).not.toHaveBeenCalled()

    await user.clear(textArea)
    await user.tab()
    expectRequiredError(textArea)
    expect(setStringValueSpy).not.toHaveBeenCalled()
  })

  it("commits a non-empty value after a blocked commit", async () => {
    const user = userEvent.setup()
    const props = getProps({ required: true, default: "hello" })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)
    setStringValueSpy.mockClear()

    const textArea = screen.getByRole("textbox")
    await user.clear(textArea)
    await user.tab()
    expectRequiredError(textArea)

    await user.type(textArea, "abc")
    await user.tab()

    expect(setStringValueSpy).toHaveBeenCalledWith(props.element.id, "abc", {
      formId: props.element.formId,
      fragmentId: undefined,
      fromUser: true,
    })
    expectNoRequiredError(textArea)
  })

  it("does not snap a blocked field back to the last accepted value on rerender", async () => {
    const user = userEvent.setup()
    const props = getProps({ required: true, default: "hello" })
    const { rerender } = render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.clear(textArea)
    await user.tab()
    expectRequiredError(textArea)

    // A rerun from another widget sends a new proto without setValue.
    rerender(
      <TextArea
        {...props}
        element={TextAreaProto.create({ ...props.element })}
      />
    )

    expect(textArea).toHaveValue("")
    expectRequiredError(textArea)
    expect(props.widgetMgr.getStringValue(props.element)).toBe("hello")
  })

  it.each([
    ["the last accepted value", "hello"],
    ["a different value", "Ada"],
  ])(
    "applies a session_state write of %s after a blocked commit",
    async (_name, incoming) => {
      const user = userEvent.setup()
      const props = getProps({ required: true, default: "hello" })
      const { rerender } = render(<TextArea {...props} />)

      const textArea = screen.getByRole("textbox")
      await user.clear(textArea)
      await user.tab()
      expectRequiredError(textArea)

      rerender(
        <TextArea
          {...props}
          element={TextAreaProto.create({
            ...props.element,
            setValue: true,
            value: incoming,
          })}
        />
      )

      expect(textArea).toHaveValue(incoming)
      expectNoRequiredError(textArea)
      expect(props.widgetMgr.getStringValue(props.element)).toBe(incoming)
    }
  )

  it("applies a session_state write that also turns required off after a blocked commit", async () => {
    const user = userEvent.setup()
    const props = getProps({ required: true, default: "hello" })
    const { rerender } = render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.clear(textArea)
    await user.tab()
    expectRequiredError(textArea)

    rerender(
      <TextArea
        {...props}
        element={TextAreaProto.create({
          ...props.element,
          required: false,
          setValue: true,
          value: "Ada",
        })}
      />
    )

    expect(textArea).toHaveValue("Ada")
    expectNoRequiredError(textArea)
    expect(textArea).not.toHaveAttribute("aria-required")
  })

  it("keeps an unblocked dirty edit over a session_state write", async () => {
    const user = userEvent.setup()
    const props = getProps({ required: true, default: "hello" })
    const { rerender } = render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.clear(textArea)
    await user.tab()
    expectRequiredError(textArea)

    // Typing hides the error, so the edit is dirty but no longer blocked.
    await user.type(textArea, "a")
    expectNoRequiredError(textArea)

    rerender(
      <TextArea
        {...props}
        element={TextAreaProto.create({
          ...props.element,
          setValue: true,
          value: "Ada",
        })}
      />
    )

    expect(textArea).toHaveValue("a")
    expect(textArea).not.toHaveValue("Ada")
  })

  it("applies a session_state write over a dirty field whose form submit was blocked", async () => {
    const user = userEvent.setup()
    const { widgetMgr } = createWidgetMgr()
    const props = getProps(
      { formId: "form", required: true, id: "required-dirty-form" },
      { widgetMgr }
    )
    const { rerender } = render(<TextArea {...props} />)

    // Type and clear without blurring, so the field is still dirty when the
    // submit is blocked.
    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "x")
    await user.clear(textArea)
    act(() => {
      widgetMgr.submitForm("form", undefined)
    })
    expectRequiredError(textArea)

    rerender(
      <TextArea
        {...props}
        element={TextAreaProto.create({
          ...props.element,
          setValue: true,
          value: "Ada",
        })}
      />
    )

    expect(textArea).toHaveValue("Ada")
    expectNoRequiredError(textArea)
  })

  it("clears a leftover required error when required is turned off", async () => {
    const user = userEvent.setup()
    const props = getProps({ required: true, default: "hello" })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    const { rerender } = render(<TextArea {...props} />)
    setStringValueSpy.mockClear()

    const textArea = screen.getByRole("textbox")
    await user.clear(textArea)
    await user.tab()
    expectRequiredError(textArea)

    rerender(
      <TextArea
        {...props}
        element={TextAreaProto.create({ ...props.element, required: false })}
      />
    )

    expectNoRequiredError(textArea)
    expect(textArea).not.toHaveAttribute("aria-required")

    // The empty edit is still pending and now commits.
    await user.click(textArea)
    await user.tab()
    expect(setStringValueSpy).toHaveBeenCalledWith(
      props.element.id,
      "",
      expect.anything()
    )
  })

  it("does not bring back a leftover required error when required is turned back on", async () => {
    const user = userEvent.setup()
    const props = getProps({ required: true, default: "hello" })
    const { rerender } = render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.clear(textArea)
    await user.tab()
    expectRequiredError(textArea)

    rerender(
      <TextArea
        {...props}
        element={TextAreaProto.create({ ...props.element, required: false })}
      />
    )
    expectNoRequiredError(textArea)

    rerender(<TextArea {...props} />)

    expect(textArea).toHaveAttribute("aria-required", "true")
    expect(textArea).toHaveValue("")
    expectNoRequiredError(textArea)
  })

  it("shows no error after a programmatic empty write", () => {
    const props = getProps({ required: true, default: "hello" })
    const { rerender } = render(<TextArea {...props} />)

    rerender(
      <TextArea
        {...props}
        element={TextAreaProto.create({
          ...props.element,
          setValue: true,
          value: "",
        })}
      />
    )

    const textArea = screen.getByRole("textbox")
    expect(textArea).toHaveValue("")
    expectNoRequiredError(textArea)
  })

  it("clears a leftover form error after a programmatic refill and does not bring it back on a programmatic clear", () => {
    const { widgetMgr } = createWidgetMgr()
    const props = getProps(
      { formId: "form", required: true, id: "required-refill" },
      { widgetMgr }
    )
    const { rerender } = render(<TextArea {...props} />)
    const textArea = screen.getByRole("textbox")

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })
    expectRequiredError(textArea)

    rerender(
      <TextArea
        {...props}
        element={TextAreaProto.create({
          ...props.element,
          setValue: true,
          value: "Ada",
        })}
      />
    )
    expect(textArea).toHaveValue("Ada")
    expectNoRequiredError(textArea)

    rerender(
      <TextArea
        {...props}
        element={TextAreaProto.create({
          ...props.element,
          setValue: true,
          value: "",
        })}
      />
    )
    expect(textArea).toHaveValue("")
    expectNoRequiredError(textArea)
  })

  it("stages an empty blur inside a form without showing an error", async () => {
    const user = userEvent.setup()
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    const props = getProps(
      { formId: "form", required: true, default: "hello" },
      { widgetMgr }
    )
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.clear(textArea)
    await user.tab()

    expectNoRequiredError(textArea)
    expect(widgetMgr.getStringValue(props.element)).toBe("")
    expect(sendRerunBackMsg).not.toHaveBeenCalled()
  })

  it("blocks a form submit and shows an error on every empty required field", () => {
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    const firstProps = getProps(
      { id: "required-1", formId: "form", required: true, label: "First" },
      { widgetMgr }
    )
    const secondProps = getProps(
      { id: "required-2", formId: "form", required: true, label: "Second" },
      { widgetMgr }
    )
    render(
      <>
        <TextArea {...firstProps} />
        <TextArea {...secondProps} />
      </>
    )

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })

    expect(sendRerunBackMsg).not.toHaveBeenCalled()
    const alerts = screen.getAllByRole("alert")
    expect(alerts).toHaveLength(2)
    expect(alerts[0]).toHaveTextContent(REQUIRED_MESSAGE)
    expect(alerts[1]).toHaveTextContent(REQUIRED_MESSAGE)
    expect(screen.getAllByTestId("stTextAreaErrorIcon")).toHaveLength(2)
  })

  it("does not clear form values when a required submit fails", async () => {
    const user = userEvent.setup()
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    widgetMgr.setFormSubmitBehaviors("form", true)
    const filledProps = getProps(
      { id: "filled", formId: "form", required: true, label: "Filled" },
      { widgetMgr }
    )
    const emptyProps = getProps(
      { id: "empty", formId: "form", required: true, label: "Empty" },
      { widgetMgr }
    )
    render(
      <>
        <TextArea {...filledProps} />
        <TextArea {...emptyProps} />
      </>
    )

    const [filled, empty] = screen.getAllByRole("textbox")
    await user.type(filled, "abc")
    await user.tab()

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })

    expect(sendRerunBackMsg).not.toHaveBeenCalled()
    expect(filled).toHaveValue("abc")
    expect(filled).not.toHaveAttribute("aria-invalid")
    expect(empty).toHaveAttribute("aria-invalid", "true")
  })

  it("submits a filled required form and clears it without an error", async () => {
    const user = userEvent.setup()
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    widgetMgr.setFormSubmitBehaviors("form", true)
    const props = getProps({ formId: "form", required: true }, { widgetMgr })
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "abc")
    await user.tab()

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })

    expect(sendRerunBackMsg).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(textArea).toHaveValue(""))
    expectNoRequiredError(textArea)

    // The cleared field still gates the next submit.
    act(() => {
      widgetMgr.submitForm("form", undefined)
    })
    expect(sendRerunBackMsg).toHaveBeenCalledTimes(1)
    expectRequiredError(textArea)
  })

  it("blocks Ctrl+Enter-to-submit while the required form field is empty", async () => {
    const user = userEvent.setup()
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    vi.spyOn(widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)
    const submitFormSpy = vi.spyOn(widgetMgr, "submitForm")
    const props = getProps({ formId: "form", required: true }, { widgetMgr })
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.click(textArea)
    await user.keyboard("{Control>}{Enter}{/Control}")

    expect(submitFormSpy).toHaveBeenCalledTimes(1)
    expect(sendRerunBackMsg).not.toHaveBeenCalled()
    expectRequiredError(textArea)
  })

  it("submits via Ctrl+Enter once the required form field has a value", async () => {
    const user = userEvent.setup()
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    vi.spyOn(widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)
    const props = getProps({ formId: "form", required: true }, { widgetMgr })
    render(<TextArea {...props} />)

    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "abc")
    await user.keyboard("{Control>}{Enter}{/Control}")

    expect(sendRerunBackMsg).toHaveBeenCalledTimes(1)
    expectNoRequiredError(textArea)
  })

  it("does not gate a form submit when required is false", () => {
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    const props = getProps({ formId: "form", required: false }, { widgetMgr })
    render(<TextArea {...props} />)

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })

    expect(sendRerunBackMsg).toHaveBeenCalledTimes(1)
    expectNoRequiredError(screen.getByRole("textbox"))
  })

  it("deregisters the form submit validator on unmount", () => {
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    const props = getProps({ formId: "form", required: true }, { widgetMgr })
    const { unmount } = render(<TextArea {...props} />)

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })
    expect(sendRerunBackMsg).not.toHaveBeenCalled()

    unmount()
    act(() => {
      widgetMgr.submitForm("form", undefined)
    })
    expect(sendRerunBackMsg).toHaveBeenCalledTimes(1)
  })
})

describe("TextArea query param binding", () => {
  it("registers query param binding on mount when queryParamKey is set", () => {
    const props = getProps({ queryParamKey: "my_text" })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<TextArea {...props} />)

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

    const { unmount } = render(<TextArea {...props} />)

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

    render(<TextArea {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).not.toHaveBeenCalled()
  })

  it("registers query param binding with custom default value", () => {
    const props = getProps({
      queryParamKey: "bio",
      default: "initial bio",
    })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<TextArea {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "bio",
      "string_value",
      "initial bio",
      true,
      undefined
    )
  })

  it("does not write an empty value to the URL on a blocked required commit", async () => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [400],
    })
    const user = userEvent.setup()
    const props = getProps({
      queryParamKey: "my_text",
      required: true,
      default: "hello",
    })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextArea {...props} />)
    setStringValueSpy.mockClear()

    try {
      const textArea = screen.getByRole("textbox")
      await user.type(textArea, "2")
      await user.tab()
      expect(setStringValueSpy).toHaveBeenCalledWith(
        props.element.id,
        "hello2",
        expect.objectContaining({ fromUser: true })
      )
      expect(window.location.search).toContain("my_text=hello2")

      await user.clear(textArea)
      await user.tab()

      expect(setStringValueSpy).not.toHaveBeenCalledWith(
        props.element.id,
        "",
        expect.anything()
      )
      expect(window.location.search).toContain("my_text=hello2")
      expect(screen.getByRole("alert")).toHaveTextContent(
        "This field is required."
      )
    } finally {
      window.history.replaceState({}, "", window.location.pathname)
    }
  })
})

describe("on_change='ignore' mode", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Let a scheduled rerun flush before asserting whether one was sent.
  async function flushScheduledRerun(): Promise<void> {
    await act(async () => {
      await new Promise(resolve => {
        setTimeout(resolve, 0)
      })
    })
  }

  it("passes triggerRerun: false when ignoreRerun is true", async () => {
    const user = userEvent.setup()
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    const props = getProps({ ignoreRerun: true }, { widgetMgr })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextArea {...props} />)
    setStringValueSpy.mockClear()
    sendRerunBackMsg.mockClear()

    await user.type(screen.getByRole("textbox"), "testing")
    await user.tab()

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
    await flushScheduledRerun()
    expect(sendRerunBackMsg).not.toHaveBeenCalled()
  })

  it("does not pass triggerRerun when ignoreRerun is false", async () => {
    const user = userEvent.setup()
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    const props = getProps({ ignoreRerun: false }, { widgetMgr })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextArea {...props} />)
    setStringValueSpy.mockClear()
    sendRerunBackMsg.mockClear()

    await user.type(screen.getByRole("textbox"), "testing")
    await user.tab()

    expect(setStringValueSpy).toHaveBeenCalledWith(
      props.element.id,
      "testing",
      {
        formId: props.element.formId,
        fragmentId: undefined,
        fromUser: true,
      }
    )
    await flushScheduledRerun()
    expect(sendRerunBackMsg).toHaveBeenCalled()
  })

  it("does not change form batching when ignoreRerun is true", async () => {
    const user = userEvent.setup()
    const sendRerunBackMsg = vi.fn()
    let pendingFormIds = new Set<string>()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(newData => {
        pendingFormIds = newData.formsWithPendingChanges
      }),
    })
    const props = getProps(
      {
        ignoreRerun: true,
        formId: "testForm",
      },
      { widgetMgr }
    )
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextArea {...props} />)
    setStringValueSpy.mockClear()
    sendRerunBackMsg.mockClear()

    await user.type(screen.getByRole("textbox"), "a")

    expect(setStringValueSpy).toHaveBeenCalledWith(props.element.id, "a", {
      formId: "testForm",
      fragmentId: undefined,
      fromUser: true,
      triggerRerun: false,
    })
    await flushScheduledRerun()
    expect(sendRerunBackMsg).not.toHaveBeenCalled()
    expect(pendingFormIds).toEqual(new Set(["testForm"]))
  })

  it("does not commit on keystroke outside a form when ignoreRerun is true", async () => {
    const user = userEvent.setup()
    const props = getProps({ ignoreRerun: true })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextArea {...props} />)
    setStringValueSpy.mockClear()

    await user.type(screen.getByRole("textbox"), "hello")

    expect(setStringValueSpy).not.toHaveBeenCalled()
  })

  it("passes triggerRerun: false when ctrl+enter is pressed", async () => {
    const user = userEvent.setup()
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    const props = getProps({ ignoreRerun: true }, { widgetMgr })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextArea {...props} />)
    setStringValueSpy.mockClear()
    sendRerunBackMsg.mockClear()

    await user.type(screen.getByRole("textbox"), "testing")
    await user.keyboard("{Control>}{Enter}")

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
    await flushScheduledRerun()
    expect(sendRerunBackMsg).not.toHaveBeenCalled()
  })

  it("keeps the last accepted ignore value when a required empty commit is blocked", async () => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [400],
    })
    const user = userEvent.setup()
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    const props = getProps(
      { required: true, ignoreRerun: true },
      { widgetMgr }
    )
    const setStringValueSpy = vi.spyOn(widgetMgr, "setStringValue")
    render(<TextArea {...props} />)
    setStringValueSpy.mockClear()

    const textArea = screen.getByRole("textbox")
    await user.type(textArea, "world")
    await user.keyboard("{Control>}{Enter}{/Control}")
    expect(setStringValueSpy).toHaveBeenCalledWith(props.element.id, "world", {
      formId: props.element.formId,
      fragmentId: undefined,
      fromUser: true,
      triggerRerun: false,
    })

    await user.clear(textArea)
    await user.tab()

    expect(setStringValueSpy).not.toHaveBeenCalledWith(
      props.element.id,
      "",
      expect.anything()
    )
    expect(widgetMgr.getStringValue(props.element)).toBe("world")
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This field is required."
    )
    await flushScheduledRerun()
    expect(sendRerunBackMsg).not.toHaveBeenCalled()
  })
})
