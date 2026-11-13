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

import { createContext } from "react"

import type {
  ElementTimingHandle,
  RenderTimingTracker,
} from "~lib/util/performance/RenderTimingTracker"

/**
 * The app's render timing tracker, or null when render timing isn't measured
 * (local apps, or usage stats turned off).
 */
export const RenderTimingContext = createContext<RenderTimingTracker | null>(
  null
)
RenderTimingContext.displayName = "RenderTimingContext"

/**
 * The render timing handle of the enclosing element container, or null when
 * render timing isn't measured.
 */
export const ElementTimingContext = createContext<ElementTimingHandle | null>(
  null
)
ElementTimingContext.displayName = "ElementTimingContext"
