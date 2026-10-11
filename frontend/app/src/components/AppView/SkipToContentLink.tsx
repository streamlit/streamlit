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

import type { MouseEvent, ReactElement } from "react"

import { StyledSkipToContentLink } from "./styled-components"

/** DOM id for the main landmark; used by the skip-to-content link. */
export const MAIN_ELEMENT_ID = "stMain"

/**
 * Skip link that moves focus to the main landmark (WCAG 2.4.1).
 * Hidden until it receives keyboard focus.
 *
 * Keeps `href="#stMain"` as the no-JS fallback, but prevents the default
 * fragment navigation on activation so we do not write `location.hash` or
 * fire `hashchange` (which AppView forwards to embed hosts as UPDATE_HASH).
 */
function SkipToContentLink(): ReactElement {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault()
    document.getElementById(MAIN_ELEMENT_ID)?.focus({ preventScroll: true })
  }

  return (
    <StyledSkipToContentLink
      href={`#${MAIN_ELEMENT_ID}`}
      data-testid="stSkipToContent"
      onClick={handleClick}
    >
      Skip to main content
    </StyledSkipToContentLink>
  )
}

export default SkipToContentLink
