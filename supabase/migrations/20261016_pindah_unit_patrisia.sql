-- Ibu Patrisia (Giselle, Gwyneth) dipindah dari Unit 3 ke Unit 2 (16 Oct 2026, owner's choice: sesuai data sistem lama).
-- Semua data ikut pindah: siswa, kontrak siswa, kontrak tutor, 5 presensi, 2 invoice (lunas), 1 pemasukan lain.
-- PDF yang sudah dicetak dikosongkan (pdf_url = null) dan 6 file Drive-nya dipindah ke Sampah, supaya dicetak ulang
-- dengan unit baru: 5 laporan belajar (1ThnZ3Xd..., 1VPLrHaw..., 1HUNcECg..., 1TUOz9fS..., 1FsUOgwL...) dan 1 invoice
-- (17wmEptC..., dipakai bersama 2 invoice dan pemasukan lain). Honor presensi tidak berubah (dicek: total Rp 240.000).
-- Kembalikan: ganti unit 2 (3dc2ca30-...) dengan unit 3 (f8176502-e...) pada baris yang sama.
with u as (select '3dc2ca30-e047-4fb8-8a45-d0b4925d803d'::uuid id),
s as (update siswa set unit_id=(select id from u) where id in ('35d8eccb-28d1-4b85-baa7-30f545ab0ac7','deb59a74-acd3-4db7-80e8-5e288e04b03b') returning 1),
ks as (update kontrak_siswa set unit_id=(select id from u) where id in ('fadb4c32-c974-4c43-a6a5-70993e156b4e','3dbd21c0-1812-49a0-8bf2-cadb65bb921f') returning 1),
kt as (update kontrak_tutor set unit_id=(select id from u) where id in ('639c7ca5-113e-4270-9205-52160f18ae33','db6409f5-e792-4ed6-b79d-834b5218a41f','54824ad9-1c73-44a9-ab30-0b9f08ab840a') returning 1),
p as (update presensi set unit_id=(select id from u), pdf_url=null where id in ('6c09a1c8-00e7-48cf-9ed8-026995bc559d','660ae0ab-263a-4df5-b3e4-1257c7d290a5','f4653a18-ae68-41aa-9b8f-753f972ca136','9b077a9c-be65-498b-b2da-0119c7e73707','345d1062-b59c-458c-959b-05a30944daa8') returning 1),
i as (update invoice set unit_id=(select id from u), pdf_url=null where id in ('33c16657-fa49-4bfe-bdef-558a4b89a4ff','69092137-70b9-493b-8139-907389a4d800') returning 1),
pl as (update pemasukan_lain set unit_id=(select id from u), pdf_url=null where id='9477e925-8bef-4df0-9633-012f78209cd7' returning 1)
select 1;
