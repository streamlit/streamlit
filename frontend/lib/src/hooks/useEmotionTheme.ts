/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

// eslint-disable-next-line no-restricted-imports -- Expected usage
import { useTheme } from "@emotion/react"

import { EmotionTheme } from "~lib/theme"

/**
 * This hook is a wrapper around the useTheme hook from @emotion/react.
 * It is used to get the current theme from the emotion cache.
 * It is required to use this hook instead of useTheme for type-safety.
 *
 * @returns The current theme from the emotion cache.
 */
export const useEmotionTheme = (): EmotionTheme => {
  const theme: EmotionTheme = useTheme()

  return theme
}
