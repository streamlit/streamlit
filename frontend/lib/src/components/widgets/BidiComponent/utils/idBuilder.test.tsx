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

import { describe, expect, it } from "vitest"

import { STREAMLIT_INTERNAL_KEY_PREFIX } from "~lib/components/widgets/BidiComponent/constants"
import {
  makeTriggerAggregatorId,
  TRIGGER_AGGREGATOR_SUFFIX,
} from "~lib/components/widgets/BidiComponent/utils/idBuilder"

describe("utils/idBuilder", () => {
  describe("makeTriggerAggregatorId", () => {
    it("creates aggregator IDs with internal prefix to hide them from session state", () => {
      expect(makeTriggerAggregatorId("myComponent")).toBe(
        `${STREAMLIT_INTERNAL_KEY_PREFIX}_myComponent__${TRIGGER_AGGREGATOR_SUFFIX}`
      )
    })

    it("concatenates base and suffix with the expected format", () => {
      const aggregatorIds = [
        makeTriggerAggregatorId("component123"),
        makeTriggerAggregatorId("anotherComponent"),
      ]

      aggregatorIds.forEach(aggregatorId => {
        // Should start with internal prefix
        expect(aggregatorId).toMatch(
          new RegExp(`^\\$\\$STREAMLIT_INTERNAL_KEY_`)
        )
        // Should contain the delimiter
        expect(aggregatorId).toMatch(/__/)
        // Should be structured as prefix_base__events
        expect(aggregatorId).toMatch(
          new RegExp(
            `^\\$\\$STREAMLIT_INTERNAL_KEY_[^_]+__${TRIGGER_AGGREGATOR_SUFFIX}$`
          )
        )
      })
    })

    it("throws when base contains the delimiter", () => {
      expect(() => makeTriggerAggregatorId("bad__base")).toThrow()
    })
  })
})
