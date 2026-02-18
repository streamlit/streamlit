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

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { vi } from "vitest"

import { MenuButton as MenuButtonProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import MenuButton, { Props } from "./MenuButton"

vi.mock("~lib/WidgetStateManager")

const sendBackMsg = vi.fn()

const getProps = (
  elementProps: Partial<MenuButtonProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: MenuButtonProto.create({
    id: "1",
    label: "Actions",
    options: ["Option A", "Option B", "Option C"],
    type: "secondary",
    ...elementProps,
  }),
  disabled: false,
  // @ts-expect-error
  widgetMgr: new WidgetStateManager(sendBackMsg),
  ...widgetProps,
})

describe("MenuButton widget", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<MenuButton {...props} />)

    const menuButton = screen.getByTestId("stMenuButton")
    expect(menuButton).toBeInTheDocument()
  })

  it("should have correct className", () => {
    const props = getProps()
    render(<MenuButton {...props} />)

    const menuButton = screen.getByTestId("stMenuButton")
    expect(menuButton).toHaveClass("stMenuButton")
  })

  it("should render a label within the button", () => {
    const props = getProps()
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")
    expect(button).toHaveTextContent("Actions")
  })

  it("opens menu on click", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")
    await user.click(button)

    const menuBody = screen.getByTestId("stMenuButtonBody")
    expect(menuBody).toBeVisible()
  })

  it("toggles menu open/closed on button click", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")

    // Open menu
    await user.click(button)
    expect(screen.getByTestId("stMenuButtonBody")).toBeVisible()

    // Close menu by clicking button again
    await user.click(button)
    expect(screen.queryByTestId("stMenuButtonBody")).not.toBeInTheDocument()
  })

  it("selects an option and triggers widget manager", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")
    await user.click(button)

    const optionB = screen.getByText("Option B")
    await user.click(optionB)

    expect(props.widgetMgr.setStringTriggerValue).toHaveBeenCalledWith(
      props.element,
      "Option B",
      { fromUi: true },
      undefined
    )
  })

  it("passes fragmentId when selecting option", async () => {
    const user = userEvent.setup()
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")
    await user.click(button)

    const optionA = screen.getByText("Option A")
    await user.click(optionA)

    expect(props.widgetMgr.setStringTriggerValue).toHaveBeenCalledWith(
      props.element,
      "Option A",
      { fromUi: true },
      "myFragmentId"
    )
  })

  it.each([
    ["disabled prop", {}, { disabled: true }],
    ["element.disabled", { disabled: true }, {}],
  ])("can be disabled via %s", (_desc, elementProps, widgetProps) => {
    const props = getProps(elementProps, widgetProps)
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")
    expect(button).toBeDisabled()
  })

  it("does not trigger callback when disabled", async () => {
    const user = userEvent.setup()
    const props = getProps({}, { disabled: true })
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")
    await user.click(button)

    expect(props.widgetMgr.setStringTriggerValue).not.toHaveBeenCalled()
  })

  it.each(["primary", "secondary", "tertiary"])(
    "renders %s button type",
    type => {
      const props = getProps({ type })
      render(<MenuButton {...props} />)

      const button = screen.getByTestId("stMenuButtonButton")
      expect(button).toHaveAttribute("kind", type)
    }
  )

  it("renders with help tooltip", async () => {
    const user = userEvent.setup()
    const props = getProps({ help: "This is help text" })
    render(<MenuButton {...props} />)

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltipTarget)

    const tooltipContent = await screen.findByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("This is help text")
  })

  it("renders all menu options", async () => {
    const user = userEvent.setup()
    const props = getProps({ options: ["Export CSV", "Export JSON", "Print"] })
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")
    await user.click(button)

    expect(screen.getByText("Export CSV")).toBeInTheDocument()
    expect(screen.getByText("Export JSON")).toBeInTheDocument()
    expect(screen.getByText("Print")).toBeInTheDocument()
  })

  it("renders icon when provided", () => {
    const props = getProps({ icon: ":material/settings:" })
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")
    expect(button).toBeInTheDocument()
  })

  it("closes menu after selecting an option", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")
    await user.click(button)

    expect(screen.getByTestId("stMenuButtonBody")).toBeVisible()

    const optionC = screen.getByText("Option C")
    await user.click(optionC)

    expect(screen.queryByTestId("stMenuButtonBody")).not.toBeInTheDocument()
  })
})
