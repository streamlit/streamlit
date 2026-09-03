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

import styled, { CSSObject } from "@emotion/styled"
import {
  RadioButton as RARadioButton,
  RadioField as RARadioField,
  RadioGroup as RARadioGroup,
  Text as RAText,
} from "react-aria-components"

import type { EmotionTheme } from "~lib/theme/types"
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
  // Horizontal groups use `center` to distribute the minElementHeight space
  // evenly above and below items. Vertical groups stack items from the top.
  alignItems: $horizontal ? "center" : "flex-start",
  // Horizontal groups always use `lg` (16px) between items regardless of
  // captions. Vertical groups add `sm` only when captions are present.
  gap: $horizontal
    ? theme.spacing.lg
    : $hasCaptions
      ? theme.spacing.sm
      : theme.spacing.none,
  minHeight: theme.sizes.minElementHeight,
}))

/**
 * Per-option wrapper: it declares the option's `value` and passes the group's
 * selection state to its `RadioButton` child via context. `RadioButton` must
 * nest inside this field.
 *
 * Stacks the clickable label above the caption, which sits outside the label so
 * React Aria can expose it as the option's `aria-describedby` target rather than
 * folding it into the accessible name.
 *
 * Owns the text colour, including the disabled variant, because it is the nearest
 * ancestor of both the label and the caption — so the two dim together. The label
 * and the caption each set their own `cursor`, since each is clickable.
 */
export const StyledRadioField = styled(RARadioField)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  color: theme.colors.bodyText,
  "&[data-disabled]": {
    color: theme.colors.fadedText40,
  },
}))

/**
 * Clickable `<label>` for each radio option. It wraps the hidden input, the
 * circle indicator (`StyledRadioOuter`/`StyledRadioInner`), and the option text,
 * so the whole row is a click target. It stays a plain block container: the
 * children own the circle-and-text alignment so the caption can sit outside that
 * row without manual offset calculations.
 *
 * React Aria sets `data-focus-visible`, `data-disabled`, `data-selected` and
 * friends as data attributes — we use those for state-driven styles.
 */
export const StyledRadioButton = styled(RARadioButton)(({ theme }) => ({
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
 * Padding shared by the caption and its spacer, so both occupy the same box as
 * the option label above them.
 *
 * `paddingLeft` indents past the circle (`circle width + row gap`) so caption
 * text aligns with the option text rather than the circle; the field and label
 * share a left edge because `StyledRadioButton` has `paddingLeft: none`.
 * `paddingRight` matches `StyledRadioButton`'s so the caption's content box is as
 * wide as the label's. Drop it and the field shrinks by that much whenever the
 * caption is the wider of the two, shifting later options in a horizontal group
 * left.
 */
const captionBox = ({ theme }: { theme: EmotionTheme }): CSSObject => ({
  paddingLeft: `calc(${theme.sizes.checkbox} + ${theme.spacing.sm})`,
  paddingRight: theme.spacing.threeXS,
})

interface StyledRadioCaptionProps {
  $isDisabled: boolean
}

/**
 * The caption, rendered as React Aria's `description` slot so it reaches the
 * option's `aria-describedby` instead of joining its accessible name.
 *
 * Rendered as a `<div>` (`elementType="div"`) because caption markdown can
 * contain block elements; `Text` defaults to a `<span>`.
 *
 * Carries the label's cursor because clicking a caption selects its option, the
 * same as clicking the label does.
 *
 * Must stay the element React Aria's `descriptionProps.ref` lands on: wrapping it
 * in another element would leave `aria-describedby` pointing nowhere.
 */
export const StyledRadioCaption = styled(RAText, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<StyledRadioCaptionProps>(props => ({
  ...captionBox(props),
  cursor: props.$isDisabled ? "not-allowed" : "pointer",
}))

/**
 * Reserves a caption's height for options that have none, so horizontal groups
 * with partial captions keep their rows aligned — the group centres items
 * vertically, so a shorter field would nudge its own row off the shared baseline.
 *
 * - A plain `div`, not a `Text`: it must not claim the `description` slot and
 *   point `aria-describedby` at blank content, and `Text` throws against a
 *   slotted `TextContext` without a `slot` prop.
 * - Call sites fill it with a non-breaking space rather than setting a height,
 *   because only a real caption line box matches the height exactly.
 * - It shares the caption's indent but not its cursor; there is nothing to click.
 */
export const StyledRadioCaptionSpacer = styled.div(captionBox)
