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

// One entry per widget. Survives a remount so a rewritten label is not mapped
// again as if it were still the previous generation. Dropped when the widget
// leaves the app, so a later recreation can refresh the same label pair.
const claimedFormLabelKeys = new Map<string, string>()

export function resetFormLabelRefreshClaims(): void {
  claimedFormLabelKeys.clear()
}

/** Forget claims for widgets that are no longer in the app. */
export function releaseInactiveFormLabelRefreshClaims(
  activeIds: ReadonlySet<string>
): void {
  for (const widgetId of claimedFormLabelKeys.keys()) {
    if (!activeIds.has(widgetId)) {
      claimedFormLabelKeys.delete(widgetId)
    }
  }
}

/**
 * Return whether this widget should rewrite pending form labels.
 *
 * Each label generation is claimed once. A server `setValue` claims the
 * generation and wins, so a later effect cannot put the old selection back.
 */
export function claimFormLabelRefresh(
  widgetId: string,
  previousLabels: readonly string[],
  options: readonly string[],
  serverSetValue: boolean
): boolean {
  if (
    !widgetId ||
    previousLabels.length === 0 ||
    previousLabels.length !== options.length
  ) {
    return false
  }
  const key = `${previousLabels.join("\0")}\n${options.join("\0")}`
  if (claimedFormLabelKeys.get(widgetId) === key) {
    return false
  }
  claimedFormLabelKeys.set(widgetId, key)
  return !serverSetValue
}
