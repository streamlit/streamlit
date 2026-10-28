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

import styled, { type CSSObject } from "@emotion/styled"
import { transparentize } from "color2k"
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
  /** Whether the options render as cards (`type="cards"`). */
  $isCards: boolean
  /**
   * Whether the widget has a definite width (`width="stretch"` or pixels).
   * Only horizontal cards use it.
   */
  $containerWidth: boolean
}

/**
 * Layout of a card group. Cards in the same row share its height.
 *
 * - Vertical: a stack that stretches each card to the group width, which is
 *   the widest card for `width="content"`.
 * - Horizontal with a container width: equal columns that fill the row and
 *   wrap once a card would get narrower than `radioCardMinWidth`.
 * - Horizontal with `width="content"`: a wrapping row of content-width cards,
 *   like horizontal radio buttons and `st.pills`. An equal-width grid can't
 *   wrap here: it needs the widest card's width, which the fit-content element
 *   container doesn't know yet while it sizes the group.
 */
function getCardGroupStyles(
  theme: EmotionTheme,
  horizontal: boolean,
  containerWidth: boolean
): CSSObject {
  if (!horizontal) {
    return {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: theme.spacing.sm,
    }
  }

  if (containerWidth) {
    return {
      display: "grid",
      gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${theme.sizes.radioCardMinWidth}), 1fr))`,
      gap: theme.spacing.sm,
    }
  }

  return {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: theme.spacing.sm,
  }
}

/**
 * Container for the radio group. Controls direction, wrap, gap, and minimum
 * height; card groups use `getCardGroupStyles` instead. `shouldForwardProp`
 * prevents `$`-prefixed layout props from being forwarded to React Aria's
 * RadioGroup component. The native `orientation` prop passes through so React
 * Aria sets the correct `data-orientation` attribute and uses the right
 * arrow-key direction for keyboard navigation.
 */
export const StyledRadioGroup = styled(RARadioGroup, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<StyledRadioGroupProps>(({
  theme,
  $horizontal,
  $hasCaptions,
  $isCards,
  $containerWidth,
}) => {
  if ($isCards) {
    return getCardGroupStyles(theme, $horizontal, $containerWidth)
  }

  return {
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
  }
})

/**
 * Per-option wrapper: it declares the option's `value` and passes the group's
 * selection state to its `RadioButton` child via context. `RadioButton` must
 * nest inside this field.
 *
 * In the default style, it stacks the clickable label above the caption, which
 * sits outside the label so React Aria can expose it as the option's
 * `aria-describedby` target rather than folding it into the accessible name.
 * Card groups use `StyledRadioCardField`, put the caption inside the label,
 * and keep it out of the name with `aria-labelledby`.
 *
 * Owns the text colour, including the disabled variant, so the label and the
 * caption dim together. React Aria marks both this element and the label
 * `data-disabled`, so they split state-driven styles: colour here, `cursor` on
 * the label.
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
 * `StyledRadioField` for a card group. Its rules only matter in a wrapping row
 * of content-width cards; the other card layouts stretch the field.
 *
 * - It never shrinks, which would break words apart; the row wraps instead.
 * - It is capped at the row's width, so a card too wide for the row wraps its
 *   text at word boundaries.
 */
export const StyledRadioCardField = styled(StyledRadioField)({
  flex: "0 0 auto",
  maxWidth: "100%",
})

/**
 * Clickable `<label>` for each radio option. It wraps the hidden input, the
 * circle indicator (`StyledRadioOuter`/`StyledRadioInner`), and the option text,
 * so the whole row is a click target. It stays a plain block container:
 * `StyledRadioRow` owns circle-and-text alignment, so the field can stack the
 * caption below the label with no offset maths.
 *
 * React Aria sets `data-focus-visible`, `data-hovered`, `data-pressed` and
 * friends here as data attributes — we use those for state-driven styles.
 * `data-disabled` and `data-selected` also appear on `StyledRadioField`, which
 * owns the colour; this element owns `cursor`.
 *
 * No `user-select` rule: React Aria's `usePress` suppresses selection for the
 * duration of a press, so a standing rule would only stop users copying the
 * option text. This matches `st.checkbox` and `st.toggle`.
 */
export const StyledRadioButton = styled(RARadioButton)(({ theme }) => ({
  display: "block",
  cursor: "pointer",
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
 * Clickable `<label>` for each option of a card group (`type="cards"`). Unlike
 * `StyledRadioButton`, it also wraps the caption, so the whole card is one
 * click target. `RadioCardOption` keeps the caption out of the accessible name.
 *
 * - Fills its `StyledRadioCardField`, which the group stretches to the row's
 *   height, so cards in a row share the same height. Content stays
 *   top-aligned.
 * - Padding includes the border, so the circle sits about the same distance
 *   from the top and left edges.
 * - Hover and focus only tint unselected cards: pressing a selected radio does
 *   nothing.
 * - Selected cards get a primary border and a light primary tint, like
 *   selected pills. An inset primary ring doubles the border without shifting
 *   the layout, so the selection reads at card size.
 * - Disabled cards keep a neutral border. A selected one keeps a faint fill;
 *   the circle still shows which option is selected.
 */
export const StyledRadioCard = styled(RARadioButton)(({ theme }) => {
  const selectedRing = `inset 0 0 0 ${theme.sizes.borderWidth} ${theme.colors.primary}`

  return {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 auto",
    minWidth: 0,
    boxSizing: "border-box",
    padding: `calc(${theme.spacing.md} - ${theme.sizes.borderWidth}) calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
    border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
    borderRadius: theme.radii.default,
    backgroundColor: theme.colors.bgColor,
    cursor: "pointer",
    transition:
      "background-color 100ms ease, border-color 100ms ease, box-shadow 100ms ease",
    "&:is([data-hovered], [data-focus-visible]):not([data-selected])": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    "&[data-focus-visible]": {
      boxShadow: theme.shadows.focusRing,
    },
    "&[data-selected]:not([data-disabled])": {
      borderColor: theme.colors.primary,
      backgroundColor: transparentize(theme.colors.primary, 0.9),
      boxShadow: selectedRing,
    },
    "&[data-selected][data-focus-visible]:not([data-disabled])": {
      boxShadow: `${selectedRing}, ${theme.shadows.focusRing}`,
    },
    "&[data-disabled]": {
      cursor: "not-allowed",
      backgroundColor: theme.colors.transparent,
    },
    "&[data-selected][data-disabled]": {
      backgroundColor: theme.colors.fadedText05,
    },
    // Forced colors drop the fills and box shadows, which would leave no
    // selection or focus cue. A system-colored outline brings both back. One
    // outline is enough: keyboard focus sits on the selected card, or on an
    // unselected one only while nothing is selected.
    "@media (forced-colors: active)": {
      "&:is([data-selected], [data-focus-visible])": {
        outline: `${theme.sizes.focusOutlineWidth} solid Highlight`,
        outlineOffset: `calc(-1 * ${theme.sizes.focusOutlineWidth})`,
      },
    },
  }
})

interface StyledRadioCardTitleProps {
  $isEmphasized: boolean
}

/**
 * Title of a card: the option label next to the circle. It is semibold when
 * the group has captions, which sets it apart from the caption below it.
 * Without captions it keeps the normal label weight, like the default style.
 */
export const StyledRadioCardTitle = styled.div<StyledRadioCardTitleProps>(
  ({ theme, $isEmphasized }) => ({
    minWidth: 0,
    "& p": {
      fontWeight: $isEmphasized
        ? theme.fontWeights.semiBold
        : theme.fontWeights.normal,
    },
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

/**
 * `StyledRadioRow` for a card. It aligns the circle and the title at the top,
 * so the circle stays next to the first line of a title that wraps.
 */
export const StyledRadioCardRow = styled(StyledRadioRow)({
  alignItems: "flex-start",
})

/**
 * Holds the circle of a card in a box one title line tall, which centers the
 * circle on the title's first line. A single-line title looks the same as
 * with `StyledRadioRow`.
 */
export const StyledRadioCardIndicator = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  height: `calc(${theme.fontSizes.sm} * ${theme.lineHeights.base})`,
}))

interface StyledRadioOuterProps {
  $isSelected: boolean
  $isHovered: boolean
  $isDisabled: boolean
}

/**
 * Visual outer circle of the radio button indicator.
 *
 * - Checked: `primary` fill with a matching `primary` stroke, so `border-color`
 *   has a value to transition from and to.
 * - Enabled and unchecked: `bgColor` fill behind a `borderColor` stroke, which
 *   switches to `darkenedBgMix15` on hover like the secondary button and the
 *   `st.toggle` off track.
 * - Disabled: a `borderColor` disk with no CSS border. `borderColor` is
 *   translucent, so a stroke over a matching fill would darken the rim.
 *   `StyledRadioInner` supplies the white centre when selected and the
 *   `bgColor` hole when not.
 *
 * No margin offset needed: its parent centers it vertically
 * (`StyledRadioRow` in the default style, `StyledRadioCardIndicator` in cards).
 */
export const StyledRadioOuter = styled.div<StyledRadioOuterProps>(
  ({ theme, $isSelected, $isHovered, $isDisabled }) => {
    let backgroundColor: string
    let border = "none"

    if ($isDisabled) {
      backgroundColor = theme.colors.borderColor
    } else if ($isSelected) {
      border = `${theme.sizes.borderWidth} solid ${theme.colors.primary}`
      backgroundColor = theme.colors.primary
    } else if ($isHovered) {
      border = `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`
      backgroundColor = theme.colors.darkenedBgMix15
    } else {
      border = `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`
      backgroundColor = theme.colors.bgColor
    }

    return {
      width: theme.sizes.checkbox,
      height: theme.sizes.checkbox,
      flexShrink: 0,
      boxSizing: "border-box",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor,
      border,
      transition: "background-color 100ms ease, border-color 100ms ease",
    }
  }
)

interface StyledRadioInnerProps {
  $isSelected: boolean
  $isDisabled: boolean
}

/**
 * Centre of the radio indicator.
 *
 * - Selected: white dot, 37.5% of the outer diameter.
 * - Enabled and unchecked: size 0, because `StyledRadioOuter` paints the fill.
 * - Disabled and unchecked: `bgColor` disk inset by `borderWidth` on each
 *   side, leaving the same ring as the enabled CSS border.
 *
 * Sizes are pixel-rounded to avoid uneven edges from fractional rem-to-px
 * conversion.
 */
export const StyledRadioInner = styled.div<StyledRadioInnerProps>(
  ({ theme, $isSelected, $isDisabled }) => {
    const checkboxSize = Number.parseFloat(theme.sizes.checkbox)
    const outerPx = convertRemToPx(checkboxSize.toString())
    const checkedPx = Math.round(outerPx * 0.375)

    let sizePx = $isSelected ? checkedPx : 0
    let backgroundColor = theme.colors.white

    if ($isDisabled && !$isSelected) {
      // Match the enabled ring. `borderWidth` is a px token, so no rem
      // conversion. `threeXS` would grow the ring when baseFontSize changes.
      const borderPx = Number.parseFloat(theme.sizes.borderWidth)
      sizePx = Math.max(0, Math.round(outerPx - 2 * borderPx))
      backgroundColor = theme.colors.bgColor
    }

    return {
      borderRadius: "50%",
      backgroundColor,
      width: `${sizePx}px`,
      height: `${sizePx}px`,
    }
  }
)

/**
 * Aligns caption and spacer text with the label so the two cannot drift.
 * `paddingLeft` clears the circle. `paddingRight` matches the label's so a
 * caption wider than its label cannot shift later options in a horizontal group.
 */
const captionBoxStyles = ({ theme }: { theme: EmotionTheme }): CSSObject => ({
  paddingLeft: `calc(${theme.sizes.checkbox} + ${theme.spacing.sm})`,
  paddingRight: theme.spacing.threeXS,
})

/**
 * The caption, rendered as React Aria's `description` slot so it reaches the
 * option's `aria-describedby` instead of joining its accessible name.
 *
 * - Rendered as a `<div>` (`elementType="div"`) because `StreamlitMarkdown` wraps
 *   its output in a `<div>`, which is invalid inside `Text`'s default `<span>`.
 * - Blank captions render nothing rather than an empty `Text`: React Aria drops
 *   the description id unless this slot mounts content.
 * - No `cursor` rule: in the default style it is not a click target, so the
 *   text cursor signals selectable prose. Inside a card it inherits the card's
 *   pointer.
 */
export const StyledRadioCaption = styled(RAText)(captionBoxStyles)

/**
 * Keeps horizontal options without captions aligned with captioned ones, without
 * claiming the `description` slot.
 *
 * - A plain `div`, not a `Text`: it holds no description, and a `Text` here
 *   would either claim the `description` slot or need `slot={null}` to opt out
 *   of it.
 * - `Radio` fills it with a non-breaking space rather than setting a height,
 *   because only a real caption line box matches the height exactly.
 */
export const StyledRadioCaptionSpacer = styled.div(captionBoxStyles)
