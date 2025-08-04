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

/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

declare module "@loaders.gl/core"

declare module "@loaders.gl/csv"

declare module "@loaders.gl/gltf"

declare module "native-file-system-adapter"

// Type definition for an internal component in react-color. We need to override
// some of it to fix a bug in the color picker that triggers a security error when
// the color picker is closed in a cross-origin iframe, see `BaseColorPicker.tsx`.
declare module "react-color/es/components/common/Saturation" {
  import React from "react"
  export default class Saturation extends React.Component<any, any> {
    container: HTMLElement
    getContainerRenderWindow(): Window & typeof globalThis
  }
}
