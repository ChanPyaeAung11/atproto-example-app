# AT Protocol "Statusphere" Example App

Testing and understanding a portion of AT Protocol

- Sync the profile records of all users so that you can show their display names instead of their handles.
- Count the number of each status used and display the total counts.
- Fetch the authed user's app.bsky.graph.follow follows and show statuses from them.
- Create a new lexicon called movie for letterboxd style movie reviews.
- Post and Edit movie reviews
- Upload custom posters (blobs)
- Delete movie reviews

## Getting Started

```sh
git clone https://github.com/ChanPyaeAung11/atproto-example-app.git
cd atproto-example-app
cp .env.template .env
npm install
npm run dev
# Navigate to http://localhost:8080
```
