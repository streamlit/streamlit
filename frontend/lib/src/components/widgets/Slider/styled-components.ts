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
  Slider as RASlider,
  SliderThumb,
  SliderTrack,
} from "react-aria-components"

export const StyledSlider = styled.div({
  position: "relative",
  ":focus-within:has(:focus-visible)": {
    "--slider-focused": 1,
  },
})

/** Wraps RASlider with position:relative and insets it by half the thumb radius on
 * each side. This mirrors BaseUI's StyledThumbWrapper (left/right: thumbSize/2) so
 * thumbs at min/max do not overflow the widget boundary. The SliderTickBar lives
 * inside StyledSliderTrack so it aligns with these inset bounds. */
export const StyledRASlider = styled(RASlider)(({ theme }) => ({
  position: "relative",
  width: "100%",
  paddingLeft: `calc(${theme.sizes.sliderThumb} / 2)`,
  paddingRight: `calc(${theme.sizes.sliderThumb} / 2)`,
}))

/** Wraps SliderTrack with the 40px touch-target height and position:relative,
 * making it the containing block for thumb left:X% positioning.
 * All children (track line, thumbs) are position:absolute so they contribute
 * no in-flow height. The full minElementHeight comes entirely from padding. */
export const StyledSliderTrack = styled(SliderTrack)(({ theme }) => ({
  position: "relative",
  paddingTop: `calc(${theme.sizes.minElementHeight} / 2)`,
  paddingBottom: `calc(${theme.sizes.minElementHeight} / 2)`,
}))

/** Styled SliderThumb. RA applies inline styles: position:absolute; left:X%;
 * transform:translate(-50%,-50%). We add top:50% here (RA does not set it) so
 * the thumb is vertically centered within SliderTrack. */
export const StyledThumb = styled(SliderThumb)(({ theme }) => ({
  alignItems: "center",
  backgroundColor: theme.colors.primary,
  borderTopLeftRadius: "100%",
  borderTopRightRadius: "100%",
  borderBottomLeftRadius: "100%",
  borderBottomRightRadius: "100%",
  borderTopStyle: "none",
  borderBottomStyle: "none",
  borderRightStyle: "none",
  borderLeftStyle: "none",
  display: "flex",
  justifyContent: "center",
  height: theme.sizes.sliderThumb,
  width: theme.sizes.sliderThumb,
  // RA sets position:absolute; left:X%; transform:translate(-50%,-50%) as inline styles.
  // It does NOT set top, so without this the thumb sits at the track top and translate
  // shifts it further upward — vertically broken.
  top: "50%",
  boxShadow: theme.shadows.none,
  "&[data-disabled]": {
    backgroundColor: theme.colors.gray60,
  },
  "&[data-dragging], &[data-focus-visible]": {
    boxShadow: theme.shadows.focusRing,
  },
  ":focus": {
    outline: "none",
  },
}))

interface StyledThumbValueProps {
  disabled: boolean
}

export const StyledThumbValue = styled.div<StyledThumbValueProps>(
  ({ disabled, theme }) => ({
    fontFamily: theme.genericFonts.bodyFont,
    fontSize: theme.fontSizes.sm,
    color: disabled ? theme.colors.gray60 : theme.colors.primary,
    top: "-1.6em",
    position: "absolute",
    whiteSpace: "nowrap",
    backgroundColor: theme.colors.transparent,
    lineHeight: theme.lineHeights.base,
    fontWeight: theme.fontWeights.normal,
    // If values are clickable, it's hard to move the right thumb when they're
    // very close. So make them unclickable:
    pointerEvents: "none",
  })
)

interface StyledSliderTrackLineProps {
  isDisabled: boolean
  fillStart: number // 0–100, percent
  fillEnd: number // 0–100, percent
}

/** Replaces UIStyledInnerTrack. Renders the visual track bar with a CSS gradient
 * fill since RA does not automatically color the filled portion. */
export const StyledSliderTrackLine = styled.div<StyledSliderTrackLineProps>(
  ({ theme, isDisabled, fillStart, fillEnd }) => ({
    position: "absolute",
    height: theme.spacing.twoXS,
    left: 0,
    right: 0,
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    background: isDisabled
      ? theme.colors.darkenedBgMix25
      : `linear-gradient(
          to right,
          ${theme.colors.darkenedBgMix25} ${fillStart}%,
          ${theme.colors.primary} ${fillStart}%,
          ${theme.colors.primary} ${fillEnd}%,
          ${theme.colors.darkenedBgMix25} ${fillEnd}%)`,
  })
)

interface StyledSliderTickBarProps {
  isHovered: boolean
  isDisabled: boolean
}

export const StyledSliderTickBar = styled.div<StyledSliderTickBarProps>(
  ({ theme, isHovered, isDisabled }) => ({
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    display: "flex",
    justifyContent: "space-between",
    pointerEvents: "none",
    marginTop: `-${theme.spacing.md}`,
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.lineHeights.base,
    fontWeight: theme.fontWeights.normal,
    color: isDisabled ? theme.colors.fadedText40 : theme.colors.fadedText60,
    opacity: isHovered ? 1 : "var(--slider-focused, 0)",
    transition: isHovered ? "none" : "opacity 300ms 200ms",
  })
)
