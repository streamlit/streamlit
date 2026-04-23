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

import { ComponentType, forwardRef, ReactNode } from "react"

import { StyledHighlightWrapper } from "./styled-components"

interface HighlightListItemProps {
  $isHighlighted?: boolean
  children?: ReactNode
}

/**
 * Factory function that creates a list item component with highlight wrapper.
 * Use this for dropdown list items that need consistent highlight styling.
 *
 * @param ListItemComponent - The outer list item component (e.g., styled li)
 */
export function createHighlightListItem<P extends HighlightListItemProps>(
  ListItemComponent: ComponentType<P>
): ComponentType<P> {
  const HighlightListItem = forwardRef<HTMLLIElement, P>(
    ({ children, $isHighlighted, ...props }, ref) => (
      <ListItemComponent ref={ref} {...(props as unknown as P)}>
        <StyledHighlightWrapper $isHighlighted={$isHighlighted}>
          {children}
        </StyledHighlightWrapper>
      </ListItemComponent>
    )
  )

  HighlightListItem.displayName = `HighlightListItem(${
    ListItemComponent.displayName || ListItemComponent.name || "Component"
  })`

  return HighlightListItem as unknown as ComponentType<P>
}
