#### Todo

- Start implementing the rest of the messages.
  - "progress" : prints out a progress bar (for a 0<num<1)
    - make the proto format
    - marshall the proto format
    - unmarshall the proto format
  - "auto"     : figures out the
- Clean up some names in the code.
  - Make the `DataFrame` prop into `df`
  - make the `Chart` prop into `ch art`
- Create some great examples
  - Speed test recapitulates previous demo.
    - See if I need to add the fancier delta for charts.
  - Test how it goes on a keras example
- Clean things up.
  - Rename it from tiny-notebook to printf
  - Rename notebook everywhere to printf.
  - Clean up Lenna.png and the examples.
  - Figure out how to make an installer with pip
  - Give it a nice favicon.
- Make a presentation to show how this will all work.

#### After the Demo

- Get the name printf.com.
- Fix the problem where you have to sleep for another second.
- "info"     : prints out df.info() on a DataFrame-like object

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
