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

import { useCallback, useEffect, useState } from "react"
import {
  type Initialize,
  type NewSession,
  type SessionEvent,
  type SessionStatus,
} from "../../../proto"
import type { MessageQueue } from "../lib/MessageQueue"
import { type StreamlitInstallation } from "../stores/StreamlitInstallationContext"
import { ScriptRunState, type ScriptRunInfo } from "../stores/ScriptRunContext"

export function useStreamlitScriptRunState(
  messageQueue: MessageQueue,
  streamlitInstallation: StreamlitInstallation | null
): ScriptRunInfo {
  const [scriptRunId, setScriptRunId] = useState<string>("")
  const [scriptName, setScriptName] = useState<string>("")
  const [scriptRunState, setScriptRunState] = useState<ScriptRunState>(
    ScriptRunState.NOT_RUNNING
  )
  const [mainScriptPath, setMainScriptPath] = useState<string>("")

  const handleSessionStatusChanged = useCallback(
    (status: SessionStatus) => {
      if (
        status.scriptIsRunning &&
        scriptRunState !== ScriptRunState.STOP_REQUESTED
      ) {
        // If the script is running, we change our ScriptRunState only
        // if we don't have a pending stop request
        setScriptRunState(ScriptRunState.RUNNING)
      } else if (
        !status.scriptIsRunning &&
        scriptRunState !== ScriptRunState.RERUN_REQUESTED &&
        scriptRunState !== ScriptRunState.COMPILATION_ERROR
      ) {
        // If the script is not running, we change our ScriptRunState only
        // if we don't have a pending rerun request, and we don't have
        // a script compilation failure
        setScriptRunState(ScriptRunState.NOT_RUNNING)

        // const customComponentCounter =
        //   this.metricsMgr.getAndResetCustomComponentCounter();
        // Object.entries(customComponentCounter).forEach(([name, count]) => {
        //   this.metricsMgr.enqueue("customComponentStats", {
        //     name,
        //     count,
        //   });
        // });
      }
    },
    [scriptRunState]
  )

  const requestScriptStop = useCallback(() => {
    setScriptRunState(ScriptRunState.STOP_REQUESTED)
  }, [])

  const requestScriptRerun = useCallback(() => {
    setScriptRunState(ScriptRunState.RERUN_REQUESTED)
  }, [])

  const handleNewSession = useCallback(
    (session: NewSession) => {
      const initializeMsg = session.initialize as Initialize

      // At this point we received an initialize message but the streamlitInstallation
      // is being set. For now, we can handle the session status change here
      if (streamlitInstallation === null) {
        handleSessionStatusChanged(
          initializeMsg.sessionStatus as SessionStatus
        )
      }

      setScriptRunId(session.scriptRunId)
      setScriptName(session.name)
      setMainScriptPath(session.mainScriptPath)
    },
    [streamlitInstallation, handleSessionStatusChanged]
  )

  const handleSessionEvent = useCallback((sessionEvent: SessionEvent) => {
    if (sessionEvent.type === "scriptCompilationException") {
      setScriptRunState(ScriptRunState.COMPILATION_ERROR)
    }
  }, [])

  useEffect(() => {
    return messageQueue.on<NewSession>("newSession", handleNewSession)
  }, [messageQueue, handleNewSession])

  useEffect(() => {
    return messageQueue.on<SessionStatus>(
      "sessionStatusChanged",
      handleSessionStatusChanged
    )
  }, [messageQueue, handleSessionStatusChanged])

  useEffect(() => {
    return messageQueue.on<SessionEvent>("sessionEvent", handleSessionEvent)
  }, [messageQueue, handleSessionEvent])

  return {
    scriptName,
    scriptRunState,
    scriptRunId,
    mainScriptPath,
    requestScriptRerun,
    requestScriptStop,
  }
}
