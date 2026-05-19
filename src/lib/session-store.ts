import session from "express-session";
import { pool } from "../../models/index.js";

type SessionRecord = {
  sess: session.SessionData;
  expire: Date;
};

export class PgSessionStore extends session.Store {
  constructor() {
    super();
  }

  async get(
    sid: string,
    callback: (err?: unknown, session?: session.SessionData | null) => void,
  ) {
    try {
      const result = await pool.query<SessionRecord>(
        `
          select sess, expire
          from app_sessions
          where sid = $1
            and expire > now()
          limit 1
        `,
        [sid],
      );

      callback(undefined, result.rows[0]?.sess ?? null);
    } catch (error) {
      callback(error);
    }
  }

  async set(
    sid: string,
    sess: session.SessionData,
    callback?: (err?: unknown) => void,
  ) {
    try {
      const cookie = sess.cookie as session.Cookie | undefined;
      const maxAge = typeof cookie?.maxAge === "number" ? cookie.maxAge : 1000 * 60 * 60 * 24 * 30;
      const expire = new Date(Date.now() + maxAge);

      await pool.query(
        `
          insert into app_sessions (sid, sess, expire)
          values ($1, $2::jsonb, $3)
          on conflict (sid)
          do update set sess = excluded.sess, expire = excluded.expire
        `,
        [sid, JSON.stringify(sess), expire],
      );

      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  async destroy(sid: string, callback?: (err?: unknown) => void) {
    try {
      await pool.query(`delete from app_sessions where sid = $1`, [sid]);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  async touch(
    sid: string,
    sess: session.SessionData,
    callback?: (err?: unknown) => void,
  ) {
    try {
      const cookie = sess.cookie as session.Cookie | undefined;
      const maxAge = typeof cookie?.maxAge === "number" ? cookie.maxAge : 1000 * 60 * 60 * 24 * 30;
      const expire = new Date(Date.now() + maxAge);

      await pool.query(
        `update app_sessions set expire = $2 where sid = $1`,
        [sid, expire],
      );

      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }
}
