import { Router } from "express";
import { Webhook } from "svix";
import { supabase } from "../lib/supabase.js";

export const webhooksRouter = Router();

// Clerk webhook — needs the raw body, so this route is mounted with
// express.raw({ type: "application/json" }) in index.ts, BEFORE express.json().
webhooksRouter.post("/clerk", async (req, res) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET!;
  const svixId = req.headers["svix-id"] as string;
  const svixTimestamp = req.headers["svix-timestamp"] as string;
  const svixSignature = req.headers["svix-signature"] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(400).json({ error: "Missing svix headers" });
  }

  const wh = new Webhook(secret);
  let evt: any;
  try {
    evt = wh.verify(req.body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  if (evt.type === "user.created") {
    const { id, email_addresses, primary_email_address_id, first_name, last_name } = evt.data;
    const primaryEmail = email_addresses?.find((entry: { id: string }) => entry.id === primary_email_address_id)?.email_address
      ?? email_addresses?.[0]?.email_address;
    const email = primaryEmail?.trim().toLowerCase() ?? null;
    const fullName = [first_name, last_name].filter(Boolean).join(" ") || null;

    const { data: approvedProfile, error: lookupError } = email
      ? await supabase.from("profiles").select("id, clerk_user_id").ilike("email", email).limit(1).maybeSingle()
      : { data: null, error: null };
    if (lookupError) {
      console.error("Failed to find approved client profile:", lookupError);
      return res.status(500).json({ error: "Failed to link client profile" });
    }
    if (approvedProfile?.clerk_user_id && approvedProfile.clerk_user_id !== id) {
      return res.status(409).json({ error: "This email is already linked to another account" });
    }

    const result = approvedProfile
      ? await supabase.from("profiles").update({ clerk_user_id: id, email, full_name: fullName ?? undefined })
          .eq("id", approvedProfile.id).is("clerk_user_id", null)
      : await supabase.from("profiles").insert({
          clerk_user_id: id,
          email,
          full_name: fullName,
          role: "client", // default — promote to admin manually in Supabase
        });

    if (result.error) {
      console.error("Failed to create or link profile from webhook:", result.error);
      return res.status(500).json({ error: "Failed to create profile" });
    }
  }

  res.status(200).json({ received: true });
});
