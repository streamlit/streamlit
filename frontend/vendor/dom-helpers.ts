/* eslint-disable */

// We only need a single function from https://github.com/react-bootstrap/dom-helpers,
// so we copy it here instead of adding a new dependency.

const canUseDOM = !!(
  typeof window !== "undefined" &&
  window.document &&
  window.document.createElement
)

let size: number

// https://github.com/react-bootstrap/dom-helpers/blob/3f509a03c5e330faa93bcf8acf30976b5a7bacac/src/scrollbarSize.ts#L5
export function scrollbarSize(recalc?: boolean) {
  if ((!size && size !== 0) || recalc) {
    if (canUseDOM) {
      const scrollDiv = document.createElement("div")

      scrollDiv.style.position = "absolute"
      scrollDiv.style.top = "-9999px"
      scrollDiv.style.width = "50px"
      scrollDiv.style.height = "50px"
      scrollDiv.style.overflow = "scroll"

      document.body.appendChild(scrollDiv)
      size = scrollDiv.offsetWidth - scrollDiv.clientWidth
      document.body.removeChild(scrollDiv)
    }
  }

  return size
}
