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

/**
 * This rule enforces the use of React.memo for React components.
 * It detects exported components and ensures they are wrapped with memo
 * for performance optimization.
 */
module.exports = {
  meta: {
    name: "enforce-memo",
    type: "error",
    docs: {
      description: "Enforce use of React.memo for exported React components",
      category: "Best Practices",
      recommended: false,
    },
    fixable: "code",
    schema: [],
  },
  create(context) {
    // Track state for components used in various contexts
    const componentsUsedInHOCs = new Map() // Maps component name to HOC variable name or true if memoized
    const hocWrappedComponents = new Set() // Set of HOC-wrapped component variable names
    const exportedComponents = new Set() // Set of component names that are exported
    const sourceCode = context.getSourceCode()
    const sourceText = sourceCode.getText()

    /**
     * Checks if a component is already wrapped with React.memo in an export statement
     */
    const isWrappedInExport = componentName => {
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
    const isExported = node => node.parent?.type === "ExportDefaultDeclaration"

    /**
     * Checks if a component is used in a HOC and the result is memoized
     * Handles patterns like:
     * const EnhancedComponent = someOtherHOC(MyComponent)
     * export default memo(EnhancedComponent)
     */
    const isComponentUsedInMemoizedHOC = componentName => {
      const hocPattern = new RegExp(
        `const\\s+(\\w+)\\s*=\\s*\\w+\\(\\s*${componentName}\\s*\\)`,
        "g"
      )

      let match
      while ((match = hocPattern.exec(sourceText)) !== null) {
        if (match?.[1]) {
          const hocVarName = match[1]
          const memoExportPattern = new RegExp(
            `export\\s+default\\s+(React\\.memo|memo)\\(\\s*${hocVarName}\\s*\\)`
          )

          if (memoExportPattern.test(sourceText)) {
            return true
          }
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
    const isVariableExported = (_, componentName) => {
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
    const hasMemoImport = () => {
      const imports = sourceCode.ast.body.filter(
        node =>
          node.type === "ImportDeclaration" && node.source.value === "react"
      )

      // Check for named imports like: import { memo } from 'react'
      // or import React, { memo } from 'react'
      const hasNamedMemoImport = imports.some(importDecl =>
        importDecl.specifiers.some(
          specifier =>
            specifier.type === "ImportSpecifier" &&
            specifier.imported.name === "memo"
        )
      )

      // Check for namespace imports like: import * as React from 'react'
      // Since we can't statically know if React.memo is used with a namespace import,
      // we'll check if React is imported as a namespace and if React.memo is used in the code
      const hasNamespaceImport = imports.some(importDecl =>
        importDecl.specifiers.some(
          specifier => specifier.type === "ImportNamespaceSpecifier"
        )
      )

      return hasNamedMemoImport || hasNamespaceImport
    }

    /**
     * Adds the memo import if not already present in the file
     * Returns a fixer or null if import already exists
     */
    const ensureMemoImport = fixer => {
      if (hasMemoImport()) return null

      const allImports = sourceCode.ast.body.filter(
        node => node.type === "ImportDeclaration"
      )

      // Try to add to existing React import
      const reactImport = allImports.find(
        node =>
          node.source.value === "react" &&
          node.specifiers.every(
            spec =>
              spec.type !== "ImportSpecifier" || spec.imported.name !== "memo"
          )
      )

      if (reactImport) {
        const hasNamedImports = reactImport.specifiers.some(
          spec => spec.type === "ImportSpecifier"
        )

        if (hasNamedImports) {
          // Add to existing named imports
          const lastSpecifier =
            reactImport.specifiers[reactImport.specifiers.length - 1]
          return fixer.insertTextAfter(lastSpecifier, ", memo")
        } else {
          // Add as new named import alongside default import
          return fixer.insertTextAfter(reactImport.specifiers[0], ", { memo }")
        }
      } else if (allImports.length > 0) {
        // Add after the last import
        const lastImport = allImports[allImports.length - 1]
        return fixer.insertTextAfter(
          lastImport,
          "\nimport { memo } from 'react';"
        )
      } else {
        // Add at the beginning of the file
        return fixer.insertTextBefore(
          sourceCode.ast,
          "import { memo } from 'react';\n\n"
        )
      }
    }

    /**
     * Recursively finds all return statements in a node
     */
    const findReturnStatements = (node, results = []) => {
      if (!node) return results

      if (node.type === "ReturnStatement") {
        results.push(node)
      } else if (node.body) {
        if (Array.isArray(node.body)) {
          node.body.forEach(child => findReturnStatements(child, results))
        } else {
          findReturnStatements(node.body, results)
        }
      }

      // Handle conditionals and switch statements
      if (node.consequent) findReturnStatements(node.consequent, results)
      if (node.alternate) findReturnStatements(node.alternate, results)
      if (node.cases) node.cases.forEach(c => findReturnStatements(c, results))

      return results
    }

    /**
     * Determines if a node is likely a React component by checking if it returns JSX
     */
    const isLikelyReactComponent = node => {
      if (!node?.body) return false

      if (node.body.type === "BlockStatement") {
        // Check function body for JSX in return statements
        const returnStatements = findReturnStatements(node.body)
        return returnStatements.some(
          stmt =>
            stmt.argument?.type === "JSXElement" ||
            stmt.argument?.type === "JSXFragment"
        )
      }

      // Check for arrow functions with implicit JSX returns
      return (
        node.type === "ArrowFunctionExpression" &&
        (node.body.type === "JSXElement" || node.body.type === "JSXFragment")
      )
    }

    /**
     * Checks if a component is already wrapped with memo directly, in exports,
     * or used in an HOC that is memoized
     */
    const isMemoWrapped = (node, componentName) =>
      (node.parent?.type === "CallExpression" &&
        node.parent.callee &&
        (node.parent.callee.name === "memo" ||
          (node.parent.callee.object?.name === "React" &&
            node.parent.callee.property?.name === "memo"))) ||
      isWrappedInExport(componentName) ||
      isComponentUsedInMemoizedHOC(componentName)

    /**
     * Creates fixes for all export statements that reference a component
     */
    const fixExportStatements = (fixer, componentName) => {
      const regex = new RegExp(
        `(export\\s+default\\s+)(${componentName})([^\\w]|$)`,
        "g"
      )
      let match
      const exportMatches = []

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
        if (node.declaration?.type === "Identifier") {
          const exportedName = node.declaration.name
          exportedComponents.add(exportedName)

          if (hocWrappedComponents.has(exportedName)) {
            context.report({
              node,
              message: "React components should be wrapped with memo",
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
          node.arguments?.[0]?.type === "Identifier" &&
          isPascalCase(node.arguments[0].name)
        ) {
          const componentName = node.arguments[0].name

          // If part of a variable declaration: const Enhanced = someHOC(MyComponent)
          if (
            node.parent?.type === "VariableDeclarator" &&
            node.parent.id?.type === "Identifier"
          ) {
            const hocVarName = node.parent.id.name
            hocWrappedComponents.add(hocVarName)
            componentsUsedInHOCs.set(componentName, hocVarName)
          }

          // If directly exported: export default someHOC(MyComponent)
          if (node.parent?.type === "ExportDefaultDeclaration") {
            exportedComponents.add(componentName)
          }
        }

        // Capture export default memo(Component)
        if (
          (node.callee?.name === "memo" ||
            (node.callee?.object?.name === "React" &&
              node.callee?.property?.name === "memo")) &&
          node.arguments?.[0]?.type === "Identifier" &&
          node.parent?.type === "ExportDefaultDeclaration"
        ) {
          exportedComponents.add(node.arguments[0].name)
        }
      },

      // Handle memo call expressions specifically
      "CallExpression[callee.name='memo'], CallExpression[callee.property.name='memo']"(
        node
      ) {
        if (
          node.arguments?.[0]?.type === "Identifier" &&
          hocWrappedComponents.has(node.arguments[0].name)
        ) {
          // When a memo wraps an HOC variable, mark any components used in that HOC as memoized
          for (const [
            componentName,
            hocName,
          ] of componentsUsedInHOCs.entries()) {
            if (hocName === node.arguments[0].name) {
              componentsUsedInHOCs.set(componentName, true)

              if (node.parent?.type === "ExportDefaultDeclaration") {
                exportedComponents.add(componentName)
              }
            }
          }
        }
      },

      // Handle function declarations for components
      FunctionDeclaration(node) {
        // Skip if not a PascalCase React component
        if (!isPascalCase(node.id.name) || !isLikelyReactComponent(node)) {
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
          message: "React components should be wrapped with memo",
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
        if (!node.id?.type === "Identifier" || !isPascalCase(node.id.name))
          return

        // Skip if not a function expression
        if (
          !node.init ||
          (node.init.type !== "ArrowFunctionExpression" &&
            node.init.type !== "FunctionExpression")
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
          message: "React components should be wrapped with memo",
          fix(fixer) {
            const fixes = []
            const importFix = ensureMemoImport(fixer)
            if (importFix) fixes.push(importFix)

            if (isVariableStatementExported) {
              fixes.push(...fixExportStatements(fixer, componentName))
            } else {
              // Wrap the function definition with memo
              const nodeText = sourceCode.getText(node.init)
              fixes.push(fixer.replaceText(node.init, `memo(${nodeText})`))
            }

            return fixes.length > 0 ? fixes : null
          },
        })
      },
    }
  },
}

/**
 * Checks if a name follows PascalCase convention (used to identify components)
 */
const isPascalCase = name =>
  name?.[0] === name?.[0].toUpperCase() && name?.length > 1
