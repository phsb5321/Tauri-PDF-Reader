/**
 * Cover Repository Port
 *
 * The persistence boundary for derived first-page cover rasters. Covers are
 * cached PNGs keyed by the document id (a SHA-256 content hash) + the cover
 * format version, pinned server-side — this port never sees paths or version
 * numbers beyond what the backend owns.
 */

export interface CoverRepositoryPort {
  /**
   * Read the cached cover for a document, or null on a miss (the caller then
   * renders page 1 and stores it). A corrupt cache entry is quarantined by
   * the backend and also reads as a miss.
   */
  get(documentId: string): Promise<Blob | null>;

  /**
   * Persist a freshly rendered cover PNG for a document. The backend
   * validates the bytes (PNG signature + chunk bounds), the id (must be a
   * real library document), and writes atomically.
   */
  store(documentId: string, png: Blob): Promise<void>;

  /**
   * Preflight the source PDF's size WITHOUT reading it — the oversized-file
   * skip must not cost a whole-file read (backend stat, library-gated).
   */
  sourceSize(filePath: string): Promise<number>;
}
