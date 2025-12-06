import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { connectToDatabase } from "@/lib/db/mongoose";
import User from "@/models/User";
import bcrypt from "bcryptjs";

const providers = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const { email, password } = credentials || {};
      if (!email || !password) return null;
      await connectToDatabase();
      const user = await User.findOne({ email }).lean();
      if (!user || !user.passwordHash) return null;
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;
      return { id: String(user._id), name: user.name, email: user.email, role: user.role };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions = {
  session: { strategy: "jwt" },
  providers,
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // Merge role
      if (user?.role) token.role = user.role;
      if (account?.provider === "google" && profile?.email) {
        // Ensure user exists in our DB and attach role
        await connectToDatabase();
        const existing = await User.findOne({ email: profile.email });
        if (!existing) {
          const created = await User.create({
            name: profile.name || "Google User",
            email: profile.email,
            role: "user",
            image: profile.picture,
          });
          token.role = created.role;
        } else {
          token.role = existing.role || "user";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.role = token.role || "user";
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
