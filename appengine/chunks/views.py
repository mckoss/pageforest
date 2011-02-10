import time
import logging

from django.http import HttpResponse, HttpResponseRedirect
from django.core.urlresolvers import reverse

from google.appengine.ext import db

from utils.shortcuts import render_to_response, lookup_or_404

from chunks.models import Chunk
from blobs.models import Blob, MAX_INTERNAL_SIZE

MAX_VACUUM_CHUNKS = 100


def chunk_get(request, key_name):
    """
    Show a chunk as text/plain for debugging.
    """
    chunk = lookup_or_404(Chunk, key_name)
    return HttpResponse(chunk.value, mimetype='text/plain')


def vacuum(request, start):
    """
    Delete Chunks that are no longer referenced by any Blobs.

    REVIEW: Chunks are vanishing - bug in here or elsewhere???

    REVIEW: Since a Chunk is cacheable, why are we calling
    db.delete(keys) instead of chunk.delete() - shouldn't we also
    free the cache?

    REVIEW: The method of sweeping does not scale as the store gets
    larger - the reason being that the starting point will only hit
    points at random based on the time of day.  There may also be
    more than 1,000 entries between start points.  This should be
    changed to use task queues to pick up the sweep from the point
    left off by the previous sweep.
    """
    if not start:
        # Calculate fraction of the current day.
        year, month, day, hour, minute, sec = time.gmtime()[:6]
        minute += sec / 60.0
        hour += minute / 60.0
        fraction = (hour - 1) / 24
        start = "%06x" % int(fraction * 0xffffff)
    # Load up to 1000 chunk keys.
    chunks = Chunk.all(keys_only=True).order('__key__').filter(
        '__key__ >', db.Key.from_path('Chunk', start)).fetch(1000)
    # Load up to 1000 blobs.
    blobs = Blob.all().order('sha1').filter('sha1 >', start).fetch(1000)
    # Keep shallow copies of chunks and blobs list for later.
    original_chunks = chunks[:]
    original_blobs = blobs[:]
    # Find unreferenced chunks.
    chunks_without_blobs = []
    blobs_without_chunks = []
    while chunks and blobs:
        if chunks[0].name() == blobs[0].sha1:
            # One or more Blobs are referring to this chunk.
            while blobs and blobs[0].sha1 == chunks[0].name():
                blobs.pop(0)
            chunks.pop(0)
        elif chunks[0].name() > blobs[0].sha1:
            # This Blob doesn't reference a Chunk.
            blob = blobs.pop(0)
            if blob.size > MAX_INTERNAL_SIZE:
                logging.error("Blob missing chunk: %s (%s)" % (blob.key().name(), blob.sha1))
                blobs_without_chunks.append(blob)
        elif chunks[0].name() < blobs[0].sha1:
            # This Chunk is not referenced by any Blobs.
            chunks_without_blobs.append(chunks.pop(0))
            if len(chunks_without_blobs) >= MAX_VACUUM_CHUNKS:
                break

    do_action = ('HTTP_X_APPENGINE_CRON' in request.META or
                 'confirmed' in request.POST)

    # Delete unreferenced chunks from the datastore.
    if chunks_without_blobs and do_action:
        # MUST delete memcache keys as well as the store or else
        # subsequent put's will leave dangline Blobs.
        # BAD: db.delete(chunks_without_blobs)
        Chunk.delete_keys(chunks_without_blobs)
        logging.warning('Deleted %d unreferenced chunks from %s to %s' % (
                len(chunks_without_blobs),
                chunks_without_blobs[0].name(),
                chunks_without_blobs[-1].name()))
        if request.method == 'POST':
            return HttpResponseRedirect(reverse(vacuum, args=[start]))

    # ERROR!  Attempt to recover lost Chunk values from memcache.
    recovered_chunks = []
    if blobs_without_chunks:
        chunks = Chunk.get_by_key_name_list([blob.sha1 for blob in blobs_without_chunks])
        logging.info("chunks: %r" % chunks)
        for chunk in chunks:
            if chunk is None:
                continue
            chunk.put(write_through=True)
            logging.warning("Recovered lost chunk: %s" % chunk.key().name())
            recovered_chunks.append(chunk.key().name())

    return render_to_response(request, 'chunks/vacuum.html', {
            'chunks': original_chunks,
            'blobs': original_blobs,
            'blobs_without_chunks': blobs_without_chunks,
            'chunks_without_blobs': chunks_without_blobs,
            'recovered_chunks': recovered_chunks})
