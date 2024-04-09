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
 * @file Utilities for fetching Google Fonts using the Google Fonts API.
 *
 * @see https://developers.google.com/fonts/docs/developer_api
 * @module GoogleFontUtils
 */

interface FontFilesProps {
  [key: string]: string
}

interface FontFamilyAxesProps {
  tag: string
  start: string
  end: string
}

/**
 * Describes the response properties for a font family from the Google `webfonts` API.
 *
 * @see https://developers.google.com/fonts/docs/developer_api#details
 * @typedef FontFamilyResponseProps - The font metadata response properties.
 * @param axes {FontFamilyAxesProps} - Axis range, Present only upon request(see below) for variable fonts.
 * @param family {string} - The name of the family
 * @param files {FontFilesProps} - The font family files (with all supported scripts) for each one of the available variants.
 * @param kind {string} - The kind of object, a webfont object
 * @param lastModified {string} - The date (format "yyyy-MM-dd") the font family was modified for the last time.
 * @param menu {string} - A url to the family subset covering only the name of the family.
 * @param subsets {string[]} - A list of scripts supported by the family
 * @param variants {string[]} - The different styles available for the family
 * @param version {string} - The font family version.
 */
export interface FontFamilyResponseProps {
  axes?: FontFamilyAxesProps[]
  family: string
  files: FontFilesProps
  kind: string
  lastModified: string
  menu: string
  subsets: string[]
  variants: string[]
  version: string
}

/**
 * Google Fonts API font-face CSS URL builder.
 */
interface FontFamilyArgs {
  family: string
  variants?: string[]
}

/**
 * Types for args in `@font-face` CSS API URL builder.
 *
 * @see https://developers.google.com/fonts/docs/getting_started
 * @typedef FontFaceApiArgs - The valid args used in the URL when fetching the `@font-face` CSS.
 */
export interface FontFaceApiArgs {
  capability?: "VF" | "WOFF2"
  families: FontFamilyArgs[]
  sort?: "alpha" | "date" | "popularity" | "style" | "trending"
  subsets?: string[]
  text?: string
  effect?: string
  display?: "auto" | "block" | "swap" | "fallback" | "optional"
}

/**
 * Constructs a Google Fonts API font-face CSS URL based on provided arguments.
 *
 * @param {FontApiArgs} fontArgs - The font args to be used in the URL.
 * @param {string} fontArgs.capability - The font capability to be used in the URL.
 * @param {FontFamilyArgs[]} fontArgs.families - An array of font families to be used in the URL. Each font family object should contain a family name and an array of variant names.
 * @param {string} fontArgs.families.family - Name of a font family. A singular family name, such as "Roboto".
 * @param {string[]} fontArgs.families.variants - Name of a font variant. An array of variant names, such as "regular".
 * @param {string} fontArgs.sort - The font sort to be used in the URL.
 * @param {string[]} fontArgs.subsets - The font subsets to be used in the URL.
 * @param {string} fontArgs.text - The font text to be used in the URL.
 * @param {string} fontArgs.effect - The font effect to be used in the URL.
 * @param {string} fontArgs.display - The font display to be used in the URL.
 * @returns {string} The constructed URL for fetching the specified Google Fonts CSS.
 */
export const fontFaceUrlBuilder = (fontArgs: FontFaceApiArgs): string => {
  let apiUrl = "https://fonts.googleapis.com/css?family="

  fontArgs.families.forEach((font, index) => {
    if (index > 0) {
      // Add a pipe separator between font families.
      apiUrl += "|"
    }

    // Encode the font family name and replace spaces with '+' rather than '%20'.
    apiUrl += encodeURIComponent(font.family).replace(/%20/g, "+")

    if (font.variants) {
      apiUrl += `:${font.variants.join(",")}`
    }
  })

  if (fontArgs.subsets) {
    apiUrl += `&subset=${fontArgs.subsets.join(",")}`
  }

  if (fontArgs.sort) {
    apiUrl += `&sort=${fontArgs.sort}`
  }

  return apiUrl
}

/**
 * Webfonts API URL builder that takes the font args and formats them into a URL.
 *
 * @see https://developers.google.com/fonts/docs/developer_api
 * @typedef WebfontApiArgs - The valid args used in the URL when fetching the webfonts API.
 */
export interface WebfontApiArgs {
  capability?: "VF" | "WOFF2"
  family?: string
  sort?: "alpha" | "date" | "popularity" | "style" | "trending"
  subset?: string
}

/**
 * Constructs a URL for the Google Webfonts API based on provided arguments.
 *
 * @requires GOOGLE_API_KEY - The org Google API key to be used in the URL.
 * @param {WebfontApiArgs} fontArgs - The font args to be used in the URL.
 * @param {string} fontArgs.capability - The font capability to be used in the URL.
 * @param {string} fontArgs.family - Name of a font family. A singular family name, such as "Roboto".
 * @param {string[]} fontArgs.subsets - Name of a font subset. A singular subset name, such as "latin".
 * @param {string} fontArgs.sort - The font sort to be used in the URL.
 * @returns {string} The constructed URL for fetching webfonts from the Google Webfonts API.
 */
export const webfontUrlBuilder = (fontArgs: WebfontApiArgs): string => {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error(
      "GOOGLE_API_KEY is not defined. Method doesn't allow unregistered callers (callers without established identity). Please use API Key or other form of API consumer identity to call this API."
    )
  }

  let apiUrl = `https://www.googleapis.com/webfonts/v1/webfonts?key=${process.env.GOOGLE_API_KEY}`

  // If no font args are provided, return the base URL.
  // This will retrieve the dynamic list of fonts offered by the Google Fonts service.
  if (Object.keys(fontArgs).length === 0) {
    return apiUrl
  }

  if (fontArgs.family) {
    // Encode the font family name and replace spaces with '+' rather than '%20'.
    apiUrl += `&family=${encodeURIComponent(fontArgs.family).replace(
      /%20/g,
      "+"
    )}`
  }

  if (fontArgs.subset) {
    apiUrl += `&subset=${fontArgs.subset}`
  }

  if (fontArgs.sort) {
    apiUrl += `&sort=${fontArgs.sort}`
  }

  return apiUrl
}
