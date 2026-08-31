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
 * In GitHub Actions, emit workflow-command annotations then stylish output.
 * Locally, delegate to stylish.
 */

import path from "node:path"

const GITHUB_ANNOTATION_SEVERITY = {
  2: "error",
  1: "warning",
}

function escapeData(value) {
  return String(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A")
}

function escapeProperty(value) {
  return escapeData(value)
    .replaceAll(":", "%3A")
    .replaceAll(",", "%2C")
    .replaceAll("[", "%5B")
    .replaceAll("]", "%5D")
}

function toAnnotationFilePath(filePath, context) {
  const root = process.env.GITHUB_WORKSPACE ?? context?.cwd ?? process.cwd()
  const relative = path.relative(root, filePath)
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return filePath
  }
  return relative
}

function formatGithubAnnotations(results, context) {
  const lines = []

  for (const result of results) {
    for (const message of result.messages) {
      const severity = GITHUB_ANNOTATION_SEVERITY[message.severity] ?? "notice"
      const props = [
        `file=${escapeProperty(toAnnotationFilePath(result.filePath, context))}`,
      ]
      if (message.line != null) {
        props.push(`line=${message.line}`)
      }
      if (message.endLine != null) {
        props.push(`endLine=${message.endLine}`)
      }
      if (message.column != null) {
        props.push(`col=${message.column}`)
      }
      if (message.endColumn != null) {
        props.push(`endColumn=${message.endColumn}`)
      }
      if (message.ruleId) {
        props.push(`title=${escapeProperty(message.ruleId)}`)
      }

      const text = message.ruleId
        ? `${message.message} [${message.ruleId}]`
        : message.message
      lines.push(`::${severity} ${props.join(",")}::${escapeData(text)}`)
    }
  }

  return lines.join("\n")
}

async function formatStylish(results, context) {
  const { ESLint } = await import("eslint")
  const eslint = new ESLint()
  const stylish = await eslint.loadFormatter("stylish")
  return stylish.format(results, context)
}

export default async function githubFormatter(results, context) {
  const stylishOutput = await formatStylish(results, context)

  if (process.env.GITHUB_ACTIONS !== "true") {
    return stylishOutput
  }

  const annotations = formatGithubAnnotations(results, context)
  return [annotations, stylishOutput].filter(Boolean).join("\n")
}
