# Introduction #

Pageforest apps can save their state to the server. Each app state is a "document".

# Resources #

  * A "document" may consist of multiple resources, for example...
    * A image gallery with several images in it (binary data should be allowed).
    * A chat room with hundreds of chat messages.

# History #

  * For some documents, would it be desirable to have version history?

# Ownership #

  * Each document should have an owner.
  * Usually the person who created it.

# Access control #

  * Read and write permissions.

# Quota #

  * Users may store a number of documents (or megabytes) for free.
  * Usage that exceeds the quota is possible, e.g. for a monthly fee.

# Metadata #

  * Each document should have the following metadata:
    * Title
    * Labels / tags
    * Created and last modified timestamp

# Document Manager #

  * A users should be able to list documents...
    * Owned by me
    * Opened by me
    * Shared with me
    * Starred?
  * Documents can be filtered / sorted by...
    * Pageforest App
    * Last access time
    * Last modified time
    * Creation time