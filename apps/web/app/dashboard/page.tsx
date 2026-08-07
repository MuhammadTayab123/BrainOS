import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>🎉 Welcome to BrainOS Dashboard</h1>

      <p>You are successfully authenticated.</p>

      <p>Your Clerk User ID:</p>

      <code>{userId}</code>
    </main>
  );
}