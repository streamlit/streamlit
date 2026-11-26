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

import {
  type RefObject,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
} from "react"

import { ElementTimingContext } from "~lib/components/core/RenderTimingContext"
import type { ElementLoadKind } from "~lib/util/performance/RenderTimingTracker"

function hasMediaLoaded(
  node: HTMLImageElement | HTMLMediaElement | null | undefined
): boolean {
  if (node instanceof HTMLImageElement) return node.complete
  if (node instanceof HTMLMediaElement) {
    // A browser that decides not to preload stops at NETWORK_IDLE and fires
    // `suspend` instead of `loadeddata`.
    return (
      node.readyState >= node.HAVE_CURRENT_DATA ||
      node.networkState === node.NETWORK_IDLE
    )
  }
  return false
}

/**
 * Tells the browser's render timing metrics whether an element is still
 * waiting on asynchronous work before it's fully drawn: code loading
 * behind the element's own Suspense boundary (`"code"`), a chart library
 * drawing (`"draw"`) or media loading (`"media"`). The element stays
 * pending until every call passes `isLoaded: true`, or until the calling
 * component unmounts.
 *
 * An element that keeps drawing or loading after it commits must use this
 * hook or `useElementLoadCallback`. Otherwise render timing counts it as
 * fully drawn on its first paint, and nothing flags the early time.
 *
 * Does nothing when render timing isn't measured.
 */
export function useElementLoadState(
  kind: ElementLoadKind,
  isLoaded: boolean
): void {
  useElementLoadCallback(kind, isLoaded ? null : true)
}

/**
 * Like `useElementLoadState`, for work that finishes in an event handler
 * (such as an image's `load` event), without adding state or re-renders.
 * The work identified by `workKey` counts as pending from when it commits
 * until the returned callback is called. Pass a primitive, such as a URL or
 * spec string, since the key is compared by identity. `workKey` can be:
 *
 * - A value that changes with the work, such as an image URL: each new
 *   value is tracked again, and the callbacks of earlier values do nothing.
 * - A constant, such as `true`: the work is tracked once per mount, not
 *   again when the element's payload changes.
 * - `null` or `undefined`: the element has no such work.
 *
 * Pass `mediaRef` when the work is an `<img>`, `<video>` or `<audio>`
 * loading, so a resource that finished before the element committed doesn't
 * count as pending.
 *
 * Does nothing when render timing isn't measured.
 */
export function useElementLoadCallback(
  kind: ElementLoadKind,
  workKey: unknown,
  mediaRef?: RefObject<HTMLImageElement | HTMLMediaElement | null>
): () => void {
  const handle = useContext(ElementTimingContext)
  const slotId = useId()
  const pendingWorkKeyRef = useRef<unknown>(undefined)

  useLayoutEffect(() => {
    if (!handle || workKey === null || workKey === undefined) return

    pendingWorkKeyRef.current = workKey
    // A cached resource can finish loading while a time-sliced render is
    // paused, before React commits the element and can deliver its event.
    if (hasMediaLoaded(mediaRef?.current)) return
    handle.setLoading(slotId, kind, true)
    return () => {
      handle.setLoading(slotId, kind, false)
    }
  }, [handle, slotId, kind, workKey, mediaRef])

  return useCallback(() => {
    if (pendingWorkKeyRef.current !== workKey) return
    handle?.setLoading(slotId, kind, false)
  }, [handle, slotId, kind, workKey])
}
