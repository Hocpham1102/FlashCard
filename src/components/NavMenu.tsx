"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
};

function getItemClassname(pathname: string, href: string) {
  const isActive =
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return isActive
    ? "rounded-xl bg-indigo-50 px-3.5 py-1.5 text-sm font-semibold text-indigo-600 border border-indigo-100 shadow-xs"
    : "rounded-xl px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors";
}

export function NavMenu() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/admin")
  ) {
    return null;
  }

  if (status === "loading") {
    return (
      <div className="hidden md:block h-8 w-32 rounded-xl bg-slate-100 animate-pulse" />
    );
  }

  const items: NavItem[] = [];

  if (session?.user) {
    items.push({ label: "Dashboard", href: "/dashboard" });
  }

  if (session?.user?.role === "ADMIN" || session?.user?.isAdmin) {
    items.push({ label: "Admin", href: "/admin" });
  }

  return (
    <div className="hidden md:flex items-center gap-1.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={getItemClassname(pathname, item.href)}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
