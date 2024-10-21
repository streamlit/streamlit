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

import emotionBaseTheme from "@streamlit/lib/src/theme/emotionBaseTheme"
import { createEmotionColors } from "@streamlit/lib/src/theme/getColors"

import genericColors from "./themeColors"

export default {
  ...emotionBaseTheme,
  inSidebar: false,
  colors: createEmotionColors({
    ...emotionBaseTheme.colors,
    ...genericColors,
  }),
}
