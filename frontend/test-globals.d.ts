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

/**
 * Type declarations for test-only globals.
 * These are initialized in vitest.setup.ts.
 */

import type { HostWindowConfig } from "@streamlit/utils"

/**
 * Type for the shared mock StreamlitConfig state used in tests.
 * This allows tests to control StreamlitConfig values.
 */
interface MockStreamlitConfigState {
  BACKEND_BASE_URL?: string
  HOST_CONFIG_BASE_URL?: string
  DOWNLOAD_ASSETS_BASE_URL?: string
  MAIN_PAGE_BASE_URL?: string
  CUSTOM_COMPONENT_CLIENT_ID?: string
  LIGHT_THEME?: unknown
  DARK_THEME?: unknown
  ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION?: boolean
  HOST_CONFIG?: HostWindowConfig
}

declare global {
  var __mockStreamlitConfig: MockStreamlitConfigState
}

export {}
