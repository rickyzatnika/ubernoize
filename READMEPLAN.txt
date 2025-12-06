Aplikasi ini adalah aplikasi penjualan ticket untuk penyelenggara acara UBERNOIZE. UBERNOIZE adalah penyelenggara acara musik Underground di Bandung tepatnya di Ujung Berung.
Dalam satu waktu ubernoize bisa mengadakan acara di berbagai kota di jawa-barat. Aplikasi ticket ini dibuat dengan tujuan memudahkan penggemar musik underground di jawa-barat dan agar tidak
terjadinya penumpukan masa di gate jika membeli ticket manual.

Ubernoize menyediakan beberapa ticket diantara lain "Bronze", "Silver", "Gold", dan "VIP". Satu user yang login akan dibatasi pembelian ticket sebanyak 3 ticket sekaligus atau pembelian secara bertahap sebanyak 3x. Metode pembayaran saya menggunakan payment gateway dari "Midtrans". Setelah user berhasil melakukan pemesanan dan melakukan pembayaran lalu mengirim bukti pembayaran admin akan melihat di dashboard apakah bukti pembayaran valid atau tidak, jika valid maka dihalaman profile user akan menampilkan tombol untuk melihat QRCode, yang nantinya QRCode itu akan -
diperlihatkan kepada crew Ubernoize di Gate untuk memverifikasi bahwa barcode itu adalah pembelian ticket yang di approve oleh admin di dashboard.

Untuk sementara penjelasan planning saya tentang aplikasi ini cukup sekian, mungkin akan ada pengembangan ide di lain waktu.
Tolong buatkan secara bertahap mulai dari Frontend lalu ke Backend. Untuk autentication saya ingin menggunakan Nextauth,diantaranya CredentialsProvider dan GoogleProvider untuk user.

Tambahan - Untuk database saya menggunakan mongodb.
dan untuk data fetch saya ingin menggunakan swr "gunakan mutate dari swr agar terlihat realtime" jangan gunakan Websocket !

##

Catatan Jika menggunakan QRCode Signature :

Membangun Aplikasi Sendiri (Custom Scanner App)
Kalau sistem tiketnya internal (misalnya untuk perusahaan, event khusus, atau transportasi), biasanya dibuat aplikasi sendiri:
- Mobile app khusus (Android/iOS) untuk crew gate.
- Aplikasi ini membaca QRCode → kirim data ke server via API (POST request).
- Server melakukan verifikasi signature (HMAC-SHA256) + cek database.
- Hasil valid/invalid ditampilkan langsung di aplikasi.
- Semua log scan tersimpan di dashboard admin.


contoh payload JSON POST yang biasanya dikirim dari aplikasi scanner ke server saat QRCode tiket digital di-scan
Harus menggunakan Scanner app harus khusus (bukan QR gratis), karena perlu integrasi ke server.

{
  "order_id": "69336e193b4a44a740ada77e",
  "issued_at": "2025-12-06T07:33:13Z",
  "expires_at": "2025-12-14T06:39:26Z",
  "signature": "a1b2c3d4e5f6g7h8i9j0...", 
  "scan_time": "2025-12-06T08:10:45Z",
  "gate_id": "GATE_A1",
  "crew_id": "CREW_102",
  "device_id": "SCANNER_01"
}


{
  "status": "VALID",
  "message": "Tiket sah dan belum digunakan",
  "scan_id": "LOG_20251206_081045"
}
atau
{
  "status": "INVALID",
  "message": "Tiket kadaluarsa atau sudah digunakan",
  "scan_id": "LOG_20251206_081045"
}
