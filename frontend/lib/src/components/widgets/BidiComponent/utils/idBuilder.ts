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

import {
  EVENT_DELIM,
  STREAMLIT_INTERNAL_KEY_PREFIX,
} from "~lib/components/widgets/BidiComponent/constants"

/**
 * Suffix used for the trigger-aggregator widget id.
 */
export const TRIGGER_AGGREGATOR_SUFFIX = "events" as const

/**
 * Build the trigger-aggregator widget id given a component's base id.
 *
 * Aggregator widgets are marked as internal by prefixing with the internal key prefix,
 * so they won't be exposed in st.session_state to end users.
 *
 * @throws {Error} If base contains the delimiter. This prevents ambiguous ids.
 */
export function makeTriggerAggregatorId(base: string): string {
  if (base.includes(EVENT_DELIM)) {
    throw new Error(
      "Base component id must not contain the delimiter sequence"
    )
  }

  return `${STREAMLIT_INTERNAL_KEY_PREFIX}_${base}${EVENT_DELIM}${TRIGGER_AGGREGATOR_SUFFIX}`
}
