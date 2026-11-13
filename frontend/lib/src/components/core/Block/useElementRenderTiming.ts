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
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react"

import type { ElementNode } from "~lib/AppNode"
import { RenderTimingContext } from "~lib/components/core/RenderTimingContext"
import type { ElementTimingHandle } from "~lib/util/performance/RenderTimingTracker"

interface ElementRenderTiming {
  /** Null when render timing isn't measured. */
  handle: ElementTimingHandle | null
  /** Attach to the element container's DOM node. */
  containerRef: RefObject<HTMLDivElement>
}

/**
 * Registers an element container with the app's render timing tracker each
 * time it commits a new or changed element payload.
 */
export function useElementRenderTiming(
  node: ElementNode
): ElementRenderTiming {
  const tracker = useContext(RenderTimingContext)
  const handle = useMemo(
    () => tracker?.createElementHandle() ?? null,
    [tracker]
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const { element, scriptRunId } = node

  useLayoutEffect(() => {
    if (!handle) return

    handle.setTarget(containerRef.current)
    handle.elementCommitted(scriptRunId, element, element.type ?? "")
  }, [handle, element, scriptRunId])

  useEffect(() => {
    return () => {
      handle?.dispose()
    }
  }, [handle])

  return { handle, containerRef }
}
