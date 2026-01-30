import Conf from "conf";

const conf = new Conf({ projectName: "terminalmarket" });

export function getApiBase() {
  return conf.get("apiBase", "https://terminalmarket.app/api");
}

export function setApiBase(value) {
  conf.set("apiBase", value);
  return value;
}

export function getSessionCookie() {
  return conf.get("sessionCookie", null);
}

export function setSessionCookie(value) {
  conf.set("sessionCookie", value);
  return value;
}

export function clearSession() {
  conf.delete("sessionCookie");
}

export function getUser() {
  return conf.get("user", null);
}

export function setUser(user) {
  conf.set("user", user);
  return user;
}

export function clearUser() {
  conf.delete("user");
}
