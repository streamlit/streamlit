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

import { AST_NODE_TYPES } from "@typescript-eslint/utils"

import { createRule } from "./utils/createRule"

type MessageIds = "useStrictEquality"

const useStrictNullEqualityChecks = createRule<[], MessageIds>({
  name: "use-strict-null-equality-checks",
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow == null and != null comparisons",
    },
    fixable: "code",
    schema: [],
    messages: {
      useStrictEquality:
        "Use isNullOrUndefined or notNullOrUndefined instead of == null or != null",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator === "==" || node.operator === "!=") {
          if (
            (node.right.type === AST_NODE_TYPES.Literal &&
              node.right.value === null) ||
            (node.right.type === AST_NODE_TYPES.Identifier &&
              node.right.name === "undefined") ||
            (node.left.type === AST_NODE_TYPES.Literal &&
              node.left.value === null) ||
            (node.left.type === AST_NODE_TYPES.Identifier &&
              node.left.name === "undefined")
          ) {
            context.report({
              node,
              messageId: "useStrictEquality",
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
})

export default useStrictNullEqualityChecks
