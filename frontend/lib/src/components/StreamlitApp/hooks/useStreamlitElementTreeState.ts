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

import { useCallback, useEffect, useRef, useState } from "react"
import type { MessageQueue } from "../lib/MessageQueue"
import { AppRoot } from "../../../AppNode"
import {
  type Delta,
  type ForwardMsgMetadata,
  ForwardMsg,
} from "../../../proto"
import { type ScriptRunInfo, ScriptRunState } from "../stores/ScriptRunContext"
import { type StreamlitInstallation } from "../stores/StreamlitInstallationContext"

const ELEMENT_LIST_BUFFER_TIMEOUT_MS = 10

export function useStreamlitElementTreeState(
  messageQueue: MessageQueue,
  streamlitInstallation: StreamlitInstallation | null,
  scriptRunInfo: ScriptRunInfo,
  currentPageScriptHash: string
): AppRoot {
  const [root, setRoot] = useState<AppRoot>(() => AppRoot.empty(true))
  const pendingElementsBuffer = useRef<AppRoot>(root)
  const pendingElementsTimerRunning = useRef<boolean>(false)
  const { scriptRunId, scriptRunState } = scriptRunInfo
  const scriptIsRunning = scriptRunState === ScriptRunState.RUNNING

  const delayedSettingRoot = useCallback(() => {
    pendingElementsTimerRunning.current = false
    if (scriptIsRunning) {
      setRoot(pendingElementsBuffer.current)
    }
  }, [scriptIsRunning])

  const handleDeltaMessage = useCallback(
    (delta: Delta, metadata: ForwardMsgMetadata | null | undefined) => {
      pendingElementsBuffer.current = pendingElementsBuffer.current.applyDelta(
        scriptRunId,
        delta,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Delta messages always have metadata
        metadata!
      )

      // this.metricsMgr.handleDeltaMessage(deltaMsg);

      if (!pendingElementsTimerRunning.current) {
        pendingElementsTimerRunning.current = true

        // (BUG #685) When user presses stop, stop adding elements to
        // the app immediately to avoid race condition.
        setTimeout(delayedSettingRoot, ELEMENT_LIST_BUFFER_TIMEOUT_MS)
      }
    },
    [scriptRunId, delayedSettingRoot]
  )

  const handleScriptFinished = useCallback(
    (status: ForwardMsg.ScriptFinishedStatus) => {
      if (status === ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY) {
        // Clear any stale elements left over from the previous run.
        // (We don't do this if our script had a compilation error and didn't
        // finish successfully.)
        const newElements =
          pendingElementsBuffer.current.clearStaleNodes(scriptRunId)
        setRoot(newElements)
        pendingElementsBuffer.current = newElements

        // Tell the WidgetManager which widgets still exist. It will remove
        // widget state for widgets that have been removed.
        // const activeWidgetIds = new Set(
        //   Array.from(this.state.elements.getElements())
        //     .map((element) => getElementWidgetID(element))
        //     .filter(notUndefined)
        // );
        // this.widgetMgr.removeInactive(activeWidgetIds);
      }
    },
    [scriptRunId]
  )

  useEffect(() => {
    return messageQueue.on<Delta>("delta", handleDeltaMessage)
  }, [messageQueue, handleDeltaMessage])

  useEffect(() => {
    return messageQueue.on<ForwardMsg.ScriptFinishedStatus>(
      "scriptFinished",
      handleScriptFinished
    )
  }, [messageQueue, handleScriptFinished])

  // Reset all elements when we detect a change on appHash or pageScriptHash.
  // aka Streamlit is running a new script so the old elements are now invalid.
  useEffect(() => {
    const newRoot = AppRoot.empty(false)

    setRoot(newRoot)
    pendingElementsBuffer.current = newRoot
  }, [streamlitInstallation?.appHash, currentPageScriptHash])

  return root
}
