mkdir -p public/vendor/viz
cd public/vendor/viz

# We only want to download viz.js once since we preload on `yarn start`
# Adds the `no-clobber` flag, which throws an error if the file already exists
wget -nc "https://unpkg.com/viz.js@1.8.0/viz.js" -O "viz-1.8.0.min.js" || true
