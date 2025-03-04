import pino from "pino";
import { IdResolver } from "@atproto/identity";
import { Firehose } from "@atproto/sync";
import type { Database } from "#/db";
import * as Status from "#/lexicon/types/xyz/statusphere/status";
import * as Movie from "#/lexicon/types/xyz/statusphere/movie";

export function createIngester(db: Database, idResolver: IdResolver) {
  const logger = pino({ name: "firehose ingestion" });
  return new Firehose({
    idResolver,
    handleEvent: async (evt) => {
      // Watch for write events
      if (evt.event === "create" || evt.event === "update") {
        const now = new Date();
        const record = evt.record;

        // If the write is a valid status update
        if (
          evt.collection === "xyz.statusphere.status" &&
          Status.isRecord(record) &&
          Status.validateRecord(record).success
        ) {
          // Store the status in our SQLite
          await db
            .insertInto("status")
            .values({
              uri: evt.uri.toString(),
              authorDid: evt.did,
              status: record.status,
              createdAt: record.createdAt,
              indexedAt: now.toISOString(),
            })
            .onConflict((oc) =>
              oc.column("uri").doUpdateSet({
                status: record.status,
                indexedAt: now.toISOString(),
              }),
            )
            .execute();
        } else if (
          evt.collection === "xyz.statusphere.movie" &&
          Movie.isRecord(record) &&
          Movie.validateRecord(record).success
        ) {
          await db
            .insertInto("movie")
            .values({
              uri: evt.uri.toString(),
              authorDid: evt.did,
              name: record.name,
              rate: parseFloat(record.rate),
              watchedBefore: record.watchedBefore ? 1 : 0,
              liked: record.liked ? 1 : 0,
              createdAt: record.createdAt,
              indexedAt: new Date().toISOString(),
            })
            .onConflict((oc) =>
              oc.column("uri").doUpdateSet({
                uri: evt.uri.toString(),
                authorDid: evt.did,
                name: record.name,
                rate: parseFloat(record.rate),
                watchedBefore: record.watchedBefore ? 1 : 0,
                liked: record.liked ? 1 : 0,
                review: record.review,
                createdAt: record.createdAt,
                indexedAt: now.toISOString(),
              }),
            )
            .execute();
        }
      } else if (evt.event === "delete") {
        // Remove the status from our SQLite
        if (evt.collection === "xyz.statusphere.status")
          await db
            .deleteFrom("status")
            .where("uri", "=", evt.uri.toString())
            .execute();
        if (evt.collection === "xyz.statusphere.movie")
          await db
            .deleteFrom("movie")
            .where("uri", "=", evt.uri.toString())
            .execute();
      }
    },
    onError: (err) => {
      logger.error({ err }, "error on firehose ingestion");
    },
    filterCollections: ["xyz.statusphere.status", "xyz.statusphere.movie"],
    excludeIdentity: true,
    excludeAccount: true,
  });
}
