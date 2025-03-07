
#!/bin/bash
echo "Menginstal dependensi untuk Pterodactyl Panel..."
npm install
mkdir -p database
mkdir -p public
mkdir -p public/css
mkdir -p public/js
mkdir -p servers
mkdir -p views
echo "Instalasi selesai."
echo "Jalankan 'node index.js' untuk memulai panel."
