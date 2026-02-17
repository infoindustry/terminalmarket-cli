import fetch from "node-fetch";
import { getApiBase, getSessionCookie, setSessionCookie, getCsrfToken, setCsrfToken } from "./config.js";

function joinUrl(base, path) {
  if (!base) return path;
  return base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
}

function getHeaders(method = "GET") {
  const headers = { "Content-Type": "application/json" };
  const cookie = getSessionCookie();
  if (cookie) {
    headers["Cookie"] = cookie;
  }
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (!safeMethods.includes(method.toUpperCase())) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers["x-csrf-token"] = csrf;
    }
  }
  return headers;
}

export async function fetchCsrfToken() {
  try {
    const url = joinUrl(getApiBase(), "/auth/csrf-token");
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders("GET"),
      credentials: "include"
    });
    saveCookies(res);
    if (res.ok) {
      const data = await res.json();
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
        return data.csrfToken;
      }
    }
  } catch {
    // silently ignore — CSRF token will be missing but some endpoints may still work
  }
  return null;
}

function saveCookies(response) {
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/(?:tm\.sid|connect\.sid)=[^;]+/);
    if (match) {
      setSessionCookie(match[0]);
    }
  }
}

export async function apiGet(path) {
  const url = joinUrl(getApiBase(), path);
  const res = await fetch(url, { 
    method: "GET",
    headers: getHeaders("GET"),
    credentials: "include"
  });
  saveCookies(res);
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
    headers: getHeaders("POST"),
    body: JSON.stringify(body ?? {}),
    credentials: "include"
  });
  saveCookies(res);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${url} failed: ${res.status} ${res.statusText}${text ? " — " + text : ""}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return { ok: true };
}

export async function apiDelete(path) {
  const url = joinUrl(getApiBase(), path);
  const res = await fetch(url, { 
    method: "DELETE",
    headers: getHeaders("DELETE"),
    credentials: "include"
  });
  saveCookies(res);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DELETE ${url} failed: ${res.status} ${res.statusText}${text ? " — " + text : ""}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return { ok: true };
}

export async function apiPut(path, body) {
  const url = joinUrl(getApiBase(), path);
  const res = await fetch(url, {
    method: "PUT",
    headers: getHeaders("PUT"),
    body: JSON.stringify(body ?? {}),
    credentials: "include"
  });
  saveCookies(res);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT ${url} failed: ${res.status} ${res.statusText}${text ? " — " + text : ""}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return { ok: true };
}

export async function apiPatch(path, body) {
  const url = joinUrl(getApiBase(), path);
  const res = await fetch(url, {
    method: "PATCH",
    headers: getHeaders("PATCH"),
    body: JSON.stringify(body ?? {}),
    credentials: "include"
  });
  saveCookies(res);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PATCH ${url} failed: ${res.status} ${res.statusText}${text ? " — " + text : ""}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return { ok: true };
}
