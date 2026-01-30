import fetch from "node-fetch";
import { getApiBase } from "./config.js";

function joinUrl(base, path) {
  if (!base) return path;
  return base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
}

export async function apiGet(path) {
  const url = joinUrl(getApiBase(), path);
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}${text ? " — " + text : ""}`);
  }
  return res.json();
}

export async function apiPost(path, body) {
  const url = joinUrl(getApiBase(), path);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {})
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${url} failed: ${res.status} ${res.statusText}${text ? " — " + text : ""}`);
  }
  // clicks endpoint can return empty or json
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return { ok: true };
}
