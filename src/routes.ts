import assert from "node:assert";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { OAuthResolverError } from "@atproto/oauth-client-node";
import { isValidHandle } from "@atproto/syntax";
import { TID } from "@atproto/common";
import { Agent } from "@atproto/api";
import express from "express";
import { getIronSession } from "iron-session";
import type { AppContext } from "#/index";
import { home } from "#/pages/home";
import { movie } from "#/pages/movie";
import { login } from "#/pages/login";
import { env } from "#/lib/env";
import { page } from "#/lib/view";
import * as Status from "#/lexicon/types/xyz/statusphere/status";
import * as Movie from "#/lexicon/types/xyz/statusphere/movie";
import * as Profile from "#/lexicon/types/app/bsky/actor/profile";
import * as GetFollows from "@atproto/api/src/client/types/app/bsky/graph/getFollows";
import { sql } from "kysely";
import type { Movie as movieType } from "./db";

type Session = { did: string };

type status = {
  status: string;
  uri: string;
  authorDid: string;
  createdAt: string;
  indexedAt: string;
}[];

// Helper function for defining routes
const handler =
  (fn: express.Handler) =>
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };

// Helper function to get the Atproto Agent for the active session
async function getSessionAgent(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  ctx: AppContext,
) {
  // retrieve the `clientSession` (and decrypt the cookie).
  const session = await getIronSession<Session>(req, res, {
    cookieName: "sid",
    password: env.COOKIE_SECRET,
  });
  if (!session.did) return null;
  try {
    // retrieve the Atproto tokens (access token and refresh token) from
    // SessionStore using DID as key
    const oauthSession = await ctx.oauthClient.restore(session.did);
    // create AtProto Agent to interact with PDS
    return oauthSession ? new Agent(oauthSession) : null;
  } catch (err) {
    ctx.logger.warn({ err }, "oauth restore failed");
    await session.destroy();
    return null;
  }
}

export const createRouter = (ctx: AppContext) => {
  const router = express.Router();

  // Static assets
  router.use(
    "/public",
    express.static(path.join(__dirname, "pages", "public")),
  );

  // OAuth metadata
  router.get(
    "/client-metadata.json",
    handler((_req, res) => {
      return res.json(ctx.oauthClient.clientMetadata);
    }),
  );

  // OAuth callback to complete session creation
  router.get(
    "/oauth/callback",
    handler(async (req, res) => {
      const params = new URLSearchParams(req.originalUrl.split("?")[1]);
      try {
        // Exchanging auth code for tokens (PDS-App Interaction)
        // also checks the state value for CSRF verification
        // plain JS object that contains DID and Handle. not the actual tokens.
        const { session } = await ctx.oauthClient.callback(params);
        // Create or retrieve iron-session (secure cookie)
        const clientSession = await getIronSession<Session>(req, res, {
          cookieName: "sid",
          password: env.COOKIE_SECRET,
        });
        assert(!clientSession.did, "session already exists");
        clientSession.did = session.did;
        await clientSession.save();
      } catch (err) {
        ctx.logger.error({ err }, "oauth callback failed");
        return res.redirect("/?error");
      }
      return res.redirect("/movie");
    }),
  );

  // Login page
  router.get(
    "/login",
    handler(async (_req, res) => {
      return res.type("html").send(page(login({})));
    }),
  );

  // Login handler
  router.post(
    "/login",
    handler(async (req, res) => {
      // Validate
      const handle = req.body?.handle;
      if (typeof handle !== "string" || !isValidHandle(handle)) {
        return res.type("html").send(page(login({ error: "invalid handle" })));
      }

      // Initiate the OAuth flow
      try {
        // a random state is generated here
        const url = await ctx.oauthClient.authorize(handle, {
          scope: "atproto transition:generic",
        });

        return res.redirect(url.toString());
      } catch (err) {
        ctx.logger.error({ err }, "oauth authorize failed");
        return res.type("html").send(
          page(
            login({
              error:
                err instanceof OAuthResolverError
                  ? err.message
                  : "couldn't initiate login",
            }),
          ),
        );
      }
    }),
  );

  // Logout handler
  router.post(
    "/logout",
    handler(async (req, res) => {
      const session = await getIronSession<Session>(req, res, {
        cookieName: "sid",
        password: env.COOKIE_SECRET,
      });
      await session.destroy();
      return res.redirect("/");
    }),
  );

  // Homepage
  router.get(
    "/",
    handler(async (req, res) => {
      // If the user is signed in, get an agent which communicates with their server
      const agent = await getSessionAgent(req, res, ctx);

      if (!agent) {
        // Serve the logged-out view
        return res.type("html").send(page(home({})));
      }
      // Fetch data stored in our SQLite
      const statuses: status = await ctx.db
        .selectFrom("status")
        .selectAll()
        .orderBy("indexedAt", "desc")
        .execute();
      console.log(statuses);
      const myStatus = agent
        ? await ctx.db
            .selectFrom("status")
            .selectAll()
            .where("authorDid", "=", agent.assertDid)
            .orderBy("indexedAt", "desc")
            .executeTakeFirst()
        : undefined;

      const statusesCount: {
        status: string;
        count: number;
      }[] = await ctx.db
        .selectFrom("status")
        .select((eb) => ["status", sql<number>`count(*)`.as("count")])
        .groupBy("status")
        .execute();

      // Map user DIDs to their domain-name handles
      // const didHandleMap = await ctx.resolver.resolveDidsToHandles(
      //   statuses.map((s) => s.authorDid),
      // );

      // Map user DIDs to their displayNames
      const didDisplayNameMap = await ctx.resolver.resolveDidsToDisplayNames(
        statuses.map((s) => s.authorDid),
        agent as Agent,
      );

      const followResponse = await agent?.getFollows({
        actor: agent.assertDid,
      });
      let followings: string[] = [];
      if (followResponse?.success) {
        const followData: GetFollows.OutputSchema = followResponse.data;
        const followListRaw = followData.follows;
        followListRaw.map((f) => followings.push(f.did));
      }

      let followStatus: status = [];
      if (followings.length > 0) {
        followStatus = await ctx.db
          .selectFrom("status")
          .selectAll()
          .where("authorDid", "in", followings)
          .orderBy("indexedAt", "desc")
          .limit(50)
          .execute();
      }

      // Fetch additional information about the logged-in user
      const profileResponse = await agent.com.atproto.repo
        .getRecord({
          repo: agent.assertDid,
          collection: "app.bsky.actor.profile",
          rkey: "self",
        })
        .catch(() => undefined);
      //console.log(profileResponse);

      const profileRecord = profileResponse?.data;

      const profile =
        profileRecord &&
        Profile.isRecord(profileRecord.value) &&
        Profile.validateRecord(profileRecord.value).success
          ? profileRecord.value
          : {};

      // Serve the logged-in view
      return res.type("html").send(
        page(
          home({
            statuses,
            statusesCount,
            followStatus,
            didDisplayNameMap,
            profile,
            myStatus,
          }),
        ),
      );
    }),
  );

  // "Set status" handler
  router.post(
    "/status",
    handler(async (req, res) => {
      // If the user is signed in, get an agent which communicates with their server
      const agent = await getSessionAgent(req, res, ctx);
      if (!agent) {
        return res
          .status(401)
          .type("html")
          .send("<h1>Error: Session required</h1>");
      }

      // Construct & validate their status record
      const rkey = TID.nextStr();
      const record = {
        $type: "xyz.statusphere.status",
        status: req.body?.status,
        createdAt: new Date().toISOString(),
      };
      if (!Status.validateRecord(record).success) {
        return res
          .status(400)
          .type("html")
          .send("<h1>Error: Invalid status</h1>");
      }

      let uri;
      try {
        // Write the status record to the user's repository
        const res = await agent.com.atproto.repo.putRecord({
          repo: agent.assertDid,
          collection: "xyz.statusphere.status",
          rkey,
          record,
          validate: false,
        });
        uri = res.data.uri;
      } catch (err) {
        ctx.logger.warn({ err }, "failed to write record");
        return res
          .status(500)
          .type("html")
          .send("<h1>Error: Failed to write record</h1>");
      }

      try {
        // Optimistically update our SQLite
        // This isn't strictly necessary because the write event will be
        // handled in #/firehose/ingestor.ts, but it ensures that future reads
        // will be up-to-date after this method finishes.
        await ctx.db
          .insertInto("status")
          .values({
            uri,
            authorDid: agent.assertDid,
            status: record.status,
            createdAt: record.createdAt,
            indexedAt: new Date().toISOString(),
          })
          .execute();
      } catch (err) {
        ctx.logger.warn(
          { err },
          "failed to update computed view; ignoring as it should be caught by the firehose",
        );
      }

      return res.redirect("/");
    }),
  );

  router.get(
    "/movie",
    handler(async (req, res) => {
      // If the user is signed in, get an agent which communicates with their server
      const agent = await getSessionAgent(req, res, ctx);
      if (!agent) {
        // Serve the logged-out view
        return res.type("html").send(page(movie({})));
      }

      // Fetch movie records from the user's repository
      try {
        const movieRecords = await agent.com.atproto.repo.listRecords({
          repo: agent.assertDid,
          collection: "xyz.statusphere.movie",
        });

        // Store each valid movie record in the database
        if (movieRecords.success && movieRecords.data.records.length > 0) {
          for (const record of movieRecords.data.records) {
            if (
              Movie.isRecord(record.value) &&
              Movie.validateRecord(record.value).success
            ) {
              const movieData = record.value;
              await ctx.db
                .insertInto("movie")
                .values({
                  uri: record.uri,
                  authorDid: agent.assertDid,
                  name: movieData.name,
                  rate: parseFloat(movieData.rate),
                  watchedBefore: movieData.watchedBefore ? 1 : 0,
                  liked: movieData.liked ? 1 : 0,
                  review: movieData.review,
                  createdAt: movieData.createdAt,
                  indexedAt: new Date().toISOString(),
                })
                .onConflict((oc) =>
                  oc.column("uri").doUpdateSet({
                    name: movieData.name,
                    rate: parseFloat(movieData.rate),
                    watchedBefore: movieData.watchedBefore ? 1 : 0,
                    liked: movieData.liked ? 1 : 0,
                    review: movieData.review,
                    createdAt: movieData.createdAt,
                    indexedAt: new Date().toISOString(),
                  }),
                )
                .execute();
            }
          }
        }
      } catch (err) {
        ctx.logger.warn({ err }, "failed to fetch or store movie records");
      }
      let editMovie;
      if (req.query.uri) {
        const uri = req.query.uri as string;
        editMovie = await ctx.db
          .selectFrom("movie")
          .selectAll()
          .where("uri", "=", uri)
          .orderBy("indexedAt", "asc")
          .executeTakeFirst();
      }

      // Fetch data stored in our SQLite
      const loggedMovies: movieType[] = await ctx.db
        .selectFrom("movie")
        .selectAll()
        .orderBy("indexedAt", "asc")
        .execute();
      console.log(loggedMovies);

      // Fetch additional information about the logged-in user
      const profileResponse = await agent.com.atproto.repo
        .getRecord({
          repo: agent.assertDid,
          collection: "app.bsky.actor.profile",
          rkey: "self",
        })
        .catch(() => undefined);

      const profileRecord = profileResponse?.data;

      const profile =
        profileRecord &&
        Profile.isRecord(profileRecord.value) &&
        Profile.validateRecord(profileRecord.value).success
          ? profileRecord.value
          : {};

      return res
        .type("html")
        .send(page(movie({ profile, loggedMovies, editMovie })));
    }),
  );

  router.post(
    "/movie",
    handler(async (req, res) => {
      // If the user is signed in, get an agent which communicates with their server
      const agent = await getSessionAgent(req, res, ctx);
      if (!agent) {
        return res
          .status(401)
          .type("html")
          .send("<h1>Error: Session required</h1>");
      }

      // Construct & validate their status record
      let rkey;
      console.log("REQUEST BODY URI : ", req.body.uri);
      if (req.body?.uri) {
        rkey = req.body.uri.split("/").pop();
      } else {
        rkey = TID.nextStr();
      }

      const record = {
        $type: "xyz.statusphere.movie",
        name: req.body?.name,
        rate: req.body?.rate,
        watchedBefore: req.body?.watchedBefore ? true : false,
        liked: req.body?.liked ? true : false,
        review: req.body?.review,
        createdAt: new Date().toISOString(),
      };

      if (!Movie.validateRecord(record).success) {
        return res
          .status(400)
          .type("html")
          .send("<h1>Error: Invalid movie record</h1>");
      }
      console.log("Valid movie record: ", record);
      console.log("rkey: ", rkey);
      let uri;
      try {
        // Write the status record to the user's repository
        const res = await agent.com.atproto.repo.putRecord({
          repo: agent.assertDid,
          collection: "xyz.statusphere.movie",
          rkey,
          record,
          validate: false,
        });
        uri = res.data.uri;
      } catch (err) {
        ctx.logger.warn({ err }, "failed to write record");
        return res
          .status(500)
          .type("html")
          .send("<h1>Error: Failed to write record</h1>");
      }

      try {
        // Optimistically update our SQLite
        // This isn't strictly necessary because the write event will be
        // handled in #/firehose/ingestor.ts, but it ensures that future reads
        // will be up-to-date after this method finishes.
        await ctx.db
          .insertInto("movie")
          .values({
            uri,
            authorDid: agent.assertDid,
            name: record.name,
            rate: parseFloat(record.rate),
            watchedBefore: record.watchedBefore ? 1 : 0,
            liked: record.liked ? 1 : 0,
            createdAt: record.createdAt,
            review: record.review,
            indexedAt: new Date().toISOString(),
          })
          .onConflict((oc) =>
            oc.column("uri").doUpdateSet({
              uri,
              authorDid: agent.assertDid,
              name: record.name,
              rate: parseFloat(record.rate),
              watchedBefore: record.watchedBefore ? 1 : 0,
              liked: record.liked ? 1 : 0,
              review: record.review,
              createdAt: record.createdAt,
              indexedAt: new Date().toISOString(),
            }),
          )
          .execute();
      } catch (err) {
        ctx.logger.warn(
          { err },
          "failed to update computed view; ignoring as it should be caught by the firehose",
        );
      }

      return res.redirect("/movie");
    }),
  );
  return router;
};
