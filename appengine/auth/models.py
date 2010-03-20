from google.appengine.ext import db


class User(db.Expando):
    email = db.EmailProperty()
    joined = db.DateTimeProperty()
