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

import { reorderSegments } from "./dateInputUtils"
import { StyledDateFieldInput, StyledDateSegment } from "./styled-components"

const DATE_SEGMENT_TYPES = new Set(["year", "month", "day"])
const TIME_SEGMENT_TYPES = new Set(["hour", "minute", "second", "dayPeriod"])

// These literal filters assume en-US locale with 24h cycle: `, ` separates
// date from time and `:` separates time parts. Update when locale/hourCycle
// support is added.
function buildDateTimeSegments(
  segments: readonly IDateSegment[],
  format: string
): IDateSegment[] {
  const dateSegments = segments.filter(
    seg =>
      DATE_SEGMENT_TYPES.has(seg.type) ||
      (seg.type === "literal" && seg.text !== ", ")
  )
  const reorderedDate = reorderSegments(dateSegments, format)

  const timeSegments = segments.filter(
    seg =>
      TIME_SEGMENT_TYPES.has(seg.type) ||
      (seg.type === "literal" && seg.text === ":")
  )

  const commaLiteral: IDateSegment = {
    type: "literal",
    text: ", ",
    isPlaceholder: false,
    placeholder: "",
    isEditable: false,
  }

  return [...reorderedDate, commaLiteral, ...timeSegments]
}

/**
 * Renders date segments reordered per `format`. When `includeTime` is true,
 * appends a ", " literal separator followed by time segments in their natural
 * order. Must be a child of `DateField` to read `DateFieldStateContext`.
 */
export function ReorderedSegments({
  format,
  isRange,
  includeTime,
}: {
  format: string
  isRange?: boolean
  includeTime?: boolean
}): ReactElement | null {
  const state = useContext(DateFieldStateContext)
  if (!state) return null

  const segments = includeTime
    ? buildDateTimeSegments(state.segments, format)
    : reorderSegments(state.segments, format)

  return (
    <StyledDateFieldInput $isRange={isRange}>
      {segments.map((segment, i) => (
        // Index key is safe: segments is a fixed-length, fixed-order array derived from format.
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <StyledDateSegment key={`${segment.type}-${i}`} segment={segment} />
      ))}
    </StyledDateFieldInput>
  )
}
