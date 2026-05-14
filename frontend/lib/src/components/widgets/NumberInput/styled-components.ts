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

interface StyledInputContainerProps {
  hasError?: boolean
}

export const StyledInputContainer = styled.div<StyledInputContainerProps>(
  ({ theme, hasError }) => ({
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    height: theme.sizes.minElementHeight,
    // Mimic the baseweb's borders here, so we can apply the focus style
    // to the entire container and not only the input itself
    borderWidth: theme.sizes.borderWidth,
    borderStyle: "solid",
    // In error state, use the red background color for the border so it blends
    borderColor: hasError
      ? theme.colors.redBackgroundColor
      : (theme.colors.widgetBorderColor ?? theme.colors.secondaryBg),
    transitionDuration: "200ms",
    transitionProperty: "border",
    transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.4, 1)",
    borderRadius: theme.radii.default,
    overflow: "hidden", // Fix rounded corner being overlaid with corner of internal input.
    // In error state, apply the red background color
    backgroundColor: hasError
      ? theme.colors.redBackgroundColor
      : "transparent",

    "&.focused": {
      // Keep primary border color even in error state for clear keyboard focus indication
      borderColor: theme.colors.primary,
    },

    input: {
      MozAppearance: "textfield",
      "&::-webkit-inner-spin-button, &::-webkit-outer-spin-button": {
        WebkitAppearance: "none",
        margin: theme.spacing.none,
      },
    },
  })
)

export const StyledInputControls = styled.div({
  display: "flex",
  flexDirection: "row",
  alignSelf: "stretch",
})

interface StyledInputControlProps {
  hasError?: boolean
}

export const StyledInputControl = styled.button<StyledInputControlProps>(
  ({ theme, hasError }) => ({
    margin: theme.spacing.none,
    border: "none",
    height: theme.sizes.full,
    display: "flex",
    alignItems: "center",
    width: theme.sizes.numberInputControlsWidth,
    justifyContent: "center",
    color: theme.colors.bodyText,
    transition: "color 300ms, backgroundColor 300ms",
    // In error state, use the red background color; otherwise use the secondary background
    backgroundColor: hasError
      ? theme.colors.redBackgroundColor
      : theme.colors.secondaryBg,
    "&:hover:enabled, &:focus:enabled": {
      color: theme.colors.white,
      backgroundColor: theme.colors.primary,
      transition: "none",
      outline: "none",
    },
    "&:active": {
      outline: "none",
      border: "none",
    },
    "&:disabled": {
      cursor: "not-allowed",
      color: theme.colors.fadedText40,
    },
  })
)

interface StyledInstructionsContainerProps {
  // If widget is clearable, the instruction needs to be moved a couple
  // pixels to the left to avoid overlapping with the clear button.
  clearable: boolean
  // If widget has an error, the instruction needs to be moved to account
  // for the error icon.
  hasError?: boolean
}

export const StyledInstructionsContainer =
  styled.div<StyledInstructionsContainerProps>(
    ({ theme, clearable, hasError }) => ({
      position: "absolute",
      marginRight: theme.spacing.twoXS,
      left: 0,
      // The instructions should be placed after the two controls
      // and the clear button if it's present.
      // Also account for the error icon if there is an error.
      right: `calc(${theme.sizes.numberInputControlsWidth} * 2 + ${
        clearable ? "1em" : "0em"
      } + ${hasError ? `${theme.iconSizes.lg} + ${theme.spacing.twoXS}` : "0em"})`,
    })
  )
