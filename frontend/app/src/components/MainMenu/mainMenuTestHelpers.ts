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

import { fireEvent, RenderResult, Screen } from "@testing-library/react"

export function openMenu(screen: Screen): void {
  fireEvent.click(screen.getByTestId("stMainMenuButton"))
  vi.runOnlyPendingTimers()
  expect(screen.getByTestId("stMainMenuPopover")).toBeDefined()
}

export function getMenuStructure(
  renderResult: RenderResult
): ({ type: "separator" } | { type: "option"; label: string })[][] {
  const container = renderResult.baseElement.querySelector(
    '[data-testid="stMainMenuContent"]'
  )
  if (!container) {
    return []
  }

  const elements = Array.from(
    container.querySelectorAll(
      '[data-testid^="stMainMenuItem-"], [data-testid="stMainMenuDivider"]'
    )
  )

  const sections: (
    | { type: "separator" }
    | { type: "option"; label: string }
  )[][] = []
  let currentSection: (
    | { type: "separator" }
    | { type: "option"; label: string }
  )[] = []

  elements.forEach(element => {
    if (element.getAttribute("data-testid") === "stMainMenuDivider") {
      if (currentSection.length > 0) {
        sections.push(currentSection)
        currentSection = []
      }
      return
    }
    currentSection.push({ type: "option", label: element.textContent || "" })
  })

  if (currentSection.length > 0) {
    sections.push(currentSection)
  }

  return sections
}
