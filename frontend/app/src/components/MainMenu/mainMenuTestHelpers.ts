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
  fireEvent.click(screen.getByRole("button"))
  // Only run pending timers if fake timers are being used
  try {
    vi.runOnlyPendingTimers()
  } catch {
    // Fake timers not enabled, continue without advancing
  }
  const menu = screen.getByTestId("stMainMenuPopover")
  expect(menu).toBeDefined()
}

export function getMenuStructure(
  renderResult: RenderResult
): ({ type: "separator" } | { type: "option"; label: string })[][] {
  const popover = renderResult.baseElement.querySelector(
    '[data-testid="stMainMenuPopover"]'
  )
  if (!popover) return []

  // Get all menu items and dividers
  const items = Array.from(
    popover.querySelectorAll(
      '[data-testid^="stMainMenuItem-"], [data-testid="stMainMenuDivider"]'
    )
  ).map(d => {
    const testId = d.getAttribute("data-testid") || ""
    if (testId === "stMainMenuDivider") {
      return { type: "separator" as const }
    }
    // Extract label from testid: stMainMenuItem-Rerun -> Rerun
    // But the actual text content is more reliable
    return { type: "option" as const, label: d.textContent || "" }
  })

  // Return as a single group (no longer multiple listboxes)
  return items.length > 0 ? [items] : []
}
