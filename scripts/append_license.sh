#!/bin/sh

FILE=$1
NAME=$(basename $1 | sed 's/[_-]/ /g' | sed 's/.LICENSE//')

echo '-----' >> NOTICES
echo '' >> NOTICES
echo "The following software may be included in this product: $NAME."\
  "This software contains the following license and notice below:" >> NOTICES
echo '' >> NOTICES
cat $1 >> NOTICES
echo '' >> NOTICES
