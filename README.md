# AT Protocol "Statusphere" Example App

Testing and understanding a portion of AT Protocol

- Sync the profile records of all users so that you can show their display names instead of their handles.
- Count the number of each status used and display the total counts.
- Fetch the authed user's app.bsky.graph.follow follows and show statuses from them.
- Create a new lexicon called movie for letterboxd style movie reviews.
- Post and Edit movie reviews
- Upload custom posters (blobs)
- Delete movie reviews
- SQLite database is file based so, no need to re log in everytime server restarts
- [ ] First HTML render after deleting browser cache is not showing "@some1" is feeling "👍" today and showing [object Object] [object Object]. After server restart, it is working fine. not sure what is the issue. HELPPPPP

## Getting Started

```sh
git clone https://github.com/ChanPyaeAung11/atproto-example-app.git
cd atproto-example-app
cp .env.template .env
npm install
npm run dev
# Navigate to http://localhost:8080
```
