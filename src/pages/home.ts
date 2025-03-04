import type { Status } from "#/db";
import { html } from "../lib/view";
import { shell } from "./shell";

const TODAY = new Date().toDateString();

const STATUS_OPTIONS = [
  "👍",
  "👎",
  "💙",
  "🥹",
  "😧",
  "😤",
  "🙃",
  "😉",
  "😎",
  "🤓",
  "🤨",
  "🥳",
  "😭",
  "😤",
  "🤯",
  "🫡",
  "💀",
  "✊",
  "🤘",
  "👀",
  "🧠",
  "👩‍💻",
  "🧑‍💻",
  "🥷",
  "🧌",
  "🦋",
  "🚀",
];

type BaseProps = {
  statusesCount?: {
    status: string;
    count: number;
  }[];
  statuses?: Status[];
  followStatus?: Status[];
  profile?: { displayName?: string };
  myStatus?: Status;
};

type PropsWithHandleMap = BaseProps & {
  didHandleMap: Record<string, string>;
  didDisplayNameMap?: Record<string, string>;
};

type PropsWithDisplayNameMap = BaseProps & {
  didHandleMap?: Record<string, string>;
  didDisplayNameMap: Record<string, string>;
};

type Props =
  | PropsWithHandleMap
  | PropsWithDisplayNameMap
  | (BaseProps & {
      didHandleMap?: never;
      didDisplayNameMap?: never;
    });

export function home(props: Props) {
  return shell({
    title: "Home",
    content: content(props),
  });
}

function content({
  statusesCount,
  statuses,
  followStatus,
  didDisplayNameMap,
  didHandleMap,
  profile,
  myStatus,
}: Props) {
  return html`<div id="root">
    <div class="error"></div>
    <div id="header">
      <h1>Statusphere</h1>
      <p>Set your status on the Atmosphere.</p>
    </div>
    <div class="container">
      <div class="card">
        ${profile
          ? html`<form action="/logout" method="post" class="session-form">
              <div>
                Hi, <strong>${profile.displayName || "friend"}</strong>. What's
                your status today?
              </div>
              <div>
                <button type="submit">Log out</button>
              </div>
            </form>`
          : html`<div class="session-form">
              <div><a href="/login">Log in</a> to set your status!</div>
              <div>
                <a href="/login" class="button">Log in</a>
              </div>
            </div>`}
      </div>
      <form action="/status" method="post" class="status-options">
        ${STATUS_OPTIONS.map(
          (status) =>
            html`<button
              class=${myStatus?.status === status
                ? "status-option selected"
                : "status-option"}
              name="status"
              value="${status}"
            >
              ${status}
            </button>`,
        )}
      </form>
      ${statuses && statuses.length > 0
        ? statuses.map((status, i) => {
            const handle = didDisplayNameMap
              ? didDisplayNameMap[status.authorDid]
              : didHandleMap[status.authorDid] || status.authorDid;
            const date = ts(status);
            return html`
              <div class=${i === 0 ? "status-line no-line" : "status-line"}>
                <div>
                  <div class="status">${status.status}</div>
                </div>
                <div class="desc">
                  <a class="author" href=${toBskyLink(handle)}>@${handle}</a>
                  ${date === TODAY
                    ? `is feeling ${status.status} today`
                    : `was feeling ${status.status} on ${date}`}
                </div>
              </div>
            `;
          })
        : html`<div>no statuses yet</div>`}
      ${statusesCount && statusesCount.length > 0
        ? statusesCount.map((value, i) => {
            return html` <div>${value.status} ${value.count}</div> `;
          })
        : html`<div>no status count yet</div>`}
      ${followStatus && followStatus.length > 0
        ? followStatus.map((status, i) => {
            const handle = didDisplayNameMap
              ? didDisplayNameMap[status.authorDid]
              : didHandleMap[status.authorDid] || status.authorDid;
            const date = ts(status);
            return html`
              <div class=${i === 0 ? "status-line no-line" : "status-line"}>
                <div>
                  <div class="status">${status.status}</div>
                </div>
                <div class="desc">
                  <a class="author" href=${toBskyLink(handle)}>@${handle}</a>
                  ${date === TODAY
                    ? `is feeling ${status.status} today`
                    : `was feeling ${status.status} on ${date}`}
                </div>
              </div>
            `;
          })
        : html`<div>no follow status yet</div>`}
    </div>
  </div>`;
}

function toBskyLink(did: string) {
  return `https://bsky.app/profile/${did}`;
}

function ts(status: Status) {
  const createdAt = new Date(status.createdAt);
  const indexedAt = new Date(status.indexedAt);
  if (createdAt < indexedAt) return createdAt.toDateString();
  return indexedAt.toDateString();
}
