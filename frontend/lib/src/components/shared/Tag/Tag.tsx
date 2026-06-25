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

import { FC, memo } from "react"

import {
  StyledTagButton,
  StyledTagRemoveIcon,
  StyledTagText,
} from "./styled-components"

interface TagProps {
  /** Label text shown inside the tag and used for the overflow tooltip. */
  label: string
  /** Called when the user clicks/activates the remove button. */
  onRemove: () => void
  /** When true the tag is non-interactive (no hover, no click). */
  disabled?: boolean
}

/**
 * A removable chip / tag pill.
 *
 * The entire element is a `<button>` with `title="Delete"` so that tests can
 * locate it via `getAllByTitle("Delete")` and so keyboard users can remove a
 * tag with Enter / Space. The inner text span carries its own `title` for
 * overflow tooltip display.
 */
const Tag: FC<TagProps> = ({ label, onRemove, disabled }) => (
  <StyledTagButton
    title="Delete"
    type="button"
    disabled={disabled}
    onClick={disabled ? undefined : onRemove}
    $disabled={disabled}
    aria-label={`Remove ${label}`}
    data-testid="stTag"
  >
    <StyledTagText title={label}>{label}</StyledTagText>
    <StyledTagRemoveIcon aria-hidden="true">
      <svg
        height="0.5em"
        viewBox="0 0 10 10"
        width="0.5em"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M9 1L5 5M1 9L5 5M5 5L1 1M5 5L9 9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    </StyledTagRemoveIcon>
  </StyledTagButton>
)

export default memo(Tag)
