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

import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils"
import { RuleFix, RuleFixer } from "@typescript-eslint/utils/ts-eslint"

import { createRule } from "./utils/createRule"

type MessageIds = "enforceMemo"

/**
 * Checks if a name follows PascalCase convention (used to identify components)
 */
const isPascalCase = (name: string): boolean =>
  name?.[0] === name?.[0].toUpperCase() && name?.length > 1

/**
 * This rule enforces the use of React.memo for React components.
 * It detects exported components and ensures they are wrapped with memo
 * for performance optimization.
 */
const enforceMemo = createRule<[], MessageIds>({
  name: "enforce-memo",
  meta: {
    type: "problem",
    docs: {
      description: "Enforce use of React.memo for exported React components",
    },
    fixable: "code",
    schema: [],
    messages: {
      enforceMemo: "React components should be wrapped with memo",
    },
  },
  defaultOptions: [],
  create(context) {
    // Track state for components used in various contexts
    const componentsUsedInHOCs = new Map<string, string | boolean>() // Maps component name to HOC variable name or true if memoized
    const hocWrappedComponents = new Set<string>() // Set of HOC-wrapped component variable names
    const exportedComponents = new Set<string>() // Set of component names that are exported
    const sourceCode = context.getSourceCode()
    const sourceText = sourceCode.getText()

    // Cache for HOC pattern matching to avoid recompiling regex on every call
    const hocPatternCache = new Map<string, string[]>() // Maps component name to array of HOC variable names

    /**
     * Checks if a component is already wrapped with React.memo in an export statement
     */
    const isWrappedInExport = (componentName: string): boolean => {
      const exportPatterns = [
        `export\\s+default\\s+React\\.memo\\(\\s*${componentName}\\s*\\)`,
        `export\\s+default\\s+memo\\(\\s*${componentName}\\s*\\)`,
        `export\\s+default\\s+React\\.memo\\(\\s*\\w+\\(\\s*${componentName}\\s*\\)\\s*\\)`,
        `export\\s+default\\s+memo\\(\\s*\\w+\\(\\s*${componentName}\\s*\\)\\s*\\)`,
      ].map(pattern => new RegExp(pattern))

      return exportPatterns.some(pattern => pattern.test(sourceText))
    }

    /**
     * Checks if the node is part of an export declaration
     */
    const isExported = (node: TSESTree.Node): boolean =>
      node.parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration

    /**
     * Checks if a component is used in a HOC and the result is memoized
     * Handles patterns like:
     * const EnhancedComponent = someOtherHOC(MyComponent)
     * export default memo(EnhancedComponent)
     */
    const isComponentUsedInMemoizedHOC = (componentName: string): boolean => {
      // Check cache first
      if (!hocPatternCache.has(componentName)) {
        const hocVarNames: string[] = []
        const hocPattern = new RegExp(
          `const\\s+(\\w+)\\s*=\\s*\\w+\\(\\s*${componentName}\\s*\\)`,
          "g"
        )

        let match
        while ((match = hocPattern.exec(sourceText)) !== null) {
          if (match?.[1]) {
            hocVarNames.push(match[1])
          }
        }

        hocPatternCache.set(componentName, hocVarNames)
      }

      const hocVarNames = hocPatternCache.get(componentName) || []

      // Check if any of the HOC variables are exported with memo
      for (const hocVarName of hocVarNames) {
        const memoExportPattern = new RegExp(
          `export\\s+default\\s+(React\\.memo|memo)\\(\\s*${hocVarName}\\s*\\)`
        )

        if (memoExportPattern.test(sourceText)) {
          return true
        }
      }

      return (
        componentsUsedInHOCs.has(componentName) &&
        componentsUsedInHOCs.get(componentName) === true
      )
    }

    /**
     * Checks if a variable is exported somewhere in the file
     */
    const isVariableExported = (
      _: TSESTree.Node,
      componentName: string
    ): boolean => {
      // Return early if we already know this component is exported
      if (exportedComponents.has(componentName)) {
        return true
      }

      // Check if used in a memoized HOC
      if (isComponentUsedInMemoizedHOC(componentName)) {
        return true
      }

      // Check for direct exports or HOC+memo wrapped exports
      const patterns = [
        new RegExp(`export\\s+default\\s+${componentName}[^\\w]`),
        new RegExp(
          `export\\s+default\\s+(React\\.memo|memo)\\(\\s*\\w+\\(\\s*${componentName}\\s*\\)\\s*\\)`
        ),
      ]

      const isExported = patterns.some(pattern => pattern.test(sourceText))

      if (isExported) {
        exportedComponents.add(componentName)
      }

      return isExported
    }

    /**
     * Checks if the file already imports memo from react using AST
     * This properly detects all import patterns:
     * - import { memo } from 'react'
     * - import React, { memo } from 'react'
     * - import * as React from 'react' (+ React.memo usage)
     */
    const hasMemoImport = (): boolean => {
      const imports = sourceCode.ast.body.filter(
        (node): node is TSESTree.ImportDeclaration =>
          node.type === AST_NODE_TYPES.ImportDeclaration &&
          node.source.value === "react"
      )

      // Check for named imports like: import { memo } from 'react'
      // or import React, { memo } from 'react'
      const hasNamedMemoImport = imports.some(importDecl =>
        importDecl.specifiers.some(
          specifier =>
            specifier.type === AST_NODE_TYPES.ImportSpecifier &&
            specifier.imported.type === AST_NODE_TYPES.Identifier &&
            specifier.imported.name === "memo"
        )
      )

      // Check for namespace imports like: import * as React from 'react'
      // Since we can't statically know if React.memo is used with a namespace import,
      // we'll check if React is imported as a namespace and if React.memo is used in the code
      const hasNamespaceImport = imports.some(importDecl =>
        importDecl.specifiers.some(
          specifier =>
            specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier
        )
      )

      return hasNamedMemoImport || hasNamespaceImport
    }

    /**
     * Adds the memo import if not already present in the file
     * Returns a fixer or null if import already exists
     */
    const ensureMemoImport = (fixer: RuleFixer): RuleFix | null => {
      if (hasMemoImport()) return null

      const allImports = sourceCode.ast.body.filter(
        (node): node is TSESTree.ImportDeclaration =>
          node.type === AST_NODE_TYPES.ImportDeclaration
      )

      // Try to add to existing React import
      const reactImport = allImports.find(
        node =>
          node.source.value === "react" &&
          node.specifiers.every(
            spec =>
              spec.type !== AST_NODE_TYPES.ImportSpecifier ||
              (spec.imported.type === AST_NODE_TYPES.Identifier &&
                spec.imported.name !== "memo")
          )
      )

      if (reactImport) {
        const hasNamedImports = reactImport.specifiers.some(
          spec => spec.type === AST_NODE_TYPES.ImportSpecifier
        )

        if (hasNamedImports) {
          // Add to existing named imports
          const lastSpecifier =
            reactImport.specifiers[reactImport.specifiers.length - 1]
          return fixer.insertTextAfter(lastSpecifier, ", memo")
        }
        // Add as new named import alongside default import
        // Check if we have a default import to add named imports after
        const defaultImport = reactImport.specifiers.find(
          spec => spec.type === AST_NODE_TYPES.ImportDefaultSpecifier
        )
        if (defaultImport) {
          return fixer.insertTextAfter(defaultImport, ", { memo }")
        }
        // If no default import, add at the end of specifiers
        if (reactImport.specifiers.length === 0) {
          // Handle the case where there are no specifiers
          return fixer.insertTextAfter(reactImport.source, " { memo }")
        }
        const lastSpecifier =
          reactImport.specifiers[reactImport.specifiers.length - 1]
        return fixer.insertTextAfter(lastSpecifier, ", memo")
      } else if (allImports.length > 0) {
        // Add after the last import
        const lastImport = allImports[allImports.length - 1]
        return fixer.insertTextAfter(
          lastImport,
          "\nimport { memo } from 'react';"
        )
      }
      // Add at the beginning of the file
      return fixer.insertTextBefore(
        sourceCode.ast,
        "import { memo } from 'react';\n\n"
      )
    }

    /**
     * Recursively finds all return statements in a node
     */
    const findReturnStatements = (
      node: TSESTree.Node,
      results: TSESTree.ReturnStatement[] = []
    ): TSESTree.ReturnStatement[] => {
      if (!node) return results

      if (node.type === AST_NODE_TYPES.ReturnStatement) {
        results.push(node)
      } else if ("body" in node && node.body) {
        if (Array.isArray(node.body)) {
          node.body.forEach(child => {
            if (child && typeof child === "object" && "type" in child) {
              findReturnStatements(child as TSESTree.Node, results)
            }
          })
        } else if (typeof node.body === "object" && "type" in node.body) {
          findReturnStatements(node.body as TSESTree.Node, results)
        }
      }

      // Handle conditionals and switch statements
      if (
        "consequent" in node &&
        node.consequent &&
        typeof node.consequent === "object" &&
        "type" in node.consequent
      ) {
        findReturnStatements(node.consequent as TSESTree.Node, results)
      }
      if (
        "alternate" in node &&
        node.alternate &&
        typeof node.alternate === "object" &&
        "type" in node.alternate
      ) {
        findReturnStatements(node.alternate as TSESTree.Node, results)
      }
      if ("cases" in node && node.cases && Array.isArray(node.cases)) {
        node.cases.forEach(c => {
          if (c && typeof c === "object" && "type" in c) {
            findReturnStatements(c as TSESTree.Node, results)
          }
        })
      }

      return results
    }

    /**
     * Determines if a node is likely a React component by checking if it returns JSX
     */
    const isLikelyReactComponent = (node: TSESTree.Node): boolean => {
      if (!("body" in node) || !node.body) return false

      if (
        typeof node.body === "object" &&
        "type" in node.body &&
        node.body.type === AST_NODE_TYPES.BlockStatement
      ) {
        // Check function body for JSX in return statements
        const returnStatements = findReturnStatements(
          node.body as TSESTree.Node
        )
        return returnStatements.some(
          stmt =>
            stmt.argument?.type === AST_NODE_TYPES.JSXElement ||
            stmt.argument?.type === AST_NODE_TYPES.JSXFragment
        )
      }

      // Check for arrow functions with implicit JSX returns
      return (
        node.type === AST_NODE_TYPES.ArrowFunctionExpression &&
        typeof node.body === "object" &&
        "type" in node.body &&
        (node.body.type === AST_NODE_TYPES.JSXElement ||
          node.body.type === AST_NODE_TYPES.JSXFragment)
      )
    }

    /**
     * Checks if a component is already wrapped with memo directly, in exports,
     * or used in an HOC that is memoized
     */
    const isMemoWrapped = (
      node: TSESTree.Node,
      componentName: string
    ): boolean =>
      (node.parent?.type === AST_NODE_TYPES.CallExpression &&
        node.parent.callee &&
        ((node.parent.callee.type === AST_NODE_TYPES.Identifier &&
          node.parent.callee.name === "memo") ||
          (node.parent.callee.type === AST_NODE_TYPES.MemberExpression &&
            node.parent.callee.object?.type === AST_NODE_TYPES.Identifier &&
            node.parent.callee.object.name === "React" &&
            node.parent.callee.property?.type === AST_NODE_TYPES.Identifier &&
            node.parent.callee.property.name === "memo"))) ||
      isWrappedInExport(componentName) ||
      isComponentUsedInMemoizedHOC(componentName)

    /**
     * Creates fixes for all export statements that reference a component
     */

    const fixExportStatements = (
      fixer: RuleFixer,
      componentName: string
    ): RuleFix[] => {
      const regex = new RegExp(
        `(export\\s+default\\s+)(${componentName})([^\\w]|$)`,
        "g"
      )
      let match
      const exportMatches: Array<{ start: number; end: number }> = []

      // Find all exports of this component
      while ((match = regex.exec(sourceText)) !== null) {
        exportMatches.push({
          start: match.index + match[1].length,
          end: match.index + match[1].length + componentName.length,
        })
      }

      // Apply fixes in reverse order to avoid position shifts
      return exportMatches
        .reverse()
        .map(({ start, end }) =>
          fixer.replaceTextRange([start, end], `memo(${componentName})`)
        )
    }

    // Return an object with methods for each node type to analyze
    return {
      // Handle direct exports like: export default MyComponent
      ExportDefaultDeclaration(node) {
        if (node.declaration?.type === AST_NODE_TYPES.Identifier) {
          const exportedName = node.declaration.name
          exportedComponents.add(exportedName)

          if (hocWrappedComponents.has(exportedName)) {
            context.report({
              node,
              messageId: "enforceMemo",
              fix(fixer) {
                const fixes = []
                const importFix = ensureMemoImport(fixer)
                if (importFix) fixes.push(importFix)
                fixes.push(
                  fixer.replaceText(node.declaration, `memo(${exportedName})`)
                )
                return fixes.length > 0 ? fixes : null
              },
            })
          }
        }
      },

      // Handle call expressions like HOC calls and memo wrapping
      CallExpression(node) {
        // Capture component used in HOC call: someHOC(MyComponent)
        if (
          node.arguments?.[0]?.type === AST_NODE_TYPES.Identifier &&
          isPascalCase(node.arguments[0].name)
        ) {
          const componentName = node.arguments[0].name

          // If part of a variable declaration: const Enhanced = someHOC(MyComponent)
          if (
            node.parent?.type === AST_NODE_TYPES.VariableDeclarator &&
            node.parent.id?.type === AST_NODE_TYPES.Identifier
          ) {
            const hocVarName = node.parent.id.name
            hocWrappedComponents.add(hocVarName)
            componentsUsedInHOCs.set(componentName, hocVarName)
          }

          // If directly exported: export default someHOC(MyComponent)
          if (node.parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
            exportedComponents.add(componentName)
          }
        }

        // Capture export default memo(Component)
        if (
          ((node.callee?.type === AST_NODE_TYPES.Identifier &&
            node.callee.name === "memo") ||
            (node.callee?.type === AST_NODE_TYPES.MemberExpression &&
              node.callee.object?.type === AST_NODE_TYPES.Identifier &&
              node.callee.object.name === "React" &&
              node.callee.property?.type === AST_NODE_TYPES.Identifier &&
              node.callee.property.name === "memo")) &&
          node.arguments?.[0]?.type === AST_NODE_TYPES.Identifier &&
          node.parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration
        ) {
          exportedComponents.add(node.arguments[0].name)
        }
      },

      // Handle memo call expressions specifically
      "CallExpression[callee.name='memo'], CallExpression[callee.property.name='memo']"(
        node: TSESTree.CallExpression
      ) {
        if (
          node.arguments?.[0]?.type === AST_NODE_TYPES.Identifier &&
          hocWrappedComponents.has(node.arguments[0].name)
        ) {
          // When a memo wraps an HOC variable, mark any components used in that HOC as memoized
          for (const [
            componentName,
            hocName,
          ] of componentsUsedInHOCs.entries()) {
            if (hocName === node.arguments[0].name) {
              componentsUsedInHOCs.set(componentName, true)

              if (
                node.parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration
              ) {
                exportedComponents.add(componentName)
              }
            }
          }
        }
      },

      // Handle function declarations for components
      FunctionDeclaration(node) {
        // Skip if not a PascalCase React component
        if (
          !node.id ||
          !isPascalCase(node.id.name) ||
          !isLikelyReactComponent(node)
        ) {
          return
        }

        const componentName = node.id.name
        if (isMemoWrapped(node, componentName)) return

        // Check if exported directly or indirectly
        const isDirectlyExported = isExported(node)
        if (isDirectlyExported) {
          exportedComponents.add(componentName)
        }

        const isIndirectlyExported = isVariableExported(node, componentName)
        if (!isDirectlyExported && !isIndirectlyExported) return

        // Report and fix the issue
        context.report({
          node,
          messageId: "enforceMemo",
          fix(fixer) {
            const fixes = []
            const importFix = ensureMemoImport(fixer)
            if (importFix) fixes.push(importFix)

            if (!isDirectlyExported && isIndirectlyExported) {
              fixes.push(...fixExportStatements(fixer, componentName))
            }

            return fixes.length > 0 ? fixes : null
          },
        })
      },

      // Handle variable declarations for components (arrow functions)
      VariableDeclarator(node) {
        // Skip if not a PascalCase component name
        if (
          node.id?.type !== AST_NODE_TYPES.Identifier ||
          !isPascalCase(node.id.name)
        )
          return

        // Skip if not a function expression
        if (
          !node.init ||
          (node.init.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
            node.init.type !== AST_NODE_TYPES.FunctionExpression)
        ) {
          return
        }

        // Skip if not returning JSX
        if (!isLikelyReactComponent(node.init)) return

        const componentName = node.id.name
        if (isMemoWrapped(node, componentName)) return

        // Only trigger for exported components
        const isVariableStatementExported = isVariableExported(
          node,
          componentName
        )
        if (!isVariableStatementExported) return

        // Report and fix the issue
        context.report({
          node,
          messageId: "enforceMemo",
          fix(fixer) {
            const fixes = []
            const importFix = ensureMemoImport(fixer)
            if (importFix) fixes.push(importFix)

            if (isVariableStatementExported) {
              fixes.push(...fixExportStatements(fixer, componentName))
            } else {
              // Wrap the function definition with memo
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const nodeText = sourceCode.getText(node.init!)
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              fixes.push(fixer.replaceText(node.init!, `memo(${nodeText})`))
            }

            return fixes.length > 0 ? fixes : null
          },
        })
      },
    }
  },
})

export default enforceMemo
