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

import { act, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import {
  ButtonGroup as ButtonGroupProto,
  LabelVisibility as LabelVisibilityProto,
} from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import ButtonGroup, { Props } from "./ButtonGroup"

const materialIconNames = ["icon", "icon_2", "icon_3", "icon_4"]
const defaultSelectedIndex = 2

/** Asserts that a button is visually selected (data-selected attribute present) or not. */
const expectHighlightStyle = (
  element: HTMLElement,
  should_exist = true
): void => {
  if (should_exist) {
    expect(element).toHaveAttribute("data-selected")
  } else {
    expect(element).not.toHaveAttribute("data-selected")
  }
}

/**
 * Returns all <button> elements within the stButtonGroup container.
 * React Aria renders ToggleButton as role="radio" (single-select) or
 * role="checkbox" (multi-select), so querying by role="button" won't work.
 * We query actual <button> DOM elements instead.
 */
const getButtonGroupButtons = (): HTMLElement[] => {
  const buttonGroupWidget = screen.getByTestId("stButtonGroup")
  return Array.from(buttonGroupWidget.querySelectorAll("button"))
}

// options where content is only a material icon
const materialIconOnlyOptions = [
  ButtonGroupProto.Option.create({
    contentIcon: `:material/${materialIconNames[0]}:`,
  }),
  ButtonGroupProto.Option.create({
    contentIcon: `:material/${materialIconNames[1]}:`,
  }),
  ButtonGroupProto.Option.create({
    contentIcon: `:material/${materialIconNames[2]}:`,
  }),
  ButtonGroupProto.Option.create({
    contentIcon: `:material/${materialIconNames[3]}:`,
  }),
]

const options = [
  ButtonGroupProto.Option.create({
    content: `Some text: ${materialIconNames[0]}:`,
    contentIcon: "🔥",
  }),
  ButtonGroupProto.Option.create({
    content: `Some other text: ${materialIconNames[1]}:`,
    contentIcon: `:material/${materialIconNames[1]}:`,
  }),
]

const getProps = (
  elementProps: Partial<ButtonGroupProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: ButtonGroupProto.create({
    id: "1",
    clickMode: ButtonGroupProto.ClickMode.SINGLE_SELECT,
    default: [defaultSelectedIndex],
    disabled: false,
    label: "My ButtonGroup label",
    options: [...materialIconOnlyOptions, ...options],
    style: ButtonGroupProto.Style.SEGMENTED_CONTROL,
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  widthConfig: {
    useContent: true,
  },
  ...widgetProps,
})
const EXPECTED_BUTTONS_LENGTH = materialIconOnlyOptions.length + options.length

describe("ButtonGroup widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<ButtonGroup {...props} />)

    const buttonGroupWidget = screen.getByTestId("stButtonGroup")
    expect(buttonGroupWidget).toBeInTheDocument()
    expect(buttonGroupWidget).toHaveClass("stButtonGroup")
  })

  it("option-children with material-icon render correctly", () => {
    const props = getProps({ default: [], options: materialIconOnlyOptions })
    render(<ButtonGroup {...props} />)

    const buttons = getButtonGroupButtons()
    expect(buttons).toHaveLength(materialIconOnlyOptions.length)
    buttons.forEach((button, index) => {
      expect(button).toHaveAttribute("data-variant", "segmented_control")
      const icon = within(button).getByTestId("stIconMaterial")
      expect(icon.textContent).toContain(materialIconNames[index])
    })
  })

  it("option-children with contentIcon render correctly", () => {
    const props = getProps({
      default: [],
      options: options,
      style: ButtonGroupProto.Style.SEGMENTED_CONTROL,
    })
    render(<ButtonGroup {...props} />)

    const buttonGroupWidget = screen.getByTestId("stButtonGroup")
    const buttons = Array.from(buttonGroupWidget.querySelectorAll("button"))
    expect(buttons).toHaveLength(options.length)

    let button = buttons[0]
    expect(button).toHaveAttribute("data-variant", "segmented_control")
    let text = within(button).getByTestId("stMarkdownContainer")
    expect(text.textContent).toContain(materialIconNames[0])
    let icon = within(button).getByTestId("stIconEmoji")
    expect(icon.textContent).toContain("🔥")

    button = buttons[1]
    expect(button).toHaveAttribute("data-variant", "segmented_control")
    text = within(button).getByTestId("stMarkdownContainer")
    expect(text.textContent).toContain(materialIconNames[1])
    icon = within(button).getByTestId("stIconMaterial")
    expect(icon.textContent).toContain(materialIconNames[1])
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<ButtonGroup {...props} />)
    // defaultSelectedIndex=2 corresponds to `:material/icon_3:`
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [`:material/${materialIconNames[defaultSelectedIndex]}:`],
      {
        fromUi: false,
      },
      undefined
    )
  })

  describe("ButtonGroup props should work", () => {
    it("renders with empty options", () => {
      const props = getProps({ default: [], options: [] })
      render(<ButtonGroup {...props} />)

      const buttonGroup = screen.getByTestId("stButtonGroup")
      expect(buttonGroup).toBeInTheDocument()
      const buttons = Array.from(buttonGroup.querySelectorAll("button"))
      expect(buttons).toHaveLength(0)
    })

    it("onClick prop for single select", async () => {
      const user = userEvent.setup()
      const props = getProps()
      vi.spyOn(props.widgetMgr, "setStringArrayValue")

      render(<ButtonGroup {...props} />)

      const buttons = getButtonGroupButtons()
      expect(buttons).toHaveLength(EXPECTED_BUTTONS_LENGTH)
      // defaultSelectedIndex=2 corresponds to `:material/icon_3:`
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [`:material/${materialIconNames[defaultSelectedIndex]}:`],
        { fromUi: false },
        undefined
      )
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledTimes(1)

      // click element at index 1 to select it
      await user.click(buttons[1])
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [`:material/${materialIconNames[1]}:`],
        { fromUi: true },
        undefined
      )
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledTimes(2)

      // click element at index 0 to select it
      await user.click(getButtonGroupButtons()[0])
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [`:material/${materialIconNames[0]}:`],
        { fromUi: true },
        undefined
      )
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledTimes(3)

      // click on same button does deselect it
      await user.click(getButtonGroupButtons()[0])
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [],
        { fromUi: true },
        undefined
      )
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledTimes(4)
    })

    it("onClick prop for multi select", async () => {
      const user = userEvent.setup()
      const props = getProps({
        clickMode: ButtonGroupProto.ClickMode.MULTI_SELECT,
      })
      vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<ButtonGroup {...props} />)

      const buttons = getButtonGroupButtons()
      // defaultSelectedIndex=2 corresponds to `:material/icon_3:`
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [`:material/${materialIconNames[defaultSelectedIndex]}:`],
        { fromUi: false },
        undefined
      )

      await user.click(buttons[1])
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        // the defaultSelectedIndex is default value, index 1 is newly clicked
        [
          `:material/${materialIconNames[defaultSelectedIndex]}:`,
          `:material/${materialIconNames[1]}:`,
        ],
        { fromUi: true },
        undefined
      )

      await user.click(getButtonGroupButtons()[0])
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [
          `:material/${materialIconNames[defaultSelectedIndex]}:`,
          `:material/${materialIconNames[1]}:`,
          `:material/${materialIconNames[0]}:`,
        ],
        { fromUi: true },
        undefined
      )

      // unselect the second button
      await user.click(getButtonGroupButtons()[1])
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [
          `:material/${materialIconNames[defaultSelectedIndex]}:`,
          `:material/${materialIconNames[0]}:`,
        ],
        { fromUi: true },
        undefined
      )
    })

    it("passes fragmentId to onClick prop", async () => {
      const user = userEvent.setup()
      const props = getProps(
        {},
        {
          fragmentId: "myFragmentId",
        }
      )
      vi.spyOn(props.widgetMgr, "setStringArrayValue")
      render(<ButtonGroup {...props} />)

      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [`:material/${materialIconNames[defaultSelectedIndex]}:`],
        { fromUi: false },
        "myFragmentId"
      )

      const button = getButtonGroupButtons()[0]
      await user.click(button)
      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [`:material/${materialIconNames[0]}:`],
        { fromUi: true },
        "myFragmentId"
      )
    })

    it("can be disabled", () => {
      const props = getProps({}, { disabled: true })
      render(<ButtonGroup {...props} />)

      const buttons = getButtonGroupButtons()
      expect(buttons).toHaveLength(EXPECTED_BUTTONS_LENGTH)
      buttons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })

    it("sets widget value on update", () => {
      // Use rawValues with string values instead of value with indices
      const props = getProps({
        rawValues: [`:material/${materialIconNames[3]}:`],
        setValue: true,
      })
      vi.spyOn(props.widgetMgr, "setStringArrayValue")

      render(<ButtonGroup {...props} />)
      const buttons = getButtonGroupButtons()
      expectHighlightStyle(buttons[3])
      expectHighlightStyle(buttons[defaultSelectedIndex], false)

      expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
        props.element,
        [`:material/${materialIconNames[3]}:`],
        {
          fromUi: false,
        },
        undefined
      )
    })

    it("renders correct pills button style", () => {
      const props = getProps({
        default: [],
        options: options,
        style: ButtonGroupProto.Style.PILLS,
      })
      render(<ButtonGroup {...props} />)

      const buttons = getButtonGroupButtons()
      expect(buttons).toHaveLength(options.length)
      buttons.forEach(button => {
        expect(button).toHaveAttribute("data-variant", "pills")
      })
    })

    it("renders correct segmented control button style", () => {
      const props = getProps({
        default: [],
        options: options,
        style: ButtonGroupProto.Style.SEGMENTED_CONTROL,
      })
      render(<ButtonGroup {...props} />)

      const buttons = getButtonGroupButtons()
      expect(buttons).toHaveLength(options.length)
      buttons.forEach(button => {
        expect(button).toHaveAttribute("data-variant", "segmented_control")
      })
    })

    it("renders a label", () => {
      const props = getProps()
      render(<ButtonGroup {...props} />)

      const widgetLabel = screen.queryByText(`${props.element.label}`)
      expect(widgetLabel).toBeInTheDocument()
    })

    it("passes labelVisibility prop correctly when hidden", () => {
      const props = getProps({
        labelVisibility: {
          value: LabelVisibilityProto.LabelVisibilityOptions.HIDDEN,
        },
      })
      render(<ButtonGroup {...props} />)
      expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
        "visibility: hidden"
      )
    })

    it("passes labelVisibility prop correctly when collapsed", () => {
      const props = getProps({
        labelVisibility: {
          value: LabelVisibilityProto.LabelVisibilityOptions.COLLAPSED,
        },
      })
      render(<ButtonGroup {...props} />)
      expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
    })

    it("renders help prop correctly", async () => {
      const user = userEvent.setup()
      const props = getProps({
        help: "help text",
      })
      render(<ButtonGroup {...props} />)
      const tooltip = screen.getByTestId("stTooltipHoverTarget")
      expect(tooltip).toBeInTheDocument()

      await user.hover(tooltip)
      const helpText = await screen.findByText("help text")
      expect(helpText).toBeInTheDocument()
    })

    // eslint-disable-next-line vitest/expect-expect
    it("visualizes only selected option", async () => {
      const user = userEvent.setup()
      const props = getProps()
      render(<ButtonGroup {...props} />)

      await user.click(getButtonGroupButtons()[0])
      const buttons = getButtonGroupButtons()
      expectHighlightStyle(buttons[0])
      expectHighlightStyle(buttons[1], false)
      expectHighlightStyle(buttons[2], false)
    })

    it("shows icons with correct size for segmented control ButtonGroup", () => {
      const props = getProps({
        default: [],
        options: materialIconOnlyOptions,
        style: ButtonGroupProto.Style.SEGMENTED_CONTROL,
      })
      render(<ButtonGroup {...props} />)
      const buttons = getButtonGroupButtons()
      buttons.forEach((button, index) => {
        expect(button).toHaveAttribute("data-variant", "segmented_control")
        const icon = within(button).getByTestId("stIconMaterial")
        expect(icon.textContent).toContain(materialIconNames[index])
        expect(icon).toHaveStyle("width: 1rem")
      })
    })
  })

  it("resets its value when form is cleared", async () => {
    const user = userEvent.setup()
    // Create a widget in a clearOnSubmit form
    const props = getProps({
      formId: "form",
      clickMode: ButtonGroupProto.ClickMode.MULTI_SELECT,
    })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<ButtonGroup {...props} />)

    // Change the widget value
    // de-select default value
    await user.click(getButtonGroupButtons()[0])
    await user.click(getButtonGroupButtons()[1])
    let buttons = getButtonGroupButtons()
    expectHighlightStyle(buttons[0])
    expectHighlightStyle(buttons[1])
    expectHighlightStyle(buttons[2])
    expectHighlightStyle(buttons[3], false)

    // "Submit" the form
    act(() => props.widgetMgr.submitForm("form", undefined))

    buttons = getButtonGroupButtons()
    // default option selected
    expectHighlightStyle(buttons[0], false)
    expectHighlightStyle(buttons[1], false)
    expectHighlightStyle(buttons[2])
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenLastCalledWith(
      props.element,
      [`:material/${materialIconNames[defaultSelectedIndex]}:`],
      { fromUi: true },
      undefined
    )
  })
})

describe("ButtonGroup query param binding", () => {
  const simpleOptions = [
    ButtonGroupProto.Option.create({ content: "cat" }),
    ButtonGroupProto.Option.create({ content: "dog" }),
    ButtonGroupProto.Option.create({ content: "bird" }),
  ]

  it("registers query param binding when queryParamKey is set", () => {
    const props = getProps({
      queryParamKey: "my_pills",
      options: simpleOptions,
      default: [0],
      style: ButtonGroupProto.Style.PILLS,
    })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<ButtonGroup {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_pills",
      "string_array_value",
      ["cat"],
      true,
      "repeated"
    )
  })

  it("unregisters query param binding on unmount", () => {
    const props = getProps({
      queryParamKey: "my_pills",
      options: simpleOptions,
      default: [0],
    })
    const unregisterSpy = vi.spyOn(
      props.widgetMgr,
      "unregisterQueryParamBinding"
    )

    const { unmount } = render(<ButtonGroup {...props} />)

    unregisterSpy.mockClear()

    unmount()

    expect(props.widgetMgr.unregisterQueryParamBinding).toHaveBeenCalledWith(
      props.element.id
    )
  })

  it("registers query param binding for multi-select with same config", () => {
    const props = getProps({
      queryParamKey: "my_multi_pills",
      options: simpleOptions,
      default: [0, 2],
      clickMode: ButtonGroupProto.ClickMode.MULTI_SELECT,
      style: ButtonGroupProto.Style.PILLS,
    })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<ButtonGroup {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      props.element.id,
      "my_multi_pills",
      "string_array_value",
      ["cat", "bird"],
      true,
      "repeated"
    )
  })

  it("does not register query param binding when queryParamKey is not set", () => {
    const props = getProps({ options: simpleOptions, default: [0] })
    vi.spyOn(props.widgetMgr, "registerQueryParamBinding")

    render(<ButtonGroup {...props} />)

    expect(props.widgetMgr.registerQueryParamBinding).not.toHaveBeenCalled()
  })
})

describe("ButtonGroup required parameter", () => {
  const simpleOptions = [
    ButtonGroupProto.Option.create({ content: "apple" }),
    ButtonGroupProto.Option.create({ content: "banana" }),
    ButtonGroupProto.Option.create({ content: "cherry" }),
  ]

  it("allows deselection when required=false (default)", async () => {
    const user = userEvent.setup()
    const props = getProps({
      options: simpleOptions,
      default: [0],
      required: false,
    })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<ButtonGroup {...props} />)

    const buttons = getButtonGroupButtons()

    // Click the already-selected button (apple) to deselect it
    await user.click(buttons[0])

    // Should have been called with empty array (deselected)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenLastCalledWith(
      props.element,
      [],
      { fromUi: true },
      undefined
    )
  })

  it("prevents deselection when required=true in single-select mode", async () => {
    const user = userEvent.setup()
    const props = getProps({
      clickMode: ButtonGroupProto.ClickMode.SINGLE_SELECT,
      options: simpleOptions,
      default: [0],
      required: true,
    })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<ButtonGroup {...props} />)

    // Initial mount call
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledTimes(1)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenLastCalledWith(
      props.element,
      ["apple"],
      { fromUi: false },
      undefined
    )

    const buttons = getButtonGroupButtons()

    // Click the already-selected button (apple) to try to deselect it
    await user.click(buttons[0])

    // No additional call should have been made - click was a no-op
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledTimes(1)
  })

  it("allows changing selection when required=true in single-select mode", async () => {
    const user = userEvent.setup()
    const props = getProps({
      clickMode: ButtonGroupProto.ClickMode.SINGLE_SELECT,
      options: simpleOptions,
      default: [0],
      required: true,
    })
    vi.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<ButtonGroup {...props} />)

    const buttons = getButtonGroupButtons()

    // Click a different button (banana) - this should work
    await user.click(buttons[1])

    // Should have changed to "banana"
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenLastCalledWith(
      props.element,
      ["banana"],
      { fromUi: true },
      undefined
    )
  })

  it("renders a radiogroup with aria-required when required=true", () => {
    const props = getProps({
      options: simpleOptions,
      default: [0],
      required: true,
    })

    render(<ButtonGroup {...props} />)

    // React Aria renders ToggleButtonGroup with selectionMode="single" as role="radiogroup"
    const buttonGroup = screen.getByRole("radiogroup")
    expect(buttonGroup).toBeInTheDocument()
    expect(buttonGroup).toHaveAttribute("aria-required", "true")
  })
})
