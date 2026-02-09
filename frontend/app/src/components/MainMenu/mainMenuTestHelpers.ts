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

import { RenderResult, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { vi } from "vitest"

/**
 * Opens the main menu by clicking the menu button.
 * Requires vi.useFakeTimers() to be called in the test's beforeEach.
 */
export async function openMenu(): Promise<void> {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.click(screen.getByTestId("stMainMenuButton"))
  vi.runOnlyPendingTimers()
  expect(screen.getByTestId("stMainMenuPopover")).toBeVisible()
}

/**
 * Returns the labels of all menu items currently visible.
 * Useful for verifying menu structure in tests.
 */
export function getMenuLabels(renderResult: RenderResult): string[] {
  const container = renderResult.baseElement.querySelector(
    '[data-testid="stMainMenuList"]'
  )
  if (!container) return []

  return Array.from(
    container.querySelectorAll('[data-testid="stMainMenuItemLabel"]')
  ).map(el => el.textContent || "")
}
