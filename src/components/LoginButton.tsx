"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserAvatar } from "./UserAvatar";

export function LoginButton() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Ẩn nút đăng nhập khi đang ở trang login hoặc register
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  if (status === "loading") {
    return <div className="h-8 w-20 bg-slate-100 rounded-xl animate-pulse"></div>;
  }

  if (session) {
    return (
      <Link
        href="/profile"
        className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/80 transition-all group"
      >
        <UserAvatar 
          user={session.user} 
          className="w-8 h-8 rounded-full ring-2 ring-indigo-500/20 group-hover:ring-indigo-500/50 shadow-xs transition-all" 
          fallbackClassName="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold" 
        />
        <span className="text-sm font-semibold text-slate-700 max-w-[120px] truncate hidden sm:inline">
          {session.user?.name || session.user?.username || session.user?.email || "Bạn"}
        </span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="text-sm font-semibold text-slate-700 hover:text-indigo-600 px-3.5 py-1.5 rounded-xl hover:bg-slate-100/80 transition-colors"
      >
        Đăng nhập
      </Link>
      <Link
        href="/register"
        className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-1.5 rounded-xl shadow-xs shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        Bắt đầu
      </Link>
    </div>
  );
}
