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

module.exports = {
  meta: {
    name: "no-hardcoded-theme-values",
    type: "error",
    docs: {
      description: "Disallow hardcoded theme values",
      category: "Best Practices",
      recommended: true,
    },
    fixable: "code",
    schema: [],
  },
  create(context) {
    // Properties to check for values not allowed byt the allowedValuesRegex. We check the whole set of CSS properties with the allowed values,
    // instead of checking for each property individually based on what they allow (e.g. only check 'background-color' for 'transparent'), since
    // we do not need more fine granular matching.
    const cssPropertiesToCheck =
      /^(.*color|width|height|margin.*|padding.*|lineHeight|border.*|.*radius)$/i

    // Match and highlight as errors all values that either do not contain the word 'theme' or are not a CSS built-in value.
    // We also allow the value 0 because we use it extensively in our codebase.
    // Also allow %, vh, vw units because they are relative and relative values are okay from our theming perspective.
    const allowedValuesRegex =
      /^(?!.*theme)(?!('|")?(transparent|solid|initial|none|inherit|auto|fit-content|collapse|0|[0-9]+(%|vh|vw))( !important)?('|")?$).*$/i

    return {
      ObjectExpression(node) {
        node.properties.map(property => {
          if (
            !property.key ||
            !property.key.name ||
            !property.value ||
            !property.value.raw
          ) {
            return
          }
          if (
            cssPropertiesToCheck.test(property.key.name) &&
            allowedValuesRegex.test(property.value.raw)
          ) {
            context.report({
              node: property,
              message:
                "Hardcoded theme values are not allowed. All values must start with 'theme' or be a CSS built-in value such as 'none'.",
            })
          }
        })
      },
    }
  },
}
