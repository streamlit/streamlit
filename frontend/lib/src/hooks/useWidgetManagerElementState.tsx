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

import { useCallback, useEffect, useMemo, useState } from "react"

import { useFormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import {
  isNullOrUndefined,
  notNullOrUndefined,
} from "@streamlit/lib/src/util/utils"

/**
 * Think of useState, but the state is also persisted in the widget manager.
 * This allows you to have the state be persisted between mounting and unmounting of the component.
 * @param widgetMgr - The widget manager instance to use
 * @param id - The id of the widget to store the state for
 * @param key - The key of the state to store
 * @param defaultValue - The default value to use if the state is not set in the widget manager
 * @returns A tuple containing the current state and a function to set the state
 */
const useWidgetManagerElementState = <T,>({
  widgetMgr,
  id,
  formId,
  key,
  defaultValue,
}: {
  widgetMgr: WidgetStateManager
  id: string
  formId?: string
  key: string
  defaultValue: T
}): [T, (value: T) => void] => {
  useEffect(() => {
    const existingValue = widgetMgr.getElementState(id, key)
    if (isNullOrUndefined(existingValue) && notNullOrUndefined(defaultValue)) {
      widgetMgr.setElementState(id, key, defaultValue)
    }
  }, [widgetMgr, id, key, defaultValue])

  const [state, setStateInternal] = useState<T>(
    widgetMgr.getElementState(id, key) ?? defaultValue
  )

  const setState = useCallback(
    (value: T) => {
      widgetMgr.setElementState(id, key, value)
      setStateInternal(value)
    },
    [widgetMgr, id, key]
  )

  const element = useMemo(() => ({ formId: formId || "" }), [formId])
  const onFormCleared = useCallback(
    () => setState(defaultValue),
    [defaultValue, setState]
  )

  useFormClearHelper({
    element,
    widgetMgr,
    onFormCleared,
  })

  return [state, setState]
}

export default useWidgetManagerElementState
