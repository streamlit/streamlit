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
 * The contract that lets a `type="step"` expander draw one continuous timeline
 * across the flex gap that separates it from the next step. The step itself
 * cannot know that gap, and the container cannot know which of its children are
 * steps, so each side provides half: the block renderer marks step wrappers with
 * `STEP_BLOCK_ATTRIBUTE`, and the container hands the gap down through
 * `STEP_CONNECTOR_BOTTOM_VAR`.
 */

/** Marks a layout wrapper whose block is a `type="step"` expander. */
export const STEP_BLOCK_ATTRIBUTE = "data-step"

/**
 * Custom property holding the `bottom` offset of a step's connector line. A
 * negative value pulls the line across the flex gap to the next step's icon.
 */
export const STEP_CONNECTOR_BOTTOM_VAR = "--st-step-connector-bottom"

/** Selects a step wrapper that is directly followed by another step. */
export const STEP_FOLLOWED_BY_STEP_SELECTOR = `& > [${STEP_BLOCK_ATTRIBUTE}="true"]:has(+ [${STEP_BLOCK_ATTRIBUTE}="true"])`
