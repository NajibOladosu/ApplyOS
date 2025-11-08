import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Secure account deletion endpoint.
 *
 * Flow:
 * - Authenticates the current user via Supabase (server-side).
 * - Deletes from public.users where id = auth.uid().
 *   Because of FK + ON DELETE CASCADE in the migration, this cascades:
 *   applications, questions, documents, notifications, status_history.
 * - Relies on the trigger relationship between auth.users and public.users:
 *   auth.users delete is handled by Supabase console / auth management, not by this endpoint.
 *
 * IMPORTANT:
 * - This route intentionally does NOT use service role key or auth.admin from the client.
 * - Protects against arbitrary user-id deletion by deriving id from the session only.
 */
export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Delete from public.users; cascades will remove related data.
    const { error: deleteError } = await supabase
      .from("users")
      .delete()
      .eq("id", user.id);

    if (deleteError) {
      console.error("Account deletion error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 }
      );
    }

    // Sign out: clear auth cookies by calling signOut on this server client.
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected account deletion error:", error);
    return NextResponse.json(
      { error: "Unexpected error deleting account" },
      { status: 500 }
    );
  }
}