import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("OFFICEZONE_SERVICE_ROLE_KEY");
    const adminPin = Deno.env.get("ADMIN_PIN");
    if (!url || !serviceKey || !adminPin) return reply({ error: "Server secrets missing: ADMIN_PIN / OFFICEZONE_SERVICE_ROLE_KEY" }, 500);
    const body = await req.json();
    if (String(body.admin_pin ?? "") !== adminPin) return reply({ error: "Admin PIN incorrect" }, 403);
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const action = String(body.action ?? "reply");
    const validId = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    if (action === "list_forms") {
      const { data, error } = await db.from("officezone_forms").select("id,user_id,uin,rank,full_name,coy,mobile_number,diet_type,remarks,status,approval_status,created_at").order("created_at", { ascending: false }).limit(500);
      if (error) return reply({ error: error.message }, 400);
      return reply({ success: true, forms: data ?? [] });
    }
    if (action === "update_form") {
      if (!validId(body.form_id)) return reply({ error: "Valid form_id required" }, 400);
      const approval = String(body.approval_status ?? "").toUpperCase();
      if (!["APPROVED", "REJECTED", "PENDING"].includes(approval)) return reply({ error: "Invalid approval_status" }, 400);
      const { data, error } = await db.from("officezone_forms").update({ approval_status: approval, status: approval.toLowerCase() }).eq("id", body.form_id).select("id,approval_status,status").single();
      if (error) return reply({ error: error.message }, 400);
      return reply({ success: true, form: data });
    }
    if (action === "list_users" || action === "list_messages") {
      const { data, error } = await db.from("officezone_chat_messages").select("id,user_id,sender_role,message,created_at").order("created_at", { ascending: false }).limit(500);
      if (error) return reply({ error: error.message }, 400);
      if (action === "list_users") return reply({ success: true, users: [...new Map((data ?? []).map((m: any) => [m.user_id, { user_id: m.user_id, last_message_at: m.created_at }])).values()] });
      if (!validId(body.user_id)) return reply({ error: "Valid user_id required" }, 400);
      return reply({ success: true, messages: (data ?? []).filter((m: any) => m.user_id === body.user_id).reverse() });
    }
    if (action === "reply") {
      if (!validId(body.user_id)) return reply({ error: "Valid user_id required" }, 400);
      const message = String(body.message ?? "").trim();
      if (!message || message.length > 2000) return reply({ error: "Message must be 1–2000 characters" }, 400);
      const { data, error } = await db.from("officezone_chat_messages").insert({ user_id: body.user_id, sender_role: "admin", message }).select("id,user_id,sender_role,message,created_at").single();
      if (error) return reply({ error: error.message }, 400);
      return reply({ success: true, message: data });
    }
    return reply({ error: "Unknown action" }, 400);
  } catch {
    return reply({ error: "Unexpected server error" }, 500);
  }
});
