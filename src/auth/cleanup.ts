import { Database } from "../db";
import type { AppContext } from "#/index";

export async function cleanupExpiredTokens(db: Database, ctx: AppContext) {
  try {
    const sessions = await db.selectFrom("auth_session").selectAll().execute();
    console.log("Sessions : ", sessions);
    for (const session of sessions) {
      try {
        const sessionData = JSON.parse(session.session);
        // console.log("Session Data", sessionData);
        const expiresAt: Date = new Date(sessionData.tokenSet.expires_at);
        console.log("Expires At", expiresAt);
        console.log("Current Date", new Date());

        if (expiresAt && expiresAt < new Date()) {
          const deleteRes = await db
            .deleteFrom("auth_session")
            .where("key", "=", session.key)
            .execute();
          console.log(deleteRes);

          console.log(
            await db.selectFrom("auth_session").selectAll().execute(),
          );
        }
      } catch (err) {
        ctx.logger.warn(
          { err },
          `Error cleaning up expired ${session.key} : ${session.session}`,
        );
      }
    }
  } catch (err) {
    ctx.logger.warn({ err }, "Error cleaning up expired tokens");
  }
}
