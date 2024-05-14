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

// If __WEBPACK_PUBLIC_PATH_OVERRIDE is set, fetches of chunked static assets
// will have their request base paths set to this value. For example, if
// __WEBPACK_PUBLIC_PATH_OVERRIDE="https://example.com/", we'll attempt to
// fetch someJavascriptCode.chunk.js from https://example.com/someJavascriptCode.chunk.js
// Of course, we'll need to rework this if we ever decide to move away from
// webpack.
const webpackPublicPath: string | undefined = (window as any)
  .__WEBPACK_PUBLIC_PATH_OVERRIDE

// eslint-disable-next-line @typescript-eslint/naming-convention
declare let __webpack_public_path__: string | undefined

if (webpackPublicPath) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  __webpack_public_path__ = webpackPublicPath
}

export {}
