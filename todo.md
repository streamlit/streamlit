#### Implementing The Server

- **Path to the server:** Running the client locally with `save=True` writes to the server.
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
