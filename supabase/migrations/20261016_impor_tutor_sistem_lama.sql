-- Impor tutor dari sistem lama (16 Oct 2026, owner's choice). Sumber: Google Drive "[Official] DB_MASTER_GENIO",
-- sheet TENTOR (73 baris) dan PENGGUNA (email + kata sandi login).
-- Keputusan pemilik: kata sandi awal = kata sandi di sheet lama; 4 tutor yang sudah ada memakai email dari sheet;
-- tutor nonaktif (Fatoni, Yosa Daru Aksa, Niken Anita Tutut Handayani, Firgi Daffa Fauzi) dilewati;
-- email dummy (fisika1/2/3, biologi1, ekonomi1, kebumian1 @gmail.com) dimasukkan apa adanya; jenis kelamin dikosongkan.
--
-- Dijalankan lewat execute_sql (bukan apply_migration) supaya kata sandi tidak tersimpan di riwayat migrasi.
-- Kata sandi TIDAK dicantumkan di file ini. Bentuk perintahnya (65 akun, satu statement):
--
-- with v(nama,email,pw,wa,keahlian,bank,rek) as (values (...65 baris...)),
-- v2 as materialized (select gen_random_uuid() id, v.* from v
--   where not exists (select 1 from auth.users a where lower(a.email) = lower(v.email))),
-- au as (insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
--     raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
--     email_change_token_new, email_change, email_change_token_current, reauthentication_token, phone_change,
--     phone_change_token, is_sso_user, is_anonymous)
--   select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
--     extensions.crypt(pw, extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb,
--     jsonb_build_object('nama', nama, 'email_verified', true), now(), now(), '', '', '', '', '', '', '', '', false, false
--   from v2 returning id),
-- ai as (insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
--   select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', false, 'phone_verified', false),
--     'email', null, now(), now() from v2 where id in (select id from au) returning user_id),
-- pu as (insert into public.users (id, nama, email, role, unit_id, status, jenis_kelamin, no_hp, login_method)
--   select id, nama, email, 'tutor', null, 'aktif', null, wa, 'password' from v2 where id in (select user_id from ai) returning id)
-- insert into public.tutor_profile (user_id, keahlian, pendidikan_terakhir, no_wa, nama_bank, no_rekening)
-- select id, keahlian, null, wa, bank, rek from v2 where id in (select id from pu);
--
-- Perapian data: no WA disimpan berformat 08 (seperti data yang sudah ada), keahlian diseragamkan (MTK -> Matematika,
-- Indo -> Bahasa Indonesia, SD (All) -> Semua mapel SD, ...), info rekening dipecah ke nama_bank + no_rekening
-- (nama bank dicocokkan sebagai kata utuh; kosong kalau tidak tertulis). Kata sandi angka dari sel numerik ditulis
-- tanpa ".0".

-- Tutor yang sudah ada: email diganti ke email sheet (Auth, identities, public.users), WA/keahlian/rekening dari sheet.
with v(old,new,wa,keahlian,bank,rek) as (values
 ('ulimaz@gmail.com','ulimazutami07@gmail.com','087839086071',array['Matematika']::text[],'BNI','1112202629'),
 ('fathonah@gmail.com','sifasitifathonah.2024@gmail.com','085729406335',array['Matematika']::text[],'BRI','306101060735539'),
 ('arisma@gmail.com','arismaindayani1@gmail.com','089504860620',array['Matematika']::text[],'BNI','2105503682')),
t as (select u.id, v.* from public.users u join v on lower(u.email)=v.old where u.role='tutor'),
a as (update auth.users au set email=t.new, updated_at=now() from t where au.id=t.id returning au.id),
i as (update auth.identities ai set identity_data = ai.identity_data || jsonb_build_object('email', t.new), updated_at=now()
  from t where ai.user_id=t.id and ai.provider='email' returning ai.user_id),
p as (update public.users pu set email=t.new, no_hp=t.wa from t where pu.id=t.id returning pu.id)
update public.tutor_profile tp set no_wa=t.wa, keahlian=t.keahlian, nama_bank=coalesce(t.bank,tp.nama_bank), no_rekening=coalesce(t.rek,tp.no_rekening)
from t where tp.user_id=t.id and (select count(*) from a)+(select count(*) from i)+(select count(*) from p) >= 0;
-- Finda Triarsa (finda@gmail.com -> ckfd27@gmail.com) menunggu penghapusan akun Auth yatim ckfd27@gmail.com (uji 11 Sep 2026).
