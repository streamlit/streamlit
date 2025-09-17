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

import enforceMemo from "./enforce-memo"
import noForceReflowAccess from "./no-force-reflow-access"
import noHardcodedThemeValues from "./no-hardcoded-theme-values"
import useStrictNullEqualityChecks from "./use-strict-null-equality-checks"

export default {
  rules: {
    "enforce-memo": enforceMemo,
    "no-force-reflow-access": noForceReflowAccess,
    "no-hardcoded-theme-values": noHardcodedThemeValues,
    "use-strict-null-equality-checks": useStrictNullEqualityChecks,
  },
}
