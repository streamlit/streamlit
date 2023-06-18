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

import { useCallback, useLayoutEffect, useRef } from "react"

function squareStepper(current: number, to: number): number {
  const sign = Math.sign(to - current)
  const step = Math.sqrt(Math.abs(to - current))
  const next = current + step * sign

  if (sign > 0) {
    return Math.min(to, next)
  }

  return Math.max(to, next)
}

function step(
  from: number,
  to: number,
  stepper: (x: number, y: number) => number,
  index: number
): number {
  let next = from

  for (let i = 0; i < index; i++) {
    next = stepper(next, to)
  }

  return next
}

export default function useScrollAnimation(
  target: HTMLElement | null,
  onEnd: () => void,
  isAnimating: boolean
): void {
  const animator = useRef(0)

  const animate = useCallback(
    (from, index, start = Date.now()) => {
      cancelAnimationFrame(animator.current)

      animator.current = requestAnimationFrame(() => {
        if (target) {
          const toNumber = target.scrollHeight - target.offsetHeight
          let nextValue = step(
            from,
            toNumber,
            squareStepper,
            (Date.now() - start) / 5
          )

          if (Math.abs(toNumber - nextValue) < 1.5) {
            nextValue = toNumber
          }

          target.scrollTop = nextValue

          if (toNumber === nextValue) {
            onEnd()
          } else {
            animate(from, index + 1, start)
          }
        }
      })
    },
    [animator, onEnd, target]
  )

  const handleCancelAnimation = useCallback(() => {
    cancelAnimationFrame(animator.current)
    onEnd()
  }, [onEnd])

  useLayoutEffect(() => {
    if (!target || !isAnimating) {
      return
    }
    animate(target.scrollTop, 1)

    if (target) {
      target.addEventListener("pointerdown", handleCancelAnimation, {
        passive: true,
      })
      target.addEventListener("wheel", handleCancelAnimation, {
        passive: true,
      })

      return () => {
        target.removeEventListener("pointerdown", handleCancelAnimation)
        target.removeEventListener("wheel", handleCancelAnimation)
        cancelAnimationFrame(animator.current)
      }
    }

    return () => cancelAnimationFrame(animator.current)
  }, [animate, animator, handleCancelAnimation, target, isAnimating])
}
