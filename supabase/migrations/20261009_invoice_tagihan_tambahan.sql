-- Tagihan tambahan (invoice susulan). Applied to GDIY on 9 Oct 2026 (in parts: invoice_tagihan_tambahan_1_schema,
-- invoice_tagihan_tambahan_2_backfill, then the lock function, trigger and presensi_before_write via SQL). This file is now
-- the source of record for presensi_before_write and presensi_lock_ditagih.
--
-- One kontrak siswa may now have several invoices in the same month (urutan 1, 2, ...). Every pertemuan is billed once:
-- presensi.invoice_id is set when its invoice is marked lunas, and stays set (also after "batalkan lunas", so the
-- documents already given to the parent keep their content). Pertemuan approved after an invoice is paid have no
-- invoice_id yet, so the app bills them on a new invoice ("Tagihan tambahan", number suffix -2, -3, ...).
-- A pertemuan that sits on a paid invoice is locked: status, date, time, contract and jenis cannot change and it
-- cannot be deleted until that invoice's lunas status is cancelled.

alter table public.invoice add column if not exists urutan int not null default 1;
alter table public.invoice drop constraint if exists uq_invoice_kontrak_periode;
alter table public.invoice drop constraint if exists uq_invoice_kontrak_periode_urutan;
alter table public.invoice add constraint uq_invoice_kontrak_periode_urutan unique (kontrak_siswa_id, periode, urutan);
alter table public.invoice drop constraint if exists chk_invoice_urutan;
alter table public.invoice add constraint chk_invoice_urutan check (urutan >= 1);

alter table public.presensi add column if not exists invoice_id uuid references public.invoice(id) on delete set null;
create index if not exists presensi_invoice_id_idx on public.presensi(invoice_id);

-- Backfill: link each paid invoice to its earliest pertemuan, up to the number it billed. Pertemuan beyond that
-- (approved after the invoice was paid) stay unlinked and become a tagihan tambahan. Triggers are off so nominal
-- and denda of old rows are not recalculated.
alter table public.presensi disable trigger trg_presensi_before_write;
with ranked as (
  select p.id as pid, i.id as iid, i.jumlah_pertemuan,
         row_number() over (partition by i.id order by p.tanggal, p.jam, p.id) as rn
  from public.invoice i
  join public.kontrak_tutor kt on kt.kontrak_siswa_id = i.kontrak_siswa_id
  join public.presensi p on p.kontrak_tutor_id = kt.id
       and to_char(p.tanggal, 'YYYY-MM') = i.periode
       and p.status in ('diterima', 'visit')
  where i.status = 'lunas'
)
update public.presensi p set invoice_id = r.iid
from ranked r
where p.id = r.pid and r.rn <= r.jumlah_pertemuan and p.invoice_id is null;
alter table public.presensi enable trigger trg_presensi_before_write;

-- Lock pertemuan that are on a paid invoice
create or replace function public.presensi_lock_ditagih()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_lunas boolean;
begin
  if old.invoice_id is null then
    return coalesce(new, old);
  end if;
  select (i.status = 'lunas') into v_lunas from public.invoice i where i.id = old.invoice_id;
  if not coalesce(v_lunas, false) then
    return coalesce(new, old);
  end if;
  if TG_OP = 'DELETE' then
    raise exception 'Pertemuan ini sudah masuk tagihan yang lunas, jadi tidak bisa dihapus. Batalkan lunas tagihannya di menu Tagihan dulu.';
  end if;
  if new.status is distinct from old.status
     or new.tanggal is distinct from old.tanggal
     or new.jam is distinct from old.jam
     or new.kontrak_tutor_id is distinct from old.kontrak_tutor_id
     or new.jenis is distinct from old.jenis
     or new.invoice_id is distinct from old.invoice_id then
    raise exception 'Pertemuan ini sudah masuk tagihan yang lunas, jadi status dan waktunya tidak bisa diubah. Batalkan lunas tagihannya di menu Tagihan dulu.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_presensi_lock_ditagih on public.presensi;
create trigger trg_presensi_lock_ditagih
  before update or delete on public.presensi
  for each row execute function public.presensi_lock_ditagih();

-- presensi_before_write: same as 20261009_presensi_jenis_visit.sql plus an early return for invoice_id-only updates
CREATE OR REPLACE FUNCTION public.presensi_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_persen_denda numeric;
  v_batas_jam numeric;
  v_nominal_visit numeric;
  v_is_tutor boolean := (public.current_role_name() = 'tutor');
begin
  new.jenis := coalesce(new.jenis, 'presensi');

  -- Menautkan pertemuan ke invoice (saat tagihan ditandai lunas) tidak boleh menghitung ulang nominal atau status
  if TG_OP = 'UPDATE' and new.invoice_id is distinct from old.invoice_id
     and (new.status, new.tanggal, new.jam, new.kontrak_tutor_id, new.jenis, new.materi_teks, new.materi_link, new.foto_url, new.catatan_pembelajaran_url, new.metode_input)
         is not distinct from
         (old.status, old.tanggal, old.jam, old.kontrak_tutor_id, old.jenis, old.materi_teks, old.materi_link, old.foto_url, old.catatan_pembelajaran_url, old.metode_input) then
    return new;
  end if;

  if v_is_tutor then
    if TG_OP = 'INSERT' then
      new.metode_input := 'mandiri';
      new.diinput_oleh := auth.uid();
      new.tanggal_input_pertama := now();
      new.unit_id := (select kt.unit_id from public.kontrak_tutor kt where kt.id = new.kontrak_tutor_id);
      new.pdf_url := null;
    else
      new.kontrak_tutor_id := old.kontrak_tutor_id;
      new.unit_id := old.unit_id;
      new.metode_input := old.metode_input;
      new.diinput_oleh := old.diinput_oleh;
      new.tanggal_input_pertama := old.tanggal_input_pertama;
      new.pdf_url := old.pdf_url;
    end if;
    new.status := 'pending';
    new.approved_by := null;
    new.approved_at := null;
    new.catatan_approval := null;
  end if;

  if TG_OP = 'INSERT' then
    if new.metode_input = 'diwakilkan' then
      new.tanggal_input_pertama := null;
      new.terlambat := false;
      new.approved_by := coalesce(new.approved_by, new.diinput_oleh);
      new.approved_at := coalesce(new.approved_at, now());
      if new.status = 'pending' then
        new.status := 'diterima';
      end if;
    else
      if new.tanggal_input_pertama is null then
        new.tanggal_input_pertama := now();
      end if;
    end if;
  end if;

  if TG_OP = 'UPDATE' then
    if old.metode_input = 'mandiri' and old.tanggal_input_pertama is not null then
      new.tanggal_input_pertama := old.tanggal_input_pertama;
    end if;

    if old.status = 'ditolak' and new.metode_input = 'mandiri'
       and (new.materi_teks is distinct from old.materi_teks
            or new.materi_link is distinct from old.materi_link
            or new.foto_url is distinct from old.foto_url
            or new.catatan_pembelajaran_url is distinct from old.catatan_pembelajaran_url
            or new.tanggal is distinct from old.tanggal
            or new.jam is distinct from old.jam
            or new.jenis is distinct from old.jenis) then
      new.status := 'pending';
      new.approved_by := null;
      new.approved_at := null;
      new.catatan_approval := null;
    end if;
  end if;

  if new.metode_input = 'mandiri' and new.tanggal_input_pertama is not null then
    if TG_OP = 'INSERT'
       or new.tanggal is distinct from old.tanggal
       or new.jam is distinct from old.jam
       or old.metode_input is distinct from new.metode_input then
      select (nilai::numeric) into v_batas_jam from public.pengaturan where kunci = 'batas_jam_telat';
      v_batas_jam := coalesce(v_batas_jam, 24);
      new.terlambat := (extract(epoch from (new.tanggal_input_pertama - (new.tanggal + new.jam))) / 3600.0) > v_batas_jam;
      if v_is_tutor and TG_OP = 'UPDATE' and coalesce(old.terlambat, false) then
        new.terlambat := true;
      end if;
    else
      new.terlambat := coalesce(old.terlambat, false);
    end if;
  else
    new.terlambat := false;
  end if;

  -- Jenis ditentukan pengirim (tutor, atau kepala unit/manajer saat mewakili). Approver hanya menerima atau menolak:
  -- pengajuan visit yang diterima menjadi status visit, presensi biasa tidak bisa dijadikan visit (tolak lalu tutor merevisi).
  if new.jenis = 'visit' and new.status = 'diterima' then
    new.status := 'visit';
  elsif new.jenis = 'presensi' and new.status = 'visit' then
    raise exception 'Presensi biasa tidak bisa diterima sebagai visit. Tolak dan minta tutor merevisi jenisnya.';
  end if;

  select coalesce((select nilai::numeric from public.pengaturan where kunci = 'persen_denda_telat'), 2) into v_persen_denda;
  select coalesce((select nilai::numeric from public.pengaturan where kunci = 'nominal_visit'), 30000) into v_nominal_visit;

  if new.status = 'diterima' then
    declare
      v_fee numeric;
      v_transport numeric;
    begin
      select fee_mengajar, uang_transport into v_fee, v_transport
        from public.kontrak_tutor where id = new.kontrak_tutor_id;
      new.nominal_sebelum_denda := coalesce(v_fee,0) + coalesce(v_transport,0);
      if new.terlambat then
        new.denda := round(coalesce(v_fee,0) * v_persen_denda / 100.0, 2);
      else
        new.denda := 0;
      end if;
      new.nominal_dibayar := new.nominal_sebelum_denda - new.denda;
    end;
  elsif new.status = 'visit' then
    new.nominal_sebelum_denda := v_nominal_visit;
    new.denda := 0;
    new.nominal_dibayar := v_nominal_visit;
  else
    new.nominal_sebelum_denda := 0;
    new.denda := 0;
    new.nominal_dibayar := 0;
  end if;

  return new;
end;
$function$;
