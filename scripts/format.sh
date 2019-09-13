# Go up until you're in the root directory
until [ -d .git ]; do cd ..; done

# Run Prettier on the staged files
yarn --cwd "frontend" pretty-quick --staged

# Run Black on the staged files (only if it exists)
# It requires Python 3.6.0+ to run but you can reformat
# Python 2 code with it, too.
if command -v "black" > /dev/null; then
  git diff --name-only --cached | grep -E "\.pyi?$" | xargs black
fi
