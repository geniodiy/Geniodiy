-- USULAN, BELUM DIPASANG ke database live GDIY (butuh persetujuan pemilik).
-- Menyalin email baru dari Supabase Auth ke public.users setiap kali email akun berganti
-- (mis. setelah verifikasi kode di halaman Profil), supaya kolom users.email tidak pernah berbeda
-- dari email untuk masuk. Tanpa trigger ini, aplikasi menyalinnya dari sisi browser setelah verifikasi.
create or replace function public.sync_user_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_user_email on auth.users;
create trigger trg_sync_user_email
after update of email on auth.users
for each row execute function public.sync_user_email_from_auth();
