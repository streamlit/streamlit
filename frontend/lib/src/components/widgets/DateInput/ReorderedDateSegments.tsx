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

import { ReactElement, useContext } from "react"

import { DateFieldStateContext } from "react-aria-components"

import { reorderSegments } from "./dateInputUtils"
import { StyledDateFieldInput, StyledDateSegment } from "./styled-components"

/**
 * Renders `state.segments` reordered to match `format` instead of the
 * locale-derived order React Aria would otherwise use — the Phase 0 spike's
 * chosen strategy (manual reordering via `useDateFieldState`, not
 * locale-substitution). Must be a child of `DateField` to read
 * `DateFieldStateContext`.
 *
 * Shared by `SingleDateInput` and `RangeDateInput`'s start/end fields — the
 * format-order logic is identical regardless of how many `DateField`s a
 * given mode renders.
 */
export function ReorderedDateSegments({
  format,
}: {
  format: string
}): ReactElement | null {
  const state = useContext(DateFieldStateContext)
  if (!state) return null

  const segments = reorderSegments(state.segments, format)

  return (
    <StyledDateFieldInput>
      {segments.map((segment, i) => (
        // Index is safe here: `segments` is a fixed-length, fixed-order
        // array derived from `format` (which doesn't change across
        // re-renders of a given DateInput instance), so there's no
        // reordering/insertion for React to misreconcile. A stable key is
        // needed only to disambiguate the (otherwise identical) literal
        // separator segments, since `segment.type` alone repeats for those.
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <StyledDateSegment key={`${segment.type}-${i}`} segment={segment} />
      ))}
    </StyledDateFieldInput>
  )
}
