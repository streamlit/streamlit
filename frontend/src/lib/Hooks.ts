import { MutableRefObject, useRef, useEffect, useState } from "react"

export const usePrevious = (value: any): any => {
  const ref = useRef()

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current
}

export const useIsOverflowing = (
  ref: MutableRefObject<HTMLElement | null>
): boolean => {
  const { current } = ref
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    if (current) {
      const { scrollHeight, clientHeight } = current

      setIsOverflowing(scrollHeight > clientHeight)
    }
  })

  return isOverflowing
}
