// Cloudflare Pages Worker
export default async function handler(request, env) {
  const url = new URL(request.url);

  // Secrets from environment
  const CLIENT_ID = env.SPOTIFY_CLIENT_ID;
  const CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;
  const REDIRECT_URI = env.SPOTIFY_REDIRECT_URI;

  // Simple in-memory token storage
  if (!globalThis.accessToken) globalThis.accessToken = null;
  if (!globalThis.refreshToken) globalThis.refreshToken = null;
  if (!globalThis.tokenExpiry) globalThis.tokenExpiry = 0;

  if (url.pathname === "/login") {
    return spotifyLogin(CLIENT_ID, REDIRECT_URI);
  } else if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");
    return spotifyCallback(code, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  } else if (url.pathname === "/currently-playing") {
    return currentlyPlaying(globalThis.accessToken, globalThis.tokenExpiry);
  }

  return new Response("Not Found", { status: 404 });
}

// Redirect user to Spotify login
function spotifyLogin(clientId, redirectUri) {
  const scopes = encodeURIComponent("user-read-currently-playing");
  const authURL = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}`;
  return Response.redirect(authURL, 302);
}

// Handle callback and exchange code for token
async function spotifyCallback(code, clientId, clientSecret, redirectUri) {
  if (!code) return new Response("No code provided", { status: 400 });

  const creds = btoa(`${clientId}:${clientSecret}`);
  const body = `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = await tokenRes.json();
  globalThis.accessToken = data.access_token;
  globalThis.refreshToken = data.refresh_token;
  globalThis.tokenExpiry = Date.now() + (data.expires_in * 1000);

  return new Response("Spotify login successful! Visit /currently-playing to see your track.");
}

// Fetch currently playing track
async function currentlyPlaying(accessToken, tokenExpiry) {
  if (!accessToken || Date.now() >= tokenExpiry) {
    return new Response("Access token missing or expired. Go to /login", { status: 401 });
  }

  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });

  if (res.status === 204) return new Response("Nothing is currently playing", { status: 200 });
  if (!res.ok) return new Response("Error fetching currently playing", { status: res.status });

  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}
