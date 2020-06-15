/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import url from "url"
import xxhash from "xxhashjs"
import {
  fromJS,
  List,
  Map as ImmutableMap,
  Set as ImmutableSet,
} from "immutable"
import { Alert as AlertProto } from "autogen/proto"
import { BlockElement, ReportElement, SimpleElement } from "./DeltaParser"

/**
 * Wraps a function to allow it to be called, at most, once per interval
 * (specified in milliseconds). If the wrapper function is called N times
 * within that interval, only the Nth call will go through. The function
 * will only be called after the full interval has elapsed since the last
 * call.
 */
export function debounce(delay: number, fn: any): any {
  let timerId: any

  return function(...args: any[]) {
    if (timerId) {
      clearTimeout(timerId)
    }

    timerId = setTimeout(() => {
      fn(...args)
      timerId = null
    }, delay)
  }
}

/**
 * Returns true if the URL parameters indicated that we're embedded in an
 * iframe.
 */
export function isEmbeddedInIFrame(): boolean {
  return url.parse(window.location.href, true).query.embed === "true"
}

/**
 * A helper function to make an ImmutableJS
 * info element from the given text.
 */
export function makeElementWithInfoText(
  text: string
): ImmutableMap<string, any> {
  return fromJS({
    type: "alert",
    alert: {
      body: text,
      format: AlertProto.Format.INFO,
    },
  })
}

/**
 * A helper function to hash a string using xxHash32 algorithm.
 * Seed used: 0xDEADBEEF
 */
export function hashString(s: string): string {
  return xxhash.h32(s, 0xdeadbeef).toString(16)
}

/**
 * Coerces a possibly-null value into a non-null value, throwing an error
 * if the value is null or undefined.
 */
export function requireNonNull<T>(obj: T | null | undefined): T {
  if (obj == null) {
    throw new Error("value is null")
  }
  return obj
}

/**
 * Provide an ImmutableSet of SimpleElements by walking a BlockElement to
 * its leaves.
 */
export function flattenElements(
  elements: BlockElement
): ImmutableSet<SimpleElement> {
  return elements.reduce(
    (acc: ImmutableSet<SimpleElement>, reportElement: ReportElement) => {
      const element = reportElement.get("element")

      if (element instanceof List) {
        return flattenElements(element as BlockElement)
      }
      return acc.union(ImmutableSet.of(element as SimpleElement))
    },
    ImmutableSet.of<SimpleElement>()
  )
}

/**
 * A promise that would be resolved after certain time
 * @param ms number
 */
export function timeout(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Tests if the app is running from a Mac
 */
export function isFromMac(): boolean {
  return /Mac/i.test(navigator.platform)
}

/**
 * Returns cookie value
 */
export function getCookie(name: string): string | undefined {
  const r = document.cookie.match("\\b" + name + "=([^;]*)\\b")
  return r ? r[1] : undefined
}
