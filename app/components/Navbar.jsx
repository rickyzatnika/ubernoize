"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function Navbar() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">UBERNOIZE</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-gray-700 hover:text-black">Events</Link>
          {!mounted ? (
            // Reserve consistent structure before hydration
            <span className="inline-block w-24 h-6 bg-gray-100 rounded" aria-hidden />
          ) : status === "loading" ? (
            <span className="text-gray-500">Memuat...</span>
          ) : session ? (
            <>
              <Link href="/profile" className="text-gray-700 hover:text-black">Profile</Link>
              {session.user?.role === "admin" && (
                <>
                  <Link href="/admin" className="text-gray-700 hover:text-black">Admin</Link>
                  <Link href="/admin/dashboard" className="text-gray-700 hover:text-black">📊 Dashboard</Link>
                  <Link href="/scanner" className="text-gray-700 hover:text-black">📱 Scanner</Link>
                </>
              )}
              <button onClick={() => signOut({ callbackUrl: "/" })} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">Sign Out</button>
            </>
          ) : (
            <>
              <Link href="/signin" className="px-3 py-1 rounded bg-black text-white hover:bg-gray-900">Sign In</Link>
              <Link href="/register" className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">Register</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
