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

/**
 * Computes next step in a square-root based animation sequence. Step size is
 * square root of absolute difference between current and target values. Can be
 * used as a stepper function for other higher-level stepping functions.
 *
 * @param {number} current - Current value in animation sequence.
 * @param {number} to - Target value of animation sequence.
 * @returns {number} Next value in animation sequence.
 */
function squareStepper(current: number, to: number): number {
  const sign = Math.sign(to - current)
  const step = Math.sqrt(Math.abs(to - current))
  const next = current + step * sign

  if (sign > 0) {
    return Math.min(to, next)
  }

  return Math.max(to, next)
}

/**
 * Computes sequence of steps in animation by repeatedly applying a stepper
 * function.
 *
 * @param {number} from - Initial value in animation sequence.
 * @param {number} to - Target value of animation sequence.
 * @param {function} stepper - Function computing next value given current
 *                             and target values.
 * @param {number} index - Number of steps to compute.
 * @returns {number} Value at given index in animation sequence.
 */
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

/**
 * Handles scroll animation for a given target HTMLElement. Uses a square-root
 * based stepping function to compute scroll animation. Stops animation if
 * target's scrollTop has reached scrollHeight or if user interacts with target
 * (mousedown or mousewheel). Can also be cancelled by caller.
 *
 * @export
 * @param {HTMLElement | null} target - HTML element to animate scroll of. If
 *                                      null, no animation is performed.
 * @param {() => void} onEnd - Callback when animation ends or is cancelled.
 * @param {boolean} isAnimating - Boolean to start or stop animation. If false,
 *                                no animation is performed.
 * @returns {void}
 */
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
