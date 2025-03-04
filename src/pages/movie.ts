import { html } from "../lib/view";
import { shell } from "./shell";
import type { Movie as movieType } from "#/db";

type Props = {
  profile?: { displayName?: string };
  loggedMovies?: movieType[];
  editMovie?: movieType;
};
export function movie(props: Props) {
  return shell({
    title: "Movie",
    content: content(props),
  });
}

function content({ profile, loggedMovies, editMovie }: Props) {
  return html`<div id="root">
    <div class="error"></div>
    <div id="header">
      <h1>Statusphere</h1>
      <p>Log a movie</p>
    </div>
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
    <form id="movieReviewForm" action="/movie" method="post">
      <div class="form-group">
        <label for="name">Movie Name:</label>
        <input
          type="text"
          id="name"
          name="name"
          value=${editMovie ? editMovie.name : ""}
          required
        />
      </div>

      <div class="form-group">
        <label for="review">Review:</label>
        <textarea id="review" name="review" required>
${editMovie ? editMovie.review : ""}</textarea
        >
      </div>

      <div class="form-group">
        <label for="rate">Rating (0-5):</label>
        <select id="rate" name="rate" required>
          <option value="">Select a rating</option>
          ${[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(
            (value) =>
              html`<option
                value="${value}"
                ?selected=${editMovie && editMovie.rate === value}
              >
                ${value}
              </option>`,
          )}
        </select>
      </div>

      <div class="form-group">
        <div class="checkbox-group">
          <input
            type="checkbox"
            id="watchedBefore"
            name="watchedBefore"
            ?checked=${editMovie && editMovie.watchedBefore}
          />
          <label for="watchedBefore">Watched Before</label>
        </div>
      </div>

      <div class="form-group">
        <div class="checkbox-group">
          <input
            type="checkbox"
            id="liked"
            name="liked"
            ?checked=${editMovie && editMovie.liked}
          />
          <label for="liked">Liked</label>
        </div>
      </div>

      <!-- If editing, include the URI to identify which movie to update -->
      ${editMovie
        ? html`<input
            type="hidden"
            id="uri"
            name="uri"
            value="${editMovie.uri || ""}"
          />`
        : ""}
      <button type="submit">${editMovie ? "Update" : "Submit"} Review</button>
    </form>
    <div class="movie-logs">
      <h2>Your Movie Logs</h2>
      ${loggedMovies && loggedMovies.length > 0
        ? html`<div class="movie-list">
            ${loggedMovies.map((log) => {
              return html`
                <div class="movie-card">
                  <h3>${log.name}</h3>
                  <div class="movie-details">
                    <div class="rating">Rating: ${log.rate || "N/A"}</div>
                    ${log.review
                      ? html`<div class="review">${log.review}</div>`
                      : ""}
                    <div class="movie-flags">
                      ${log.watchedBefore
                        ? html`<span class="tag">Watched Before</span>`
                        : ""}
                      ${log.liked
                        ? html`<span class="tag liked">Liked</span>`
                        : ""}
                    </div>
                    <div class="movie-actions">
                      <!-- Use a GET form with the URI as a query parameter -->
                      <form action="/movie" method="get" class="inline-form">
                        <input
                          type="hidden"
                          name="uri"
                          value="${log.uri || ""}"
                        />
                        <button type="submit" class="link-button">Edit</button>
                      </form>
                    </div>
                  </div>
                </div>
              `;
            })}
          </div>`
        : html`<div class="no-movies">No movies logged yet</div>`}
    </div>
  </div>`;
}
