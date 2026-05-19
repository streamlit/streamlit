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
 * being forwarded to React Aria's RadioGroup component.
 */
export const StyledRadioGroup = styled(RARadioGroup, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<StyledRadioGroupProps>(({ theme, $horizontal, $hasCaptions }) => ({
  display: "flex",
  flexDirection: $horizontal ? "row" : "column",
  flexWrap: "wrap",
  alignItems: "start",
  gap:
    $horizontal && !$hasCaptions
      ? theme.spacing.lg
      : $hasCaptions
        ? theme.spacing.sm
        : theme.spacing.none,
  minHeight: theme.sizes.minElementHeight,
}))

/**
 * Outer `<label>` wrapper for each individual radio option.
 * React Aria renders a `<label>` element and sets `data-focus-visible`,
 * `data-disabled`, `data-selected` etc. as data attributes — we use those for
 * state-driven styles rather than render-prop props, keeping this component
 * free of custom transient props.
 */
export const StyledRadioItem = styled(RARadio)(({ theme }) => ({
  display: "flex",
  alignItems: "start",
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

interface StyledRadioOuterProps {
  $isSelected: boolean
  $isDisabled: boolean
}

/**
 * Visual outer circle of the radio button indicator.
 * Background color reflects checked + enabled state.
 */
export const StyledRadioOuter = styled.div<StyledRadioOuterProps>(
  ({ theme, $isSelected, $isDisabled }) => ({
    width: theme.sizes.checkbox,
    height: theme.sizes.checkbox,
    // margin-top aligns the radio circle with the text label baseline.
    // The text label has line-height 1.6 (~1.6rem tall) while the circle is
    // theme.sizes.checkbox (~1rem), so 0.35rem centers them visually.
    //eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values
    marginTop: "0.35rem",
    marginRight: theme.spacing.none,
    marginLeft: theme.spacing.none,
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
 * Inner circle of the radio button indicator. Fills `theme.colors.bgColor`
 * (adapts to dark mode) and changes size to express checked vs unchecked:
 *
 * - Checked: 37.5% of outer diameter (small centre dot)
 * - Unchecked: outer − threeXS spacing (large fill leaving only a thin ring)
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
      backgroundColor: theme.colors.bgColor,
      width: size,
      height: size,
    }
  }
)

interface StyledRadioLabelProps {
  $isDisabled: boolean
}

/**
 * Text content area for a radio option's label (and optional caption).
 * Uses column flex so captions stack below the label text.
 */
export const StyledRadioLabel = styled.div<StyledRadioLabelProps>(
  ({ theme, $isDisabled }) => ({
    display: "flex",
    flexDirection: "column",
    color: $isDisabled ? theme.colors.fadedText40 : theme.colors.bodyText,
    position: "relative",
    top: theme.spacing.px,
  })
)
