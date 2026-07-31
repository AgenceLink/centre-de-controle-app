import { IconShieldCheck, IconBolt, IconChartBar, IconEye, IconCompass, IconGrid } from "./icons";

export const AGENT_THEME = {
  zizou: { color: "#E94C16", colorDark: "#993C1D", bg: "#FAECE7", number: "10", Icon: IconShieldCheck, mascot: "/mascots/zizou.png" },
  griezou: { color: "#4E9A1E", colorDark: "#2F5F12", bg: "#EAF3DE", number: "7", Icon: IconBolt, mascot: "/mascots/griezou.png" },
  dd: { color: "#1F7FC1", colorDark: "#0C447C", bg: "#E6F1FB", number: "4", Icon: IconChartBar, mascot: "/mascots/dd.png" },
  varane: { color: "#12A187", colorDark: "#085041", bg: "#E1F5EE", number: "5", Icon: IconEye, mascot: "/mascots/varane.png" },
  wenger: { color: "#D4527E", colorDark: "#72243E", bg: "#FBEAF0", number: "1", Icon: IconCompass, mascot: "/mascots/wenger.png" },
  olise: { color: "#E0A31A", colorDark: "#633806", bg: "#FAEEDA", number: "8", Icon: IconGrid, mascot: "/mascots/olise.png" },
};

export function agentTheme(agentId) {
  return AGENT_THEME[agentId] || { color: "#929292", colorDark: "#5E5E5E", bg: "#F1EFE8", number: "—", Icon: IconShieldCheck, mascot: null };
}
