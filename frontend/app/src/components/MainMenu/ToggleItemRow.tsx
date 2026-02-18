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
 * Toggle (on/off switch) menu item using BaseUI's Checkbox in toggle mode.
 *
 * Extracted from MainMenu.tsx for readability. Renders a
 * `role="menuitemcheckbox"` row with keyboard activation (Enter/Space)
 * and consistent focus/hover styling.
 */

import { KeyboardEvent, memo, ReactElement, useCallback } from "react"

import { Checkbox, LABEL_PLACEMENT, STYLE_TYPE } from "baseui/checkbox"
import type { CheckboxOverrides } from "baseui/checkbox/types"

import { hasLightBackgroundColor, useEmotionTheme } from "@streamlit/lib"

import type { MenuToggleItem } from "./MainMenu"
import { StyledToggleRow } from "./styled-components"

interface ToggleItemRowProps {
  item: MenuToggleItem
  tabIndex: number
  itemIndex: number
  setItemRef: (index: number, element: HTMLElement | null) => void
}

/**
 * Style overrides for the toggle switch within the menu.
 */
function getToggleOverrides(
  theme: ReturnType<typeof useEmotionTheme>,
  lightTheme: boolean,
  isDisabled: boolean
): CheckboxOverrides {
  return {
    // The outer StyledToggleRow owns focus (role="menuitemcheckbox") and
    // roving tabindex.  Remove the inner <input> from the tab order so it
    // doesn't create a duplicate focus target or break handleMenuFocus
    // (which matches event.target against stored row refs).
    Input: {
      props: {
        tabIndex: -1,
        // The outer row already exposes role/aria-checked; hide the
        // redundant input from assistive technology.
        "aria-hidden": true,
      },
    },
    Root: {
      style: {
        // All pointer interaction is handled by the parent StyledToggleRow,
        // so the Checkbox's label/input don't intercept clicks (which would
        // cause double-toggle via label→input click forwarding).
        pointerEvents: "none" as const,
        width: "100%",
        margin: 0,
        padding: `${theme.spacing.threeXS} ${theme.spacing.sm}`,
        display: "flex",
        flexDirection: "row-reverse" as const,
        alignItems: "center",
        justifyContent: "space-between",
        cursor: isDisabled ? "not-allowed" : "pointer",
        backgroundColor: theme.colors.transparent,
        borderRadius: theme.radii.default,
        // Hover/focus styling is on StyledToggleRow (the focusable parent)
      },
    },
    Label: {
      style: {
        paddingLeft: theme.spacing.none,
        paddingRight: theme.spacing.none,
        marginLeft: theme.spacing.none,
        marginRight: theme.spacing.none,
        fontSize: theme.fontSizes.sm,
        lineHeight: `${theme.lineHeights.small}rem`,
        color: isDisabled ? theme.colors.fadedText60 : theme.colors.bodyText,
      },
    },
    Toggle: {
      style: ({ $checked }: { $checked: boolean }) => {
        let backgroundColor = lightTheme
          ? theme.colors.bgColor
          : theme.colors.bodyText

        if (isDisabled) {
          backgroundColor = lightTheme
            ? theme.colors.gray70
            : theme.colors.gray90
        }

        return {
          width: `calc(${theme.sizes.checkbox} - ${theme.spacing.twoXS})`,
          height: `calc(${theme.sizes.checkbox} - ${theme.spacing.twoXS})`,
          transform: $checked ? `translateX(${theme.sizes.checkbox})` : "",
          backgroundColor,
          boxShadow: "",
        }
      },
    },
    ToggleTrack: {
      style: ({ $checked }: { $checked: boolean }) => {
        let backgroundColor = theme.colors.borderColor

        if ($checked && !isDisabled) {
          backgroundColor = theme.colors.primary
        }

        return {
          marginRight: 0,
          marginLeft: 0,
          marginBottom: 0,
          marginTop: 0,
          paddingLeft: theme.spacing.threeXS,
          paddingRight: theme.spacing.threeXS,
          width: `calc(2 * ${theme.sizes.checkbox})`,
          minWidth: `calc(2 * ${theme.sizes.checkbox})`,
          height: theme.sizes.checkbox,
          minHeight: theme.sizes.checkbox,
          borderBottomLeftRadius: theme.radii.full,
          borderTopLeftRadius: theme.radii.full,
          borderBottomRightRadius: theme.radii.full,
          borderTopRightRadius: theme.radii.full,
          backgroundColor,
        }
      },
    },
  }
}

/**
 * Renders a toggle (on/off switch) menu item using BaseUI's Checkbox toggle.
 * Memoized for performance - prevents unnecessary re-renders.
 */
const ToggleItemRow = memo(function ToggleItemRow({
  item,
  tabIndex,
  itemIndex,
  setItemRef,
}: ToggleItemRowProps): ReactElement {
  const theme = useEmotionTheme()
  const lightTheme = hasLightBackgroundColor(theme)

  const handleRef = useCallback(
    (element: HTMLDivElement | null): void => {
      setItemRef(itemIndex, element)
    },
    [setItemRef, itemIndex]
  )

  const handleClick = useCallback((): void => {
    if (!item.disabled) {
      item.onToggle()
    }
  }, [item])

  // WAI-ARIA: menuitemcheckbox must be activatable via Enter and Space.
  // Since StyledToggleRow is a <div> (not a <button>), the browser won't
  // natively fire click on Enter/Space.  Forward these keys to the toggle.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        if (!item.disabled) {
          item.onToggle()
        }
      }
    },
    [item]
  )

  return (
    <StyledToggleRow
      ref={handleRef}
      isDisabled={item.disabled}
      role="menuitemcheckbox"
      aria-checked={item.checked}
      aria-disabled={item.disabled || undefined}
      tabIndex={tabIndex}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-testid="stMainMenuAutoRerun"
    >
      <Checkbox
        checked={item.checked}
        checkmarkType={STYLE_TYPE.toggle}
        disabled={item.disabled}
        // onChange is a no-op: toggling is driven by the parent row's
        // onClick / onKeyDown.  The Checkbox Root has pointerEvents: "none"
        // so clicks pass through to StyledToggleRow.
        onChange={() => {}}
        overrides={getToggleOverrides(theme, lightTheme, !!item.disabled)}
        labelPlacement={LABEL_PLACEMENT.right}
      >
        {item.label}
      </Checkbox>
    </StyledToggleRow>
  )
})

export default ToggleItemRow
