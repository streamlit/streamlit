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

import ThemedApp from "./ThemedApp"

vi.mock("@streamlit/connection")

// Mock needed for Block.tsx
class ResizeObserver {
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}
window.ResizeObserver = ResizeObserver

describe("ThemedApp", () => {
  beforeEach(() => {
    // sourced from:
    // https://jestjs.io/docs/en/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it("renders without crashing", () => {
    render(<ThemedApp streamlitExecutionStartedAt={Date.now()} />)

    expect(screen.getByTestId("stApp")).toBeInTheDocument()
  })

  it("contains the overlay portal required by the interactive table", () => {
    render(<ThemedApp streamlitExecutionStartedAt={Date.now()} />)
    const portalElement = screen.getByTestId("portal")
    expect(portalElement).toBeInTheDocument()
  })
})
