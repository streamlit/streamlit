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
import type { DateSegment as IDateSegment } from "react-stately"

import { reorderSegments } from "~lib/components/widgets/DateInput/dateInputUtils"

import { StyledDateFieldInput, StyledDateSegment } from "./styled-components"

const DATE_SEGMENT_TYPES = new Set(["year", "month", "day"])
const TIME_SEGMENT_TYPES = new Set(["hour", "minute", "second", "dayPeriod"])

/**
 * Renders date segments reordered per `format`, then appends a ", " literal
 * separator followed by time segments in their natural order. Must be a child
 * of `DateField<CalendarDateTime>` to read `DateFieldStateContext`.
 */
export function ReorderedDateTimeSegments({
  format,
}: {
  format: string
}): ReactElement | null {
  const state = useContext(DateFieldStateContext)
  if (!state) return null

  // Extract only the date segments for reordering.
  const dateSegments = state.segments.filter(
    seg => DATE_SEGMENT_TYPES.has(seg.type) || seg.type === "literal"
  )
  // Filter out the time-related literal separators that got included.
  // We only want date literals (the ones between date segments).
  const reorderedDate = reorderSegments(
    dateSegments.filter(seg => seg.type !== "literal" || seg.text !== ", "),
    format
  )

  // Time segments in their natural order from state.
  const timeSegments = state.segments.filter(
    seg =>
      TIME_SEGMENT_TYPES.has(seg.type) ||
      (seg.type === "literal" && seg.text === ":")
  )

  // Build combined segment list: date + ", " + time.
  const commaLiteral: IDateSegment = {
    type: "literal",
    text: ", ",
    isPlaceholder: false,
    placeholder: "",
    isEditable: false,
  }

  const combined = [...reorderedDate, commaLiteral, ...timeSegments]

  return (
    <StyledDateFieldInput>
      {combined.map((segment, i) => (
        // Index key is safe: segments is a fixed-length, fixed-order array.
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <StyledDateSegment key={`${segment.type}-${i}`} segment={segment} />
      ))}
    </StyledDateFieldInput>
  )
}
