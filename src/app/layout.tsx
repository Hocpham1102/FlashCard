import { LoginButton } from "@/components/LoginButton";
import { NavBar } from "@/components/NavBar";
import { NavMenu } from "@/components/NavMenu";
import { Providers } from "@/components/Providers";
import { SoundToggle } from "@/components/SoundToggle";
import { UserStatsDisplay } from "@/components/UserStatsDisplay";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FlashCard",
  description: "A modern flashcard app for learning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} antialiased bg-gray-50 min-h-screen flex flex-col`}
      >
        <Providers>
          <NavBar>
            <Link
              href="/"
              className="flex items-center gap-2.5 text-xl font-black tracking-tight text-slate-900 group"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="tracking-tight">
                FlashCard<span className="text-indigo-600">.</span>
              </span>
            </Link>
            <NavMenu />
            <div className="flex items-center gap-2 sm:gap-4">
              <SoundToggle />
              <UserStatsDisplay />
              <LoginButton />
            </div>
          </NavBar>
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
