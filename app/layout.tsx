import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "꽃판: GO! — 화투 로그라이크",
  description: "48장 화투패와 고·스톱을 결합한 텍스트 플레이스홀더 웹게임 프로토타입",
  applicationName: "꽃판: GO!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#24221f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
