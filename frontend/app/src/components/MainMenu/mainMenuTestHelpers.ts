/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

/* eslint-disable import/no-extraneous-dependencies */
import { fireEvent, RenderResult, Screen } from "@testing-library/react"

export async function openMenu(screen: Screen): Promise<void> {
  fireEvent.click(screen.getByRole("button"))
  // Each SubMenu is a listbox, so need to use findAllByRole (findByRole throws error if multiple matches)
  const menu = await screen.findAllByRole("listbox")
  expect(menu).toBeDefined()
}

export function getMenuStructure(
  renderResult: RenderResult
): ({ type: "separator" } | { type: "option"; label: string })[][] {
  return Array.from(
    renderResult.baseElement.querySelectorAll('[role="listbox"]')
  ).map(listBoxElement => {
    return Array.from(
      listBoxElement.querySelectorAll(
        '[role=option] span:first-of-type, [data-testid="main-menu-divider"]'
      )
    ).map(d =>
      d.getAttribute("data-testid") == "main-menu-divider"
        ? { type: "separator" }
        : { type: "option", label: d.textContent as string }
    )
  })
}
