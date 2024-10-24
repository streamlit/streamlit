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
    name: "use-strict-null-equality-checks",
    type: "suggestion",
    docs: {
      description: "Disallow == null and != null comparisons",
      category: "Best Practices",
      recommended: true,
    },
    fixable: "code",
    schema: [],
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator === "==" || node.operator === "!=") {
          if (
            (node.right.type === "Literal" && node.right.value === null) ||
            (node.right.type === "Identifier" &&
              node.right.name === "undefined")
          ) {
            context.report({
              node,
              message:
                "Use isNullOrUndefined or notNullOrUndefined instead of == null or != null",
              fix(fixer) {
                const isNegated = node.operator === "!="
                const replacement = isNegated
                  ? "notNullOrUndefined"
                  : "isNullOrUndefined"
                const sourceCode = context.getSourceCode()
                const leftText = sourceCode.getText(node.left)
                return fixer.replaceText(node, `${replacement}(${leftText})`)
              },
            })
          }
        }
      },
    }
  },
}
