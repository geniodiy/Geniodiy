-- Status pendidikan terakhir tutor (16 Oct 2026, owner's request): 'lulus' (Sudah lulus) atau 'kuliah' (Masih kuliah).
-- Diisi tutor di halaman Lengkapi biodata (ModuleBiodataTutor.html), wajib bersama pendidikan_terakhir.
alter table public.tutor_profile add column if not exists status_pendidikan text;
alter table public.tutor_profile drop constraint if exists tutor_profile_status_pendidikan_check;
alter table public.tutor_profile add constraint tutor_profile_status_pendidikan_check
  check (status_pendidikan is null or status_pendidikan in ('lulus', 'kuliah'));
