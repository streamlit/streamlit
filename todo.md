#### Vetting Various Web Frameworks

- Framework
  - Express
  - Flask / aiohttp ??
  - These are gross
    - Meteor
    - Django / Heroku - gross
- Questions / Tasks
  - **Can I read / write to the database?**
    - Make each visit write to the visits document.
  - **Can I read / write json to the database?**
  - **Can I create a websocket connection to the client?**
  - **Can I create a websocket connection to the server?**
- Todo
  - Go through each framework answering these questions
  - Then answer: what would the architecture look like with that thing?
  - Requirements:
    - Can see "realtime" updates both locally and through the web
    - Can see a list of previous simulations.
    - Google / Github Login
  - Follow-on Tasks
    - Express
      - Figure out how I can use Babel
- Then create an awesome client!

#### Todo After the Demo

- Fix the image parsing bug.
- Get the name printf.com.
- Fix out of order arrivals on the javascript side
- Put add_rows into the periodic table test
- Fix the problem with calling __call__ on multiple values
- Clean things up.
  - Rename it from tiny-notebook to printf
  - Rename notebook everywhere to printf.
  - Figure out how to make an installer with pip
  - Give it a nice favicon. (maybe the connect icon?)
- Get rid of DeltaList and just send Deltas
- Switch to `enqueue` and `dequeue` for the DeltaQueue
- Clean up some names in the code.
  - Make the `DataFrame` prop into `df`
  - make the `Chart` prop into `chart`
- Fix the problem where you have to sleep for another second.
- "info"     : prints out df.info() on a DataFrame-like object
- Fix the bug in .x_axis(type='number')
- Fix the column width bug:
  - First use `shouldComponentUpdate` to decrease render calls on dataframes.
  - Then use the following to force updates of the underlying grid.
  - https://github.com/bvaughn/react-virtualized/issues/546
  - https://github.com/bvaughn/react-virtualized/blob/master/docs/MultiGrid.md

#### More things to play with and try

- Reimplement core logic in Redux
- Fix resizing bug with the table dimensions.
- Put in properties for CHART_COMPONENTS
- Fix up charts.
  - Make chart component recursive.
  - Fix `radial_bar_chart`
  - Get `pie_chart` to work.. put dataframes in the components.   
- Fix the problem when you resize a table.
- Follow the docker tutorial
- Install node within docker
- make the awesomest library ever
