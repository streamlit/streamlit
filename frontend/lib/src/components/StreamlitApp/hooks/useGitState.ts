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
import type { MessageQueue } from "../lib/MessageQueue"
import { GitInfo as GitInfoProto } from "../../../proto"
import { GitState, type GitInfo } from "../stores/GitContext"

export function useGitState(messageQueue: MessageQueue): GitInfo | null {
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)

  const convertState = useCallback(
    (orignalState: GitInfoProto.GitStates): GitState => {
      switch (orignalState) {
        case GitInfoProto.GitStates.DEFAULT:
          return GitState.DEFAULT
        case GitInfoProto.GitStates.HEAD_DETACHED:
          return GitState.HEAD_DETACHED
        case GitInfoProto.GitStates.AHEAD_OF_REMOTE:
          return GitState.AHEAD_OF_REMOTE
      }
    },
    []
  )

  useEffect(() => {
    messageQueue.on<GitInfoProto>("gitInfoChanged", info => {
      setGitInfo({
        ...info,
        state: convertState(info.state),
      })
    })
  }, [convertState, messageQueue])

  return gitInfo
}
