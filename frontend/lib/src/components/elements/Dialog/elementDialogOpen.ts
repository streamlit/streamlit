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

/**
 * How many `st.dialog` elements are currently open.
 *
 * App-chrome dialogs (About, Settings, Deploy) do not touch this counter.
 * Page-level `run_every` reads it so a tick can skip while a script dialog
 * is open without pausing for those chrome dialogs.
 */
let openElementDialogCount = 0

/** Register an open `st.dialog`. Call the returned function when it closes. */
export function markElementDialogOpen(): () => void {
  openElementDialogCount += 1
  let released = false
  return () => {
    if (released) {
      return
    }
    released = true
    openElementDialogCount -= 1
  }
}

/** True when at least one `st.dialog` is open. */
export function isElementDialogOpen(): boolean {
  return openElementDialogCount > 0
}

/** Test helper. Production code balances the counter with the returned cleanup. */
export function resetElementDialogOpenForTests(): void {
  openElementDialogCount = 0
}
