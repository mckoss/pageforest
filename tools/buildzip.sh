#!/bin/sh
DIR=scratch
VERSION=`grep ^LIB_VERSION appengine/settings.py | cut -d\' -f2`
TIMESTAMP=`date +%Y%m%d-%H%M%S`
ZIPFILE=scratch-$VERSION-$TIMESTAMP.zip
echo building: $ZIPFILE
cp -r examples/scratch $DIR || exit
rm -f $DIR/.passwd
cp tools/pf.py $DIR
rm -f $ZIPFILE
zip -r $ZIPFILE $DIR
rm -rf $DIR
grep title examples/scratch/app.json | cut -d\" -f4
