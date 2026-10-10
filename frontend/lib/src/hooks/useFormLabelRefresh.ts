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

import { type Dispatch, type SetStateAction, useEffect } from "react"

import {
  claimFormLabelRefresh,
  resetFormLabelRefreshClaims,
} from "~lib/formLabelRefreshClaims"
import type { ValueWithSource } from "~lib/hooks/useBasicWidgetState"
import { isNullOrUndefined } from "~lib/util/utils"

export { claimFormLabelRefresh, resetFormLabelRefreshClaims }

/** Which duplicate label stands for the option. Multiselect keeps the first. */
export type FormLabelMatch = "first" | "last"

/**
 * Map one pending form label onto the current option list.
 *
 * Returns undefined when the value should stay as it is. `previousLabels`
 * is only sent when the option sequence is unchanged, so the index is the
 * same option.
 */
export function remapFormString(
  value: string | null,
  options: readonly string[],
  previousLabels: readonly string[],
  match: FormLabelMatch = "last"
): string | undefined {
  if (
    previousLabels.length === 0 ||
    previousLabels.length !== options.length
  ) {
    return undefined
  }
  if (isNullOrUndefined(value)) {
    return undefined
  }
  // A label that still exists in the new list can belong to a different
  // option. The previous index is the selection; callers apply this once.
  const index =
    match === "first"
      ? previousLabels.indexOf(value)
      : previousLabels.lastIndexOf(value)
  if (index < 0) {
    return undefined
  }
  const next = options[index]
  return next === value ? undefined : next
}

/**
 * Map each pending form label, leaving typed text that is not an old label.
 */
export function remapFormStrings(
  values: readonly string[],
  options: readonly string[],
  previousLabels: readonly string[],
  match: FormLabelMatch = "last"
): string[] | undefined {
  if (
    previousLabels.length === 0 ||
    previousLabels.length !== options.length
  ) {
    return undefined
  }
  let changed = false
  const next = values.map(value => {
    const remapped = remapFormString(value, options, previousLabels, match)
    if (remapped === undefined) {
      return value
    }
    changed = true
    return remapped
  })
  return changed ? next : undefined
}

/**
 * Rewrite a form widget's pending label when format_func changes.
 *
 * The server has not seen the selection yet, so it cannot push setValue.
 * `fromUser` keeps the new label in the form until submit and does not
 * rerun. Outside a form, `previousLabels` is empty and this does nothing.
 */
export function useFormStringLabelRefresh(args: {
  widgetId: string
  formId: string
  previousLabels: readonly string[]
  options: readonly string[]
  value: string | null
  setValue: Dispatch<SetStateAction<ValueWithSource<string | null> | null>>
  // Captured during render. The basic-widget effect clears `element.setValue`
  // before this effect runs, so reading the proto flag here would be too late.
  serverSetValue: boolean
  match?: FormLabelMatch
}): void {
  const {
    widgetId,
    formId,
    previousLabels,
    options,
    value,
    setValue,
    serverSetValue,
    match = "last",
  } = args
  useEffect(() => {
    if (!formId) {
      return
    }
    if (
      !claimFormLabelRefresh(widgetId, previousLabels, options, serverSetValue)
    ) {
      return
    }
    const next = remapFormString(value, options, previousLabels, match)
    if (next === undefined) {
      return
    }
    setValue({ value: next, fromUser: true })
  }, [
    widgetId,
    formId,
    previousLabels,
    options,
    value,
    setValue,
    serverSetValue,
    match,
  ])
}

/** Array form of {@link useFormStringLabelRefresh}. */
export function useFormStringArrayLabelRefresh(args: {
  widgetId: string
  formId: string
  previousLabels: readonly string[]
  options: readonly string[]
  value: readonly string[]
  setValue: Dispatch<SetStateAction<ValueWithSource<string[]> | null>>
  serverSetValue: boolean
  match?: FormLabelMatch
}): void {
  const {
    widgetId,
    formId,
    previousLabels,
    options,
    value,
    setValue,
    serverSetValue,
    match = "last",
  } = args
  useEffect(() => {
    if (!formId) {
      return
    }
    if (
      !claimFormLabelRefresh(widgetId, previousLabels, options, serverSetValue)
    ) {
      return
    }
    const next = remapFormStrings(value, options, previousLabels, match)
    if (next === undefined) {
      return
    }
    setValue({ value: next, fromUser: true })
  }, [
    widgetId,
    formId,
    previousLabels,
    options,
    value,
    setValue,
    serverSetValue,
    match,
  ])
}
