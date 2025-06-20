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

import * as fzy from "./fuzzySearch"

const score = fzy.score
const positions = fzy.positions

const SCORE_MIN = fzy.SCORE_MIN
const SCORE_MAX = fzy.SCORE_MAX

const SCORE_GAP_LEADING = fzy.SCORE_GAP_LEADING
const SCORE_GAP_TRAILING = fzy.SCORE_GAP_TRAILING
const SCORE_GAP_INNER = fzy.SCORE_GAP_INNER
const SCORE_MATCH_CONSECUTIVE = fzy.SCORE_MATCH_CONSECUTIVE
const SCORE_MATCH_SLASH = fzy.SCORE_MATCH_SLASH
const SCORE_MATCH_CAPITAL = fzy.SCORE_MATCH_CAPITAL
const SCORE_MATCH_DOT = fzy.SCORE_MATCH_DOT

/* score(needle, haystack) */
describe("score", () => {
  it("should prefer starts of words", function () {
    /* app/models/order is better than app/models/zrder
     * because 'o' in order comes before 'z' in zrder */
    expect(score("amor", "app/models/order")).toBeGreaterThan(
      score("amor", "app/models/zrder")
    )
  })

  it("should prefer consecutive letters", function () {
    /* app/models/foo is better than app/m/foo  */
    expect(score("amo", "app/m/foo")).toBeLessThan(
      score("amo", "app/models/foo")
    )
  })

  it("should prefer contiguous over letter following period", function () {
    /* GEMFIle.Lock < GEMFILe  */
    expect(score("gemfil", "Gemfile.lock")).toBeLessThan(
      score("gemfil", "Gemfile")
    )
  })

  it("should prefer shorter matches", function () {
    expect(score("abce", "abcdef")).toBeGreaterThan(score("abce", "abc de"))
    expect(score("abc", "    a b c ")).toBeGreaterThan(
      score("abc", " a  b  c ")
    )
    expect(score("abc", " a b c    ")).toBeGreaterThan(
      score("abc", " a  b  c ")
    )
  })

  it("should prefer shorter candidates", function () {
    expect(score("test", "tests")).toBeGreaterThan(score("test", "testing"))
  })

  it("should prefer start of candidate", function () {
    /* Scores first letter highly */
    expect(score("test", "testing")).toBeGreaterThan(score("test", "/testing"))
  })

  it("score exact score", function () {
    /* Exact match is SCORE_MAX */
    expect(score("abc", "abc")).toBe(SCORE_MAX)
  })

  it("scores case insensitive the same", () => {
    expect(score("abc", "abc", false)).toBe(SCORE_MAX)
    expect(score("aBc", "abC", false)).toBe(SCORE_MAX)
  })

  it("scores case sensitive differently", () => {
    expect(score("abc", "abc", true)).toBeGreaterThan(
      score("aBc", "abC", true)
    )
  })

  it("score empty query", function () {
    /* Empty query always results in SCORE_MIN */
    expect(score("", "")).toBe(SCORE_MIN)
    expect(score("", "a")).toBe(SCORE_MIN)
    expect(score("", "bb")).toBe(SCORE_MIN)
  })

  it("score gaps", function () {
    expect(score("a", "*a")).toBe(SCORE_GAP_LEADING)
    expect(score("a", "*ba")).toBe(SCORE_GAP_LEADING * 2)
    expect(score("a", "**a*")).toBe(SCORE_GAP_LEADING * 2 + SCORE_GAP_TRAILING)
    expect(score("a", "**a**")).toBe(
      SCORE_GAP_LEADING * 2 + SCORE_GAP_TRAILING * 2
    )
    expect(score("aa", "**aa**")).toBe(
      SCORE_GAP_LEADING * 2 + SCORE_MATCH_CONSECUTIVE + SCORE_GAP_TRAILING * 2
    )
    expect(score("aa", "**a*a**")).toBe(
      SCORE_GAP_LEADING +
        SCORE_GAP_LEADING +
        SCORE_GAP_INNER +
        SCORE_GAP_TRAILING +
        SCORE_GAP_TRAILING
    )
  })

  it("score consecutive", function () {
    expect(score("aa", "*aa")).toBe(
      SCORE_GAP_LEADING + SCORE_MATCH_CONSECUTIVE
    )
    expect(score("aaa", "*aaa")).toBe(
      SCORE_GAP_LEADING + SCORE_MATCH_CONSECUTIVE * 2
    )
    expect(score("aaa", "*a*aa")).toBe(
      SCORE_GAP_LEADING + SCORE_GAP_INNER + SCORE_MATCH_CONSECUTIVE
    )
  })

  it("score slash", function () {
    expect(score("a", "/a")).toBe(SCORE_GAP_LEADING + SCORE_MATCH_SLASH)
    expect(score("a", "*/a")).toBe(SCORE_GAP_LEADING * 2 + SCORE_MATCH_SLASH)
    expect(score("aa", "a/aa")).toBe(
      SCORE_GAP_LEADING * 2 + SCORE_MATCH_SLASH + SCORE_MATCH_CONSECUTIVE
    )
  })

  it("score capital", function () {
    expect(score("a", "bA")).toBe(SCORE_GAP_LEADING + SCORE_MATCH_CAPITAL)
    expect(score("a", "baA")).toBe(SCORE_GAP_LEADING * 2 + SCORE_MATCH_CAPITAL)
    expect(score("aa", "baAa")).toBe(
      SCORE_GAP_LEADING * 2 + SCORE_MATCH_CAPITAL + SCORE_MATCH_CONSECUTIVE
    )
  })

  it("score dot", function () {
    expect(score("a", ".a")).toBe(SCORE_GAP_LEADING + SCORE_MATCH_DOT)
    expect(score("a", "*a.a")).toBe(SCORE_GAP_LEADING * 3 + SCORE_MATCH_DOT)
    expect(score("a", "*a.a")).toBe(
      SCORE_GAP_LEADING + SCORE_GAP_INNER + SCORE_MATCH_DOT
    )
  })

  it("should return SCORE_MIN for empty haystack", () => {
    expect(score("abc", "")).toBe(SCORE_MIN)
  })

  it("should handle case-sensitive matching correctly", () => {
    expect(score("abc", "ABC", true)).toBe(SCORE_MIN)
    expect(score("ABC", "ABC", true)).toBe(SCORE_MAX)
  })

  it("should return SCORE_MIN for non-matching needle", () => {
    expect(score("xyz", "abcdef")).toBe(SCORE_MIN)
  })

  it("should handle special characters in needle and haystack", () => {
    expect(score("a*c", "a*b*c")).toBeGreaterThan(SCORE_MIN)
    expect(score("a*c", "abc")).toBe(SCORE_MAX)
  })
})

describe("positions", () => {
  it("positions consecutive", function () {
    const p = positions("amo", "app/models/foo")
    expect(p).toEqual([0, 4, 5])
  })

  it("positions start of word", function () {
    /*
     * We should prefer matching the 'o' in order, since it's the beginning
     * of a word.
     */
    const p = positions("amor", "app/models/order")
    expect(p).toEqual([0, 4, 11, 12])
  })

  it("positions no bonuses", function () {
    let p = positions("as", "tags")
    expect(p).toEqual([1, 3])

    p = positions("as", "examples.txt")
    expect(p).toEqual([2, 7])
  })

  it("positions multiple candidates start of words", function () {
    const p = positions("abc", "a/a/b/c/c")
    expect(p).toEqual([2, 4, 6])
  })

  it("positions exact match", function () {
    const p = positions("foo", "foo")
    expect(p).toEqual([0, 1, 2])
  })
})

describe("hasMatch", () => {
  it("should return true for matching needle and haystack", () => {
    expect(fzy.hasMatch("abc", "abcdef")).toBe(true)
  })

  it("should return false for non-matching needle and haystack", () => {
    expect(fzy.hasMatch("xyz", "abcdef")).toBe(false)
  })

  it("should handle case-insensitive matching", () => {
    expect(fzy.hasMatch("ABC", "abcdef")).toBe(true)
  })

  it("should handle special characters in needle and haystack", () => {
    expect(fzy.hasMatch("a*c", "a*b*c")).toBe(true)
    expect(fzy.hasMatch("a*c", "abc")).toBe(false)
  })

  it("should return true for empty needle", () => {
    expect(fzy.hasMatch("", "abcdef")).toBe(true)
  })

  it("should return false for empty haystack", () => {
    expect(fzy.hasMatch("abc", "")).toBe(false)
  })
})
