"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignInClient({ callbackUrl = "/profile" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false, callbackUrl });
    if (res?.error) {
      setError("Email atau password salah");
      return;
    }
    if (res?.ok) {
      window.location.href = callbackUrl;
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-2">Selamat Datang</h1>
        <p className="text-sm text-gray-600 mb-4">Masuk untuk melanjutkan</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input className="border rounded p-2 w-full" placeholder="Email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <input className="border rounded p-2 w-full" placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
          <button className="w-full bg-black text-white px-4 py-2 rounded hover:bg-gray-900" type="submit">Masuk</button>
        </form>
        <div className="mt-4">
          <button className="w-full border px-4 py-2 rounded hover:bg-gray-50" onClick={()=>signIn("google", { callbackUrl })}>Masuk dengan Google</button>
        </div>
        {error && <p className="text-red-500 mt-2">{error}</p>}
        <p className="text-sm text-gray-600 mt-4">Belum punya akun? <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-blue-600 hover:underline">Daftar</Link></p>
        <p className="text-xs text-gray-500 mt-4">Demo: admin@ubernoize.local / admin123, user@ubernoize.local / user123</p>
      </div>
    </div>
  );
}
