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

import type * as WaveSurferNS from "wavesurfer.js"
import type * as RecordPluginNS from "wavesurfer.js/dist/plugins/record.js"

/**
 * Loads WaveSurfer and its Record plugin.
 * Split out so tests can delay this import and exercise init races.
 */
export async function loadWaveSurferModules(): Promise<{
  WaveSurfer: typeof WaveSurferNS.default
  RecordPluginClass: typeof RecordPluginNS.default
}> {
  const [WaveSurferModule, RecordPluginModule] = await Promise.all([
    import("wavesurfer.js"),
    // v8 package exports require the .js suffix for dist/plugins imports.
    import("wavesurfer.js/dist/plugins/record.js"),
  ])
  return {
    WaveSurfer: WaveSurferModule.default,
    RecordPluginClass: RecordPluginModule.default,
  }
}
