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

/**
 * @file Common types utilized across the various `FontSelect` files.
 */
import type { OptionProps as ReactSelectOptionProps } from "react-select"

/**
 * Basic types for pre-defined options and values from Google Fonts.
 */
export type FontCategories =
  | "all" // Default value
  | "display"
  | "handwriting"
  | "monospace"
  | "sans-serif"
  | "serif"
export type GoogleFontSorts =
  | "alpha"
  | "date"
  | "popularity"
  | "style"
  | "trending"
export type GoogleFontCapabilities = "VF" | "WOFF2"
export type GoogleDisplayOptions =
  | "auto"
  | "block"
  | "swap"
  | "fallback"
  | "optional"
export type GoogleFontVariants =
  | "regular"
  | "italic"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"
  | "100italic"
  | "200italic"
  | "300italic"
  | "400italic"
  | "500italic"
  | "600italic"
  | "700italic"
  | "800italic"
  | "900italic"

/**
 * Google Font Face CSS API params and args defs.
 */
export interface GoogleFontFamilyArgs {
  family?: string
  variants?: GoogleFontVariants[]
}

/**
 * Types for args in `@font-face` CSS API URL builder.
 *
 * @see https://developers.google.com/fonts/docs/getting_started
 * @typedef GoogleFontFaceApiArgs - The valid args used in the URL when fetching the `@font-face` CSS.
 */
export interface GoogleFontFaceApiArgs {
  capability?: GoogleFontCapabilities
  display?: GoogleDisplayOptions
  effect?: string
  families: GoogleFontFamilyArgs[]
  sort?: GoogleFontSorts
  subsets?: string[]
  text?: string
}

export interface GoogleFontFilesProps {
  [key: string]: string
}

export interface GoogleFontFamilyAxesProps {
  tag: string
  start: string
  end: string
}

/**
 * Describes the response properties for a font family from the Google `webfonts` API.
 *
 * @see https://developers.google.com/fonts/docs/developer_api#details
 * @typedef GoogleFontFamilyResponseProps - The font metadata response properties.
 * @param axes {GoogleFontFamilyAxesProps} - Axis range, Present only upon request(see below) for variable fonts.
 * @param family {string} - The name of the family
 * @param files {GoogleFontFilesProps} - The font family files (with all supported scripts) for each one of the available variants.
 * @param kind {string} - The kind of object, a webfont object
 * @param lastModified {string} - The date (format "yyyy-MM-dd") the font family was modified for the last time.
 * @param menu {string} - A url to the family subset covering only the name of the family.
 * @param subsets {string[]} - A list of scripts supported by the family
 * @param variants {string[]} - The different styles available for the family
 * @param version {string} - The font family version.
 */
export interface GoogleFontFamilyResponseProps {
  axes?: GoogleFontFamilyAxesProps[]
  family: string
  files: GoogleFontFilesProps
  kind: string
  lastModified: string
  menu: string
  subsets: string[]
  variants: GoogleFontVariants[]
  version: string
}

/**
 * Webfonts API URL builder that takes the font args and formats them into a URL.`1
 *
 * @see https://developers.google.com/fonts/docs/developer_api
 * @typedef GoogleWebfontApiArgs - The valid args used in the URL when fetching the webfonts API.
 */
export interface GoogleWebfontApiArgs {
  capability?: GoogleFontCapabilities
  family?: string
  sort?: GoogleFontSorts
  subset?: string
}

export interface FontFamilyMetaProps {
  family?: string
  variants?: GoogleFontVariants[]
}

export interface FetchOptionProps {
  categories?: FontCategories | FontCategories[]
  family?: string
  sort?: GoogleFontSorts
  subset?: string
  variants?: GoogleFontVariants[]
}

/**
 * Defines the shape of a font option.
 */
export interface FontOptionProps {
  category?: FontCategories
  family?: string
  label: string
  options?: FontOptionProps[]
  subsets?: string[]
  value?: string
  variants?: GoogleFontVariants[]
  version?: string
}

export interface OptionComponentProps extends ReactSelectOptionProps {
  data: FontOptionProps
}
