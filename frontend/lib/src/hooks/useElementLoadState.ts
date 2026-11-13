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

import { useCallback, useContext, useId, useLayoutEffect } from "react"

import { ElementTimingContext } from "~lib/components/core/RenderTimingContext"
import type { ElementLoadKind } from "~lib/util/performance/RenderTimingTracker"

/**
 * Tells the browser's render timing metrics whether an element is still
 * waiting on asynchronous work before it's fully drawn: a chart library
 * drawing (`"draw"`) or media loading (`"media"`). The element counts as
 * fully loaded only once every call in it passes `isLoaded: true`, or the
 * calling component unmounts.
 *
 * Does nothing when render timing isn't measured.
 */
export function useElementLoadState(
  kind: ElementLoadKind,
  isLoaded: boolean
): void {
  const handle = useContext(ElementTimingContext)
  const slotId = useId()

  useLayoutEffect(() => {
    if (!handle || isLoaded) return

    handle.setLoading(slotId, kind, true)
    return () => {
      handle.setLoading(slotId, kind, false)
    }
  }, [handle, slotId, kind, isLoaded])
}

/**
 * Like `useElementLoadState`, for work that finishes in an event handler
 * (such as an image's `load` event), without adding state or re-renders.
 * The work identified by `workKey` (for example the image URL) counts as
 * pending from when it commits until the returned callback is called. Pass
 * null when the element has no such work.
 *
 * Does nothing when render timing isn't measured.
 */
export function useElementLoadCallback(
  kind: ElementLoadKind,
  workKey: unknown
): () => void {
  const handle = useContext(ElementTimingContext)
  const slotId = useId()

  useLayoutEffect(() => {
    if (!handle || workKey === null) return

    handle.setLoading(slotId, kind, true)
    return () => {
      handle.setLoading(slotId, kind, false)
    }
  }, [handle, slotId, kind, workKey])

  return useCallback(() => {
    handle?.setLoading(slotId, kind, false)
  }, [handle, slotId, kind])
}
