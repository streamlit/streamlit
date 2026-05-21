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

import type { CSSObject } from "@emotion/react"
import { darken, getLuminance, transparentize } from "color2k"

type ThemeCssVariableSource = {
  colors: {
    bgColor: string
    bodyText: string
    primary: string
    white: string
    transparent: string
    borderColor: string
    fadedText05: string
    fadedText10: string
    fadedText40: string
    fadedText60: string
    gray30: string
    gray60: string
    lightenedBg05: string
    darkenedBgMix15: string
    darkenedBgMix25: string
  }
  shadows: {
    focusRing: string
    focusRingMuted: string
  }
}

type AnyCssVariableName = `--${string}`
type ThemeCssVariableName = `--st-${string}`
type ThemeCssVariableReference<
  Name extends AnyCssVariableName = AnyCssVariableName,
> = `var(${Name})`

type ThemeCssVariableDefinition<Name extends ThemeCssVariableName> = {
  cssVariable: Name
  getValue: (theme: ThemeCssVariableSource) => string
  getEnhancedValue?: (theme: ThemeCssVariableSource) => string
}

type ThemeCssVariableGroup = Record<
  string,
  ThemeCssVariableDefinition<ThemeCssVariableName>
>

const COLOR_MIX_SUPPORTS_RULE =
  "color: color-mix(in srgb, red 50%, transparent)"

function isLightBackground(theme: ThemeCssVariableSource): boolean {
  return getLuminance(theme.colors.bgColor) > 0.5
}

function getInactiveBodyTextTransparency(
  theme: ThemeCssVariableSource
): number {
  return isLightBackground(theme) ? 0.2 : 0.25
}

function getInactiveBodyTextOpacityPercent(
  theme: ThemeCssVariableSource
): string {
  return isLightBackground(theme) ? "80%" : "75%"
}

function createCssVariableReference<Name extends ThemeCssVariableName>(
  cssVariable: Name
): ThemeCssVariableReference<Name> {
  return `var(${cssVariable})` as ThemeCssVariableReference<Name>
}

const bodyTextCssVariableReference = createCssVariableReference(
  "--st-color-body-text"
)
const primaryCssVariableReference = createCssVariableReference(
  "--st-color-primary"
)

export const themeCssVariableContract = {
  colors: {
    bgColor: {
      cssVariable: "--st-color-bg",
      getValue: theme => theme.colors.bgColor,
    },
    bgColorTransparent: {
      cssVariable: "--st-color-bg-transparent",
      getValue: theme => transparentize(theme.colors.bgColor, 1),
    },
    bodyText: {
      cssVariable: "--st-color-body-text",
      getValue: theme => theme.colors.bodyText,
    },
    bodyTextDim: {
      cssVariable: "--st-color-body-text-dim",
      getValue: theme =>
        transparentize(
          theme.colors.bodyText,
          getInactiveBodyTextTransparency(theme)
        ),
      getEnhancedValue: theme =>
        `color-mix(in srgb, ${bodyTextCssVariableReference} ${getInactiveBodyTextOpacityPercent(
          theme
        )}, transparent)`,
    },
    primary: {
      cssVariable: "--st-color-primary",
      getValue: theme => theme.colors.primary,
    },
    primaryHover: {
      cssVariable: "--st-color-primary-hover",
      getValue: theme => darken(theme.colors.primary, 0.15),
      getEnhancedValue: () =>
        `color-mix(in srgb, ${primaryCssVariableReference} 85%, black)`,
    },
    primaryEmphasis: {
      cssVariable: "--st-color-primary-emphasis",
      getValue: theme => darken(theme.colors.primary, 0.25),
      getEnhancedValue: () =>
        `color-mix(in srgb, ${primaryCssVariableReference} 75%, black)`,
    },
    primarySoftBg: {
      cssVariable: "--st-color-primary-soft-bg",
      getValue: theme => transparentize(theme.colors.primary, 0.9),
      getEnhancedValue: () =>
        `color-mix(in srgb, ${primaryCssVariableReference} 10%, transparent)`,
    },
    primarySoftBgHover: {
      cssVariable: "--st-color-primary-soft-bg-hover",
      getValue: theme => transparentize(theme.colors.primary, 0.8),
      getEnhancedValue: () =>
        `color-mix(in srgb, ${primaryCssVariableReference} 20%, transparent)`,
    },
    white: {
      cssVariable: "--st-color-white",
      getValue: theme => theme.colors.white,
    },
    transparent: {
      cssVariable: "--st-color-transparent",
      getValue: theme => theme.colors.transparent,
    },
    borderColor: {
      cssVariable: "--st-color-border",
      getValue: theme => theme.colors.borderColor,
    },
    fadedText05: {
      cssVariable: "--st-color-faded-text-05",
      getValue: theme => theme.colors.fadedText05,
    },
    fadedText10: {
      cssVariable: "--st-color-faded-text-10",
      getValue: theme => theme.colors.fadedText10,
    },
    fadedText40: {
      cssVariable: "--st-color-faded-text-40",
      getValue: theme => theme.colors.fadedText40,
    },
    fadedText60: {
      cssVariable: "--st-color-faded-text-60",
      getValue: theme => theme.colors.fadedText60,
    },
    gray30: {
      cssVariable: "--st-color-gray-30",
      getValue: theme => theme.colors.gray30,
    },
    gray60: {
      cssVariable: "--st-color-gray-60",
      getValue: theme => theme.colors.gray60,
    },
    lightenedBg05: {
      cssVariable: "--st-color-lightened-bg-05",
      getValue: theme => theme.colors.lightenedBg05,
    },
    darkenedBgMix15: {
      cssVariable: "--st-color-darkened-bg-mix-15",
      getValue: theme => theme.colors.darkenedBgMix15,
    },
    darkenedBgMix25: {
      cssVariable: "--st-color-darkened-bg-mix-25",
      getValue: theme => theme.colors.darkenedBgMix25,
    },
  },
  shadows: {
    focusRing: {
      cssVariable: "--st-shadow-focus-ring",
      getValue: theme => theme.shadows.focusRing,
    },
    focusRingMuted: {
      cssVariable: "--st-shadow-focus-ring-muted",
      getValue: theme => theme.shadows.focusRingMuted,
    },
  },
} as const satisfies Record<string, ThemeCssVariableGroup>

type ThemeCssVariableContract = typeof themeCssVariableContract
type ValueOf<T> = T[keyof T]
type ThemeCssVariableContractDefinition =
  | ValueOf<ThemeCssVariableContract["colors"]>
  | ValueOf<ThemeCssVariableContract["shadows"]>
type ThemeVarsForGroup<Group extends ThemeCssVariableGroup> = {
  -readonly [Key in keyof Group]: ThemeCssVariableReference
}

export type ThemeVars = {
  [Group in keyof ThemeCssVariableContract]: ThemeCssVariableContract[Group] extends infer ContractGroup extends
    ThemeCssVariableGroup
    ? ThemeVarsForGroup<ContractGroup>
    : never
}

export type StreamlitThemeCssVariableName = ValueOf<
  ValueOf<ThemeCssVariableContract>
>["cssVariable"]

type ThemeCssVariableValueMap = Record<StreamlitThemeCssVariableName, string>

function createThemeVarGroup<Group extends ThemeCssVariableGroup>(
  group: Group
): ThemeVarsForGroup<Group> {
  return Object.fromEntries(
    (
      Object.entries(group) as Array<
        [keyof Group & string, Group[keyof Group]]
      >
    ).map(([key, definition]) => [
      key,
      createCssVariableReference(definition.cssVariable),
    ])
  ) as ThemeVarsForGroup<Group>
}

export function createThemeVars(): ThemeVars {
  return {
    colors: createThemeVarGroup(themeCssVariableContract.colors),
    shadows: createThemeVarGroup(themeCssVariableContract.shadows),
  }
}

function freezeThemeVars(vars: ThemeVars): ThemeVars {
  Object.values(vars).forEach(group => Object.freeze(group))
  return Object.freeze(vars)
}

export const themeVars = freezeThemeVars(createThemeVars())

function getThemeCssVariableDefinitions(): ThemeCssVariableContractDefinition[] {
  return Object.values(themeCssVariableContract).flatMap(group =>
    Object.values(group)
  ) as ThemeCssVariableContractDefinition[]
}

export function createThemeCssVariableValueMap(
  theme: ThemeCssVariableSource
): ThemeCssVariableValueMap {
  return Object.fromEntries(
    getThemeCssVariableDefinitions().map(definition => [
      definition.cssVariable,
      definition.getValue(theme),
    ])
  ) as ThemeCssVariableValueMap
}

function createEnhancedThemeCssVariableValueMap(
  theme: ThemeCssVariableSource
): Partial<ThemeCssVariableValueMap> {
  return Object.fromEntries(
    getThemeCssVariableDefinitions().flatMap(definition =>
      "getEnhancedValue" in definition && definition.getEnhancedValue
        ? [[definition.cssVariable, definition.getEnhancedValue(theme)]]
        : []
    )
  ) as Partial<ThemeCssVariableValueMap>
}

export function createThemeCssVariables(
  theme: ThemeCssVariableSource
): CSSObject {
  const enhancedCssVariables = createEnhancedThemeCssVariableValueMap(theme)

  return {
    ...createThemeCssVariableValueMap(theme),
    "@supports": {
      [COLOR_MIX_SUPPORTS_RULE]: enhancedCssVariables,
    },
  }
}

export const themeCssVariableNames = Object.freeze(
  getThemeCssVariableDefinitions().map(definition => definition.cssVariable)
) as readonly StreamlitThemeCssVariableName[]
