// Edge Function: admin-users
// Membuat dan menghapus akun (Supabase Auth + public.users) dengan kunci service role,
// yang tidak boleh ada di browser. Hanya bisa dipanggil oleh akun aktif:
//   - manajer / super_admin: semua role (super_admin hanya oleh super_admin)
//   - hrd: hanya role tutor
// Aksi:
//   { action: "create", nama, email, password, role, unit_id?, jenis_kelamin?, no_hp?, tutor_profile? }
//   { action: "delete", user_id }   (juga dipakai untuk menolak pendaftar tutor)
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ROLES = ["super_admin", "manajer", "hrd", "kepala_unit", "tutor"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function fail(message: string, status = 400) {
  return json({ error: message }, status);
}
function canManage(callerRole: string, targetRole: string) {
  if (callerRole === "super_admin") return true;
  if (callerRole === "manajer") return targetRole !== "super_admin";
  if (callerRole === "hrd") return targetRole === "tutor";
  return false;
}
function clean(v: unknown) {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("Method tidak didukung", 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. Pastikan pemanggil login dan berhak
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return fail("Sesi tidak ditemukan, silakan masuk ulang", 401);
  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user) return fail("Sesi tidak valid, silakan masuk ulang", 401);
  const callerId = authData.user.id;
  const { data: caller } = await admin.from("users").select("id, role, status").eq("id", callerId).maybeSingle();
  if (!caller || caller.status !== "aktif" || !["super_admin", "manajer", "hrd"].includes(caller.role)) {
    return fail("Anda tidak punya akses untuk mengelola akun", 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("Data tidak valid"); }

  // 2. Tambah akun
  if (body.action === "create") {
    const nama = clean(body.nama);
    const email = (clean(body.email) || "").toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const role = String(body.role || "");
    const unitId = clean(body.unit_id);
    const jk = body.jenis_kelamin === "L" || body.jenis_kelamin === "P" ? body.jenis_kelamin : null;

    if (!nama) return fail("Nama wajib diisi");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Email tidak valid");
    if (password.length < 8) return fail("Password awal minimal 8 karakter");
    if (!ROLES.includes(role)) return fail("Role tidak dikenal");
    if (!canManage(caller.role, role)) return fail("Anda tidak boleh membuat akun dengan role ini", 403);
    if (role === "kepala_unit" && !unitId) return fail("Kepala unit wajib punya unit");

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { nama },
    });
    if (cErr || !created?.user) {
      const msg = /already|registered|exists/i.test(cErr?.message || "") ? "Email sudah terdaftar" : (cErr?.message || "Gagal membuat akun login");
      return fail(msg);
    }
    const uid = created.user.id;

    const { data: row, error: uErr } = await admin.from("users").insert({
      id: uid, nama, email, role,
      unit_id: role === "kepala_unit" ? unitId : null,
      status: "aktif", jenis_kelamin: jk, no_hp: clean(body.no_hp), login_method: "password",
    }).select("*").single();
    if (uErr) {
      await admin.auth.admin.deleteUser(uid); // batalkan akun login supaya tidak tertinggal
      return fail("Gagal menyimpan data pengguna: " + uErr.message);
    }

    if (role === "tutor") {
      const tp = (body.tutor_profile || {}) as Record<string, unknown>;
      const keahlian = Array.isArray(tp.keahlian) ? tp.keahlian.map((k) => String(k).trim()).filter(Boolean) : [];
      const { error: tErr } = await admin.from("tutor_profile").insert({
        user_id: uid, keahlian,
        pendidikan_terakhir: clean(tp.pendidikan_terakhir),
        no_wa: clean(tp.no_wa) || clean(body.no_hp),
        nama_bank: clean(tp.nama_bank),
        no_rekening: clean(tp.no_rekening),
      });
      if (tErr) {
        await admin.from("users").delete().eq("id", uid);
        await admin.auth.admin.deleteUser(uid);
        return fail("Gagal menyimpan profil tutor: " + tErr.message);
      }
    }
    return json({ user: row });
  }

  // 3. Hapus akun (termasuk tolak pendaftar tutor)
  if (body.action === "delete") {
    const userId = clean(body.user_id);
    if (!userId) return fail("Akun tidak ditemukan");
    if (userId === callerId) return fail("Anda tidak bisa menghapus akun sendiri");

    const { data: target } = await admin.from("users").select("id, role").eq("id", userId).maybeSingle();
    if (target) {
      if (!canManage(caller.role, target.role)) return fail("Anda tidak boleh menghapus akun dengan role ini", 403);
      const { error: dErr } = await admin.from("users").delete().eq("id", userId);
      if (dErr) {
        if (dErr.code === "23503") {
          return fail("Akun ini sudah punya riwayat (kontrak, presensi, gaji, atau data lain), jadi tidak bisa dihapus. Nonaktifkan saja.", 409);
        }
        return fail("Gagal menghapus data pengguna: " + dErr.message);
      }
    } else if (caller.role === "hrd") {
      return fail("Akun tidak ditemukan", 404);
    }

    const { error: aErr } = await admin.auth.admin.deleteUser(userId);
    if (aErr && !/not.?found/i.test(aErr.message)) {
      return json({ ok: true, warning: "Data terhapus, tapi akun login gagal dihapus: " + aErr.message });
    }
    return json({ ok: true });
  }

  return fail("Aksi tidak dikenal");
});
