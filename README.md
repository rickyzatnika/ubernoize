This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Quickstart (Auth + MongoDB + Landing Events)

1) Copy env file
```
cp .env.example .env.local
```
Isi MONGODB_URI, NEXTAUTH_SECRET, dan Google OAuth (opsional).

2) Install dependencies
```
npm install
```

3) Jalankan MongoDB lokal (contoh)
```
# pastikan mongod berjalan di localhost:27017
```

4) Seed data (users, 1 event, ticket types)
```
# Jalankan dev, lalu POST ke endpoint seed
npm run dev
# Di terminal lain:
curl -X POST http://localhost:3000/api/dev/seed
```
Akun demo:
- admin@ubernoize.local / admin123 (role: admin)
- user@ubernoize.local / user123 (role: user)

5) Jalankan dev server
```
npm run dev
```

Buka:
- Landing: http://localhost:3000 (event listing dari MongoDB via SWR)
- Sign in: http://localhost:3000/signin (Credentials/Google)
- Profile: http://localhost:3000/profile (protected)
- Admin: http://localhost:3000/admin (role admin)

Catatan teknis:
- Database: MongoDB (Mongoose)
- Auth: NextAuth (Credentials + Google), session JWT
- Data fetch: SWR + refreshInterval (tanpa WebSocket), gunakan mutate untuk optimistic UI
- API: /api/events untuk listing event beserta ticket types

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
