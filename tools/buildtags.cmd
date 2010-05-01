@cd \src\pageforest
dir /S /B *.py | etags -

@cd appengine\static\src\js
dir /S /B *.js | etags -

@cd \Python25\Lib\site-packages\django-1.1.1-py2.5.egg\django
dir /S /B *.py | etags -

@cd \Program Files\Google\google_appengine\google\appengine
dir /S /B *.py | etags -

@cd \src\pageforest
