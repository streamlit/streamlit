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

import { createContext, useContext } from "react"

export enum GitState {
  DEFAULT = "DEFAULT",
  HEAD_DETACHED = "HEAD_DETACHED",
  AHEAD_OF_REMOTE = "AHEAD_OF_REMOTE",
}

export interface GitInfo {
  repository: string
  branch: string
  module: string
  untrackedFiles: string[]
  uncommittedFiles: string[]
  state: GitState
}

export const GitContext = createContext<GitInfo | null>(null)

export function useGit(): GitInfo {
  const context = useContext(GitContext)

  if (context === null) {
    throw new Error("useGit must be used within a GitContextProvider")
  }

  return context
}
