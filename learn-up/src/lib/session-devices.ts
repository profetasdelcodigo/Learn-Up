export interface SessionDeviceInfo {
  deviceName: string;
  browser: string;
  os: string;
}

export function decodeJwtPayload(token?: string | null): Record<string, any> | null {
  if (!token) return null;
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function getSessionIdFromAccessToken(token?: string | null): string | null {
  const payload = decodeJwtPayload(token);
  const sessionId = payload?.session_id;
  return typeof sessionId === "string" && sessionId.length > 0
    ? sessionId
    : null;
}

export function parseUserAgent(userAgent?: string | null): SessionDeviceInfo {
  const ua = userAgent || "";
  const browser = getBrowserName(ua);
  const os = getOsName(ua);
  const device = getDeviceKind(ua);

  return {
    browser,
    os,
    deviceName: [device, browser, os].filter(Boolean).join(" - "),
  };
}

function getBrowserName(ua: string) {
  if (/Edg\//i.test(ua)) return "Microsoft Edge";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/CriOS\//i.test(ua)) return "Chrome iOS";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  return "Navegador desconocido";
}

function getOsName(ua: string) {
  if (/Windows NT 10/i.test(ua)) return "Windows 10/11";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/(iPhone|iPad|iPod)/i.test(ua)) return "iOS";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Sistema desconocido";
}

function getDeviceKind(ua: string) {
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "Movil";
  return "Escritorio";
}
