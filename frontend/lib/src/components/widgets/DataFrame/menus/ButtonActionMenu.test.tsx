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

import type { ReactElement } from "react"

import { screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { BaseProvider, LightTheme } from "baseui"

import { render } from "~lib/test_util"

import ButtonActionMenu from "./ButtonActionMenu"

interface ButtonActionMenuProps {
  top: number
  left: number
  actions: string[]
  onSelectAction: (label: string) => void
  onCloseMenu: () => void
}

/**
 * Renders ButtonActionMenu and waits for the popover to fully mount.
 */
async function renderAndWaitForPopover(
  ui: ReactElement
): Promise<ReturnType<typeof render>> {
  // Wrap in BaseProvider so BaseWeb's LayersManager is present, which is
  // required for the popover's Escape-key handling to work.
  const result = render(<BaseProvider theme={LightTheme}>{ui}</BaseProvider>)
  await waitFor(() => {
    expect(
      screen.queryByTestId("stDataFrameButtonActionMenu")
    ).toBeInTheDocument()
  })
  return result
}

describe("ButtonActionMenu", () => {
  const defaultProps: ButtonActionMenuProps = {
    top: 100,
    left: 200,
    actions: ["Action 1", "Action 2", "Action 3"],
    onSelectAction: vi.fn(),
    onCloseMenu: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the menu at the correct position", async () => {
    await renderAndWaitForPopover(<ButtonActionMenu {...defaultProps} />)

    const menuTarget = screen.getByTestId("stDataFrameButtonActionMenuTarget")
    expect(menuTarget).toHaveStyle("position: fixed")
    expect(menuTarget).toHaveStyle("top: 100px")
    expect(menuTarget).toHaveStyle("left: 200px")
  })

  it("renders all action items", async () => {
    await renderAndWaitForPopover(<ButtonActionMenu {...defaultProps} />)

    expect(screen.getByText("Action 1")).toBeVisible()
    expect(screen.getByText("Action 2")).toBeVisible()
    expect(screen.getByText("Action 3")).toBeVisible()
  })

  it("calls onSelectAction and onCloseMenu when an action is clicked", async () => {
    const onSelectAction = vi.fn()
    const onCloseMenu = vi.fn()

    await renderAndWaitForPopover(
      <ButtonActionMenu
        {...defaultProps}
        onSelectAction={onSelectAction}
        onCloseMenu={onCloseMenu}
      />
    )

    await userEvent.click(screen.getByText("Action 2"))

    expect(onSelectAction).toHaveBeenCalledWith("Action 2")
    expect(onCloseMenu).toHaveBeenCalled()
  })

  it("renders actions with material icons", async () => {
    const actions = [":material/edit: Edit", ":material/delete: Delete"]

    await renderAndWaitForPopover(
      <ButtonActionMenu {...defaultProps} actions={actions} />
    )

    // The text content should be rendered (icon is handled by DynamicIcon)
    expect(screen.getByText("Edit")).toBeVisible()
    expect(screen.getByText("Delete")).toBeVisible()
  })

  it("has correct aria-label for accessibility", async () => {
    await renderAndWaitForPopover(<ButtonActionMenu {...defaultProps} />)

    const menu = screen.getByRole("menu")
    expect(menu).toBeVisible()
  })

  it("renders menu items with menuitem role", async () => {
    await renderAndWaitForPopover(<ButtonActionMenu {...defaultProps} />)

    const menuItems = screen.getAllByRole("menuitem")
    expect(menuItems).toHaveLength(3)
  })

  it("closes the menu when the Escape key is pressed", async () => {
    const onCloseMenu = vi.fn()
    const onSelectAction = vi.fn()

    await renderAndWaitForPopover(
      <ButtonActionMenu
        {...defaultProps}
        onCloseMenu={onCloseMenu}
        onSelectAction={onSelectAction}
      />
    )

    // Move focus into the menu first (matches a keyboard user's flow and is
    // required for BaseWeb's popover to route the Escape key to onEsc).
    const menuItems = screen.getAllByRole("menuitem")
    menuItems[0].focus()
    await userEvent.keyboard("{Escape}")

    expect(onCloseMenu).toHaveBeenCalled()
    // Escape should only dismiss the menu, not select an action:
    expect(onSelectAction).not.toHaveBeenCalled()
  })

  it.each(["{Enter}", " "])(
    "selects the focused action when %s is pressed",
    async key => {
      const onSelectAction = vi.fn()
      const onCloseMenu = vi.fn()

      await renderAndWaitForPopover(
        <ButtonActionMenu
          {...defaultProps}
          onSelectAction={onSelectAction}
          onCloseMenu={onCloseMenu}
        />
      )

      const menuItems = screen.getAllByRole("menuitem")
      menuItems[1].focus()
      expect(menuItems[1]).toHaveFocus()

      await userEvent.keyboard(key)

      expect(onSelectAction).toHaveBeenCalledWith("Action 2")
      expect(onCloseMenu).toHaveBeenCalled()
    }
  )
})
