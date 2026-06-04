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

import styled from "@emotion/styled"
import {
  Radio as RARadio,
  RadioGroup as RARadioGroup,
} from "react-aria-components"

import { convertRemToPx } from "~lib/theme/utils"

interface StyledRadioGroupProps {
  $horizontal: boolean
  $hasCaptions: boolean
}

/**
 * Flex container for the radio group. Controls direction, wrap, gap, and
 * minimum height. `shouldForwardProp` prevents `$`-prefixed layout props from
 * being forwarded to React Aria's RadioGroup component. The native `orientation`
 * prop passes through so React Aria sets the correct `data-orientation`
 * attribute and uses the right arrow-key direction for keyboard navigation.
 */
export const StyledRadioGroup = styled(RARadioGroup, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<StyledRadioGroupProps>(({ theme, $horizontal, $hasCaptions }) => ({
  display: "flex",
  flexDirection: $horizontal ? "row" : "column",
  flexWrap: "wrap",
  // Horizontal groups use `center` to match BaseWeb's default, which distributes
  // the minElementHeight space evenly above and below the items. Vertical groups
  // use `flex-start` so items stack from the top.
  alignItems: $horizontal ? "center" : "flex-start",
  // Horizontal groups always use `lg` (16px) between items regardless of
  // captions, matching the effective spacing of the old BaseWeb implementation
  // (which combined a `sm` per-item marginRight with a `sm` group gap = 16px).
  // Vertical groups add `sm` between items only when captions are present.
  gap: $horizontal
    ? theme.spacing.lg
    : $hasCaptions
      ? theme.spacing.sm
      : theme.spacing.none,
  minHeight: theme.sizes.minElementHeight,
}))

/**
 * Outer `<label>` wrapper for each individual radio option.
 * React Aria sets `data-focus-visible`, `data-disabled`, `data-selected` etc.
 * as data attributes — we use those for state-driven styles.
 *
 * This element is intentionally a plain block container. Layout (circle + text
 * alignment) is handled by the children so that the caption can live outside
 * the circle/text row without requiring any manual offset calculations.
 */
export const StyledRadioItem = styled(RARadio)(({ theme }) => ({
  display: "block",
  cursor: "pointer",
  userSelect: "none",
  paddingLeft: theme.spacing.none,
  paddingRight: theme.spacing.threeXS,
  marginTop: theme.spacing.none,
  marginBottom: theme.spacing.none,
  "&[data-focus-visible]": {
    backgroundColor: theme.colors.darkenedBgMix25,
  },
  "&[data-disabled]": {
    cursor: "not-allowed",
  },
}))

interface StyledRadioContentProps {
  $isDisabled: boolean
}

/**
 * Flex column that wraps all visible content (option row + caption) for a
 * single radio option. Owns the disabled text-colour so both the option label
 * and the caption dim together without each needing their own prop.
 */
export const StyledRadioContent = styled.div<StyledRadioContentProps>(
  ({ theme, $isDisabled }) => ({
    display: "flex",
    flexDirection: "column",
    color: $isDisabled ? theme.colors.fadedText40 : theme.colors.bodyText,
  })
)

/**
 * Flex row that contains only the radio circle and the option label text.
 * Using `align-items: center` here centers the circle with the label text
 * naturally — no `marginTop` offset calculations needed, regardless of font
 * size or line height.
 */
export const StyledRadioRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,
}))

interface StyledRadioOuterProps {
  $isSelected: boolean
  $isDisabled: boolean
}

/**
 * Visual outer circle of the radio button indicator.
 * Background color reflects checked + enabled state.
 * No margin offset needed: the parent `StyledRadioRow` uses `align-items:
 * center` and contains only this circle and the option text, so centering is
 * automatic.
 */
export const StyledRadioOuter = styled.div<StyledRadioOuterProps>(
  ({ theme, $isSelected, $isDisabled }) => ({
    width: theme.sizes.checkbox,
    height: theme.sizes.checkbox,
    flexShrink: 0,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      $isSelected && !$isDisabled
        ? theme.colors.primary
        : theme.colors.borderColor,
  })
)

interface StyledRadioInnerProps {
  $isSelected: boolean
}

/**
 * Inner circle of the radio button indicator. Changes both size and colour
 * to express checked vs unchecked:
 *
 * - Checked: 37.5% of outer diameter (small centre dot), white so it is
 *   visible against the primary-coloured outer circle in both light and dark
 *   mode.
 * - Unchecked: outer − threeXS spacing (large fill leaving only a thin ring),
 *   `bgColor` so the fill blends with the page background, making only the
 *   thin `borderColor` ring visible.
 *
 * Sizes are pixel-rounded to prevent uneven-border artifacts from fractional
 * rem-to-px conversions.
 */
export const StyledRadioInner = styled.div<StyledRadioInnerProps>(
  ({ theme, $isSelected }) => {
    const checkboxSize = parseFloat(theme.sizes.checkbox)
    const threeXSSpacing = parseFloat(theme.spacing.threeXS)

    const outerPx = convertRemToPx(checkboxSize.toString())
    const checkedPx = Math.round(outerPx * 0.375)

    let uncheckedPx = Math.round(
      convertRemToPx((checkboxSize - threeXSSpacing).toString())
    )
    if (uncheckedPx >= outerPx) {
      uncheckedPx -= 1
    }

    const size = $isSelected ? `${checkedPx}px` : `${uncheckedPx}px`

    return {
      borderRadius: "50%",
      backgroundColor: $isSelected ? theme.colors.white : theme.colors.bgColor,
      width: size,
      height: size,
    }
  }
)

/**
 * Indents the caption text so it aligns with the option label (i.e. starts
 * after the radio circle + gap), not with the circle itself.
 * `paddingLeft = circle width + row gap` is derived entirely from theme tokens
 * with no hardcoded values.
 */
export const StyledRadioCaption = styled.div(({ theme }) => ({
  paddingLeft: `calc(${theme.sizes.checkbox} + ${theme.spacing.sm})`,
}))
