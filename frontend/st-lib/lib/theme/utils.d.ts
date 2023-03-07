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
import { ThemePrimitives, Theme as BaseTheme } from "baseui/theme";
import { CustomThemeConfig, ICustomThemeConfig } from "src/autogen/proto";
import { Theme, ThemeConfig } from "src/theme";
export declare const AUTO_THEME_NAME = "Use system setting";
export declare const CUSTOM_THEME_NAME = "Custom Theme";
export declare const isPresetTheme: (themeConfig: ThemeConfig) => boolean;
export declare const fontToEnum: (font: string) => CustomThemeConfig.FontFamily;
export declare const fontEnumToString: (font: CustomThemeConfig.FontFamily | null | undefined) => string | undefined;
export declare const bgColorToBaseString: (bgColor?: string) => string;
export declare const createBaseThemePrimitives: (baseTheme: ThemePrimitives, theme: Theme) => ThemePrimitives;
export declare const createThemeOverrides: (theme: Theme) => Record<string, any>;
export declare const createBaseUiTheme: (theme: Theme, primitives?: import("baseui").Primitives) => BaseTheme & Record<string, any>;
type DerivedColors = {
    linkText: string;
    fadedText05: string;
    fadedText10: string;
    fadedText20: string;
    fadedText40: string;
    fadedText60: string;
    bgMix: string;
    darkenedBgMix100: string;
    darkenedBgMix25: string;
    darkenedBgMix15: string;
    lightenedBg05: string;
};
export declare const createEmotionColors: (genericColors: {
    [key: string]: string;
}) => {
    [key: string]: string;
};
export declare const isColor: (strColor: string) => boolean;
export declare const createEmotionTheme: (themeInput: Partial<ICustomThemeConfig>, baseThemeConfig?: ThemeConfig) => Theme;
export declare const toThemeInput: (theme: Theme) => Partial<CustomThemeConfig>;
export type ExportedTheme = {
    base: string;
    primaryColor: string;
    backgroundColor: string;
    secondaryBackgroundColor: string;
    textColor: string;
    font: string;
} & DerivedColors;
export declare const toExportedTheme: (theme: Theme) => ExportedTheme;
export declare const createTheme: (themeName: string, themeInput: Partial<CustomThemeConfig>, baseThemeConfig?: ThemeConfig, inSidebar?: boolean) => ThemeConfig;
export declare const getSystemTheme: () => ThemeConfig;
export declare const getCachedTheme: () => ThemeConfig | null;
export declare const setCachedTheme: (themeConfig: ThemeConfig) => void;
export declare const removeCachedTheme: () => void;
export declare const getDefaultTheme: () => ThemeConfig;
export declare function computeSpacingStyle(value: string, theme: Theme): string;
export declare function hasLightBackgroundColor(theme: Theme): boolean;
export declare function getGray70(theme: Theme): string;
export declare function getGray30(theme: Theme): string;
export declare function getGray90(theme: Theme): string;
export declare function getMdRed(theme: Theme): string;
export declare function getMdBlue(theme: Theme): string;
export declare function getMdGreen(theme: Theme): string;
export declare function getMdViolet(theme: Theme): string;
export declare function getMdOrange(theme: Theme): string;
export declare function getSequentialColorsArray(theme: Theme): string[];
export declare function getDivergingColorsArray(theme: Theme): string[];
export declare function getCategoricalColorsArray(theme: Theme): string[];
export declare function getDecreasingRed(theme: Theme): string;
export declare function getIncreasingGreen(theme: Theme): string;
export {};
