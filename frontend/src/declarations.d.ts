/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// We don't have typings for deck.gl, so let's make it untyped.
declare module "deck.gl"

declare module "@deck.gl/json"

declare module "@deck.gl/layers"

declare module "@deck.gl/aggregation-layers"

declare module "@deck.gl/geo-layers"

declare module "@loaders.gl/core"

declare module "@loaders.gl/csv"

declare module "@emotion/styled" {
  import { CreateStyled } from "@emotion/styled/types/index"
  import { Theme } from "src/theme"

  export * from "@emotion/styled/types/index"
  const customStyled: CreateStyled<Theme>
  export default customStyled
}

declare module "fzy.js" {
  export function score(pattern: string, subject: string): number
  export function positions(pattern: string, subject: string): Array<number>
  export function hasMatch(pattern: string, subject: string): boolean
}
