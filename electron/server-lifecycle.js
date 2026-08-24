/**
 * Keeps one local Next server alive for the lifetime of the Electron process.
 * Windows can close and reopen on macOS, but PGlite cannot safely have two
 * server processes pointed at the same data directory.
 */
function createServerLifecycle(start) {
  let readyUrl = null;
  let starting = null;

  return {
    getUrl() {
      if (readyUrl) return Promise.resolve(readyUrl);
      if (!starting) {
        starting = Promise.resolve()
          .then(start)
          .then((url) => {
            readyUrl = url;
            return url;
          })
          .finally(() => {
            starting = null;
          });
      }
      return starting;
    },
    reset() {
      readyUrl = null;
    },
  };
}

module.exports = { createServerLifecycle };
