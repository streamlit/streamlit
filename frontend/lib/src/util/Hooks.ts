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

import {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

export const usePrevious = (value: any): any => {
  const ref = useRef()

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current
}

export const useIsOverflowing = (
  ref: MutableRefObject<HTMLElement | null>,
  expanded?: boolean
): boolean => {
  const { current } = ref
  const [isOverflowing, setIsOverflowing] = useState(false)
  const checkOverflowing = useCallback(() => {
    if (current) {
      const { scrollHeight, clientHeight } = current

      setIsOverflowing(scrollHeight > clientHeight)
    }
  }, [current])

  // We want to double check if the element is overflowing
  // when the expanded state changes or the height of the
  // element changes
  useEffect(() => {
    checkOverflowing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, current?.clientHeight])

  // Window resizing can also affect the overflow state
  // so we need to check it as well
  useEffect(() => {
    window.addEventListener("resize", checkOverflowing)

    return () => {
      window.removeEventListener("resize", checkOverflowing)
    }
  }, [checkOverflowing])

  return isOverflowing
}
