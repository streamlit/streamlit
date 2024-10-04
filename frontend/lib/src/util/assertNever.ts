/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
 * Asserts that a given value is of type `never`. This function is useful for
 * ensuring exhaustive checks in TypeScript. If the function is called, it
 * throws an error indicating that a non-exhaustive branch was reached.
 *
 * @param {never} x - The value that should be of type `never`.
 * @throws {Error} Throws an error if a non-exhaustive branch is reached.
 * @returns {never} This function never returns a value.
 */
export const assertNever = (x: never): never => {
  throw new Error(`Reached a branch with non-exhaustive item: ${x}`)
}
