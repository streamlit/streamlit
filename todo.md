#### Current daemon

- Server runs while the simulation is happening.
  - generalize to Switchboard
    - complete the current end-to-end with regular queues
    - get the realtime demo working
    - get the save-to-server demo working
    - remove DeltaList
    - implement CrossQueues
  - Adapt Queue so that it fits into Switchboard
- Server saves the run after the simulation is done.
- Ability to see the run after it's done.
- Page to see parallel runs from the past.
- Nice to haves:
  - Move the server to Google cloud?
  - Rename it streamlet.io.
  - Run it in a docker container
- OPTIONAL: `clear-recent` server endpoin

#### Matt's Suggestions

- interested in mirroring the data
- downsampling the data
- ability to do a "10 minute dashboard"
- ability to zoom in on a graph (and make it big)
- shared cursor across multiple graphs
- panel view
- MVP
  - local development
  - do the save=True and write end-to-end
  -

#### Drago's Suggestion

- the ability to overlay the charts
- the ability to make one the baseline and compute all as deltas
- how can I convince them to switch away from tensorboard
  - they handle checkpoints
  - store the history and know that it
  - continue an existing experiment from the checkpoints

#### Implementing The Server

- **Path to the server:** Running the client locally with `save=True` writes to the server
  - make up a class to encapsulate the server
  - work on a long-running one first
  - start actually saving some data on the server
  - server has admin page
  - server allows me to see its contents
- **Path back from the server:** Can look up previous results statically on the server.
- **Bidirectional path:** Running with `save=True`
- Get the server up and running on Amazon.

#### Todo After the Demo

- Switch to message format
  - switch the existing client code to this format_list
  - get rid of on_message, instead wrap the iterator in a binary iterator
  - change the server api to receive a message token
- Make sure that symbolic links are preserved when we a clean checkout of the repo.
- Fix out of order arrivals on the javascript side
- Put add_rows into the periodic table test
- Fix the problem with calling __call__ on multiple values
- Clean things up.
  - Figure out how to make an installer with pip
- Get rid of DeltaList and just send Deltas
- Switch to `enqueue` and `dequeue` for the NotebookQueue
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
- Get rid of 14 MB limit

### Things That We Need from Ben

- a favicon

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

#### Disaggregated File Layout

- `local/` *The locally running open source client and server.*
  - `client/` *The local React client.*
    - `.gitignore`
    - `package.json`
  - `server/` *The tiny server which streams local data.*
    - `.gitignore`
  - `protobuf/` *Used to communicate between client and server.*
- `cloud/`
  - `client/`
  - `server/`
