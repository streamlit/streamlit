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
import { afterEach, vi } from "vitest"

import { Table as TableProto } from "@streamlit/protobuf"

import type * as PandasStylerUtils from "~lib/dataframes/pandasStylerUtils"
import type { Quiver } from "~lib/dataframes/Quiver"
import { UNICODE } from "~lib/mocks/arrow/types/unicode"
import { render } from "~lib/test_util"

const { displayOverrides } = vi.hoisted(() => ({
  displayOverrides: {
    current: undefined as Record<string, string> | undefined,
  },
}))

vi.mock("~lib/dataframes/pandasStylerUtils", async importOriginal => {
  const actual = (await importOriginal()) as typeof PandasStylerUtils

  return {
    ...actual,
    getStyledCell: (data: Quiver, row: number, column: number) => {
      const cell = actual.getStyledCell(data, row, column)
      const raw = data.getCell(row, column).content
      const overrides = displayOverrides.current
      if (!overrides || typeof raw !== "string" || !(raw in overrides)) {
        return cell
      }
      return { ...cell, displayContent: overrides[raw] }
    },
  }
})

import Table from "./Table"

afterEach(() => {
  displayOverrides.current = undefined
})

function renderUnicodeTable(): void {
  render(
    <Table
      element={TableProto.create({
        arrowData: { data: UNICODE },
      })}
    />
  )
}

describe("st.table styler display text", () => {
  it("keeps an empty styler display string blank", () => {
    displayOverrides.current = { foo: "" }
    renderUnicodeTable()

    expect(screen.queryByText("foo")).not.toBeInTheDocument()
    expect(screen.getByText("bar")).toBeVisible()
  })

  it("shows a non-empty styler display string instead of the raw value", () => {
    displayOverrides.current = { bar: "styled-bar" }
    renderUnicodeTable()

    expect(screen.getByText("styled-bar")).toBeVisible()
    expect(screen.queryByText("bar")).not.toBeInTheDocument()
    expect(screen.getByText("foo")).toBeVisible()
  })
})
