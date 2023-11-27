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
import { h32 } from "xxhashjs"
import {
  type EnvironmentInfo,
  type Initialize,
  type NewSession,
  type UserInfo,
} from "../../../proto"
import type { MessageQueue } from "../lib/MessageQueue"
import type { StreamlitInstallation } from "../stores/StreamlitInstallationContext"

export function useStreamlitInstallationState(
  messageQueue: MessageQueue
): StreamlitInstallation | null {
  const [streamlitInstallation, setStreamlitInstallation] =
    useState<StreamlitInstallation | null>(null)

  const hasStreamlitVersionChanged = useCallback(
    (environmentInfo: EnvironmentInfo | null | undefined) => {
      return (
        streamlitInstallation !== null &&
        environmentInfo?.streamlitVersion &&
        streamlitInstallation.streamlitVersion !==
          environmentInfo.streamlitVersion
      )
    },
    [streamlitInstallation]
  )

  const handleNewSession = useCallback(
    (session: NewSession) => {
      const initializeMsg = session.initialize as Initialize
      const environmentInfo = initializeMsg.environmentInfo as EnvironmentInfo

      // When the Streamlit versions are not the same, we cannot guarantee
      // everything works correctly, we must reload the page.
      if (hasStreamlitVersionChanged(environmentInfo)) {
        window.location.reload()
        return
      }
      const userInfo = initializeMsg.userInfo as UserInfo

      // First, handle initialization logic. Each NewSession message has
      // initialization data. If this is the _first_ time we're receiving
      // the NewSession message, we perform some one-time initialization.
      if (streamlitInstallation === null) {
        setStreamlitInstallation({
          appId: h32(
            userInfo.installationIdV3 + session.mainScriptPath,
            0xdeadbeef
          ).toString(16),
          appHash: h32(
            userInfo.installationId + session.mainScriptPath,
            0xdeadbeef
          ).toString(16),
          sessionId: initializeMsg.sessionId,
          streamlitVersion: environmentInfo.streamlitVersion,
          pythonVersion: environmentInfo.pythonVersion,
          installationId: userInfo.installationId,
          installationIdV3: userInfo.installationIdV3,
          commandLine: initializeMsg.commandLine,
        })
      }
    },
    [streamlitInstallation, hasStreamlitVersionChanged]
  )

  useEffect(() => {
    return messageQueue.on<NewSession>("newSession", handleNewSession)
  }, [messageQueue, handleNewSession])

  return streamlitInstallation
}
