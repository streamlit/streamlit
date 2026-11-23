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

import type embed from "vega-embed"
import type { expressionInterpreter } from "vega-interpreter"

/**
 * Loads `vega-embed` and the Vega expression interpreter when a chart is
 * about to draw.
 *
 * The interpreter evaluates Vega expressions without `eval`, so charts still
 * draw when a content security policy (CSP) blocks `eval`. Elements that only
 * sometimes draw a Vega chart (the `st.metric` sparkline, the dataframe column
 * statistics histogram) call this right before drawing, so pages that never
 * draw one skip the Vega chunk. Charts that always draw (`useVegaEmbed`) import
 * Vega statically instead.
 */
export async function loadVegaEmbed(): Promise<{
  embed: typeof embed
  expressionInterpreter: typeof expressionInterpreter
}> {
  const [embedModule, interpreterModule] = await Promise.all([
    import("vega-embed"),
    import("vega-interpreter"),
  ])
  return {
    embed: embedModule.default,
    expressionInterpreter: interpreterModule.expressionInterpreter,
  }
}
