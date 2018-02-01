#### New Layout for the code

- test to see if we can subtree in specific folders from another repository
  - is it possible to check this thing out again and it all works?
  - now, create a disaggregated branch in the real code
    - see if I can get the client working with disaggregated structure
      - move everything into the new structure
        - local/client/src/dataFrameProto.js
        - local/client/src/immutableProto.js
        - local/client/src/PersistentWebsocket.js
        - local/client/src/elements/DataFrame.js
        - local/client/src/elements/Chart.js
        - local/client/src/elements/ImageList.css
        - local/client/src/elements/DataFrame.css
        - local/client/src/elements/ImageList.js
      - figure out what I'm going to do with these
        - local/client/src/protobuf
        - local/client/src/protobuf/printf.js
        - local/client/src/protobuf/.gitkeep
      - move over shared objects one by one
      - keep testing with periodic-table
      - do we need `make init` ... I think not
      - then move the final thing
    - move everything to the new structure
- after the streamlet-shared is split out
  - add a repository to the shared/client/package.json
- go back to master and make a new branch disaggregated

##### Transposing the Layout:

local/
  client/
  server/
shared/
  client/
  server/
  protobuf/
cloud/
  client/
  server/

#### Implementing The Server

- **Path to the server:** Running the client locally with `save=True` writes to the server.
  - make a unified
  - save=True option in Notebook
  - opens a connection on the server.. sends a UID for the session
  - begins writing to the server
  - server simply prints out the size of everything that is being sent
    - *Verify:* What happens if we send bigger and bigger payloads?
    -
  - server has admin page
  - server allows me to see its contents
  - *NOTE:* Move shared python things to a shared package.
- **Path back from the server:** Can look up previous results statically on the server.
- **Bidirectional path:** Running with `save=True`
- Get the server up and running on Amazon.

#### Todo After the Demo

- Fix the image parsing bug.
- Make sure that symbolic links are preserved when we a clean checkout of the repo.
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

- Put in `balloons()` function.
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
