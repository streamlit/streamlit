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

import { useEffect, useRef, useState } from "react"

import type { Locale } from "date-fns"

/**
 * Guesses the appropriate date-fns locale based on the provided locale string.
 *
 * @param {string} locale - The locale string, which can be in the format of
 * 'en' or 'en-US'.
 * @returns {string[]} An array of locale strings to try, starting with the full
 * locale and falling back to the base locale.
 */
const guessDateFnsLocale = (locale: string): string[] => {
  if (locale.length <= 2) {
    return [locale]
  }
  // Some locales such as `de-DE` only have a corresponding `de` locale in
  // date-fns. We should still try to load the full locale first, and then fall
  // back to one without a region.
  return [locale, locale.substring(0, 2)]
}

/**
 * Checks if a PromiseSettledResult is fulfilled.
 *
 * @template T - The type of the value that the promise resolves to.
 * @param {PromiseSettledResult<T>} input - The result of a settled promise.
 * @returns {input is PromiseFulfilledResult<T>} - Returns true if the promise
 * is fulfilled, otherwise false.
 */
const isFulfilled = <T,>(
  input: PromiseSettledResult<T>
): input is PromiseFulfilledResult<T> => input.status === "fulfilled"

export class LocaleNotLoadedError extends Error {
  constructor(locale: string) {
    super(`Locale ${locale} could not be loaded`)
  }
}

export const useDateFnsLocale = (
  locale: string
): Locale | LocaleNotLoadedError | null => {
  const [dateFnsLocale, setDateFnsLocale] = useState<
    Locale | LocaleNotLoadedError | null
  >(null)
  const localeRef = useRef(locale)
  const isMounted = useRef(true)

  useEffect(() => {
    localeRef.current = locale
    const localeToLoad = locale

    const handleLoad = async (): Promise<void> => {
      /**
       * Helper function to set the loaded locale while preventing race
       * conditions or setting the state after the component has unmounted.
       */
      const setLoadedLocale = (
        locale: Locale | LocaleNotLoadedError
      ): void => {
        if (isMounted.current && localeRef.current === localeToLoad) {
          setDateFnsLocale(locale)
        }
      }

      const possibleLocales = guessDateFnsLocale(locale)
      const loadedLocales = await Promise.allSettled(
        possibleLocales.map(
          localeToLoad => import(`date-fns/locale/${localeToLoad}`)
        )
      )

      // Find the first locale that was properly loaded. Since
      // `guessDateFnsLocale` returns locales in priority order we can take the
      // first one that was loaded as the "best" locale.
      const bestLocale = loadedLocales.find(locale => isFulfilled(locale))

      // TypeScript doesn't seem to be type narrowing correctly here, so we call
      // `isFulfilled` once more
      if (bestLocale && isFulfilled(bestLocale)) {
        setLoadedLocale(bestLocale.value.default)
        return
      }

      // If no locale was loaded, return an error
      setLoadedLocale(new LocaleNotLoadedError(localeToLoad))
    }

    handleLoad()

    return () => {
      isMounted.current = false
    }
  }, [locale])

  return dateFnsLocale
}
