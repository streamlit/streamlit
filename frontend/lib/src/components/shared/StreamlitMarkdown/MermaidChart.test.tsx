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

import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { render } from "~lib/test_util"

import { MermaidChart } from "./MermaidChart"

describe("MermaidChart", () => {
  it("renders loading skeleton initially and error element is not present", () => {
    render(<MermaidChart source="graph TD\nA-->B" />)
    expect(screen.getByTestId("stMermaidChart")).toBeVisible()
    // Verify loading state is indicated via aria-busy
    expect(screen.getByTestId("stMermaidChart")).toHaveAttribute(
      "aria-busy",
      "true"
    )
    // The loading placeholder uses the internal "stSkeleton" test ID (tracked
    // by the app-loaded gate), not the public "stSkeletonElement" element.
    expect(screen.getByTestId("stSkeleton")).toBeVisible()
    expect(screen.queryByTestId("stSkeletonElement")).not.toBeInTheDocument()
    // Negative assertion: error element should not be present during loading
    expect(screen.queryByTestId("stMermaidError")).not.toBeInTheDocument()
  })

  it("shows error state when mermaid import fails", async () => {
    // Mock the dynamic import to reject
    vi.doMock("mermaid", () => {
      throw new Error("Failed to load mermaid")
    })

    render(<MermaidChart source="graph TD\nA-->B" />)

    // Wait for the error state to appear
    await waitFor(
      () => {
        expect(screen.getByTestId("stMermaidError")).toBeVisible()
      },
      { timeout: 5000 }
    )

    // Verify error message is shown
    expect(screen.getByTestId("stMermaidError")).toHaveTextContent(
      "Mermaid diagram error"
    )
    // Negative assertion: no img element should be rendered in error state
    expect(screen.queryByRole("img")).not.toBeInTheDocument()

    vi.doUnmock("mermaid")
  })

  // Note: Full rendering tests with mermaid SVG output are covered by E2E tests
  // because mocking dynamic imports is complex and the real mermaid rendering
  // is best tested in a browser environment.
})
