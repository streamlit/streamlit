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

declare module "*.png"
declare module "*.jpg"
declare module "*.gif"
declare module "*.svg"

// We don't have typings for deck.gl, so let's make it untyped.
declare module "deck.gl"

declare module "@deck.gl/json"

declare module "@deck.gl/layers"

declare module "@deck.gl/aggregation-layers"

declare module "@deck.gl/geo-layers"

declare module "@deck.gl/mesh-layers"

declare module "@loaders.gl/core"

declare module "@loaders.gl/csv"

declare module "@loaders.gl/gltf"

declare module "fzy.js" {
  export function score(pattern: string, subject: string): number
  export function positions(pattern: string, subject: string): Array<number>
  export function hasMatch(pattern: string, subject: string): boolean
}
