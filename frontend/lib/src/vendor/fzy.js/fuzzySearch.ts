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

// Thank you to fzy.js for the original implementation
// https://github.com/jhawthorn/fzy.js (MIT License)

const SCORE_MIN = -Infinity
const SCORE_MAX = Infinity
const SCORE_GAP_LEADING = -0.005
const SCORE_GAP_TRAILING = -0.005
const SCORE_GAP_INNER = -0.01
const SCORE_MATCH_CONSECUTIVE = 1.0
const SCORE_MATCH_SLASH = 0.9
const SCORE_MATCH_WORD = 0.8
const SCORE_MATCH_CAPITAL = 0.7
const SCORE_MATCH_DOT = 0.6

function islower(s: string): boolean {
  return s.toLowerCase() === s
}

function isupper(s: string): boolean {
  return s.toUpperCase() === s
}

function precomputeBonus(haystack: string): number[] {
  /* Which positions are beginning of words */
  const m = haystack.length
  const matchBonus = new Array(m) as number[]

  let lastChar = "/"
  for (let i = 0; i < m; i++) {
    const ch = haystack[i]

    if (lastChar === "/") {
      matchBonus[i] = SCORE_MATCH_SLASH
    } else if (lastChar === "-" || lastChar === "_" || lastChar === " ") {
      matchBonus[i] = SCORE_MATCH_WORD
    } else if (lastChar === ".") {
      matchBonus[i] = SCORE_MATCH_DOT
    } else if (islower(lastChar) && isupper(ch)) {
      matchBonus[i] = SCORE_MATCH_CAPITAL
    } else {
      matchBonus[i] = 0
    }

    lastChar = ch
  }

  return matchBonus
}

function compute(
  needle: string,
  haystack: string,
  D: number[][],
  M: number[][],
  caseSensitive = false
): void {
  const n = needle.length
  const m = haystack.length

  const lowerNeedle = caseSensitive ? needle : needle.toLowerCase()
  const lowerHaystack = caseSensitive ? haystack : haystack.toLowerCase()

  const matchBonus = precomputeBonus(haystack)

  /*
   * D[][] Stores the best score for this position ending with a match.
   * M[][] Stores the best possible score at this position.
   */

  for (let i = 0; i < n; i++) {
    D[i] = new Array(m)
    M[i] = new Array(m)

    let prevScore = SCORE_MIN
    const gapScore = i === n - 1 ? SCORE_GAP_TRAILING : SCORE_GAP_INNER

    for (let j = 0; j < m; j++) {
      if (lowerNeedle[i] === lowerHaystack[j]) {
        let score = SCORE_MIN
        if (!i) {
          score = j * SCORE_GAP_LEADING + matchBonus[j]
        } else if (j) {
          /* i > 0 && j > 0*/
          score = Math.max(
            M[i - 1][j - 1] + matchBonus[j],

            /* consecutive match, doesn't stack with matchBonus */
            D[i - 1][j - 1] + SCORE_MATCH_CONSECUTIVE
          )
        }
        D[i][j] = score
        M[i][j] = prevScore = Math.max(score, prevScore + gapScore)
      } else {
        D[i][j] = SCORE_MIN
        M[i][j] = prevScore = prevScore + gapScore
      }
    }
  }
}

function score(
  needle: string,
  haystack: string,
  caseSensitive: boolean = false
): number {
  const n = needle.length
  const m = haystack.length

  if (!n || !m) return SCORE_MIN

  if (needle === haystack || (!caseSensitive && m === n)) {
    /* Since this method can only be called with a haystack which
     * matches needle. If the lengths of the strings are equal the
     * strings themselves must also be equal (ignoring case).
     */
    return SCORE_MAX
  }

  if (m > 1024) {
    /*
     * Unreasonably large candidate: return no score
     * If it is a valid match it will still be returned, it will
     * just be ranked below any reasonably sized candidates
     */
    return SCORE_MIN
  }

  const D = new Array(n)
  const M = new Array(n)

  compute(needle, haystack, D, M, caseSensitive)

  return M[n - 1][m - 1]
}

function positions(needle: string, haystack: string): number[] {
  const n = needle.length
  const m = haystack.length

  const positions = new Array(n)

  if (!n || !m) return positions

  if (n === m) {
    for (let i = 0; i < n; i++) positions[i] = i
    return positions
  }

  if (m > 1024) {
    return positions
  }

  const D = new Array(n)
  const M = new Array(n)

  compute(needle, haystack, D, M)

  /* backtrack to find the positions of optimal matching */
  let matchRequired = false

  for (let i = n - 1, j = m - 1; i >= 0; i--) {
    for (; j >= 0; j--) {
      /*
       * There may be multiple paths which result in
       * the optimal weight.
       *
       * For simplicity, we will pick the first one
       * we encounter, the latest in the candidate
       * string.
       */
      if (D[i][j] !== SCORE_MIN && (matchRequired || D[i][j] === M[i][j])) {
        /* If this score was determined using
         * SCORE_MATCH_CONSECUTIVE, the
         * previous character MUST be a match
         */
        matchRequired = Boolean(
          i && j && M[i][j] === D[i - 1][j - 1] + SCORE_MATCH_CONSECUTIVE
        )
        positions[i] = j--
        break
      }
    }
  }

  return positions
}

function hasMatch(needle: string, haystack: string): boolean {
  needle = needle.toLowerCase()
  haystack = haystack.toLowerCase()
  const l = needle.length
  for (let i = 0, j = 0; i < l; i += 1) {
    j = haystack.indexOf(needle[i], j) + 1
    if (j === 0) return false
  }
  return true
}

export {
  /* constants */
  SCORE_MIN,
  SCORE_MAX,
  SCORE_GAP_LEADING,
  SCORE_GAP_TRAILING,
  SCORE_GAP_INNER,
  SCORE_MATCH_CONSECUTIVE,
  SCORE_MATCH_SLASH,
  SCORE_MATCH_WORD,
  SCORE_MATCH_CAPITAL,
  SCORE_MATCH_DOT,

  /* functions */
  score,
  positions,
  hasMatch,
}
