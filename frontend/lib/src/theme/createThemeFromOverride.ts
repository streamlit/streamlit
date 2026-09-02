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

import { mergeWith } from "lodash-es"
import { getLogger } from "loglevel"

import {
  CustomThemeConfig,
  ICustomThemeConfig,
  IThemeOverride,
} from "@streamlit/protobuf"
import { isNullOrUndefined, notNullOrUndefined } from "@streamlit/utils"

import { isThemeApiColor } from "./cssNamedColors"
import { hasLightBackgroundColor } from "./getColors"
import { darkTheme, lightTheme } from "./themeConfigs"
import type { EmotionTheme, ThemeConfig } from "./types"
import {
  createTheme,
  CUSTOM_THEME_DARK_NAME,
  CUSTOM_THEME_LIGHT_NAME,
  skipProtobufDefaults,
} from "./utils"

const LOG = getLogger("createThemeFromOverride")

const COLOR_STRING_KEYS = [
  "primaryColor",
  "backgroundColor",
  "secondaryBackgroundColor",
  "textColor",
  "linkColor",
  "codeTextColor",
  "codeBackgroundColor",
  "borderColor",
  "dataframeBorderColor",
  "dataframeHeaderBackgroundColor",
] as const

const BOOLEAN_KEYS = ["linkUnderline", "showWidgetBorder"] as const

const RADIUS_KEYS = ["baseRadius", "buttonRadius"] as const

const CHART_ARRAY_KEYS = [
  "chartCategoricalColors",
  "chartSequentialColors",
  "chartDivergingColors",
] as const

const THEME_API_VALUE_KEYS = [
  ...COLOR_STRING_KEYS,
  ...BOOLEAN_KEYS,
  ...RADIUS_KEYS,
  ...CHART_ARRAY_KEYS,
] as const

export interface CreateThemeFromOverrideOptions {
  inSidebar?: boolean
  name?: string
  displayName?: string
  /**
   * Fonts, radii, and sidebar tokens from the selected theme. The overlay does
   * not set these, but createSidebarTheme still needs them.
   */
  parentThemeInput?: Partial<ICustomThemeConfig>
}

export interface ThemeOverrideSurfaceFlags {
  applyBackgroundColor: boolean
  applyTextColor: boolean
}

function sectionHasThemeApiValues(
  section: ICustomThemeConfig | null | undefined
): boolean {
  if (isNullOrUndefined(section)) {
    return false
  }
  return THEME_API_VALUE_KEYS.some(key => {
    const value = section[key]
    if (isNullOrUndefined(value) || value === "") {
      return false
    }
    if (Array.isArray(value)) {
      return value.length > 0
    }
    return true
  })
}

/**
 * True when the override has no visual effect, so callers can skip applying it.
 * An empty present message (`theme={}`) matches this.
 */
export function isEmptyThemeOverride(
  theme: IThemeOverride | null | undefined
): boolean {
  if (isNullOrUndefined(theme)) {
    return true
  }
  if (notNullOrUndefined(theme.base)) {
    return false
  }
  const values = theme.values
  if (isNullOrUndefined(values)) {
    return true
  }
  return (
    !sectionHasThemeApiValues(values) &&
    !sectionHasThemeApiValues(values.light) &&
    !sectionHasThemeApiValues(values.dark)
  )
}

function stripSectionFields(
  input: ICustomThemeConfig | null | undefined
): Partial<ICustomThemeConfig> {
  if (isNullOrUndefined(input)) {
    return {}
  }
  const { light: _light, dark: _dark, sidebar: _sidebar, ...rest } = input
  return rest
}

function mergeThemeInputs(
  base: Partial<ICustomThemeConfig>,
  overlay: Partial<ICustomThemeConfig>
): Partial<CustomThemeConfig> {
  return mergeWith(
    {} as Partial<CustomThemeConfig>,
    base,
    overlay,
    skipProtobufDefaults
  )
}

/**
 * Combine shared overlay tokens with the active light/dark section. Unset
 * protobuf scalars are skipped so they do not erase shared values.
 */
export function mergeOverrideValues(
  override: IThemeOverride,
  isLightMode: boolean
): Partial<ICustomThemeConfig> {
  const values = override.values ?? {}
  return mergeThemeInputs(
    stripSectionFields(values),
    stripSectionFields(isLightMode ? values.light : values.dark)
  )
}

function sanitizeThemeApiColors(
  input: Partial<ICustomThemeConfig>
): Partial<ICustomThemeConfig> {
  const result: Partial<ICustomThemeConfig> = { ...input }

  COLOR_STRING_KEYS.forEach(key => {
    const value = result[key]
    if (typeof value !== "string" || value === "") {
      return
    }
    if (!isThemeApiColor(value)) {
      LOG.warn(`Ignoring invalid theme override color for ${key}: ${value}`)
      delete result[key]
    }
  })

  CHART_ARRAY_KEYS.forEach(key => {
    const value = result[key]
    if (!Array.isArray(value)) {
      return
    }
    const filtered = value.filter(
      (color): color is string =>
        typeof color === "string" && isThemeApiColor(color)
    )
    if (filtered.length === 0) {
      delete result[key]
      return
    }
    result[key] = filtered
  })

  return result
}

function resolveExplicitBaseTheme(
  base: CustomThemeConfig.BaseTheme,
  availableThemes: ThemeConfig[]
): ThemeConfig {
  const wantedName =
    base === CustomThemeConfig.BaseTheme.DARK
      ? CUSTOM_THEME_DARK_NAME
      : CUSTOM_THEME_LIGHT_NAME
  const configured = availableThemes.find(theme => theme.name === wantedName)
  if (configured) {
    return configured
  }
  return base === CustomThemeConfig.BaseTheme.DARK ? darkTheme : lightTheme
}

function isLightOverrideMode(
  override: IThemeOverride,
  parentEmotion: EmotionTheme
): boolean {
  if (notNullOrUndefined(override.base)) {
    return override.base === CustomThemeConfig.BaseTheme.LIGHT
  }
  return hasLightBackgroundColor(parentEmotion)
}

/**
 * Which CSS surface styles a scoped container should paint for this override.
 *
 * Inherit scopes paint a surface only for tokens the mapping actually sets, so
 * a primary-only override stays transparent. Explicit `base` starts from a
 * light/dark variant, so both bgColor and bodyText are painted together and
 * ancestor CSS color/background cannot leak through.
 */
export function getThemeOverrideSurfaceFlags(
  override: IThemeOverride,
  parentEmotion: EmotionTheme
): ThemeOverrideSurfaceFlags {
  const merged = mergeOverrideValues(
    override,
    isLightOverrideMode(override, parentEmotion)
  )
  const explicitBase = notNullOrUndefined(override.base)
  return {
    applyBackgroundColor: Boolean(merged.backgroundColor) || explicitBase,
    applyTextColor: Boolean(merged.textColor) || explicitBase,
  }
}

/**
 * Derive a full ThemeConfig from a partial ThemeOverride layered on a parent
 * Emotion theme (inherit) or a configured/preset light/dark variant (explicit
 * base).
 */
export function createThemeFromOverride(
  override: IThemeOverride,
  parentEmotion: EmotionTheme,
  availableThemes: ThemeConfig[],
  options?: CreateThemeFromOverrideOptions
): ThemeConfig {
  const inSidebar = options?.inSidebar ?? parentEmotion.inSidebar
  const explicitBase = override.base
  const isLightMode = isLightOverrideMode(override, parentEmotion)
  const mergedInput = sanitizeThemeApiColors(
    mergeOverrideValues(override, isLightMode)
  )

  let baseThemeConfig: ThemeConfig
  if (notNullOrUndefined(explicitBase)) {
    baseThemeConfig = resolveExplicitBaseTheme(explicitBase, availableThemes)
  } else {
    // Placeholder name; overwritten below by `name`.
    baseThemeConfig = {
      name: "parent",
      emotion: {
        ...parentEmotion,
        inSidebar,
      },
    }
  }

  // Explicit `base` uses the resolved variant's input only. Presets have no
  // themeInput; copying the selected theme would paint its colors/fonts/radii
  // onto the sidebar while the main area stays on the preset variant.
  const parentInput = notNullOrUndefined(explicitBase)
    ? (baseThemeConfig.themeInput ?? {})
    : (options?.parentThemeInput ?? {})

  const name = options?.name ?? "Scoped"
  const created = createTheme(
    name,
    mergedInput as Partial<CustomThemeConfig>,
    baseThemeConfig,
    inSidebar
  )

  return {
    ...created,
    name,
    displayName: options?.displayName ?? created.displayName,
    themeInput: mergeThemeInputs(parentInput, mergedInput),
    ...(notNullOrUndefined(explicitBase) ? { overlayBase: explicitBase } : {}),
  }
}
