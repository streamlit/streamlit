/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { useEffect, useState } from "react"
import type { MessageQueue } from "../lib/MessageQueue"
import { Config } from "@streamlit/lib/src/proto"
import type { SessionStatus, NewSession } from "../../../proto"
import { type AppSettings } from "../stores/AppSettingsContext"

// TODO - Only Run On Save is really corresponding to ScriptAppState. The rest are app hints
export function useStreamlitAppSettingsState(
  messageQueue: MessageQueue
): AppSettings {
  const [allowRunOnSave, setAllowRunOnSave] = useState<boolean>(false)
  const [hideTopBar, setHideTopBar] = useState<boolean>(false)
  const [hideSidebarNav, setHideSidebarNav] = useState<boolean>(false)
  const [toolbarMode, setToolbarMode] = useState<Config.ToolbarMode>(
    Config.ToolbarMode.VIEWER
  )

  useEffect(() => {
    messageQueue.on<NewSession>("newSession", session => {
      const config = session.config as Config
      setAllowRunOnSave(config.allowRunOnSave)
      setHideTopBar(config.hideTopBar)
      setHideSidebarNav(config.hideSidebarNav)
      setToolbarMode(config.toolbarMode)
    })

    messageQueue.on<SessionStatus>("sessionStatusChanged", status => {
      setAllowRunOnSave(status.runOnSave)
    })
  }, [messageQueue])

  return {
    allowRunOnSave,
    hideTopBar,
    hideSidebarNav,
    toolbarMode,
  }
}
