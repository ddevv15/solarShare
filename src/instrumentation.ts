export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateWebConfigAtStartup } = await import("@/lib/config/web");

    validateWebConfigAtStartup();
  }
}
