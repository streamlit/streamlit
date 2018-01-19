#### Todo

- Start implementing the rest of the messages.
  - 'dataframe':
    - see what other types I need to a raw numpy array
    - check in.. dataFrames complete!!
  - 'chart'
    - Create dataframe data model (proto)
    - Create the chart proto datamodel
    - Create Chart class
  - "info"     : prints out df.info() on a DataFrame-like object
  - "img"      : prints an image out
  - "auto"     : figures out the
- "progress" : prints out a progress bar (for a 0<num<1)
- Implement images really nicely.
- Rename it from tiny-notebook to printf
- Rename notebook everywhere to printf.
- Make it work with pip.
- Give it a nice favicon.
- Get the name printf.com.
- Make a presentation to show how this will all work.
- Clean things up:
  - Enable DataFrame to parse int arrays.
  - Fix resizing bug with the table dimensions.
- make the awesomest library ever

#### How charts might work.

```
chart = printf.Chart(data, type='LineChart')
chart.cartesianGrid(strokeDasharray="3 3")
chart.xAxis(datakey="name")
printf(chart)
```

#### More things to play with and try

- Reimplement core logic in Redux
- start playing around with protobufs
- Get rid of AutoSizer from Chart.js and use the recharts version.
- Follow the docker tutorial
- Install node within docker
- Figure out how to make an installer with pip

#### Protobuf Messages

- Text
- Chart
- Image
- Dataframe

- Update
  - id
  - element

- AddRows
  - id
  - rows
