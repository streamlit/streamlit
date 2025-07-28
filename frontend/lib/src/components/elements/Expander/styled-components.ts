/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
import { transparentize } from "color2k"

import { STALE_STYLES, STALE_TRANSITION_PARAMS } from "~lib/theme"

export interface StyledExpandableContainerProps {
  empty: boolean
  disabled: boolean
}

export const StyledExpandableContainer = styled.div({
  width: "100%",
})
interface StyledDetailsProps {
  isStale: boolean
}

export const BORDER_SIZE = 1 // px
export const StyledDetails = styled.details<StyledDetailsProps>(
  ({ isStale, theme }) => ({
    marginBottom: 0,
    marginTop: 0,
    width: "100%",
    borderStyle: "solid",
    borderWidth: theme.sizes.borderWidth,
    borderColor: theme.colors.borderColor,
    borderRadius: theme.radii.default,
    ...(isStale
      ? {
          borderColor: theme.colors.borderColorLight,
          transition: `border ${STALE_TRANSITION_PARAMS}`,
        }
      : {}),
  })
)

export const StyledSummaryHeading = styled.span({
  display: "flex",
  alignItems: "center",
  flexGrow: 1,
})

interface StyledSummaryProps {
  isStale: boolean
  expanded: boolean
}

export const StyledSummary = styled.summary<StyledSummaryProps>(
  ({ theme, isStale, expanded }) => ({
    position: "relative",
    display: "flex",
    width: "100%",
    "&:focus": {
      outline: "none",
    },
    "&:focus-visible": {
      boxShadow: `0 0 0 0.2rem ${transparentize(theme.colors.primary, 0.5)}`,
    },
    fontSize: "inherit",
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.md,
    paddingTop: theme.spacing.twoXS,
    paddingBottom: theme.spacing.twoXS,
    minHeight: `calc(${theme.sizes.minElementHeight} - 2 * ${theme.sizes.borderWidth})`,
    alignItems: "center",
    cursor: "pointer",
    listStyleType: "none",
    "&::-webkit-details-marker": {
      display: "none",
    },
    backgroundColor: expanded ? theme.colors.bgMix : "transparent",
    // When expanded, only round the top corners
    borderRadius: expanded
      ? `${theme.radii.default} ${theme.radii.default} 0 0`
      : theme.radii.default,
    // Animate border-radius changes when expanding/collapsing to match the animation of
    // the expander content. Use a delay when collapsing because the content first needs
    // to slide up.
    transition: expanded
      ? `border-radius 200ms cubic-bezier(0.23, 1, 0.32, 1), background-color 150ms ease`
      : `border-radius 200ms cubic-bezier(0.23, 1, 0.32, 1) 300ms, background-color 150ms ease`,
    "&:hover, &:focus-visible": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    "&:active": {
      backgroundColor: theme.colors.darkenedBgMix25,
    },
    ...(isStale && STALE_STYLES),
  })
)

export const StyledDetailsPanel = styled.div(({ theme }) => ({
  padding: theme.spacing.lg,
  borderTop: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
}))
