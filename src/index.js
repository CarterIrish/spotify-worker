/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// Replace these with your Spotify app credentials
const CLIENT_ID = env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = "https://spotify-worker.2023c-irish.workers.dev/callback";

// Simple in-memory token storage (for demonstration)
let accessToken = null;
let refreshToken = null;
let tokenExpiry = 0;

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === "/login") {
    return spotifyLogin();
  } else if (url.pathname === "/callback") {
    return spotifyCallback(url);
  } else if (url.pathname === "/currently-playing") {
    return currentlyPlaying();
  }

  return new Response("Not Found", { status: 404 });
}

// Step 1: Redirect user to Spotify login
function spotifyLogin() {
  const scopes = encodeURIComponent("user-read-currently-playing");
  const authURL = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scopes}`;
  return Response.redirect(authURL, 302);
}

// Step 2: Handle Spotify callback and exchange code for token
async function spotifyCallback(url) {
  const code = url.searchParams.get("code");
  if (!code) return new Response("No code provided", { status: 400 });

  const creds = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const body = `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = await tokenRes.json();
  accessToken = data.access_token;
  refreshToken = data.refresh_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);

  return new Response("Spotify login successful! You can now visit /currently-playing");
}

// Step 3: Fetch currently playing track
async function currentlyPlaying() {
  if (!accessToken || Date.now() >= tokenExpiry) {
    return new Response("Access token missing or expired. Go to /login", { status: 401 });
  }

  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  if (res.status === 204) return new Response("Nothing is currently playing", { status: 200 });
  if (!res.ok) return new Response("Error fetching currently playing", { status: res.status });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
}