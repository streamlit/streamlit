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

/**
 * Prefixes of server-issued scope tokens (Delta.scope_token). A widget whose
 * callback is a signal or a fragment function carries one of these tokens
 * through the existing fragment id plumbing; real fragment ids are hex hashes
 * and never contain ":", so a prefix check is unambiguous.
 */
const SCOPE_TOKEN_PREFIXES = ["signal:", "fragment_fn:"] as const

/**
 * Returns whether the given fragmentId-shaped value is a server-issued scope
 * token that must be sent back as ClientState.scope_token instead of
 * ClientState.fragment_id.
 */
export function isScopeToken(value: string): boolean {
  return SCOPE_TOKEN_PREFIXES.some(prefix => value.startsWith(prefix))
}
