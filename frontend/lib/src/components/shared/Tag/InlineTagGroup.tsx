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

import { FC, memo, ReactNode, RefObject, UIEvent } from "react"

import { StyledTagGroupContainer } from "./styled-components"
import Tag from "./Tag"

interface InlineTagGroupProps {
  /** Currently selected string values to render as tags. */
  items: string[]
  /** Called with the value string to remove when a tag's remove button fires. */
  onRemove: (item: string) => void
  /** When true all tags are rendered in a non-interactive (disabled) state. */
  disabled?: boolean
  /**
   * Ref passed to the scrollable container so the parent can control / read
   * the scroll position for scroll-preservation on tag removal.
   */
  containerRef: RefObject<HTMLDivElement>
  /**
   * Scroll handler forwarded to the container so the parent can record the
   * scroll offset before a tag is removed.
   */
  onScroll: (e: UIEvent<HTMLDivElement>) => void
  /**
   * The filter `<Input>` element rendered after all tags so that it sits
   * inline in the same wrapping flex row.
   */
  inputElement: ReactNode
  /** CSS max-height for the scrollable tag area (e.g. a `calc(...)` string). */
  maxHeight?: string
}

/**
 * A scrollable flex-wrap container that renders selected items as Tag pills
 * followed by an inline filter input.
 *
 * Scroll position is preserved across renders by having the parent pass
 * `containerRef` and an `onScroll` handler that records `scrollTop` in a ref,
 * then restore it via a `useLayoutEffect` in the parent.
 */
const InlineTagGroup: FC<InlineTagGroupProps> = ({
  items,
  onRemove,
  disabled,
  containerRef,
  onScroll,
  inputElement,
  maxHeight,
}) => (
  <StyledTagGroupContainer
    ref={containerRef}
    onScroll={onScroll}
    $maxHeight={maxHeight}
    data-testid="stMultiSelectTagContainer"
  >
    {items.map(item => (
      <Tag
        key={item}
        label={item}
        onRemove={() => onRemove(item)}
        disabled={disabled}
      />
    ))}
    {inputElement}
  </StyledTagGroupContainer>
)

export default memo(InlineTagGroup)
