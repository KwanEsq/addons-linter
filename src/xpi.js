import yauzl from 'yauzl';

/*
 * Simple Promise wrapper for the Yauzl unzipping lib to unpack add-on .xpis.
 * Note: We're using the autoclose feature of yauzl as a result every operation will
 * open the zip, do something and then close it implicitly.
 * This makes the API easy to use and the consumer doesn't need to remember to
 * close the zipfile.
 *
 */

export default class Xpi {

  constructor(filename, zipLib=yauzl) {
    this.filename = filename;
    this.zipLib = zipLib;
    this.metadata = {};
  }

  handleEntry(entry, zipfile, reject) {
    if (/\/$/.test(entry.fileName)) {
      return;
    }
    // Collect metadata for files.
    zipfile.openReadStream(entry, (err) => {
      if (err) {
        return reject(err);
      }
      this.metadata[entry.fileName] = entry;
    });
  }

  open() {
    return new Promise((resolve, reject) => {
      this.zipLib.open(this.filename, (err, zipfile) => {
        if (err) {
          return reject(err);
        }
        resolve(zipfile);
      });
    });
  }

  getMetaData(_onEventsSubscribed) {
    return new Promise((resolve, reject) => {
      // If we have already processed the file and have data
      // on this instance return that.
      if (Object.keys(this.metadata).length) {
        return resolve(this.metadata);
      }

      return this.open()
        .then((zipfile) => {
          zipfile.on('entry', (entry) => {
            this.handleEntry(entry, zipfile, reject);
          });
          // When the last entry has been processed
          // cache the metadata and resolve the promise.
          zipfile.on('end', () => resolve(this.metadata));
          if (_onEventsSubscribed) {
            // Run optional callback when we know the event handlers
            // have been inited. Useful for testing.
            if (typeof _onEventsSubscribed === 'function') {
              _onEventsSubscribed();
            }
          }
        })
        .catch(err => reject(err));
    });
  }

  getFileAsStream(path) {
    return new Promise((resolve, reject) => {

      if (Object.keys(this.metadata).indexOf(path) === -1) {
        throw new Error('path does not exist in metadata', path);
      }

      return this.open()
        .then((zipfile) => {
          zipfile.openReadStream(this.metadata[path], (err, readStream) => {
            if (err) {
              return reject(err);
            }
            resolve(readStream);
          });
        })
        .catch(err => reject(err));
    });
  }
}