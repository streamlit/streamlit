#### Todo

- Play with protobufs.
  - Create a message in Python.
  - Make sure to .gitignore created files.
  - Transfer a simple message. (Check length!)
    - Figure out how to do binary transfers over the channel.
  - Do a cleanup and check in all the protobuf code.
  - Play around with different protobuf formats in Python
  - Make a first cut of the object hierarchy.
  - See if I can send and load those objects.
- Create a delta message
  - See if I can encode it
  - See if I can decode it.
  - just use int IDs instead of full ids
- Make an object which can accumulate deltas.
- Create a text object and its ability to deltas.
- Have it create a text object and send out deltas on that.
- Start to display the deltas  on the client.
- Implement all existing datatypes
- Implement images really nicely.
- make the awesomest library ever

#### More things to play with and try

- Reimplement core logic in Redux
- start playing around with protobufs
- Get rid of AutoSizer from Chart.js and use the recharts version.
- Follow the docker tutorial
- Install node within docker
- Figure out how to make an installer with pip

#### Architecture

- Text
- Chart
- Image
- Dataframe

- Update
  - id
  - element
- AddRow
  - id
  - row
