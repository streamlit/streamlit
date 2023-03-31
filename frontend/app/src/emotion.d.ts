/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { Theme as StreamlitTheme } from "@streamlit/st-lib"

// Outside imports make declarations not ambient, so we separate out from
// the ambient declarations.d.ts
//
// This declaration allows us to extend our type declarations for emotion's
// theme (an empty object) to be our type
declare module "@emotion/react" {
  export interface Theme extends StreamlitTheme {}
}
