import datetime
import hashlib

from google.appengine.ext import db
from google.appengine.api import memcache

from django.conf import settings
from django.test import Client
from django.utils import simplejson as json

from apps.tests import AppTestCase

from apps.models import App
from docs.models import Doc
from blobs.models import Blob, MAX_INTERNAL_SIZE
from chunks.models import Chunk


class BlobTest(AppTestCase):

    def setUp(self):
        super(BlobTest, self).setUp()
        self.blob = Blob(key_name='myapp/mydoc/key/', value='{"json": true}')
        self.blob.put()

    def test_init(self):
        """The constructor should update all attributes."""
        self.assertEqual(self.blob.schema, Blob.current_schema)
        self.assertEqual(self.blob.directory, 'myapp/mydoc/')
        self.assertEqual(self.blob.value, '{"json": true}')
        self.assertEqual(self.blob._value, '{"json": true}')
        self.assertEqual(self.blob.size, 14)
        self.assertEqual(self.blob.sha1,
                         '3aa522f52117d62d31bd2dce6607923aacf1902f')
        self.assertTrue(self.blob.valid_json)
        self.assertEqual(len(self.blob.to_protobuf()), 327)

    def test_clone(self):
        """A cloned Blob should be identical, except key name and directory."""
        clone = self.blob.clone('otherapp/mydoc/key/')
        self.assertEqual(clone.directory, 'otherapp/mydoc/')
        self.assertEqual(clone.value, '{"json": true}')
        self.assertEqual(clone._value, '{"json": true}')
        self.assertEqual(clone.size, 14)
        self.assertEqual(clone.sha1,
                         '3aa522f52117d62d31bd2dce6607923aacf1902f')
        self.assertTrue(clone.valid_json)
        self.assertEqual(len(self.blob.to_protobuf()), 327)

    def test_setattr(self):
        """Setting blob.value should update all attributes."""
        self.blob.value = 'abc'
        self.assertEqual(self.blob.value, 'abc')
        self.assertEqual(self.blob._value, 'abc')
        self.assertEqual(self.blob.size, 3)
        self.assertEqual(self.blob.sha1,
                         'a9993e364706816aba3e25717850c26c9cd0d89d')
        self.assertFalse(self.blob.valid_json)
        self.assertEqual(self.blob.directory, 'myapp/mydoc/')
        self.assertEqual(len(self.blob.to_protobuf()), 316)

    def test_setattr_chunk(self):
        """Setting blob.value should create a new Chunk."""
        self.blob.value = 'abc' * 1000
        self.assertEqual(self.blob.value, 'abc' * 1000)
        self.assertEqual(self.blob._value, None)
        self.assertEqual(self.blob.size, 3000)
        self.assertEqual(self.blob.sha1,
                         '053b4dd5a9642608cc0b599e96f491154b37b2c6')
        self.assertFalse(self.blob.valid_json)
        self.assertEqual(self.blob.directory, 'myapp/mydoc/')
        self.assertEqual(len(self.blob.to_protobuf()), 310)
        self.assertTrue(Chunk.exists(self.blob.sha1))
        self.assertEqual(Chunk.get_by_key_name(self.blob.sha1).value,
                         'abc' * 1000)

    def test_get_by_key_name(self):
        """The get_by_key_name method should return the blob."""
        blob = Blob.get_by_key_name('myapp/mydoc/key/')
        self.assertEqual(blob.key().name(), 'myapp/mydoc/key/')
        self.assertEqual(blob.value, '{"json": true}')

    def test_get_absolute_url(self):
        """The get_absolute_url method should return the correct path."""
        self.assertEqual(self.blob.get_absolute_url(),
                         'http://myapp.pageforest.com/docs/mydoc/key/')


class ClientErrorTest(AppTestCase):

    def test_get_404(self):
        """Non-existent blob access should return 404 Not Found."""
        response = self.app_client.get('/docs/mydoc/does_not_exist/')
        self.assertContains(response,
            "Blob not found: myapp/mydoc/does_not_exist/", status_code=404)

    def test_not_allowed_root(self):
        """The root of an app should only allow read access."""
        self.sign_in(self.peter)
        # Only allow GET, HEAD on app_id.pageforest.com.
        response = self.app_client.put('/', 'html', content_type='text/html')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response['Allow'], 'GET, HEAD')
        # Only allow GET, HEAD, LIST on dev.app_id.pageforest.com.
        response = self.admin_client.put('/', 'html', content_type='text/html')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response['Allow'], 'GET, HEAD, LIST')

    def test_not_allowed(self):
        """Unknown HTTP method should return 405 Method Not Allowed."""
        self.sign_in(self.peter)
        response = self.app_client.options('/docs/mydoc/key')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response['Allow'],
                         'DELETE, GET, HEAD, LIST, PUSH, PUT, SLICE')

    def test_query_string_not_allowed(self):
        """Unknown query string method should return 405 Method Not Allowed."""
        self.sign_in(self.peter)
        response = self.app_client.get('/docs/mydoc/key?method=FOOBAR')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response['Allow'],
                         'DELETE, GET, HEAD, LIST, PUSH, PUT, SLICE')


class RestApiTest(AppTestCase):

    def test_crud(self):
        """Tests create, read, update, delete with REST API."""
        key_name = 'myapp/mydoc/key/'
        self.assertEqual(Blob.get_by_key_name(key_name), None)
        self.sign_in(self.peter)
        url = '/docs/mydoc/key'
        # Create.
        response = self.app_client.put(
            url, 'data', content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(Blob.get_by_key_name(key_name).value, 'data')
        # Read.
        response = self.app_client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'data')
        # Update.
        response = self.app_client.put(
            url, 'updated', content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(Blob.get_by_key_name(key_name).value, 'updated')
        # Delete.
        response = self.app_client.delete(url)
        self.assertContains(response, '"statusText": "Deleted"')
        self.assertEqual(Blob.get_by_key_name(key_name), None)

    def test_anonymous(self):
        """Anonymous user can create blobs in a public writable document."""
        self.doc.writers = ['public']
        self.doc.put()
        self.assertContains(
            self.app_client.put('/docs/mydoc/newblob', 'data',
                                content_type='text/plain'), '"Saved"')


class JsonpApiTest(AppTestCase):

    def test_crud(self):
        """Tests create, read, update, delete with JSONP API."""
        key_name = 'myapp/mydoc/key/'
        self.assertEqual(Blob.get_by_key_name(key_name), None)
        self.sign_in(self.peter)
        url = '/docs/mydoc/key'
        # Create.
        response = self.app_client.get(url + '?method=PUT&value=data')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(Blob.get_by_key_name(key_name).value, 'data')
        # Read.
        response = self.app_client.get(url + '?method=GET&callback=func')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'func("data")')
        self.assertEqual(response['Content-Type'], 'application/javascript')
        # Update.
        response = self.app_client.get(url + '?method=PUT&value=updated')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(Blob.get_by_key_name(key_name).value, 'updated')
        # Delete.
        response = self.app_client.get(url + '?method=DELETE')
        self.assertContains(response, '"statusText": "Deleted"')
        self.assertEqual(Blob.get_by_key_name(key_name), None)


class HostTest(AppTestCase):

    def setUp(self):
        super(HostTest, self).setUp()
        self.other = App(key_name='other',
                         url='https://other.pageforest.com/',
                         owner='peter',
                         secret='OtherSecreT')
        self.other.put()
        self.otherdoc = Doc(key_name='other/mydoc', doc_id='MyDoc',
                            owner='peter')
        self.otherdoc.put()
        self.other_client = Client(
            HTTP_HOST='other.pageforest.com',
            HTTP_REFERER=self.other.url)
        self.other_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.other)

    def test_host(self):
        """Test namespace isolation with Host header."""
        url = '/docs/mydoc/key'
        response = self.other_client.put(
            url, 'otherdata', content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        self.assertEqual(Blob.get_by_key_name('other/mydoc/key/').value,
                         'otherdata')
        # GET with the same host header should work.
        response = self.other_client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'otherdata')
        # GET without host header should fail with 404 Not Found.
        response = self.app_client.get(url)
        self.assertEqual(response.status_code, 404)


class MemcacheTest(AppTestCase):

    def assertProtoBuf(self, binary, data=None):
        """Check binary protocol buffer."""
        self.assertTrue(binary is not None)
        self.assertEqual(binary.count('pageforest'), 1)
        self.assertEqual(binary.count('Blob'), 2)
        self.assertEqual(binary.count('myapp/mydoc/key/with/slashes/'), 2)
        self.assertEqual(binary.count('created'), 2)
        self.assertEqual(binary.count('created_ip'), 1)
        self.assertEqual(binary.count('modified'), 2)
        self.assertEqual(binary.count('modified_ip'), 1)
        if data:
            self.assertEqual(binary.count(data), 1)

    def test_crud(self):
        """Tests create, read, update, delete with memcache."""
        url = '/docs/mydoc/key/with/slashes'
        key_name = 'myapp/mydoc/key/with/slashes/'
        cache_key = settings.CACHEABLE_PREFIX + '~Blob~' + key_name
        self.assertEqual(memcache.get(cache_key), None)
        self.sign_in(self.peter)
        # Create.
        self.app_client.put(url, 'data', content_type='text/plain')
        self.assertEqual(Blob.get_by_key_name(key_name).value, 'data')
        binary = memcache.get(cache_key)
        self.assertProtoBuf(binary, 'data')
        # Make sure it reads from memcache if possible.
        binary = binary.replace('data', 'ofop')
        memcache.set(cache_key, binary, 300)
        response = self.app_client.get(url)
        self.assertEqual(response.content, 'ofop')
        # Make sure that GET saves to memcache if necessary.
        memcache.delete(cache_key)
        self.assertEqual(memcache.get(cache_key), None)
        response = self.app_client.get(url)
        self.assertProtoBuf(memcache.get(cache_key))
        # Update.
        self.app_client.put(url, 'updated', content_type='text/plain')
        self.assertProtoBuf(memcache.get(cache_key), 'updated')
        # Delete.
        self.app_client.delete(url)
        self.assertEqual(memcache.get(cache_key), None)


class MimeTest(AppTestCase):

    def put_and_get(self, path):
        """Helper function for MIME tests."""
        self.sign_in(self.peter)
        self.admin_client.put(path, 'data', content_type='text/plain')
        return self.admin_client.get(path)

    def test_html(self):
        """Test that the mime type is guessed correctly for HTML."""
        response = self.put_and_get('/index.html')
        self.assertContains(response, 'data')
        self.assertEqual(response['Content-Type'], 'text/html')
        # Try again with the top-level alias for index.html.
        response = self.admin_client.get('/')
        self.assertContains(response, 'data')
        self.assertEqual(response['Content-Type'], 'text/html')

    def test_css(self):
        """Test that the mime type is guessed correctly for CSS."""
        response = self.put_and_get('/styles/css/style.css')
        self.assertEqual(response['Content-Type'], 'text/css')

    def test_js(self):
        """Test that the mime type is guessed correctly for JS."""
        response = self.put_and_get('/scripts/test.js')
        self.assertEqual(response['Content-Type'], 'application/javascript')

    def test_json(self):
        """Test that the mime type is guessed correctly for JSON."""
        response = self.put_and_get('/extra/test.json')
        self.assertEqual(response['Content-Type'], 'application/json')

    def test_jpg(self):
        """Test that the mime type is guessed correctly for JPG."""
        response = self.put_and_get('/images/test.jpg')
        self.assertEqual(response['Content-Type'], 'image/jpeg')

    def test_png(self):
        """Test that the mime type is guessed correctly for PNG."""
        response = self.put_and_get('/images/test.png')
        self.assertEqual(response['Content-Type'], 'image/png')

    def test_ico(self):
        """Test that the mime type is guessed correctly for ICO."""
        response = self.put_and_get('/favicon.ico')
        self.assertEqual(response['Content-Type'], 'image/vnd.microsoft.icon')


class TaggableTest(AppTestCase):

    def test_tags(self):
        """Query string options should set and filter tags on blobs."""
        self.sign_in(self.peter)
        self.assertContains(
            self.app_client.put('/docs/mydoc/tagblob?tags=0,1%2C2,3-4'),
            '"statusText": "Saved"')
        self.assertEquals(
            Blob.get_by_key_name('myapp/mydoc/tagblob/').tags,
            ['0', '1', '2', '3-4'])
        response = self.app_client.get('/docs/mydoc/?method=LIST&tag=3-4')
        self.assertContains(response, """\
{
  "tagblob": {
    "json": false,
    "modified": {
      "__class__": "Date",
      "isoformat": "2010-11-12T13:14:15Z"
    },
    "sha1": "84e52dc7aeb405f3b4faa3937cfe430bcd36488d",
    "size": 20,
    "tags": [
      "0",
      "1",
      "2",
      "3-4"
    ]
  }
}""")

    def test_max(self):
        """The maximum number of tags should be enforced in the back-end."""
        self.sign_in(self.peter)
        self.assertContains(self.app_client.put(
                '/docs/mydoc/tagblob?tags=0,1,2,3,4,5,6,7,8,9,10'),
                            '"statusText": "Saved"')
        self.assertEquals(
            Blob.get_by_key_name('myapp/mydoc/tagblob/').tags,
            list('0123456789'))


class JsonArrayTest(AppTestCase):

    def setUp(self):
        """Prepare a simple chat array."""
        super(JsonArrayTest, self).setUp()
        self.chat = Blob(key_name='myapp/mydoc/chat/',
                             value='["hello", "hi", "howdy"]')
        self.chat.put()

    def assertContent(self, url, content):
        """Get array content and compare with expected value."""
        response = self.app_client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, content)

    def test_last(self):
        """Test that the end of the array can be retrieved."""
        url = '/docs/mydoc/chat'
        self.assertContent(url + '?method=SLICE', '["hello", "hi", "howdy"]')
        self.assertContent(url + '?method=SLICE&start=-1', '["howdy"]')
        self.assertContent(url + '?method=SLICE&start=-2', '["hi", "howdy"]')
        self.assertContent(url + '?method=SLICE&start=-3',
                           '["hello", "hi", "howdy"]')
        self.assertContent(url + '?method=SLICE&start=-4',
                           '["hello", "hi", "howdy"]')
        self.assertContent(url + '?method=SLICE&start=-999999999999999999',
                           '["hello", "hi", "howdy"]')

    def test_push(self):
        """Test that push appends to the end af the array."""
        started = datetime.datetime.now()
        self.sign_in(self.peter)
        response = self.app_client.post(
            '/docs/mydoc/chat?method=PUSH',
            data='bye', content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 4')
        self.assertContent('/docs/mydoc/chat?method=SLICE&start=-2',
                           '["howdy", "bye"]')
        chat = Blob.get_by_key_name('myapp/mydoc/chat/')
        self.assertTrue(chat.created <= started)
        self.assertTrue(chat.modified >= started)

    def test_push_empty(self):
        """Test that push creates the array if it didn't exist."""
        started = datetime.datetime.now()
        self.sign_in(self.peter)
        response = self.app_client.post(
            '/docs/mydoc/chat2?method=PUSH',
            data='hi', content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 1')
        self.assertContent('/docs/mydoc/chat2', '["hi"]')
        newchat = Blob.get_by_key_name('myapp/mydoc/chat2/')
        self.assertTrue(newchat.created >= started)
        self.assertTrue(newchat.modified >= started)

    def test_push_max(self):
        """Test that push appends to the end af the array."""
        self.sign_in(self.peter)
        response = self.app_client.post(
            '/docs/mydoc/chat?method=PUSH&max=3', data='bye',
            content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 3')
        self.assertContent('/docs/mydoc/chat', '["hi", "howdy", "bye"]')

    def test_push_chunk(self):
        """Test that push creates a new chunk if over 600 bytes."""
        big_string = 'x' * MAX_INTERNAL_SIZE
        self.sign_in(self.peter)
        response = self.app_client.post(
            '/docs/mydoc/chat?method=PUSH',
            data=big_string, content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 4')
        self.assertContent('/docs/mydoc/chat?method=SLICE&start=-2',
                           '["howdy", "%s"]' % big_string)
        chat = Blob.get_by_key_name('myapp/mydoc/chat/')
        self.assertEqual(db.Model.__getattribute__(chat, 'value'), None)
        self.assertEqual(chat.sha1, 'b8ffe72b2ebd15f3329e7f31ea89a1b2c7153838')
        chunk = Chunk.get_by_key_name(chat.sha1)
        self.assertEqual(chunk.value,
                         '["hello", "hi", "howdy", "%s"]' % big_string)
        # Push again to check that a new chunk is created.
        response = self.app_client.post(
            '/docs/mydoc/chat?method=PUSH',
            data="hey", content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 5')
        self.assertContent('/docs/mydoc/chat?method=SLICE&start=-2',
                           '["%s", "hey"]' % big_string)
        # Push again to check that we can go back to internal storage.
        response = self.app_client.post(
            '/docs/mydoc/chat?method=PUSH&max=2',
            data="ho", content_type="text/plain")
        self.assertContains(response, '"statusText": "Pushed"')
        self.assertContains(response, '"newLength": 2')
        chat = Blob.get_by_key_name('myapp/mydoc/chat/')
        self.assertEqual(chat.sha1, '55b06adde3decd5c6e3559c5d9602d9fc839d6aa')
        self.assertEqual(db.Model.__getattribute__(chat, 'value'),
                         '["hey", "ho"]')
        self.assertFalse(Chunk.get_by_key_name(chat.sha1))


class ListTest(AppTestCase):

    def setUp(self):
        super(ListTest, self).setUp()
        Doc(key_name='myapp/1234', doc_id='1234', owner='peter').put()
        Blob(key_name='myapp/1234/', value='zero').put()
        Blob(key_name='myapp/1234/one/', value='one').put()
        Blob(key_name='myapp/1234/one/two/', value='two').put()
        Blob(key_name='myapp/1234/one/two/three/', value='three').put()
        Blob(key_name='myapp/1234/one/two/three/four/', value='four').put()
        self.sign_in(self.peter)

    def test_depth_1(self):
        """List method with depth=1 should return only direct children."""
        for url in [
            '/docs/1234?method=list',
            '/docs/1234/?method=LIST',
            '/docs/1234?method=list&depth=1',
            ]:
            self.assertContains(self.app_client.get(url), """\
{
  "one": {
    "json": false,
    "modified": {
      "__class__": "Date",
      "isoformat": "2010-11-12T13:14:15Z"
    },
    "sha1": "fe05bcdcdc4928012781a5f1a2a77cbb5398e106",
    "size": 3
  }
}""")

    def test_keys_only_1(self):
        """List method with depth=1 should return only direct children."""
        for url in [
            '/docs/1234?method=list&keysonly=true',
            '/docs/1234/?method=LIST&keysonly=true',
            '/docs/1234?keysonly=true&method=list&depth=1',
            ]:
            self.assertContains(self.app_client.get(url), """\
{
  "one": {}
}""")

    def test_depth_2(self):
        """List method with depth=2 should return only two levels."""
        for url in [
            '/docs/1234?method=list&depth=2',
            '/docs/1234/?depth=2&method=LIST',
            '/docs/1234?method=list&depth=2&callback=foo',
            ]:
            response = self.app_client.get(url)
            self.assertContains(response, '"one": {')
            self.assertContains(response, '"one/two": {')
            self.assertNotContains(response, 'three')
            self.assertNotContains(response, 'four')

    def test_depth_unlimited(self):
        """List method with depth=0 should return all sub-children."""
        four_keys = [
            'myapp/1234/one/',
            'myapp/1234/one/two/',
            'myapp/1234/one/two/three/',
            'myapp/1234/one/two/three/four/']
        # Delete keys from memcache.
        for key_name in four_keys:
            memcache.delete(Blob.class_get_cache_key(key_name))
            self.assertFalse(Blob.cache_get_by_key_name(key_name))
        for url in [
            '/docs/1234?method=list&depth=0',
            '/docs/1234?method=list&depth=4',
            '/docs/1234?method=list&depth=5',
            ]:
            response = self.app_client.get(url)
            decoded = json.loads(response.content)
            self.assertEqual(
                set(decoded.keys()),
                set(('one', 'one/two', 'one/two/three', 'one/two/three/four')))
        # Check that LIST has populated memcache again.
        for key_name in four_keys:
            self.assertTrue(Blob.cache_get_by_key_name(key_name))

    def test_keys_only_unlimited(self):
        """List method with depth=unlimited should return all sub-children."""
        for url in [
            '/docs/1234?method=list&keysonly=true&depth=0',
            '/docs/1234?method=list&depth=4&keysonly=true',
            '/docs/1234?method=list&keysonly=true&depth=5',
            ]:
            response = self.app_client.get(url)
            self.assertContains(response, """\
{
  "one": {},
  "one/two": {},
  "one/two/three": {},
  "one/two/three/four": {}
}""")

    def test_relative(self):
        """List method with relative depth should show three but not four."""
        for url in [
            '/docs/1234?method=list&depth=3',
            '/docs/1234/?method=list&depth=3',
            '/docs/1234/one?method=list&depth=2',
            '/docs/1234/one/?method=list&depth=2',
            '/docs/1234/one/two?method=list&depth=1',
            '/docs/1234/one/two?method=list',
            ]:
            response = self.app_client.get(url)
            self.assertContains(response, 'three": {')
            self.assertNotContains(response, 'four')

    def test_app_doc_list(self):
        """The app_doc_list function should show Peter's documents."""
        for url in [
            '/docs?method=list',
            '/docs/?method=LIST',
            ]:
            self.assertContains(self.app_client.get(url), """\
{
  "1234": {
    "json": true,
    "modified": {
      "__class__": "Date",
      "isoformat": "2010-11-12T13:14:15Z"
    },
    "sha1": "aa8c41330509455ee5679d04ed41535d280d9a89",
    "size": 4
  },
  "MyDoc": {
    "json": true,
    "modified": {
      "__class__": "Date",
""")


class PrefixTest(AppTestCase):

    def setUp(self):
        super(PrefixTest, self).setUp()
        Blob(key_name='myapp/mydoc/', value='').put()
        Blob(key_name='myapp/mydoc/p/', value='').put()
        Blob(key_name='myapp/mydoc/pq/', value='').put()
        Blob(key_name='myapp/mydoc/pre/', value='').put()
        Blob(key_name='myapp/mydoc/pro/', value='').put()
        Blob(key_name='myapp/mydoc/prefix/', value='').put()
        Blob(key_name='myapp/mydoc/ps/', value='').put()
        self.sign_in(self.peter)

    def test_prefix(self):
        """The prefix filter should return only matching blobs."""
        url = '/docs/mydoc/?method=LIST&keysonly=true&prefix=pr'
        response = self.app_client.get(url)
        decoded = json.loads(response.content)
        self.assertEqual(set(decoded.keys()),
                         set(['pre', 'prefix', 'pro']))


class MigrationTest(AppTestCase):

    def test_schema_1_to_3(self):
        """The update_schema method should migrate from schema 1 to 3."""
        value = 'x' * 2048
        sha1 = hashlib.sha1(value).hexdigest()
        # Simulate a Blob with schema 1.
        big = Blob(key_name='big', schema=1)
        # Set the value directly on the big entity, without creating a Chunk.
        db.Model.__setattr__(big, 'value', value)
        # Old blobs with schema 1 don't have the size property.
        big.size = None
        self.assertEqual(big.schema, 1)
        self.assertEqual(big.size, None)
        self.assertEqual(big.value, value)
        self.assertEqual(db.Model.__getattribute__(big, 'value'), value)
        # Check that update_schema creates a Chunk.
        self.assertFalse(Chunk.exists(sha1))
        big.update_schema()
        self.assertTrue(Chunk.exists(sha1))
        chunk = Chunk.cache_get_by_key_name(sha1)
        self.assertEqual(chunk.value, value)
        # Check that the big entity was upgraded.
        self.assertEqual(big.schema, 3)
        self.assertEqual(big.size, 2048)
        self.assertEqual(big.sha1, sha1)
        self.assertEqual(big.value, value)
        self.assertEqual(db.Model.__getattribute__(big, 'value'), None)
