#!/bin/sh
DIR=scratch
VERSION=`grep ^LIB_VERSION appengine/settings.py | cut -d\' -f2`
ZIPFILE=scratch-$VERSION.zip
echo building: $ZIPFILE
cp -r appengine/apps/scratch $DIR || exit
cp tools/pf.py $DIR
rm -f $ZIPFILE
zip -r $ZIPFILE $DIR
rm -rf $DIR
