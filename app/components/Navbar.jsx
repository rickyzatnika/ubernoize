"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  useEffect(() => setMounted(true), []);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className=" border-red-900/30 bg-gradient-to-r from-black via-gray-900 to-red-900 backdrop-blur sticky top-0 z-50 shadow-lg">
      {/* Main navbar */}
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center hover:scale-105 transition-transform">
            <Image
              src="/logo.png"
              width={50}
              height={25} 
              alt="UBERNOIZE" 
              className="object-contain"
              style={{
                width: 'auto',
                height: 'auto',
              }}
            />
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4 text-sm">
            <Link href="/" className="text-gray-200 hover:text-white px-3 py-2 rounded-md hover:bg-white/10 transition-colors">
              🎪 Events
            </Link>
            {!mounted ? (
              <span className="inline-block w-24 h-6 bg-white/20 rounded animate-pulse" aria-hidden />
            ) : status === "loading" ? (
              <span className="text-gray-300">Memuat...</span>
            ) : session ? (
              <>
                <Link href="/profile" className="text-gray-200 hover:text-white px-3 py-2 rounded-md hover:bg-white/10 transition-colors">
                  👤 Profile
                </Link>
                {session.user?.role === "admin" && (
                  <>
                    <Link href="/admin" className="text-gray-200 hover:text-white px-3 py-2 rounded-md hover:bg-white/10 transition-colors">
                      ⚙️ Admin
                    </Link>
                    <Link href="/admin/dashboard" className="text-gray-200 hover:text-white px-3 py-2 rounded-md hover:bg-white/10 transition-colors">
                      📊 Dashboard
                    </Link>
                    <Link href="/scanner" className="text-red-400 hover:text-red-300 px-3 py-2 rounded-md hover:bg-red-900/30 transition-colors font-medium border border-red-500/30">
                      📱 Scanner
                    </Link>
                  </>
                )}
                <button 
                  onClick={() => signOut({ callbackUrl: "/" })} 
                  className="px-4 py-2 rounded-md bg-white/20 hover:bg-white/30 text-gray-200 hover:text-white transition-colors"
                >
                  🚪 Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/signin" className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors">
                  Sign In
                </Link>
                <Link href="/register" className="px-4 py-2 rounded-md bg-white/20 hover:bg-white/30 text-gray-200 transition-colors">
                  Register
                </Link>
              </>
            )}
          </nav>

          {/* Mobile hamburger button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-md hover:bg-white/10 transition-colors"
            aria-label="Toggle mobile menu"
          >
            <div className="w-6 h-6 flex flex-col justify-center items-center">
              <div className={`w-5 h-0.5 bg-gray-200 transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-1' : ''}`}></div>
              <div className={`w-5 h-0.5 bg-gray-200 mt-1 transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`}></div>
              <div className={`w-5 h-0.5 bg-gray-200 mt-1 transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-1' : ''}`}></div>
            </div>
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-white/20 pt-4 bg-gradient-to-b from-black/95 to-gray-900/95 rounded-b-lg shadow-xl animate-slideDown">
            <nav className="flex flex-col space-y-2">
              <Link 
                href="/" 
                onClick={closeMobileMenu}
                className="text-gray-200 hover:text-white hover:bg-white/10 px-4 py-3 rounded-md transition-colors flex items-center"
              >
                🎪 <span className="ml-3">Events</span>
              </Link>
              
              {!mounted ? (
                <div className="px-4 py-3">
                  <span className="inline-block w-32 h-6 bg-white/20 rounded animate-pulse" aria-hidden />
                </div>
              ) : status === "loading" ? (
                <div className="px-4 py-3 text-gray-300">Memuat...</div>
              ) : session ? (
                <>
                  <Link 
                    href="/profile" 
                    onClick={closeMobileMenu}
                    className="text-gray-200 hover:text-white hover:bg-white/10 px-4 py-3 rounded-md transition-colors flex items-center"
                  >
                    👤 <span className="ml-3">Profile</span>
                  </Link>
                  
                  {session.user?.role === "admin" && (
                    <>
                      <div className="px-4 py-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Admin Tools</div>
                      </div>
                      <Link 
                        href="/admin" 
                        onClick={closeMobileMenu}
                        className="text-gray-200 hover:text-white hover:bg-white/10 px-4 py-3 rounded-md transition-colors flex items-center"
                      >
                        ⚙️ <span className="ml-3">Admin Panel</span>
                      </Link>
                      <Link 
                        href="/admin/dashboard" 
                        onClick={closeMobileMenu}
                        className="text-gray-200 hover:text-white hover:bg-white/10 px-4 py-3 rounded-md transition-colors flex items-center"
                      >
                        📊 <span className="ml-3">Gate Monitor Dashboard</span>
                      </Link>
                      <Link 
                        href="/scanner" 
                        onClick={closeMobileMenu}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/30 px-4 py-3 rounded-md transition-colors flex items-center font-medium border border-red-500/30"
                      >
                        📱 <span className="ml-3">Scanner (Mobile)</span>
                        <span className="ml-auto text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-full">Crew Tool</span>
                      </Link>
                    </>
                  )}
                  
                  <div className="px-4 py-2 mt-4 border-t border-white/20">
                    <button 
                      onClick={() => {
                        closeMobileMenu();
                        signOut({ callbackUrl: "/" });
                      }}
                      className="w-full text-left text-red-400 hover:text-red-300 hover:bg-red-900/20 px-4 py-3 rounded-md transition-colors flex items-center"
                    >
                      🚪 <span className="ml-3">Sign Out</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link 
                    href="/signin" 
                    onClick={closeMobileMenu}
                    className="text-white bg-red-600 hover:bg-red-700 px-4 py-3 rounded-md transition-colors mx-4 text-center font-medium"
                  >
                    Sign In
                  </Link>
                  <Link 
                    href="/register" 
                    onClick={closeMobileMenu}
                    className="text-gray-200 bg-white/20 hover:bg-white/30 px-4 py-3 rounded-md transition-colors mx-4 text-center"
                  >
                    Register
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>

      {/* CSS untuk animasi slide down */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }
      `}</style>
    </header>
  );
}
