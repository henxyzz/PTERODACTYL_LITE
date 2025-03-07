
# Panel Pterodactyl - Tema Cyberpunk

Panel pterodactyl sederhana dengan tema cyberpunk untuk menjalankan berbagai jenis server seperti Python, NodeJS, Bash, dan Minecraft. Panel ini dibuat menggunakan Node.js dengan database SQLite lokal.

## Fitur

- Autentikasi pengguna (login dan registrasi)
- Dashboard dengan informasi kuota dan penggunaan resource
- Pembuatan server dengan berbagai "egg" (Python, NodeJS, Bash, Minecraft)
- Manajemen server (start, stop, delete)
- Visualisasi penggunaan resource (CPU, RAM, Disk)
- Panel admin untuk mengatur kuota pengguna
- Tema cyberpunk yang keren

## Cara Penggunaan

1. Install semua dependensi:
   ```
   npm install
   ```

2. Jalankan server:
   ```
   node index.js
   ```

3. Akses panel di browser dengan URL:
   ```
   http://localhost:3000
   ```

## Kuota Default

Setiap pengguna baru mendapatkan kuota default:
- Disk: 2GB (2048 MB)
- RAM: 2GB (2048 MB)
- CPU: 100%

## Eggs yang Tersedia

1. **NodeJS** - Untuk menjalankan aplikasi Node.js
2. **Python** - Untuk menjalankan script Python
3. **Bash** - Untuk menjalankan script Bash
4. **Minecraft** - Untuk menjalankan server Minecraft

## Panel Admin

Administrator (pengguna dengan ID 1) dapat mengatur kuota pengguna melalui panel admin.
