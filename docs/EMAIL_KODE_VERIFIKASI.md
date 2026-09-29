# Template email Supabase untuk ganti email (kode verifikasi)

Ganti email di halaman Profil memakai kode 6 angka, bukan tautan. Supaya kode muncul di email,
ubah template di dashboard Supabase (Authentication > Email Templates) sekali saja.

## Change Email Address

Subject: `Kode verifikasi ganti email Genio Institute`

Body (HTML):

```html
<h2>Ganti email Genio Institute</h2>
<p>Kode verifikasi Anda:</p>
<p style="font-size:28px; font-weight:700; letter-spacing:6px;">{{ .Token }}</p>
<p>Kode berlaku 10 menit. Jangan bagikan kode ini kepada siapa pun.</p>
<p>Jika Anda tidak meminta ganti email, abaikan pesan ini dan segera ganti password Anda.</p>
```

## Pengaturan lain

- Authentication > Sign In / Providers > Email: OTP expiry sebaiknya 600 detik (10 menit).
- Authentication > SMTP Settings: pasang SMTP sendiri (Resend, Brevo, atau SMTP Workspace) agar email tidak masuk spam.
- "Secure email change" aktif: kode dikirim ke email lama dan baru, jadi pengguna memasukkan dua kode (aplikasi sudah menangani ini).
- "Secure email change" nonaktif: cukup satu kode ke email baru.
