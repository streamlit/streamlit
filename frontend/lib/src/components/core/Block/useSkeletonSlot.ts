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

import { useCallback, useContext, useEffect, useMemo, useState } from "react"

import type { Spinner as SpinnerProto, streamlit } from "@streamlit/protobuf"

import { ScriptRunContext } from "~lib/components/core/ScriptRunContext"
import useTimeout from "~lib/hooks/useTimeout"
import type { BlockNode } from "~lib/render-tree/BlockNode"
import { getLoadingBlockState } from "~lib/render-tree/skeletonUtils"
import { ScriptRunState } from "~lib/ScriptRunState"
import { notNullOrUndefined } from "~lib/util/utils"

import { PendingSkeletonContext } from "./PendingSkeletonContext"
import { PENDING_SKELETON_DELAY_MS } from "./styled-components"

/** How a container renders the skeleton of its slot right now. */
export interface SkeletonSlot {
  /** Whether an overlay can cover the container, so it sets `position`. */
  canShowOverlay: boolean
  /** Whether the container shows its inline skeleton and hides its children. */
  showsInlineSkeleton: boolean
  /** Whether the container covers its children with the skeleton overlay. */
  showsOverlay: boolean
  /** Whether the children wait under a skeleton, including its grace period. */
  isChildrenPending: boolean
  /** The inline skeleton's height (`Block.loading.skeleton_height`). */
  skeletonHeight?: streamlit.HeightConfig.$Properties | null
  /** The spinner shown on the skeleton as its label. */
  label?: SpinnerProto.$Properties
}

/** The slot of a container that shows no skeleton. */
export const NO_SKELETON_SLOT: SkeletonSlot = {
  canShowOverlay: false,
  showsInlineSkeleton: false,
  showsOverlay: false,
  isChildrenPending: false,
}

/**
 * Compute how a container shows the skeleton of its slot.
 *
 * - A loading block (`Block.loading`) without previous content shows an inline
 *   skeleton until the current run draws its first visible element into it.
 * - With previous content, the content stays mounted and the overlay covers
 *   it after the grace period. A standalone skeleton waiting on the
 *   container's content (`BlockNode.pendingSkeleton`) does the same.
 *
 * `BlockNodeRenderer` calls this hook because the renderer stays mounted while
 * hiding an empty block, so a cleared slot counts as existing on the next run.
 */
export function useSkeletonSlot(node: BlockNode): SkeletonSlot {
  const { scriptRunId, scriptRunState, fragmentIdsThisRun } =
    useContext(ScriptRunContext)
  const isInPendingSkeleton = useContext(PendingSkeletonContext)
  const isRunning = scriptRunState === ScriptRunState.RUNNING
  const loadingState = useMemo(
    () =>
      getLoadingBlockState(node, scriptRunId, isRunning, fragmentIdsThisRun),
    [node, scriptRunId, isRunning, fragmentIdsThisRun]
  )

  // An enclosing loading block that shows its skeleton already covers this one.
  const wantsInlineSkeleton =
    loadingState.isPending &&
    !loadingState.hasPreviousContent &&
    !isInPendingSkeleton
  // A block from an earlier run waits for the grace period before it shows its
  // inline skeleton, so a slot that a cached rerun fills quickly, or that gets
  // no content, doesn't flash it. A new block reserves its space right away.
  // A CSS delay can't do this: a hidden skeleton still takes up its height.
  // An empty slot keeps its renderer, and so its wait, because the backend
  // queue merges the skeleton element `st.skeleton()` sends into the loading
  // block that replaces it at the same path.
  const [mountedRunId] = useState(scriptRunId)
  const existedInEarlierRun = mountedRunId !== scriptRunId
  const [graceElapsedRunId, setGraceElapsedRunId] = useState<string>()
  const isGraceElapsed = graceElapsedRunId === scriptRunId
  const handleGraceElapsed = useCallback(
    () => setGraceElapsedRunId(scriptRunId),
    [scriptRunId]
  )
  const { restart: restartGraceTimer } = useTimeout(
    handleGraceElapsed,
    wantsInlineSkeleton && existedInEarlierRun
      ? PENDING_SKELETON_DELAY_MS
      : null
  )
  // The delay can stay set across runs, so each run restarts the timer.
  useEffect(() => restartGraceTimer(), [scriptRunId, restartGraceTimer])

  const hasPendingSkeleton = notNullOrUndefined(node.pendingSkeleton)
  return {
    canShowOverlay:
      notNullOrUndefined(node.deltaBlock.loading) || hasPendingSkeleton,
    showsInlineSkeleton:
      wantsInlineSkeleton && (!existedInEarlierRun || isGraceElapsed),
    showsOverlay:
      !isInPendingSkeleton &&
      ((loadingState.isPending && loadingState.hasPreviousContent) ||
        hasPendingSkeleton),
    isChildrenPending: isInPendingSkeleton || loadingState.isPending,
    skeletonHeight: node.deltaBlock.loading?.skeletonHeight,
    label: loadingState.label,
  }
}
