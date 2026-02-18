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
  setItemRef: (index: number, element: HTMLButtonElement | null) => void
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
    Root: {
      style: {
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
      // The StyledToggleRow is a div, but we store it alongside button refs
      // for roving tabindex. Cast is safe — we only need .focus().
      setItemRef(itemIndex, element as unknown as HTMLButtonElement | null)
    },
    [setItemRef, itemIndex]
  )

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
      onKeyDown={handleKeyDown}
      data-testid="stMainMenuAutoRerun"
    >
      <Checkbox
        checked={item.checked}
        checkmarkType={STYLE_TYPE.toggle}
        disabled={item.disabled}
        onChange={() => item.onToggle()}
        overrides={getToggleOverrides(theme, lightTheme, !!item.disabled)}
        labelPlacement={LABEL_PLACEMENT.right}
        aria-label={item.label}
      >
        {item.label}
      </Checkbox>
    </StyledToggleRow>
  )
})

export default ToggleItemRow
