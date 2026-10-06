import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"분수 팡! 대포 탐험대",description:"초등 3학년 2학기 분수 문제를 풀고 블록 성을 무너뜨리는 게임.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>}
