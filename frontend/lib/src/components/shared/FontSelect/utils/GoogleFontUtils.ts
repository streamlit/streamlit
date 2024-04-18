/**
 * @file Utilities for fetching Google Fonts using the Google Fonts API.
 *
 * @see https://developers.google.com/fonts/docs/developer_api
 * @module GoogleFontUtils
 */

import type {
  GoogleFontFamilyArgs,
  GoogleFontFaceApiArgs,
  GoogleWebfontApiArgs,
} from "../types/FontTypes"

/**
 * Appends a stylesheet link to the document head for a given href.
 *
 * @param {string} href - The URL of the stylesheet to append.
 */
export const addFontStylesheet = (href: string) => {
  const link = document.createElement("link")
  link.href = href
  link.rel = "stylesheet"
  document.head.appendChild(link)
}

/**
 * Removes a stylesheet link from the document head for a given href.
 * @param {string} href - The URL of the stylesheet to remove.
 */
export const removeFontStylesheet = (href: string) => {
  const link = document.head.querySelector(`link[href="${href}"]`) as HTMLLinkElement;

  if (link) {
    document.head.removeChild(link);
  }
};

/**
 * Google Fonts API font-face CSS URL builder.
 */

/**
 * Splits font families into chunks to adhere to API request limits.
 *
 * @param {Array} families - The list of font families to chunk.
 * @param {Number} chunkSize = The maximum number of font families per CSS request.
 * @returns {Array} Chunked list of font families.
 */
export const chunkFontFamilies = (
  families: GoogleFontFamilyArgs[],
  chunkSize = 500
) => {
  let chunked: Array<GoogleFontFamilyArgs[]> = []

  for (let i = 0; i < families.length; i += chunkSize) {
    const chunk: GoogleFontFamilyArgs[] = families.slice(i, i + chunkSize)
    chunked.push(chunk)
  }

  return chunked
}

/**
 * Constructs a Google Fonts API font-face CSS URL based on provided arguments.
 *
 * @param {FontApiArgs} fontArgs - The font args to be used in the URL.
 * @param {string} fontArgs.capability - The font capability to be used in the URL.
 * @param {GoogleFontFamilyArgs[]} fontArgs.families - An array of font families to be used in the URL. Each font family object should contain a family name and an array of variant names.
 * @param {string} fontArgs.families.family - Name of a font family. A singular family name, such as "Roboto".
 * @param {string[]} fontArgs.families.variants - Name of a font variant. An array of variant names, such as "regular".
 * @param {string} fontArgs.sort - The font sort to be used in the URL.
 * @param {string[]} fontArgs.subsets - The font subsets to be used in the URL.
 * @param {string} fontArgs.text - The font text to be used in the URL.
 * @param {string} fontArgs.effect - The font effect to be used in the URL.
 * @param {string} fontArgs.display - The font display to be used in the URL.
 * @returns {string[]} The constructed URL for fetching the specified Google Fonts CSS.
 */
export const fontFaceUrlBuilder = (
  fontArgs: GoogleFontFaceApiArgs
): string[] => {
  if (!fontArgs.families.length) {
    return []
  }

  // Chunk the `families` lists to smaller groups since the Google `@font-face` API
  // has a limit of 1095 fonts per request URL.
  const families =
    fontArgs.families.length > 1095
      ? chunkFontFamilies(fontArgs.families)
      : [fontArgs.families]

  // Then craft the list of urls for adding font stylesheets to the document.
  const fontUrls = families.map(group => {
    let apiUrl = "https://fonts.googleapis.com/css?family="

    group.forEach((font, index) => {
      if (!font.family || font.family === "") {
        return ""
      }

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
  })

  return fontUrls
}

/**
 * Constructs a URL for the Google Webfonts API based on provided arguments.
 *
 * @requires GOOGLE_API_KEY - The org Google API key to be used in the URL.
 * @param {GoogleWebfontApiArgs} fontArgs - The font args to be used in the URL.
 * @param {string} fontArgs.capability - The font capability to be used in the URL.
 * @param {string} fontArgs.family - Name of a font family. A singular family name, such as "Roboto".
 * @param {string[]} fontArgs.subset - Name of a font subset. A singular subset name, such as "latin".
 * @param {string} fontArgs.sort - The font sort to be used in the URL.
 * @returns {string} The constructed URL for fetching webfonts from the Google Webfonts API.
 */
export const webfontUrlBuilder = (fontArgs: GoogleWebfontApiArgs): string => {
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
