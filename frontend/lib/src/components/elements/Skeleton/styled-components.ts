/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"

const pulseAnimation = keyframes`
  0%, 100% {
    opacity: 0.5;
  }

  50% {
    opacity: 1;
  }
`

const ANIMATION_STYLES = {
  animationDuration: "750ms",
  animationName: pulseAnimation,
  animationTimingFunction: "ease-in",
  animationDirection: "normal",
  animationIterationCount: "infinite",
}

export const StyledSkeleton = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.lg,
}))

export const TitleSkeleton = styled.div(({ theme }) => ({
  height: theme.fontSizes.fourXL,
  width: `calc(${theme.sizes.contentMaxWidth} * 0.37)`, // Picked because it looks good.
  maxWidth: "75%", // Picked because it looks good.
  background:
    theme.colors.skeletonBackgroundColor || theme.colors.darkenedBgMix15,
  borderRadius: theme.radii.default,
  ...ANIMATION_STYLES,
}))

export const ParagraphSkeleton = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.sm, // Picked because it looks good.
}))

export interface TextLineSkeletonProps {
  width: string
}

export const TextLineSkeleton = styled.div<TextLineSkeletonProps>(
  ({ theme, width }) => ({
    height: theme.fontSizes.md,
    width,
    background:
      theme.colors.skeletonBackgroundColor || theme.colors.darkenedBgMix15,
    borderRadius: theme.radii.default,
    ...ANIMATION_STYLES,
  })
)

export interface SquareSkeletonProps {
  height?: string
  width?: string
}

export const SquareSkeleton = styled.div<SquareSkeletonProps>(
  ({ theme, height, width }) => ({
    height: height ?? theme.fontSizes.fourXL,
    width: width ?? "100%",
    background:
      theme.colors.skeletonBackgroundColor || theme.colors.darkenedBgMix15,
    borderRadius: theme.radii.default,
    ...ANIMATION_STYLES,
  })
)
