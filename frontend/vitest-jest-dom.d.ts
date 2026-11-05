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
 * Vitest 5 custom matchers are declared on `Matchers<R, T>`.
 * `@testing-library/jest-dom/vitest` still augments `Assertion<T>`, which does
 * not merge with Vitest 5's two-parameter `Assertion<R, T>`. Remove this file
 * once jest-dom augments `Matchers` itself:
 * https://github.com/testing-library/jest-dom/issues/662
 */
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers"
import "vitest"

declare module "vitest" {
  // Type parameters must match Vitest's Matchers exactly so the interfaces merge.
  // Unused `T`, empty body, and jest-dom's `any` are required for that merge.
  /* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any -- declaration merging shim */
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<any, R> {}
  /* eslint-enable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
}
