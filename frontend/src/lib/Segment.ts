declare global {
  interface Window {
    analytics: any
  }
}

export const segmentLauncher = () => {
  const analytics = (window.analytics = window.analytics || [])
  if (!analytics.initialize)
    if (analytics.invoked)
      window.console &&
        console.error &&
        console.error("Segment snippet included twice.")
    else {
      analytics.invoked = !0
      analytics.methods = [
        "trackSubmit",
        "trackClick",
        "trackLink",
        "trackForm",
        "pageview",
        "identify",
        "reset",
        "group",
        "track",
        "ready",
        "alias",
        "debug",
        "page",
        "once",
        "off",
        "on",
      ]
      analytics.factory = function(t: any) {
        return function() {
          var e = Array.prototype.slice.call(arguments)
          e.unshift(t)
          analytics.push(e)
          return analytics
        }
      }
      for (var t = 0; t < analytics.methods.length; t++) {
        var e = analytics.methods[t]
        analytics[e] = analytics.factory(e)
      }
      analytics.load = function(t: string, e: any) {
        var n = document.createElement("script")
        n.type = "text/javascript"
        n.async = !0
        n.src =
          "https://cdn.segment.com/analytics.js/v1/" + t + "/analytics.min.js"
        var a = document.getElementsByTagName("script")[0]
        if (a.parentNode != null) a.parentNode.insertBefore(n, a)
        analytics._loadOptions = e
      }
      analytics.SNIPPET_VERSION = "4.1.0"
      analytics.load("iCkMy7ymtJ9qYzQRXkQpnAJEq7D4NyMU")
    }
}
