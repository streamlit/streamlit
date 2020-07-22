/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement, memo } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { Map as ImmutableMap } from "immutable"
import { WidgetStateManager } from "lib/WidgetStateManager"

export interface Props {
  element: ImmutableMap<string, any>
  widgetMgr: WidgetStateManager
}

function HotKey({ element, widgetMgr }: Props): ReactElement {
  const widgetId = element.get("id")
  const keys = element.get("keys")

  useHotkeys(keys, () => {
    widgetMgr.setBoolValue(widgetId, true, { fromUi: true })
  })

  return <></>
}

export default memo(HotKey)
