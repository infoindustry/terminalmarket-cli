import Conf from "conf";

const conf = new Conf({ projectName: "terminalmarket" });

export function getApiBase() {
  return conf.get("apiBase", "https://terminalmarket.app/api");
}

export function setApiBase(value) {
  conf.set("apiBase", value);
  return value;
}
