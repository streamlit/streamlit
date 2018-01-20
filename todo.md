#### Todo

- Start implementing the rest of the messages.
  - "info"     : prints out df.info() on a DataFrame-like object
  - "img"      : prints an image out
  - "auto"     : figures out the
  - "progress" : prints out a progress bar (for a 0<num<1)
- Implement images really nicely.
- Test how it goes on a keras example
- See if I need to add the fancier delta for charts.
- Rename it from tiny-notebook to printf
- Rename notebook everywhere to printf.
- Figure out how to make an installer with pip
- Give it a nice favicon.
- Get the name printf.com.
- Make a presentation to show how this will all work.
- make the awesomest library ever

#### After the Demo

- Fix the problem where you have to sleep for another second.

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
- Follow the docker tutorial
- Install node within docker
- Enable DataFrame to parse int arrays.
- Fix resizing bug with the table dimensions.
- Put in properties for CHART_COMPONENTS
- Fix up charts.
  - Make chart component recursive.
  - Fix `radial_bar_chart`
  - Get `pie_chart` to work.. put dataframes in the components.   
- Fix the problem when you resize a table.

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
