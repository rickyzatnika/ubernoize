import SignInClient from "./SignInClient";

export default async function SignInPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const raw = (resolvedSearchParams && resolvedSearchParams.callbackUrl) || "/profile";
  let callbackUrl = "/profile";
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith("http")) callbackUrl = decoded;
    else if (decoded.startsWith("/")) callbackUrl = decoded;
    else callbackUrl = "/" + decoded;
  } catch {
    callbackUrl = "/profile";
  }
  return <SignInClient callbackUrl={callbackUrl} />;
}
