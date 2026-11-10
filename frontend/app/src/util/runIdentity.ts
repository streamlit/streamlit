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
  /**
   * Fragments this run reruns, with parent fragments before nested ones.
   * Empty for a full-app run.
   */
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

/** A finished run's identity and which of its fragments' output was delivered. */
export interface FinishedRun extends RunIdentity {
  /**
   * Fragments of the run whose output the server discarded before delivery,
   * because those fragments rerun next.
   */
  droppedFragmentIds: ReadonlySet<string>
  /**
   * Fragments whose stale nodes this finish clears: fragmentIds minus
   * droppedFragmentIds. Empty for a full-app run. Undefined if delivery lists
   * every fragment (the server downgrades such finishes instead), because an
   * empty list would mean a full-app run.
   */
  cleanupFragmentIds?: string[]
}

/**
 * Reads a finished run from script_finished metadata: its identity from
 * metadata.run and its delivered output from metadata.delivery. Returns
 * undefined when there is no run identity.
 */
export function getFinishedRun(
  metadata?: ForwardMsgMetadata | null
): FinishedRun | undefined {
  const runIdentity = getRunIdentity(metadata)
  if (!runIdentity) {
    return undefined
  }
  const droppedFragmentIds = new Set(metadata?.delivery?.droppedFragmentIds)
  const cleanupFragmentIds = runIdentity.fragmentIds.filter(
    fragmentId => !droppedFragmentIds.has(fragmentId)
  )
  const isEveryFragmentDropped =
    runIdentity.fragmentIds.length > 0 && cleanupFragmentIds.length === 0
  return {
    ...runIdentity,
    droppedFragmentIds,
    cleanupFragmentIds: isEveryFragmentDropped
      ? undefined
      : cleanupFragmentIds,
  }
}
