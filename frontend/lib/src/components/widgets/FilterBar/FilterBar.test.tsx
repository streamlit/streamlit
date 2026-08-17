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

import { act } from "react"

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  FilterBar as FilterBarProto,
  FilterType,
  IFilterColumnMeta,
} from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import FilterBar, { Props } from "./FilterBar"

function makeColumn(name: string): IFilterColumnMeta {
  return {
    name,
    filterType: FilterType.FILTER_TYPE_MULTISELECT,
    options: ["a", "b", "c"],
    operators: ["is", "is_not"],
    disabled: false,
  }
}

const columns = [
  makeColumn("status"),
  makeColumn("company"),
  makeColumn("region"),
]

const threeFilterState = {
  status: { type: "multiselect", values: ["a"] },
  company: { type: "multiselect", values: ["b"] },
  region: { type: "multiselect", values: ["c"] },
}

function getProps(
  initialState: Record<string, unknown> = {},
  extraProps: Partial<Props> = {}
): Props {
  const widgetMgr = {
    getStringValue: vi
      .fn()
      .mockReturnValue(
        Object.keys(initialState).length > 0
          ? JSON.stringify(initialState)
          : null
      ),
    setStringValue: vi.fn(),
  } as unknown as WidgetStateManager

  return {
    disabled: false,
    element: {
      id: "test-filter-bar",
      formId: "",
      label: "Filters",
      help: "",
      placeholder: "Add filter",
      expanded: true,
      disabled: false,
      columns,
      labelVisibility: { value: 0 },
      width: 0,
      value: "",
    } as unknown as FilterBarProto,
    widgetMgr,
    ...extraProps,
  }
}

describe("FilterBar keyboard navigation", () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  it("renders pills with roving tabindex (first pill has tabIndex=0)", () => {
    render(<FilterBar {...getProps(threeFilterState)} />)
    const pills = screen
      .getAllByRole("button")
      .filter(b => b.getAttribute("aria-haspopup") === "dialog")
    expect(pills).toHaveLength(3)
    expect(pills[0]).toHaveAttribute("tabindex", "0")
    expect(pills[1]).toHaveAttribute("tabindex", "-1")
    expect(pills[2]).toHaveAttribute("tabindex", "-1")
  })

  it("ArrowRight moves focus to next pill", async () => {
    render(<FilterBar {...getProps(threeFilterState)} />)
    const pills = screen
      .getAllByRole("button")
      .filter(b => b.getAttribute("aria-haspopup") === "dialog")

    act(() => {
      pills[0].focus()
    })
    await user.keyboard("{ArrowRight}")

    expect(pills[1]).toHaveFocus()
  })

  it("ArrowLeft wraps from first to last pill", async () => {
    render(<FilterBar {...getProps(threeFilterState)} />)
    const pills = screen
      .getAllByRole("button")
      .filter(b => b.getAttribute("aria-haspopup") === "dialog")

    act(() => {
      pills[0].focus()
    })
    await user.keyboard("{ArrowLeft}")

    expect(pills[2]).toHaveFocus()
  })

  it("ArrowRight wraps from last to first pill", async () => {
    render(<FilterBar {...getProps(threeFilterState)} />)
    const pills = screen
      .getAllByRole("button")
      .filter(b => b.getAttribute("aria-haspopup") === "dialog")

    act(() => {
      pills[2].focus()
    })
    await user.keyboard("{ArrowRight}")

    expect(pills[0]).toHaveFocus()
  })

  it("Home moves focus to first pill", async () => {
    render(<FilterBar {...getProps(threeFilterState)} />)
    const pills = screen
      .getAllByRole("button")
      .filter(b => b.getAttribute("aria-haspopup") === "dialog")

    act(() => {
      pills[2].focus()
    })
    await user.keyboard("{Home}")

    expect(pills[0]).toHaveFocus()
  })

  it("End moves focus to last pill", async () => {
    render(<FilterBar {...getProps(threeFilterState)} />)
    const pills = screen
      .getAllByRole("button")
      .filter(b => b.getAttribute("aria-haspopup") === "dialog")

    act(() => {
      pills[0].focus()
    })
    await user.keyboard("{End}")

    expect(pills[2]).toHaveFocus()
  })

  it("pill row has role=toolbar", () => {
    render(<FilterBar {...getProps(threeFilterState)} />)
    const toolbar = screen.getByRole("toolbar")
    expect(toolbar).toBeVisible()
  })

  it("only focused pill has tabIndex=0 after arrow key navigation", async () => {
    render(<FilterBar {...getProps(threeFilterState)} />)
    const pills = screen
      .getAllByRole("button")
      .filter(b => b.getAttribute("aria-haspopup") === "dialog")

    act(() => {
      pills[0].focus()
    })
    await user.keyboard("{ArrowRight}")

    expect(pills[0]).toHaveAttribute("tabindex", "-1")
    expect(pills[1]).toHaveAttribute("tabindex", "0")
    expect(pills[2]).toHaveAttribute("tabindex", "-1")
  })
})
