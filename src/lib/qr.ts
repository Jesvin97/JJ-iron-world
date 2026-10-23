import QRCode from "qrcode";
import { appUrl } from "./env";

export function reviewUrl(slug: string | null | undefined, fallbackOrigin?: string): string {
  const base = appUrl() ?? fallbackOrigin ?? "http://localhost:3000";
  return slug ? `${base}/review?c=${encodeURIComponent(slug)}` : `${base}/review`;
}

export function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#3b2a22", light: "#ffffff" } });
}

export function qrPng(url: string) {
  return QRCode.toBuffer(url, { type: "png", errorCorrectionLevel: "M", margin: 2, width: 1024, color: { dark: "#3b2a22", light: "#ffffff" } });
}
