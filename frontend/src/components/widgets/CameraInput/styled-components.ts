/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import { transparentize } from "color2k"
import { MouseEvent, ReactNode } from "react"
import { Theme } from "src/theme"

export interface CameraInputButtonProps {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => any
  disabled?: boolean
  children: ReactNode
  progress?: number | null
}

export interface StyledCameraInputProps {
  width: number
}

enum Size {
  XSMALL = "xsmall",
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
}

function getSizeStyle(size: Size, theme: Theme): CSSObject {
  switch (size) {
    case Size.XSMALL:
      return {
        padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
        fontSize: theme.fontSizes.sm,
      }
    case Size.SMALL:
      return {
        padding: `${theme.spacing.twoXS} ${theme.spacing.md}`,
      }
    case Size.LARGE:
      return {
        padding: `${theme.spacing.md} ${theme.spacing.md}`,
      }
    default:
      return {
        padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      }
  }
}

type RequiredCameraInputButtonProps = Required<CameraInputButtonProps>

export const StyledCameraInput = styled.div<StyledCameraInputProps>(
  ({ theme, width }) => ({
    // This is used to position the "Switch facing mode" button
    // with respect to the webcam block.
    position: "relative",
    width: "100%",
    objectFit: "contain",
  })
)

export interface StyledBoxProps {
  width: number
}

export const StyledBox = styled.div<StyledBoxProps>(({ theme, width }) => ({
  backgroundColor: theme.colors.secondaryBg,
  borderRadius: `${theme.radii.md} ${theme.radii.md} 0 0`,
  width,
  height: (width * 9) / 16,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
}))

export const StyledDescription = styled.p(({ theme }) => ({
  marginTop: theme.spacing.sm,
  textAlign: "center",
}))

export interface StyledImgProps {
  opacity: string
}

export const StyledImg = styled.img<StyledImgProps>(({ theme, opacity }) => ({
  borderRadius: `${theme.radii.md} ${theme.radii.md} 0 0`,
  objectFit: "contain",
  opacity,
}))

export const StyledLink = styled.a(({ theme }) => ({
  color: theme.colors.primary,
  display: "block",
  textDecoration: "none",
}))

export const StyledSpan = styled.span(({ theme }) => ({
  display: "flex",
  alignItems: "center",
}))

export const StyledSwitchFacingModeButton = styled.div(({ theme }) => ({
  position: "absolute",
  top: theme.spacing.lg,
  right: theme.spacing.lg,
  zIndex: 1,
  color: theme.colors.fadedText40,
  mixBlendMode: "difference",
  opacity: 0.6,
}))

export const StyledWebcamWrapper = styled.div(({ theme }) => ({
  display: "flex",
}))

export const StyledProgressBar = styled.div(({ theme }) => ({
  height: "fit-content",
  width: "100%",
  position: "absolute",
  bottom: 0,
}))

export const StyledCameraInputBaseButton = styled.button<
  RequiredCameraInputButtonProps
>(({ theme }) => ({
  position: "relative",
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: theme.colors.lightenedBg05,
  border: `1px solid ${theme.colors.fadedText10}`,
  borderRadius: `0 0 ${theme.radii.md} ${theme.radii.md}`,
  "&:hover": {
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
  },
  "&:active": {
    color: theme.colors.white,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  "&:focus:not(:active)": {
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
  },
  "&:disabled, &:disabled:hover, &:disabled:active": {
    color: theme.colors.fadedText40,
  },
  fontWeight: theme.fontWeights.normal,
  padding: `${theme.spacing.xs} ${theme.spacing.md}`,
  margin: 0,
  lineHeight: theme.lineHeights.base,
  color: "inherit",
  width: "100%",
  userSelect: "none",
  "&:focus": {
    boxShadow: `0 0 0 0.2rem ${transparentize(theme.colors.primary, 0.5)}`,
    outline: "none",
  },
  ...getSizeStyle(Size.MEDIUM, theme),
}))
