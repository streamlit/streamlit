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

import { Fragment, isValidElement, ReactNode } from "react"

export interface HeaderContentInputs {
  hasLogo: boolean
  hasExpandButton: boolean
  hasNavigation: boolean
  showToolbar: boolean
  hasRightContent: boolean
}

/**
 * Returns whether a React node tree contains anything that actually renders.
 *
 * Empty fragments are truthy React values, but they do not render visible
 * header content. Callers should use this instead of plain truthiness when a
 * collapsed header depends on whether a slot has real content.
 */
export function hasRenderableNode(node: ReactNode): boolean {
  if (node === null || node === undefined || typeof node === "boolean") {
    return false
  }

  if (Array.isArray(node)) {
    return node.some(child => hasRenderableNode(child))
  }

  if (typeof node === "string" || typeof node === "number") {
    return true
  }

  if (
    isValidElement<{ children?: ReactNode }>(node) &&
    node.type === Fragment
  ) {
    return hasRenderableNode(node.props.children)
  }

  return true
}

/**
 * Determines whether the header has visible content that occupies layout space.
 *
 * The header is sticky and takes up flow space only when it has content to show.
 * This function is shared between the Header component (to decide transparent vs
 * opaque rendering and height) and AppView (to adjust block container padding).
 * Keeping it in one place prevents the two from diverging — a mismatch would cause
 * the padding to over- or under-compensate for the header's height.
 *
 * Note: `showToolbar` alone is not sufficient — the toolbar slot only occupies
 * space when `rightContent` (e.g. the deploy/settings menu) actually renders.
 */
export function hasVisibleHeaderContent({
  hasLogo,
  hasExpandButton,
  hasNavigation,
  showToolbar,
  hasRightContent,
}: HeaderContentInputs): boolean {
  return (
    hasLogo ||
    hasExpandButton ||
    hasNavigation ||
    (showToolbar && hasRightContent)
  )
}
