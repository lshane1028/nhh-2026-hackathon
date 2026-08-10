import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "경화수월 — 화투 로그라이크",
  description: "패 두 장으로 끗을 만들고 수집 점수를 쌓아 목표를 넘기는 화투 로그라이크",
  applicationName: "경화수월",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#130f0c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
