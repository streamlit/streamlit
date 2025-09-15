/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React from "react"

import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Arrow } from "@streamlit/protobuf"

import type { Quiver } from "~lib/dataframes/Quiver"

import type { DataFrameProps } from "./DataFrame"
import { ReadOnlyGrid } from "./ReadOnlyGrid"

// Mock the heavy DataFrame component so we can assert the props passed by ReadOnlyGrid
let receivedProps: DataFrameProps | undefined
vi.mock("./DataFrame", () => {
  return {
    default: vi.fn((props: DataFrameProps) => {
      receivedProps = props
      return <div data-testid="MockDataFrame" />
    }),
  }
})

describe("ReadOnlyGrid", () => {
  beforeEach(() => {
    receivedProps = undefined
    vi.clearAllMocks()
  })

  it("renders DataFrame with read-only defaults and stretch width", () => {
    const fakeQuiver = {} as unknown as Quiver // DataFrame is mocked; the value isn't used

    render(<ReadOnlyGrid data={fakeQuiver} />)

    // Mocked DataFrame should be rendered
    expect(screen.getByTestId("MockDataFrame")).toBeVisible()

    // Props should be passed through with expected defaults
    expect(receivedProps?.disabled).toBe(true)
    expect(receivedProps?.disableFullscreenMode).toBe(true)
    expect(receivedProps?.data).toBe(fakeQuiver)
    expect(receivedProps?.customToolbarActions).toBeUndefined()
    expect(receivedProps?.heightConfig).toBeUndefined()
    expect(receivedProps?.widthConfig?.useStretch).toBe(true)

    // Element should be configured as read-only
    expect(receivedProps?.element?.disabled).toBe(true)
    expect(receivedProps?.element?.editingMode).toBe(
      Arrow.EditingMode.READ_ONLY
    )
  })

  it("applies pixel height when provided", () => {
    const fakeQuiver = {} as unknown as Quiver

    render(<ReadOnlyGrid data={fakeQuiver} height={320} />)

    expect(receivedProps?.heightConfig).toEqual(
      expect.objectContaining({ pixelHeight: 320 })
    )
  })

  it("forwards custom toolbar actions", () => {
    const fakeQuiver = {} as unknown as Quiver
    const actions = [
      <button key="a" type="button">
        A
      </button>,
    ]

    render(<ReadOnlyGrid data={fakeQuiver} customToolbarActions={actions} />)

    expect(receivedProps?.customToolbarActions).toBe(actions)
  })
})
