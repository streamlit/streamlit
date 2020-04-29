import { Streamlit, RenderData } from "./streamlit"

// Import Streamlit's default CSS
import "./index.css"

// We import bootstrap.css to get some simple default styling for our
// text and button. You can remove or replace this.
import "bootstrap/dist/css/bootstrap.min.css"

// Add text and a button to the DOM. (You could also add these directly
// to index.html.)
const textDiv = document.body.appendChild(document.createElement("div"))
const button = document.body.appendChild(document.createElement("button"))
button.textContent = "Click Me!"

// Add a click handler to our button
let numClicks = 0
button.onclick = function(): void {
  // Increment numClicks, and pass the new value back to
  // Streamlit via `Streamlit.setWidgetValue`.
  numClicks += 1
  Streamlit.setWidgetValue(numClicks)
}

// Tell Streamlit we're ready to start receiving data. We won't get our
// first RENDER_EVENT until we call this function.
Streamlit.setComponentReady()

// Tell Streamlit to update our height. We can omit the height parameter here
// to have it default to our scrollHeight.
Streamlit.setFrameHeight()

// Finally, subscribe to the Streamlit RENDER_EVENT. This event will be
// dispatched when Streamlit has new data to send to the component. It
// will always be dispatched at least once, after the component indicates
// that it's ready.
Streamlit.events.addEventListener(Streamlit.RENDER_EVENT, function(
  event: Event
): void {
  // Get the RenderData from the event
  const data = (event as CustomEvent<RenderData>).detail

  // Disable our button if necessary.
  button.disabled = data.disabled

  // RenderData.args is the JSON dictionary of arguments sent from the
  // Python script.
  let name = data.args["name"]
  if (name == null) {
    name = "Undefined"
  }

  textDiv.textContent = `Hello, ${name}!`

  // This isn't strictly necessary for the example because our height stays
  // fixed, but we can also have Streamlit update our frameHeight after each
  // render event in case it should change.
  Streamlit.setFrameHeight()
})
