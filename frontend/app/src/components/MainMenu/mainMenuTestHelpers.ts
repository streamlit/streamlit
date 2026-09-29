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
import { userEvent } from "@testing-library/user-event"

/**
 * Opens the main menu by clicking the menu button and waits for the popover
 * to appear. The menu mounts synchronously via conditional render, so waitFor
 * typically resolves on the first check.
 */
export async function openMenu(): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Main menu" }))
  await waitFor(() => {
    expect(screen.getByTestId("stMainMenuPopover")).toBeVisible()
  })
}

/**
 * Returns the labels of all action menu items currently visible.
 * Useful for verifying menu structure in tests.
 */
export function getMenuLabels(): string[] {
  const container = screen.getByRole("menu", { name: "Main menu" })

  return Array.from(
    container.querySelectorAll('[data-testid="stMainMenuItemLabel"]')
  ).map(el => el.textContent || "")
}
