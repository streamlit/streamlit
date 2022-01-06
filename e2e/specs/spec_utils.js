/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Indexing into a list of elements produced by `cy.get()` may fail if not enough
// elements are rendered, but this does not prompt cypress to retry the `get` call,
// so the list will never update. This is a major cause of flakiness in tests.
// The solution is to use `should` to wait for enough elements to be available first.
// This is a convenience function for doing this automatically.
export function cyGetIndexed(selector, index) {
  return cy
    .get(selector)
    .should("have.length.at.least", index + 1)
    .eq(index);
}
