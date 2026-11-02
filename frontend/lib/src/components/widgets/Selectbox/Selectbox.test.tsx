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
import userEvent from "@testing-library/user-event"

import { Selectbox as SelectboxProto } from "@streamlit/protobuf"

import { REQUIRED_FIELD_MESSAGE } from "~lib/components/widgets/BaseWidget/requiredField"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Selectbox, { type Props } from "./Selectbox"

const getProps = (
  elementProps: Partial<SelectboxProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: SelectboxProto.create({
    id: "1",
    label: "Label",
    default: 0,
    options: ["a", "b", "c"],
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...widgetProps,
})

const pickOption = async (
  _selectbox: HTMLElement,
  value: string
): Promise<void> => {
  const user = userEvent.setup()
  // Click the open button to open the dropdown
  const openButton = screen.getByRole("button", { name: "Open" })
  await user.click(openButton)
  // Find the desired option by role and click it
  const valueElement = screen.getByRole("option", { name: value })
  await user.click(valueElement)
  // Click outside the widget to close the dropdown
  await user.click(document.body)
}

describe("Selectbox widget", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<Selectbox {...props} />)
    const selectbox = screen.getByTestId("stSelectbox")
    expect(selectbox).toBeInTheDocument()
    expect(selectbox).toHaveClass("stSelectbox")
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Selectbox {...props} />)
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.id,
      props.element.options[props.element.default ?? 0],
      { formId: props.element.formId, fragmentId: undefined, fromUser: false }
    )
  })

  it("gets correct value from proto", () => {
    const props = getProps({
      rawValue: "c",
      setValue: true,
    })
    render(<Selectbox {...props} />)

    expect(screen.getByDisplayValue("c")).toBeVisible()
  })

  it("can pass fragmentId to setStringValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Selectbox {...props} />)
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element.id,
      props.element.options[props.element.default ?? 0],
      {
        formId: props.element.formId,
        fragmentId: "myFragmentId",
        fromUser: false,
      }
    )
  })

  it("handles the onChange event", async () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Selectbox {...props} />)

    const selectbox = screen.getByRole("combobox")

    await pickOption(selectbox, "b")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element.id,
      "b",
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )
    expect(screen.getByDisplayValue("b")).toBeVisible()
  })

  it("resets its value when form is cleared", async () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Selectbox {...props} />)

    const selectbox = screen.getByRole("combobox")
    await pickOption(selectbox, "b")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element.id,
      "b",
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )

    // "Submit" the form
    act(() => {
      props.widgetMgr.submitForm("form", undefined)
    })

    // Our widget should be reset, and the widgetMgr should be updated
    await waitFor(() => {
      expect(screen.getByDisplayValue("a")).toBeVisible()
    })
    expect(screen.queryByDisplayValue("b")).not.toBeInTheDocument()
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element.id,
      props.element.options[props.element.default ?? 0],
      { formId: props.element.formId, fragmentId: undefined, fromUser: true }
    )
  })

  it("renders a placeholder with null default", () => {
    const props = getProps({
      placeholder: "Please select an option...",
      default: null,
    })
    render(<Selectbox {...props} />)

    expect(
      screen.getByPlaceholderText("Please select an option...")
    ).toBeInTheDocument()
  })
})

describe("Selectbox query param binding", () => {
  it("registers query param binding on mount when queryParamKey is set", () => {
    const props = getProps({ queryParamKey: "my_select" })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<Selectbox {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_select",
      "string_value",
      "a",
      false,
      undefined
    )
  })

  it("unregisters query param binding on unmount", () => {
    const props = getProps({ queryParamKey: "my_select" })
    const unregisterSpy = vi.spyOn(
      props.widgetMgr,
      "unregisterQueryParamBinding"
    )

    const { unmount } = render(<Selectbox {...props} />)

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

    render(<Selectbox {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).not.toHaveBeenCalled()
  })

  it("registers with clearable=true when no default", () => {
    const props = getProps({ queryParamKey: "my_select", default: null })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<Selectbox {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_select",
      "string_value",
      null,
      true,
      undefined
    )
  })
})

describe("Selectbox required", () => {
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

  /** Renders two empty required selectboxes in one form; returns their roots. */
  function renderRequiredFormPair(
    widgetMgr: WidgetStateManager
  ): [HTMLElement, HTMLElement] {
    render(
      <>
        <Selectbox
          {...getProps(
            { id: "first", formId: "form", default: null, required: true },
            { widgetMgr }
          )}
        />
        <Selectbox
          {...getProps(
            { id: "second", formId: "form", default: null, required: true },
            { widgetMgr }
          )}
        />
      </>
    )
    const [first, second] = screen.getAllByTestId("stSelectbox")
    return [first, second]
  }

  /** Pick an option in the selectbox rendered inside `root`. */
  async function pickOptionIn(
    root: HTMLElement,
    value: string
  ): Promise<void> {
    const user = userEvent.setup()
    await user.click(within(root).getByRole("button", { name: "Open" }))
    await user.click(screen.getByRole("option", { name: value }))
    await user.click(document.body)
  }

  function expectRequiredError(root: HTMLElement): void {
    const scope = within(root)
    expect(scope.getByTestId("stSelectboxErrorIcon")).toBeVisible()
    const alert = scope.getByRole("alert")
    expect(alert).toHaveTextContent(REQUIRED_FIELD_MESSAGE)
    const input = scope.getByRole("combobox")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(
      alert.getAttribute("id")
    )
  }

  function expectNoRequiredError(root: HTMLElement): void {
    const scope = within(root)
    expect(scope.queryByTestId("stSelectboxErrorIcon")).not.toBeInTheDocument()
    expect(scope.queryByRole("alert")).not.toBeInTheDocument()
    expect(scope.getByRole("combobox")).not.toHaveAttribute("aria-invalid")
  }

  it("shows the marker and aria-required without an error on initial render", () => {
    render(<Selectbox {...getProps({ default: null, required: true })} />)

    const selectbox = screen.getByTestId("stSelectbox")
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-required",
      "true"
    )
    expect(screen.getByTestId("stWidgetLabelRequired")).toBeVisible()
    expectNoRequiredError(selectbox)
  })

  it("sets aria-required and the marker only when required is true", () => {
    render(<Selectbox {...getProps({ default: null, required: false })} />)

    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-required")
    expect(
      screen.queryByTestId("stWidgetLabelRequired")
    ).not.toBeInTheDocument()
  })

  it("hides the clear button after a selection when required", async () => {
    const props = getProps({ default: null, required: true })
    render(<Selectbox {...props} />)

    await pickOptionIn(screen.getByTestId("stSelectbox"), "b")

    expect(screen.getByDisplayValue("b")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Clear value" })
    ).not.toBeInTheDocument()
  })

  it("keeps the clear button after a selection when not required", async () => {
    const props = getProps({ default: null, required: false })
    render(<Selectbox {...props} />)

    await pickOptionIn(screen.getByTestId("stSelectbox"), "b")

    expect(screen.getByRole("button", { name: "Clear value" })).toBeVisible()
  })

  it("does not clear a required selection on Escape", async () => {
    const user = userEvent.setup()
    const props = getProps({ default: null, required: true })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    render(<Selectbox {...props} />)

    await pickOptionIn(screen.getByTestId("stSelectbox"), "b")
    const input = screen.getByRole("combobox")
    await user.click(input)
    await user.keyboard("{Escape}")

    expect(input).toHaveValue("b")
    expect(setStringValueSpy).toHaveBeenLastCalledWith(
      props.element.id,
      "b",
      expect.objectContaining({ fromUser: true })
    )
    expect(setStringValueSpy).not.toHaveBeenCalledWith(
      props.element.id,
      null,
      expect.objectContaining({ fromUser: true })
    )
  })

  it("does not register a form submit validator outside a form", () => {
    const props = getProps({ default: null, required: true })
    const addValidatorSpy = vi.spyOn(props.widgetMgr, "addFormSubmitValidator")
    render(<Selectbox {...props} />)

    expect(addValidatorSpy).not.toHaveBeenCalled()
    expectNoRequiredError(screen.getByTestId("stSelectbox"))
  })

  it("blocks a form submit and shows an error on every empty required field", () => {
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    const [first, second] = renderRequiredFormPair(widgetMgr)

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })

    expect(sendRerunBackMsg).not.toHaveBeenCalled()
    expectRequiredError(first)
    expectRequiredError(second)
  })

  it("clears a field's error on selection and submits once every field is filled", async () => {
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    const [first, second] = renderRequiredFormPair(widgetMgr)

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })
    expectRequiredError(first)

    await pickOptionIn(first, "b")
    expectNoRequiredError(first)
    expectRequiredError(second)

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })
    expect(sendRerunBackMsg).not.toHaveBeenCalled()
    expectNoRequiredError(first)

    await pickOptionIn(second, "c")
    act(() => {
      widgetMgr.submitForm("form", undefined)
    })

    expect(sendRerunBackMsg).toHaveBeenCalledTimes(1)
    expectNoRequiredError(second)
  })

  it("does not clear form values when a required submit fails", async () => {
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    widgetMgr.setFormSubmitBehaviors("form", true)
    const [filled, empty] = renderRequiredFormPair(widgetMgr)
    await pickOptionIn(filled, "b")

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })

    expect(sendRerunBackMsg).not.toHaveBeenCalled()
    expect(within(filled).getByRole("combobox")).toHaveValue("b")
    expectNoRequiredError(filled)
    expectRequiredError(empty)
  })

  it("clears a submitted required form without an error and gates the next submit", async () => {
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    widgetMgr.setFormSubmitBehaviors("form", true)
    render(
      <Selectbox
        {...getProps(
          { formId: "form", default: null, required: true },
          { widgetMgr }
        )}
      />
    )
    const selectbox = screen.getByTestId("stSelectbox")
    await pickOptionIn(selectbox, "b")

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })

    expect(sendRerunBackMsg).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("")
    })
    expectNoRequiredError(selectbox)

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })
    expect(sendRerunBackMsg).toHaveBeenCalledTimes(1)
    expectRequiredError(selectbox)
  })

  it("does not gate a form submit when required is false", () => {
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    render(
      <Selectbox
        {...getProps(
          { formId: "form", default: null, required: false },
          { widgetMgr }
        )}
      />
    )

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })

    expect(sendRerunBackMsg).toHaveBeenCalledTimes(1)
    expectNoRequiredError(screen.getByTestId("stSelectbox"))
  })

  it("blocks a form submit when a disabled required field is empty", () => {
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    render(
      <Selectbox
        {...getProps(
          { formId: "form", default: null, required: true },
          { widgetMgr, disabled: true }
        )}
      />
    )

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })

    expect(sendRerunBackMsg).not.toHaveBeenCalled()
    expectRequiredError(screen.getByTestId("stSelectbox"))
  })

  it("clears a leftover error when required is turned off and does not bring it back", () => {
    const { widgetMgr } = createWidgetMgr()
    const props = getProps(
      { formId: "form", default: null, required: true },
      { widgetMgr }
    )
    const { rerender } = render(<Selectbox {...props} />)
    const selectbox = screen.getByTestId("stSelectbox")

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })
    expectRequiredError(selectbox)

    rerender(
      <Selectbox
        {...props}
        element={SelectboxProto.create({ ...props.element, required: false })}
      />
    )
    expectNoRequiredError(selectbox)
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-required")

    rerender(
      <Selectbox
        {...props}
        element={SelectboxProto.create({ ...props.element, required: true })}
      />
    )
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-required",
      "true"
    )
    expectNoRequiredError(selectbox)
  })

  it("clears a leftover error after a session_state fill and does not bring it back on a programmatic clear", async () => {
    const { widgetMgr } = createWidgetMgr()
    const props = getProps(
      { formId: "form", default: null, required: true },
      { widgetMgr }
    )
    const { rerender } = render(<Selectbox {...props} />)
    const selectbox = screen.getByTestId("stSelectbox")

    act(() => {
      widgetMgr.submitForm("form", undefined)
    })
    expectRequiredError(selectbox)

    rerender(
      <Selectbox
        {...props}
        element={SelectboxProto.create({
          ...props.element,
          setValue: true,
          rawValue: "b",
        })}
      />
    )
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("b")
    })
    expectNoRequiredError(selectbox)

    rerender(
      <Selectbox
        {...props}
        element={SelectboxProto.create({ ...props.element, setValue: true })}
      />
    )
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("")
    })
    expectNoRequiredError(selectbox)
  })

  it("deregisters the form submit validator on unmount", () => {
    const { sendRerunBackMsg, widgetMgr } = createWidgetMgr()
    const props = getProps(
      { formId: "form", default: null, required: true },
      { widgetMgr }
    )
    const { unmount } = render(<Selectbox {...props} />)

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

  it("keeps an ignore-buffered selection when Escape is pressed", async () => {
    const user = userEvent.setup()
    const props = getProps({
      default: null,
      required: true,
      ignoreRerun: true,
    })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    render(<Selectbox {...props} />)

    await pickOptionIn(screen.getByTestId("stSelectbox"), "b")
    await user.click(screen.getByRole("combobox"))
    await user.keyboard("{Escape}")

    expect(setStringValueSpy).toHaveBeenLastCalledWith(props.element.id, "b", {
      formId: props.element.formId,
      fragmentId: undefined,
      fromUser: true,
      triggerRerun: false,
    })
    expect(setStringValueSpy).not.toHaveBeenCalledWith(
      props.element.id,
      null,
      expect.objectContaining({ fromUser: true })
    )
  })

  it("keeps the query param binding clearable but never writes null from the UI", async () => {
    const user = userEvent.setup()
    const props = getProps({
      queryParamKey: "required_select",
      default: null,
      required: true,
    })
    const registerSpy = vi.spyOn(props.widgetMgr, "registerQueryParamBinding")
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    render(<Selectbox {...props} />)

    expect(registerSpy).toHaveBeenCalledWith(
      props.element.id,
      "required_select",
      "string_value",
      null,
      true,
      undefined
    )

    await pickOptionIn(screen.getByTestId("stSelectbox"), "b")
    await user.click(screen.getByRole("combobox"))
    await user.keyboard("{Escape}")

    expect(setStringValueSpy).not.toHaveBeenCalledWith(
      props.element.id,
      null,
      expect.objectContaining({ fromUser: true })
    )
    expect(setStringValueSpy).toHaveBeenLastCalledWith(
      props.element.id,
      "b",
      expect.objectContaining({ fromUser: true })
    )
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
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    const props = getProps({ ignoreRerun: true }, { widgetMgr })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Selectbox {...props} />)
    setStringValueSpy.mockClear()
    sendRerunBackMsg.mockClear()

    const selectbox = screen.getByRole("combobox")
    await pickOption(selectbox, "b")

    expect(setStringValueSpy).toHaveBeenLastCalledWith(props.element.id, "b", {
      formId: props.element.formId,
      fragmentId: undefined,
      fromUser: true,
      triggerRerun: false,
    })
    await flushScheduledRerun()
    expect(sendRerunBackMsg).not.toHaveBeenCalled()
  })

  it("does not pass triggerRerun when ignoreRerun is false", async () => {
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    const props = getProps({ ignoreRerun: false }, { widgetMgr })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Selectbox {...props} />)
    setStringValueSpy.mockClear()
    sendRerunBackMsg.mockClear()

    const selectbox = screen.getByRole("combobox")
    await pickOption(selectbox, "b")

    expect(setStringValueSpy).toHaveBeenLastCalledWith(props.element.id, "b", {
      formId: props.element.formId,
      fragmentId: undefined,
      fromUser: true,
    })
    await flushScheduledRerun()
    expect(sendRerunBackMsg).toHaveBeenCalled()
  })

  it("does not change form batching when ignoreRerun is true", async () => {
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

    render(<Selectbox {...props} />)
    setStringValueSpy.mockClear()
    sendRerunBackMsg.mockClear()

    const selectbox = screen.getByRole("combobox")
    await pickOption(selectbox, "b")

    expect(setStringValueSpy).toHaveBeenLastCalledWith(props.element.id, "b", {
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

    render(<Selectbox {...props} />)
    setStringValueSpy.mockClear()

    const selectbox = screen.getByRole("combobox")
    await user.click(selectbox)
    await user.type(selectbox, "b")

    expect(setStringValueSpy).not.toHaveBeenCalled()
  })

  it("passes triggerRerun: false when clear is clicked", async () => {
    const user = userEvent.setup()
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    const props = getProps({ ignoreRerun: true, default: null }, { widgetMgr })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Selectbox {...props} />)
    setStringValueSpy.mockClear()
    sendRerunBackMsg.mockClear()

    const selectbox = screen.getByRole("combobox")
    await pickOption(selectbox, "a")
    setStringValueSpy.mockClear()
    sendRerunBackMsg.mockClear()

    await user.click(screen.getByRole("button", { name: "Clear value" }))

    expect(setStringValueSpy).toHaveBeenLastCalledWith(
      props.element.id,
      null,
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

  it("passes triggerRerun: false when a new option is committed with Enter", async () => {
    const user = userEvent.setup()
    const sendRerunBackMsg = vi.fn()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg,
      formsDataChanged: vi.fn(),
    })
    const props = getProps(
      {
        ignoreRerun: true,
        acceptNewOptions: true,
        default: null,
      },
      { widgetMgr }
    )
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

    render(<Selectbox {...props} />)
    setStringValueSpy.mockClear()
    sendRerunBackMsg.mockClear()

    const selectboxInput = screen.getByRole("combobox")
    await user.type(selectboxInput, "hello world!")
    await user.keyboard("{enter}")

    expect(setStringValueSpy).toHaveBeenLastCalledWith(
      props.element.id,
      "hello world!",
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
})
