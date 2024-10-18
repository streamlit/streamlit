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
 * This rule will disallow hardcoded theme values in styled-components / in all object expressions.
 * This includues:
 * - <div style={{ backgroundColor: 'red', width: '100px' }} />
 * - styled.div`background-color: red; width: 100px;`
 * - const foo = styled.div(() => { backgroundColor: 'red', width: '100px' })
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
      /^(.*color|width|height|margin.*|padding.*|lineHeight|line-height|border.*|.*radius|font.*|zIndex|z-index)$/i

    // Match and highlight as errors all values that either do not contain the word 'theme' or are not a CSS built-in value.
    // We also allow the value 0 because we use it extensively in our codebase.
    // Also allow %, em, vh, vw units after a number because they are relative and relative values are okay from our theming perspective. We don't allow 'rem'
    // though because its less fine-granular than 'em' and we use(d) it heavily to hardcode any kinds of values in our codebase.
    // The following font-related values are allowed: 'small-caps', 'italic', 'normal', 'liga'.
    // The part '(((-)?[0-9]+(\.[0-9]+)?(%|em|vh|vw)|0)\s?)+' allows for non-zero digits with a unit or 0, or a combination of both separated by whitespaces.
    const allowedValuesRegex =
      /^(?!.*theme)(?!('|")?(transparent|solid|initial|none|inherit|auto|unset|fit-content|collapse|0|(((-)?[0-9]+(\.[0-9]+)?(%|em|vh|vw)|0)\s?)+|small-caps|italic|normal|liga)( !important)?('|")?$).*$/i

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
      TaggedTemplateExpression(node) {
        // we only check templateExpressions in combination of the styled object,
        // e.g. styled.div`color: theme.colors.primary;`
        if (
          !node.tag.object ||
          node.tag.object.name !== "styled" ||
          !node.quasi
        ) {
          return
        }
        node.quasi.quasis.map(quasi => {
          if (quasi.type !== "TemplateElement") {
            return
          }

          const styleProperties = quasi.value.raw.split(";")
          for (const styleProperty of styleProperties) {
            const [property, value] = styleProperty.split(":")
            if (!property || !value) {
              continue
            }
            const trimmedProperty = property.trim()
            const trimmedValue = value.trim()
            if (
              cssPropertiesToCheck.test(trimmedProperty) &&
              allowedValuesRegex.test(trimmedValue) &&
              // when a function is passed, e.g. "width: ${({ theme }) => theme }px",
              // the trimmedValue is empty with the current parsing. We skip this for now to not
              // overcomplicate the parsing.
              trimmedValue !== ""
            ) {
              context.report({
                node: quasi,
                message:
                  "Hardcoded theme values are not allowed in template strings. All values must start with 'theme' or be a CSS built-in value such as 'none'. In general, please use the styled-object notation anyways.",
              })
            }
          }
        })
      },
    }
  },
}
