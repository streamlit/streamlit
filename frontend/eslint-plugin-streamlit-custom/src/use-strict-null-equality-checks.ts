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

// TODO: Convert from JavaScript implementation
const useStrictNullEqualityChecks = {
  meta: {
    type: "problem" as const,
    docs: {
      description: "Enforce strict null equality checks",
    },
    schema: [],
    messages: {
      useStrictEquality:
        "Use strict equality (=== or !==) instead of loose equality (== or !=)",
    },
  },
  create(context: any) {
    return {
      // Rule implementation will be migrated from JavaScript version
    }
  },
}

export default useStrictNullEqualityChecks
