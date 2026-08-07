import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "꽃판: GO! — 화투 로그라이크",
  description: "짓고땡과 고·스톱, 열두 달 부적 빌드를 결합한 화투 로그라이크",
  applicationName: "꽃판: GO!",
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
