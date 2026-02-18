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

/**
 * Toggle (on/off switch) menu item rendered as a pure visual toggle.
 *
 * Renders a `role="menuitemcheckbox"` row with keyboard activation
 * (Enter/Space) and consistent focus/hover styling.  The toggle track
 * and knob are plain styled-components — no hidden form inputs or
 * third-party checkbox components.
 */

import { KeyboardEvent, memo, ReactElement, useCallback } from "react"

import type { MenuToggleItem } from "./MainMenu"
import {
  StyledToggleKnob,
  StyledToggleRow,
  StyledToggleTrack,
} from "./styled-components"

interface ToggleItemRowProps {
  item: MenuToggleItem
  tabIndex: number
  itemIndex: number
  setItemRef: (index: number, element: HTMLElement | null) => void
}

/**
 * Renders a toggle (on/off switch) menu item.
 * Memoized for performance — prevents unnecessary re-renders.
 */
const ToggleItemRow = memo(function ToggleItemRow({
  item,
  tabIndex,
  itemIndex,
  setItemRef,
}: ToggleItemRowProps): ReactElement {
  const { key, label, checked, disabled, onToggle } = item

  const handleRef = useCallback(
    (element: HTMLDivElement | null): void => {
      setItemRef(itemIndex, element)
    },
    [setItemRef, itemIndex]
  )

  const handleClick = useCallback((): void => {
    if (!disabled) {
      onToggle()
    }
  }, [disabled, onToggle])

  // WAI-ARIA: menuitemcheckbox must be activatable via Enter and Space.
  // Since StyledToggleRow is a <div> (not a <button>), the browser won't
  // natively fire click on Enter/Space.  Forward these keys to the toggle.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        if (!disabled) {
          onToggle()
        }
      }
    },
    [disabled, onToggle]
  )

  return (
    <StyledToggleRow
      ref={handleRef}
      isDisabled={disabled}
      role="menuitemcheckbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={tabIndex}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-testid={`stMainMenuItem-${key}`}
    >
      {label}
      <StyledToggleTrack isChecked={checked} isDisabled={disabled}>
        <StyledToggleKnob isChecked={checked} isDisabled={disabled} />
      </StyledToggleTrack>
    </StyledToggleRow>
  )
})

export default ToggleItemRow
