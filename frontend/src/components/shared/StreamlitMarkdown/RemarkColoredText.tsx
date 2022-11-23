/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
// @ts-nocheck
import { visit } from "unist-util-visit"
import { is } from "unist-util-is"

import {
  SentenceWithColorRegex,
  SentenceWithColorRegexes,
  ColorStartRegex,
  ColorStartRegexes,
  ColorEndRegexes,
} from "./styled-components"

function addColorTagsToText(child, currentColor): string {
  let text = child.value
  let match
  for (let i = 0; i < SentenceWithColorRegexes.length; i++) {
    match = text.match(SentenceWithColorRegexes[i])
    if (match) break
  }
  // I've never managed to infinite loop this version of the code,
  // however for safety, let's limit number of iterations to 1 000 000
  let numOfIterations = 0
  while (match && match.index !== undefined) {
    if (numOfIterations++ > 1000000) {
      break
    }
    const prefix = text.substring(0, match.index)
    if (prefix.length > 0) {
      text = text.substring(match.index)
    }
    for (let i = 0; i < SentenceWithColorRegexes.length; i++) {
      match = text.match(SentenceWithColorRegexes[i])
      if (match) break
    }
    if (match) {
      const colorMatch = match[0].match(ColorStartRegex)
      if (colorMatch) {
        text = text.substring(match[0].length)
      }
    }
  }
  let colorStartMatch
  for (let i = 0; i < ColorStartRegexes.length; i++) {
    colorStartMatch = text.match(ColorStartRegexes[i])
    if (colorStartMatch) break
  }
  let colorEndMatch
  for (let i = 0; i < ColorEndRegexes.length; i++) {
    colorEndMatch = text.match(ColorEndRegexes[i])
    if (colorEndMatch) break
  }
  if (colorStartMatch && !colorEndMatch && !currentColor) {
    const prefix = text.substring(0, colorStartMatch.index)
    if (prefix.length > 0) {
      text = text.substring(colorStartMatch.index)
    }
    currentColor = colorStartMatch[0].replace("[", "").replace("]", "")
    child.value = child.value.replace(text, `${text}[/${currentColor}]`)
  } else if (colorEndMatch && !colorStartMatch) {
    const suffix = text.substring(colorEndMatch.index, text.length)
    if (suffix.length > 0) {
      text = text.substring(0, colorEndMatch.index)
    }
    currentColor = colorEndMatch[0].substring(2, colorEndMatch[0].length - 1)
    child.value = child.value.replace(text, `[${currentColor}]${text}`)
    currentColor = null
  } else if (currentColor && !child.value.match(SentenceWithColorRegex)) {
    child.value = `[${currentColor}]${child.value}[/${currentColor}]`
  }
  return currentColor
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function remarkColoredText() {
  this.currentColor = null

  return (tree, file) => {
    visit(tree, "paragraph", node => {
      node.children.forEach((child, index) => {
        if (is(child, "strong")) {
          child.children.forEach((child, index) => {
            this.currentColor = addColorTagsToText(child, this.currentColor)
          })
        } else if (is(child, "text")) {
          this.currentColor = addColorTagsToText(child, this.currentColor)
        }
      })
    })
  }
}
