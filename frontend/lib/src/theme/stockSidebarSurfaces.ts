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

import { CustomThemeConfig } from "@streamlit/protobuf"

/** Stock sidebar surface colors when `[theme.sidebar]` does not set them. */
export const stockSidebarSurfaces = {
  [CustomThemeConfig.BaseTheme.LIGHT]: {
    backgroundColor: "#F8F8F7",
    secondaryBackgroundColor: "#F4F4F3",
  },
  [CustomThemeConfig.BaseTheme.DARK]: {
    backgroundColor: "#21201D",
    secondaryBackgroundColor: "#34322E",
  },
} as const
