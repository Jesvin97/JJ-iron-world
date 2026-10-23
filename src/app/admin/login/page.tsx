import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, adminFromToken } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin sign in" };

export default async function LoginPage() {
  if (await adminFromToken((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/admin");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-center font-serif text-3xl">Glam’more Admin</h1>
      <LoginForm />
    </main>
  );
}
