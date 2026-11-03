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

import type { ForwardMsgMetadata } from "@streamlit/protobuf"

/** The ID of one script run and the fragments it reruns. */
export interface RunIdentity {
  scriptRunId: string
  /** Fragments this run reruns, ancestors first. Empty means a full-app run. */
  fragmentIds: string[]
}

/**
 * Reads the run identity from ForwardMsg metadata. Returns undefined when
 * there is no run or its scriptRunId is empty.
 */
export function getRunIdentity(
  metadata?: ForwardMsgMetadata | null
): RunIdentity | undefined {
  const run = metadata?.run
  if (!run?.scriptRunId) {
    return undefined
  }
  return {
    scriptRunId: run.scriptRunId,
    fragmentIds: run.fragmentIds ?? [],
  }
}
