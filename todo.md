#### Todo

- Create something fast in react
  - Do it without the http load code
    - **Overall Architecture:**
      - Server maintains the state.
      - On new websocket connection
      - When new websockets created
    - **How it works:**
      - Keep the client server open and start working on the python server.
          - Use the [webbrowser](https://docs.python.org/3/library/webbrowser.html) package to refresh the page
      - Make an object which can accumulate deltas.
      - Create a text object and its ability to deltas.
      - Have it create a text object and send out deltas on that.
      - Start to display the deltas  on the client.
  - Put in the http load

  - Tiny websockets server
    - Make the python webserver send a lot of information quickly
    - repeat speed Test, gating the loads on the websockets
    - keep repeating speed Test
- make the awesomest library ever

#### How to reload the webpage within the server

#### More things to play with and try

- Reimplement core logic in Redux
- start playing around with protobufs
- Get rid of AutoSizer from Chart.js and use the recharts version.
- Follow the docker tutorial
- Install node within docker
- Figure out how to make an installer with pip
