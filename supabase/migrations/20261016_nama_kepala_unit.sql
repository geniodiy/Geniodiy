-- Nama kepala unit disamakan dengan sistem lama (owner's choice 16 Oct 2026), dijalankan lewat execute_sql.
-- Sebelumnya: Unit 1 Andi Prasetyo (L), Unit 2 Doni Saputra (L), Unit 3 Rina Kusuma (P),
-- Unit 4 Wati Handayani (P), Unit 5 Eko Nugroho (L). Email login tidak berubah (ku1..ku5@genio.id).
-- Gelar Mr./Ms. disimpan di nama; sapaan WhatsApp dan inisial avatar tidak menambah gelar dua kali.
update public.users u set nama = v.nama, jenis_kelamin = v.jk
from (values ('Unit 1','Mr. Kholif','L'),('Unit 2','Ms. Uut','P'),('Unit 3','Ms. Uli','P'),
             ('Unit 4','Ms. Levi','P'),('Unit 5','Mr. Tri','L')) v(unit,nama,jk), public.units un
where un.nama_unit = v.unit and u.unit_id = un.id and u.role = 'kepala_unit';
