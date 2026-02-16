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

import {
  act,
  fireEvent,
  RenderResult,
  Screen,
  waitFor,
} from "@testing-library/react"

export async function openMenu(screen: Screen): Promise<void> {
  // Wrap in act() to batch React state updates from baseui's StatefulPopover
  act(() => {
    fireEvent.click(screen.getByRole("button"))
    // Advance timers if fake timers are enabled (MainMenu tests use fake timers)
    if (vi.isFakeTimers()) {
      vi.runAllTimers()
    }
  })
  // Wait for async popover state updates to complete
  await waitFor(() => {
    expect(screen.getAllByRole("listbox")).toBeDefined()
  })
}

export function getMenuStructure(
  renderResult: RenderResult
): ({ type: "separator" } | { type: "option"; label: string })[][] {
  return Array.from(
    renderResult.baseElement.querySelectorAll('[role="listbox"]')
  ).map(listBoxElement => {
    return Array.from(
      listBoxElement.querySelectorAll(
        '[role=option] span:first-of-type, [data-testid="stMainMenuDivider"]'
      )
    ).map(d =>
      d.getAttribute("data-testid") == "stMainMenuDivider"
        ? { type: "separator" }
        : { type: "option", label: d.textContent }
    )
  })
}
