"use client";
import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mendaftar");
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-2">Daftar Akun</h1>
        <p className="text-sm text-gray-600 mb-4">Buat akun untuk mulai membeli tiket</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input className="border rounded p-2 w-full" placeholder="Nama (opsional)" type="text" value={name} onChange={(e)=>setName(e.target.value)} />
          <input className="border rounded p-2 w-full" placeholder="Email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <input className="border rounded p-2 w-full" placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
          <button disabled={loading} className="w-full bg-black text-white px-4 py-2 rounded hover:bg-gray-900 disabled:opacity-50" type="submit">
            {loading ? "Mendaftar..." : "Daftar"}
          </button>
        </form>
        {error && <p className="text-red-500 mt-2">{error}</p>}
        {success && (
          <p className="text-green-600 mt-2">Pendaftaran berhasil. Silakan <Link href="/signin" className="underline">masuk</Link>.</p>
        )}
        <p className="text-sm text-gray-600 mt-4">Sudah punya akun? <Link href="/signin" className="text-blue-600 hover:underline">Masuk</Link></p>
      </div>
    </div>
  );
}
