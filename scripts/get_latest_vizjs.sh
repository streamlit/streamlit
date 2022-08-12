# Download the latest version of viz.js from npm.
# We don't manage viz via node_modules, so we should run this script
# from time to time to update it.
wget "https://unpkg.com/viz.js/viz.js" -O "viz.min.js"
