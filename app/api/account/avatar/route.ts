import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Handles avatar upload.
 *
 * Flow:
 * - Authenticate user via server-side Supabase.
 * - Read multipart/form-data, accept one "file".
 * - Delete old avatar if exists.
 * - Upload new avatar to Supabase Storage bucket "avatars" under path: user.id/avatar
 * - Update user profile with new avatar URL.
 *
 * Returns:
 * - 200 with avatar URL on success.
 * - 401 when unauthenticated.
 * - 400/500 on validation or server errors.
 */

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image." },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (!buffer.length) {
      return NextResponse.json(
        { error: "Empty file" },
        { status: 400 }
      )
    }

    // Delete old avatar if exists
    const { data: existingFiles } = await supabase.storage
      .from("avatars")
      .list(user.id)

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(
        (f) => `${user.id}/${f.name}`
      )
      await supabase.storage
        .from("avatars")
        .remove(filesToDelete)
    }

    // Upload new avatar
    const path = `${user.id}/avatar`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError || !uploadData) {
      console.error("Storage upload error:", uploadError)
      return NextResponse.json(
        { error: "Failed to upload avatar" },
        { status: 500 }
      )
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(uploadData.path)

    // Update user profile with new avatar URL
    const { error: updateError } = await supabase
      .from("users")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id)

    if (updateError) {
      console.error("Update profile error:", updateError)
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, avatar_url: publicUrl },
      { status: 200 }
    )
  } catch (error) {
    console.error("Unexpected avatar upload error:", error)
    return NextResponse.json(
      { error: "Unexpected error while uploading avatar" },
      { status: 500 }
    )
  }
}
