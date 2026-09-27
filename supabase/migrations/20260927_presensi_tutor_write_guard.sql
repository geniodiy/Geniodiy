-- Applied to GDIY on 27 Sep 2026 (migrations presensi_tutor_write_guard + presensi_terlambat_keep_on_approval).
-- Record of the live function; edit here and re-apply via a new migration.
--
-- Tutor guard:
--   INSERT by a tutor: status forced to pending, approval fields cleared, metode_input = mandiri,
--     diinput_oleh = the tutor, tanggal_input_pertama = now() (cannot be backdated),
--     unit_id copied from kontrak_tutor.
--   UPDATE by a tutor (RLS only allows rows with status ditolak): only tanggal, jam, materi_teks,
--     materi_link, foto_url and catatan_pembelajaran_url can change; status goes back to pending.
--     A row that was late stays late, so moving the date cannot remove the penalty.
-- terlambat is recomputed only on INSERT or when tanggal/jam/metode change; approval keeps it.

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
            or new.jam is distinct from old.jam) then
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
