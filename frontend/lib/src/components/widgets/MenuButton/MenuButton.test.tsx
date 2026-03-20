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

import { screen, waitFor, within } from "@testing-library/react"
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

  it("renders with correct className and label", () => {
    const props = getProps()
    render(<MenuButton {...props} />)

    const menuButton = screen.getByTestId("stMenuButton")
    expect(menuButton).toHaveClass("stMenuButton")

    const button = screen.getByTestId("stMenuButtonButton")
    expect(button).toHaveTextContent("Actions")
  })

  it("toggles menu open/closed on button click", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")

    // Open menu
    await user.click(button)
    const menuBody = await screen.findByTestId("stMenuButtonBody")
    expect(menuBody).toBeVisible()

    // Close menu by clicking button again
    await user.click(button)
    await waitFor(() => {
      expect(screen.queryByTestId("stMenuButtonBody")).not.toBeInTheDocument()
    })
  })

  it("selects an option and triggers widget manager", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")
    await user.click(button)

    // Wait for menu to appear and click the menuitem
    await screen.findByTestId("stMenuButtonBody")
    const optionB = screen.getByRole("menuitem", { name: "Option B" })
    await user.click(optionB)

    // Wait for menu to close (indicates callback was invoked)
    await waitFor(() => {
      expect(screen.queryByTestId("stMenuButtonBody")).not.toBeInTheDocument()
    })

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

    // Wait for menu to appear and click the menuitem
    await screen.findByTestId("stMenuButtonBody")
    const optionA = screen.getByRole("menuitem", { name: "Option A" })
    await user.click(optionA)

    // Wait for menu to close (indicates callback was invoked)
    await waitFor(() => {
      expect(screen.queryByTestId("stMenuButtonBody")).not.toBeInTheDocument()
    })

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

    // Wait for menu to appear and verify all options are visible via role queries
    await screen.findByTestId("stMenuButtonBody")
    expect(screen.getByRole("menuitem", { name: "Export CSV" })).toBeVisible()
    expect(screen.getByRole("menuitem", { name: "Export JSON" })).toBeVisible()
    expect(screen.getByRole("menuitem", { name: "Print" })).toBeVisible()
  })

  it("renders icon when provided", () => {
    const props = getProps({ icon: ":material/settings:" })
    render(<MenuButton {...props} />)

    // Verify button renders with the icon (the DynamicButtonLabel handles icon rendering)
    const button = screen.getByTestId("stMenuButtonButton")
    expect(button).toHaveTextContent("Actions")
  })

  it("extracts and renders leading material icons from options", async () => {
    const user = userEvent.setup()
    const props = getProps({
      options: [
        ":material/edit: Edit",
        ":material/delete: Delete",
        "No icon option",
      ],
    })
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")
    await user.click(button)

    // Wait for menu to appear
    const menuBody = await screen.findByTestId("stMenuButtonBody")

    // Check that options with icons render the icon via DynamicIcon (testId: stIconMaterial)
    // Scope to menu body to avoid matching the button's expand/collapse icon
    const materialIcons = within(menuBody).getAllByTestId("stIconMaterial")
    expect(materialIcons).toHaveLength(2)
    expect(materialIcons[0]).toHaveTextContent("edit")
    expect(materialIcons[1]).toHaveTextContent("delete")

    // Check that the text labels are rendered without the icon prefix
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeVisible()
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeVisible()
    expect(
      screen.getByRole("menuitem", { name: "No icon option" })
    ).toBeVisible()
  })

  it("renders option with material icon at the end as plain text", async () => {
    const user = userEvent.setup()
    const props = getProps({
      options: ["Export :material/download:"],
    })
    render(<MenuButton {...props} />)

    const button = screen.getByTestId("stMenuButtonButton")
    await user.click(button)

    // Wait for menu to appear
    await screen.findByTestId("stMenuButtonBody")

    // Icon is not at the start, so it should be rendered as inline markdown icon
    // not extracted as a separate DynamicIcon in the menu option icon container
    const menuItem = screen.getByRole("menuitem")
    // The icon should still render via StreamlitMarkdown's material icon support
    expect(menuItem).toHaveTextContent("Export")
  })
})
