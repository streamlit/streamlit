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
 * @file This hook fetches Google Fonts asynchronously.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react"

import { WebfontAxios } from "../utils/axiosUtils"
import { webfontUrlBuilder } from "../utils/GoogleFontUtils"

import type { FontOptionProps, FetchOptionProps } from "../types/FontTypes"

interface FetchError {
  message: string
  error: Error
}

/**
 * Custom hook for fetching Google Fonts. It takes the full set of families from Google to load and creates
 *
 * @param {FetchOptionProps} options - Configuration options for fetching fonts, including:
 * @param {String} options.family Name of a font family.
 * @param {FontCategories} options.category All, multiple, or one specific category of fonts to load. Can be
 *                                  a single category as a string or an array of categories.
 * @param {GoogleFontSorts} options.sort How the fonts are sorted on fetch.
 * @param {String} options.subset Name of a font subset.
 * @param {String[]} options.variants The different styles to fetch for the family. Will only load variants
 *                            that are available for the selected families.
 * @returns {object} The font options and loading state. Contains:
 *  - fontOptions: Array of fonts that match the criteria.
 *  - isLoading: Boolean indicating if the fetch operation is ongoing.
 *  - error: Error information if the fetch fails.
 */
export const useFetchGoogleFonts = ({
  categories,
  family,
  sort = "alpha",
  subset,
  variants = ["regular"],
}: FetchOptionProps) => {
  const [fontOptions, setFontOptions] = useState<FontOptionProps[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<FetchError | null>(null)

  // Memoize parameters to ensure stability
  const memoizedCategories = useMemo(() => categories, [categories])
  const memoizedFamily = useMemo(() => family, [family])
  const memoizedSort = useMemo(() => sort, [sort])
  const memoizedSubset = useMemo(() => subset, [subset])
  const memoizedVariants = useMemo(() => variants, [variants])

  const fetchFonts = useCallback(async () => {
    try {
      setIsLoading(true)
      const webfontUrl = webfontUrlBuilder({
        family: memoizedFamily,
        sort: memoizedSort,
        subset: memoizedSubset,
      })
      const response = await WebfontAxios.get(webfontUrl)

      // Transforms the webfont response items for use as options in the font selector.
      // Extra values are added to the `Option` to allow for formatting, sorting, etc.
      const options: FontOptionProps[] = response.data.items
        .filter(font => {
          const fontMatchesCategory =
            memoizedCategories === undefined ||
            !memoizedCategories.length ||
            memoizedCategories.includes("all") ||
            memoizedCategories?.includes(font.category)
          const fontMatchesVariants =
            memoizedVariants === undefined ||
            !memoizedVariants.length ||
            memoizedVariants?.some(variant => font.variants.includes(variant))

          return fontMatchesCategory && fontMatchesVariants
        })
        .map(font => ({
          category: font.category,
          family: font.family,
          label: font.family,
          subsets: font.subsets,
          value: font.family,
          variants: font.variants,
          version: font.version,
        }))

      // Lastly, update the font options in the select dropdown list with the received fonts in the response.
      setFontOptions(options)
    } catch (err) {
      console.error("Failed to fetch fonts:", err)
      setError({ message: "Failed to fetch fonts", error: err })
    } finally {
      setIsLoading(false)
    }
  }, [
    memoizedFamily,
    memoizedSort,
    memoizedSubset,
    memoizedCategories,
    memoizedVariants,
  ])

  useEffect(() => {
    fetchFonts()
  }, [])

  return { fontOptions, isLoading, error }
}
