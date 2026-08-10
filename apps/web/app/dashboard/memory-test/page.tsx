import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createMemory, searchMemories } from "../../../lib/brainos-api";

export default async function MemoryTestPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  async function createTestMemory() {
    "use server";

    await createMemory(
      "BrainOS Phase 14 authenticated memory test. Semantic memory persistence is working.",
      0.8,
    );

    redirect("/dashboard/memory-test?created=true");
  }

  async function searchTestMemory(formData: FormData) {
    "use server";

    const query = String(formData.get("query") || "").trim();

    if (!query) {
      return;
    }

    const memories = await searchMemories(query, 5);

    console.log("========== MEMORY SEARCH TEST ==========");
    console.log("Query:", query);
    console.log("Results:", JSON.stringify(memories, null, 2));
    console.log("========================================");
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>BrainOS Memory Test</h1>

      <p>
        <strong>Authenticated Clerk User:</strong>
      </p>

      <code>{userId}</code>

      <section style={{ marginTop: "2rem" }}>
        <h2>Create Test Memory</h2>

        <form action={createTestMemory}>
          <button type="submit">
            Create Test Memory
          </button>
        </form>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Search Memories</h2>

        <form action={searchTestMemory}>
          <input
            type="text"
            name="query"
            placeholder="Search your memories..."
            defaultValue="BrainOS Phase 14 authenticated memory test"
            style={{
              padding: "0.5rem",
              width: "400px",
              marginRight: "0.5rem",
            }}
          />

          <button type="submit">
            Search Memories
          </button>
        </form>

        <p style={{ marginTop: "1rem" }}>
          Search results will appear in the Backend Terminal.
        </p>
      </section>
    </main>
  );
}