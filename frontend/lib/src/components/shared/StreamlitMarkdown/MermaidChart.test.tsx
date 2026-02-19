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

import { render, RenderResult, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import ThemeProvider from "~lib/components/core/ThemeProvider"
import { mockTheme } from "~lib/mocks/mockTheme"

import { MermaidChart } from "./MermaidChart"

const renderMermaidChart = (source: string): RenderResult => {
  return render(
    <ThemeProvider theme={mockTheme.emotion}>
      <MermaidChart source={source} />
    </ThemeProvider>
  )
}

describe("MermaidChart", () => {
  it("renders with correct test id", () => {
    renderMermaidChart("graph TD\nA-->B")
    expect(screen.getByTestId("stMermaidChart")).toBeVisible()
  })

  // Note: Full rendering tests with mermaid SVG output are covered by E2E tests
  // because mocking dynamic imports is complex and the real mermaid rendering
  // is best tested in a browser environment.
})
