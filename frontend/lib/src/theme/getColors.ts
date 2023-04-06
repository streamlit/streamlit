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

import { getLuminance, darken, lighten, mix, transparentize } from "color2k"

import { Theme } from "./types"
import { CustomThemeConfig } from "src/autogen/proto"

export type DerivedColors = {
  linkText: string
  fadedText05: string
  fadedText10: string
  fadedText20: string
  fadedText40: string
  fadedText60: string

  bgMix: string
  darkenedBgMix100: string
  darkenedBgMix25: string
  darkenedBgMix15: string
  lightenedBg05: string
}

export const computeDerivedColors = (
  genericColors: Record<string, string>
): DerivedColors => {
  const { bodyText, secondaryBg, bgColor } = genericColors

  const hasLightBg = getLuminance(bgColor) > 0.5

  // Always keep links blue, but brighten them up a bit on dark backgrounds so
  // they're easier to read.
  const linkText = hasLightBg
    ? genericColors.blue
    : lighten(genericColors.blue, 0.2)

  const fadedText05 = transparentize(bodyText, 0.9) // Mostly used for very faint 1px lines.
  const fadedText10 = transparentize(bodyText, 0.8) // Mostly used for 1px lines.
  const fadedText20 = transparentize(bodyText, 0.7) // Used for 1px lines.
  const fadedText40 = transparentize(bodyText, 0.6) // Backgrounds.
  const fadedText60 = transparentize(bodyText, 0.4) // Secondary text.

  const bgMix = mix(bgColor, secondaryBg, 0.5)
  const darkenedBgMix100 = hasLightBg
    ? darken(bgMix, 0.3)
    : lighten(bgMix, 0.6) // Icons.
  // TODO(tvst): Rename to darkenedBgMix25 (number = opacity)
  const darkenedBgMix25 = transparentize(darkenedBgMix100, 0.75)
  const darkenedBgMix15 = transparentize(darkenedBgMix100, 0.85) // Hovered menu/nav items.

  const lightenedBg05 = lighten(bgColor, 0.025) // Button, checkbox, radio background.

  return {
    linkText,
    fadedText05,
    fadedText10,
    fadedText20,
    fadedText40,
    fadedText60,

    bgMix,
    darkenedBgMix100,
    darkenedBgMix25,
    darkenedBgMix15,
    lightenedBg05,
  }
}

export const createEmotionColors = (genericColors: {
  [key: string]: string
}): { [key: string]: string } => {
  const derivedColors = computeDerivedColors(genericColors)
  return {
    ...genericColors,
    ...derivedColors,

    // Alerts
    alertErrorBorderColor: genericColors.dangerBg,
    alertErrorBackgroundColor: genericColors.dangerBg,
    alertErrorTextColor: genericColors.danger,

    alertInfoBorderColor: genericColors.infoBg,
    alertInfoBackgroundColor: genericColors.infoBg,
    alertInfoTextColor: genericColors.info,

    alertSuccessBorderColor: genericColors.successBg,
    alertSuccessBackgroundColor: genericColors.successBg,
    alertSuccessTextColor: genericColors.success,

    alertWarningBorderColor: genericColors.warningBg,
    alertWarningBackgroundColor: genericColors.warningBg,
    alertWarningTextColor: genericColors.warning,

    codeTextColor: genericColors.green80,
    codeHighlightColor: derivedColors.bgMix,

    docStringModuleText: genericColors.bodyText,
    docStringContainerBackground: transparentize(
      genericColors.secondaryBg,
      0.6
    ),

    headingColor: genericColors.bodyText,
  }
}
