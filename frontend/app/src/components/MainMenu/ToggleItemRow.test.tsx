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

import { render } from "@streamlit/lib/testing"

import type { MenuToggleItem } from "./MainMenu"
import ToggleItemRow from "./ToggleItemRow"

function makeItem(overrides?: Partial<MenuToggleItem>): MenuToggleItem {
  return {
    type: "toggle",
    key: "autoRerun",
    label: "Auto rerun",
    checked: false,
    onToggle: vi.fn(),
    ...overrides,
  }
}

function renderToggle(
  item: MenuToggleItem,
  props?: { tabIndex?: number; itemIndex?: number }
): void {
  render(
    <ToggleItemRow
      item={item}
      tabIndex={props?.tabIndex ?? -1}
      itemIndex={props?.itemIndex ?? 0}
      setItemRef={vi.fn()}
    />
  )
}

describe("ToggleItemRow", () => {
  it("renders with role='menuitemcheckbox'", () => {
    const item = makeItem()
    renderToggle(item)

    const toggle = screen.getByRole("menuitemcheckbox")
    expect(toggle).toBeInTheDocument()
  })

  it("renders the label text", () => {
    const item = makeItem({ label: "Auto rerun" })
    renderToggle(item)

    expect(screen.getByText("Auto rerun")).toBeInTheDocument()
  })

  it("sets aria-checked='false' when unchecked", () => {
    const item = makeItem({ checked: false })
    renderToggle(item)

    expect(screen.getByRole("menuitemcheckbox")).toHaveAttribute(
      "aria-checked",
      "false"
    )
  })

  it("sets aria-checked='true' when checked", () => {
    const item = makeItem({ checked: true })
    renderToggle(item)

    expect(screen.getByRole("menuitemcheckbox")).toHaveAttribute(
      "aria-checked",
      "true"
    )
  })

  it("sets aria-disabled when disabled", () => {
    const item = makeItem({ disabled: true })
    renderToggle(item)

    expect(screen.getByRole("menuitemcheckbox")).toHaveAttribute(
      "aria-disabled",
      "true"
    )
  })

  it("does not set aria-disabled when enabled", () => {
    const item = makeItem({ disabled: false })
    renderToggle(item)

    expect(screen.getByRole("menuitemcheckbox")).not.toHaveAttribute(
      "aria-disabled"
    )
  })

  it("applies the provided tabIndex", () => {
    const item = makeItem()
    renderToggle(item, { tabIndex: 0 })

    expect(screen.getByRole("menuitemcheckbox")).toHaveAttribute(
      "tabindex",
      "0"
    )
  })

  it("calls onToggle when the toggle row is clicked", async () => {
    const item = makeItem()
    renderToggle(item)

    const user = userEvent.setup()
    const toggle = screen.getByRole("menuitemcheckbox")
    await user.click(toggle)

    expect(item.onToggle).toHaveBeenCalledOnce()
  })

  // Note: " " (literal space) is used instead of "{Space}" because JSDOM
  // does not fire click on <div> elements for {Space} keyUp.
  it.each([["{Enter}"], [" "]])(
    "calls onToggle when %s is pressed",
    async key => {
      const item = makeItem()
      renderToggle(item, { tabIndex: 0 })

      const user = userEvent.setup()
      const toggle = screen.getByRole("menuitemcheckbox")
      toggle.focus()

      await user.keyboard(key)

      expect(item.onToggle).toHaveBeenCalledOnce()
    }
  )

  it("does not call onToggle on keyboard activation when disabled", async () => {
    const item = makeItem({ disabled: true })
    renderToggle(item, { tabIndex: 0 })

    const user = userEvent.setup()
    const toggle = screen.getByRole("menuitemcheckbox")
    toggle.focus()

    await user.keyboard("{Enter}")

    expect(item.onToggle).not.toHaveBeenCalled()
  })

  it("does not call onToggle when clicked while disabled", async () => {
    const item = makeItem({ disabled: true })
    renderToggle(item)

    const user = userEvent.setup()
    const toggle = screen.getByRole("menuitemcheckbox")
    await user.click(toggle)

    expect(item.onToggle).not.toHaveBeenCalled()
  })

  it("calls setItemRef with the correct index", () => {
    const item = makeItem()
    const setItemRef = vi.fn()

    render(
      <ToggleItemRow
        item={item}
        tabIndex={-1}
        itemIndex={3}
        setItemRef={setItemRef}
      />
    )

    expect(setItemRef).toHaveBeenCalledWith(3, expect.any(HTMLElement))
  })
})
