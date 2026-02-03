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

import { act, RenderResult, Screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

export async function openMenu(screen: Screen): Promise<void> {
  const isUsingFakeTimers = (() => {
    try {
      vi.getTimerCount()
      return true
    } catch {
      return false
    }
  })()
  const user = userEvent.setup(
    isUsingFakeTimers ? { advanceTimers: vi.advanceTimersByTime } : undefined
  )
  await act(async () => {
    await user.click(screen.getByTestId("stMainMenuButton"))
    if (isUsingFakeTimers) {
      vi.runOnlyPendingTimers()
    }
  })
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
    const labelElement = element.querySelector(
      '[data-testid="stMainMenuItemLabel"]'
    )
    currentSection.push({
      type: "option",
      label: labelElement?.textContent || "",
    })
  })

  if (currentSection.length > 0) {
    sections.push(currentSection)
  }

  return sections
}
