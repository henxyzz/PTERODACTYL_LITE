
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');
const formidable = require('formidable');
const FTP = require('node-ftp');

// Inisialisasi aplikasi Express
const app = express();
const PORT = process.env.PORT || 3000;

// Membuat folder untuk database jika belum ada
if (!fs.existsSync('./database')) {
  fs.mkdirSync('./database');
}

// Inisialisasi database SQLite
const db = new sqlite3.Database('./database/pterodactyl.db');

// Membuat tabel users dan servers jika belum ada
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    email TEXT UNIQUE,
    disk_quota INTEGER DEFAULT 2048,
    ram_quota INTEGER DEFAULT 2048,
    cpu_quota INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    user_id INTEGER,
    egg_type TEXT,
    disk INTEGER,
    ram INTEGER,
    cpu INTEGER,
    port INTEGER,
    status TEXT DEFAULT 'stopped',
    ftp_host TEXT,
    ftp_port INTEGER,
    ftp_user TEXT,
    ftp_password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'pterodactyl-panel-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 86400000 } // 24 jam
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware untuk mengecek autentikasi
const requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

// Middleware untuk mendapatkan info sistem
const getSystemInfo = () => {
  const totalMem = os.totalmem() / 1024 / 1024; // MB
  const freeMem = os.freemem() / 1024 / 1024; // MB
  const cpuUsage = os.loadavg()[0]; // 1 menit load average
  
  return {
    totalMem: Math.round(totalMem),
    usedMem: Math.round(totalMem - freeMem),
    cpuUsage: Math.round(cpuUsage * 100) / 100
  };
};

// Routes
app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('index');
});

app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.render('login', { error: 'Terjadi kesalahan database' });
    }
    
    if (!user) {
      return res.render('login', { error: 'Username tidak ditemukan' });
    }
    
    bcrypt.compare(password, user.password, (err, result) => {
      if (err || !result) {
        return res.render('login', { error: 'Password salah' });
      }
      
      req.session.userId = user.id;
      req.session.username = user.username;
      res.redirect('/dashboard');
    });
  });
});

app.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('register', { error: null });
});

app.post('/register', (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  
  if (password !== confirmPassword) {
    return res.render('register', { error: 'Password tidak cocok' });
  }
  
  // Default kuota
  const disk_quota = 2048; // 2GB
  const ram_quota = 2048;  // 2GB
  const cpu_quota = 100;   // 100%
  
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.render('register', { error: 'Terjadi kesalahan saat mengenkripsi password' });
    }
    
    db.run('INSERT INTO users (username, email, password, disk_quota, ram_quota, cpu_quota) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, disk_quota, ram_quota, cpu_quota],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.render('register', { error: 'Username atau email sudah digunakan' });
          }
          return res.render('register', { error: 'Terjadi kesalahan database' });
        }
        
        req.session.userId = this.lastID;
        req.session.username = username;
        res.redirect('/dashboard');
      }
    );
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/dashboard', requireLogin, (req, res) => {
  const userId = req.session.userId;
  
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) {
      req.session.destroy();
      return res.redirect('/login');
    }
    
    db.all('SELECT * FROM servers WHERE user_id = ?', [userId], (err, servers) => {
      if (err) {
        servers = [];
      }
      
      const systemInfo = getSystemInfo();
      
      res.render('dashboard', {
        user,
        servers: servers || [],
        systemInfo
      });
    });
  });
});

app.get('/servers/create', requireLogin, (req, res) => {
  const userId = req.session.userId;
  
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) {
      return res.redirect('/dashboard');
    }
    
    res.render('create-server', { user, error: null });
  });
});

app.post('/servers/create', requireLogin, (req, res) => {
  const userId = req.session.userId;
  const { name, egg_type, disk, ram, cpu, port } = req.body;
  
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) {
      return res.redirect('/dashboard');
    }
    
    if (disk > user.disk_quota || ram > user.ram_quota || cpu > user.cpu_quota) {
      return res.render('create-server', {
        user,
        error: 'Permintaan melebihi kuota yang tersedia'
      });
    }
    
    // Cek apakah port tersedia
    db.get('SELECT * FROM servers WHERE port = ?', [port], (err, existingServer) => {
      if (existingServer) {
        return res.render('create-server', {
          user,
          error: 'Port sudah digunakan. Silakan pilih port lain.'
        });
      }
      
      db.run('INSERT INTO servers (name, user_id, egg_type, disk, ram, cpu, port) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, userId, egg_type, disk, ram, cpu, port],
        function(err) {
          if (err) {
            return res.render('create-server', {
              user,
              error: 'Terjadi kesalahan saat membuat server'
            });
          }
          
          // Buat direktori untuk server
          const serverDir = path.join(__dirname, 'servers', `${this.lastID}`);
          if (!fs.existsSync('./servers')) {
            fs.mkdirSync('./servers');
          }
          if (!fs.existsSync(serverDir)) {
            fs.mkdirSync(serverDir);
          }
          
          // Buat file konfigurasi berdasarkan tipe egg
          if (egg_type === 'nodejs') {
            fs.writeFileSync(path.join(serverDir, 'package.json'), JSON.stringify({
              name: name,
              version: '1.0.0',
              description: 'NodeJS Server',
              main: 'index.js',
              scripts: {
                start: 'node index.js'
              }
            }, null, 2));
            fs.writeFileSync(path.join(serverDir, 'index.js'), 'console.log("Server started");');
          } else if (egg_type === 'python') {
            fs.writeFileSync(path.join(serverDir, 'requirements.txt'), '# Requirements');
            fs.writeFileSync(path.join(serverDir, 'main.py'), 'print("Server started")');
          } else if (egg_type === 'bash') {
            fs.writeFileSync(path.join(serverDir, 'start.sh'), '#!/bin/bash\necho "Server started"');
            exec(`chmod +x ${path.join(serverDir, 'start.sh')}`);
          } else if (egg_type === 'minecraft') {
            fs.writeFileSync(path.join(serverDir, 'eula.txt'), 'eula=true');
            fs.writeFileSync(path.join(serverDir, 'server.properties'), 'server-port=' + port);
          }
          
          res.redirect('/dashboard');
        }
      );
    });
  });
});

app.get('/servers/:id', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  
  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.redirect('/dashboard');
    }
    
    res.render('server-detail', { server });
  });
});

app.post('/servers/:id/start', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  
  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }
    
    // Update status server
    db.run('UPDATE servers SET status = ? WHERE id = ?', ['running', serverId], (err) => {
      if (err) {
        return res.json({ success: false, message: 'Gagal mengupdate status server' });
      }
      
      // Simulasi menjalankan server (dalam implementasi nyata, gunakan child_process untuk menjalankan server)
      res.json({ success: true, message: 'Server berhasil dijalankan' });
    });
  });
});

app.post('/servers/:id/stop', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  
  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }
    
    // Update status server
    db.run('UPDATE servers SET status = ? WHERE id = ?', ['stopped', serverId], (err) => {
      if (err) {
        return res.json({ success: false, message: 'Gagal mengupdate status server' });
      }
      
      // Simulasi menghentikan server
      res.json({ success: true, message: 'Server berhasil dihentikan' });
    });
  });
});

app.post('/servers/:id/delete', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  
  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.redirect('/dashboard');
    }
    
    db.run('DELETE FROM servers WHERE id = ?', [serverId], (err) => {
      if (err) {
        return res.redirect(`/servers/${serverId}`);
      }
      
      // Hapus direktori server
      const serverDir = path.join(__dirname, 'servers', `${serverId}`);
      if (fs.existsSync(serverDir)) {
        fs.rmSync(serverDir, { recursive: true, force: true });
      }
      
      res.redirect('/dashboard');
    });
  });
});

app.get('/admin', requireLogin, (req, res) => {
  const userId = req.session.userId;
  
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user || userId !== 1) { // ID 1 dianggap admin
      return res.redirect('/dashboard');
    }
    
    db.all('SELECT * FROM users', [], (err, users) => {
      if (err) {
        users = [];
      }
      
      res.render('admin', { users });
    });
  });
});

app.post('/admin/user/:id/quota', requireLogin, (req, res) => {
  const targetUserId = req.params.id;
  const { disk_quota, ram_quota, cpu_quota } = req.body;
  const adminId = req.session.userId;
  
  // Pastikan hanya admin yang bisa mengubah kuota
  if (adminId !== 1) {
    return res.redirect('/dashboard');
  }
  
  db.run('UPDATE users SET disk_quota = ?, ram_quota = ?, cpu_quota = ? WHERE id = ?',
    [disk_quota, ram_quota, cpu_quota, targetUserId],
    (err) => {
      if (err) {
        return res.redirect('/admin?error=update-failed');
      }
      
      res.redirect('/admin?success=true');
    }
  );
});

// File Management Routes
// Upload File Route
app.post('/servers/:id/upload', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;

  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    const serverDir = path.join(__dirname, 'servers', `${serverId}`);
    
    const form = new formidable.IncomingForm();
    form.uploadDir = serverDir;
    form.keepExtensions = true;
    
    form.parse(req, (err, fields, files) => {
      if (err) {
        return res.json({ success: false, message: 'Gagal upload file' });
      }
      
      const uploadedFile = files.file;
      if (!uploadedFile) {
        return res.json({ success: false, message: 'Tidak ada file yang diupload' });
      }
      
      const newPath = path.join(serverDir, uploadedFile.originalFilename || uploadedFile.newFilename);
      
      try {
        fs.renameSync(uploadedFile.filepath, newPath);
        res.json({ success: true, message: 'File berhasil diupload', fileName: uploadedFile.originalFilename || uploadedFile.newFilename });
      } catch (e) {
        res.json({ success: false, message: 'Gagal memindahkan file upload', error: e.message });
      }
    });
  });
});

// Unzip File Route
app.post('/servers/:id/unzip', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  const { fileName } = req.body;

  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    const serverDir = path.join(__dirname, 'servers', `${serverId}`);
    const zipFilePath = path.join(serverDir, fileName);
    
    if (!fs.existsSync(zipFilePath)) {
      return res.json({ success: false, message: 'File zip tidak ditemukan' });
    }
    
    try {
      const zip = new AdmZip(zipFilePath);
      zip.extractAllTo(serverDir, true);
      res.json({ success: true, message: 'File berhasil diekstrak' });
    } catch (e) {
      res.json({ success: false, message: 'Gagal mengekstrak file zip', error: e.message });
    }
  });
});

// Copy File Route
app.post('/servers/:id/copy', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  const { sourceFile, targetFile } = req.body;

  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    const serverDir = path.join(__dirname, 'servers', `${serverId}`);
    const sourcePath = path.join(serverDir, sourceFile);
    const targetPath = path.join(serverDir, targetFile);
    
    if (!fs.existsSync(sourcePath)) {
      return res.json({ success: false, message: 'File sumber tidak ditemukan' });
    }
    
    try {
      fs.copyFileSync(sourcePath, targetPath);
      res.json({ success: true, message: 'File berhasil disalin' });
    } catch (e) {
      res.json({ success: false, message: 'Gagal menyalin file', error: e.message });
    }
  });
});

// Rename File Route
app.post('/servers/:id/rename', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  const { oldName, newName } = req.body;

  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    const serverDir = path.join(__dirname, 'servers', `${serverId}`);
    const oldPath = path.join(serverDir, oldName);
    const newPath = path.join(serverDir, newName);
    
    if (!fs.existsSync(oldPath)) {
      return res.json({ success: false, message: 'File tidak ditemukan' });
    }
    
    try {
      fs.renameSync(oldPath, newPath);
      res.json({ success: true, message: 'File berhasil diubah nama' });
    } catch (e) {
      res.json({ success: false, message: 'Gagal mengubah nama file', error: e.message });
    }
  });
});

// Edit File Content Route
app.post('/servers/:id/edit', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  const { fileName, content } = req.body;

  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    const serverDir = path.join(__dirname, 'servers', `${serverId}`);
    const filePath = path.join(serverDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.json({ success: false, message: 'File tidak ditemukan' });
    }
    
    try {
      fs.writeFileSync(filePath, content);
      res.json({ success: true, message: 'File berhasil diperbarui' });
    } catch (e) {
      res.json({ success: false, message: 'Gagal mengupdate file', error: e.message });
    }
  });
});

// Get File Content Route
app.get('/servers/:id/file', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  const { fileName } = req.query;

  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    const serverDir = path.join(__dirname, 'servers', `${serverId}`);
    const filePath = path.join(serverDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.json({ success: false, message: 'File tidak ditemukan' });
    }
    
    try {
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        const files = fs.readdirSync(filePath).map(file => {
          const fileStat = fs.statSync(path.join(filePath, file));
          return {
            name: file,
            isDirectory: fileStat.isDirectory(),
            size: fileStat.size,
            modified: fileStat.mtime
          };
        });
        
        return res.json({ success: true, isDirectory: true, files });
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      res.json({ success: true, content, isDirectory: false });
    } catch (e) {
      res.json({ success: false, message: 'Gagal membaca file', error: e.message });
    }
  });
});

// List Files Route
app.get('/servers/:id/files', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  const { dir } = req.query;

  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    const serverDir = path.join(__dirname, 'servers', `${serverId}`);
    const targetDir = dir ? path.join(serverDir, dir) : serverDir;
    
    if (!fs.existsSync(targetDir)) {
      return res.json({ success: false, message: 'Direktori tidak ditemukan' });
    }
    
    try {
      const files = fs.readdirSync(targetDir).map(file => {
        const filePath = path.join(targetDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          name: file,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime
        };
      });
      
      res.json({ success: true, files });
    } catch (e) {
      res.json({ success: false, message: 'Gagal membaca direktori', error: e.message });
    }
  });
});

// FTP Configuration Routes
// Save FTP Config
app.post('/servers/:id/ftp/config', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  const { host, port, user, password } = req.body;

  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    // Save FTP config to database
    db.run('UPDATE servers SET ftp_host = ?, ftp_port = ?, ftp_user = ?, ftp_password = ? WHERE id = ?',
      [host, port, user, password, serverId],
      (err) => {
        if (err) {
          return res.json({ success: false, message: 'Gagal menyimpan konfigurasi FTP' });
        }
        
        res.json({ success: true, message: 'Konfigurasi FTP berhasil disimpan' });
      }
    );
  });
});

// Connect to FTP
app.post('/servers/:id/ftp/connect', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;

  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    if (!server.ftp_host || !server.ftp_user || !server.ftp_password) {
      return res.json({ success: false, message: 'Konfigurasi FTP belum lengkap' });
    }
    
    const client = new FTP();
    
    client.on('ready', () => {
      client.list((err, list) => {
        if (err) {
          client.end();
          return res.json({ success: false, message: 'Gagal mendapatkan daftar file' });
        }
        
        client.end();
        res.json({ success: true, message: 'Berhasil terhubung ke FTP', files: list });
      });
    });
    
    client.on('error', (err) => {
      return res.json({ success: false, message: 'Gagal terhubung ke FTP', error: err.message });
    });
    
    client.connect({
      host: server.ftp_host,
      port: server.ftp_port || 21,
      user: server.ftp_user,
      password: server.ftp_password
    });
  });
});

// Download from FTP
app.post('/servers/:id/ftp/download', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  const { remotePath, localPath } = req.body;

  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    if (!server.ftp_host || !server.ftp_user || !server.ftp_password) {
      return res.json({ success: false, message: 'Konfigurasi FTP belum lengkap' });
    }
    
    const client = new FTP();
    const serverDir = path.join(__dirname, 'servers', `${serverId}`);
    const targetPath = path.join(serverDir, localPath);
    
    client.on('ready', () => {
      client.get(remotePath, (err, stream) => {
        if (err) {
          client.end();
          return res.json({ success: false, message: 'Gagal mengunduh file', error: err.message });
        }
        
        stream.pipe(fs.createWriteStream(targetPath));
        
        stream.once('close', () => {
          client.end();
          res.json({ success: true, message: 'File berhasil diunduh' });
        });
      });
    });
    
    client.on('error', (err) => {
      return res.json({ success: false, message: 'Gagal terhubung ke FTP', error: err.message });
    });
    
    client.connect({
      host: server.ftp_host,
      port: server.ftp_port || 21,
      user: server.ftp_user,
      password: server.ftp_password
    });
  });
});

// Upload to FTP
app.post('/servers/:id/ftp/upload', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  const { localPath, remotePath } = req.body;

  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    if (!server.ftp_host || !server.ftp_user || !server.ftp_password) {
      return res.json({ success: false, message: 'Konfigurasi FTP belum lengkap' });
    }
    
    const client = new FTP();
    const serverDir = path.join(__dirname, 'servers', `${serverId}`);
    const sourcePath = path.join(serverDir, localPath);
    
    if (!fs.existsSync(sourcePath)) {
      return res.json({ success: false, message: 'File lokal tidak ditemukan' });
    }
    
    client.on('ready', () => {
      client.put(sourcePath, remotePath, (err) => {
        client.end();
        
        if (err) {
          return res.json({ success: false, message: 'Gagal mengupload file', error: err.message });
        }
        
        res.json({ success: true, message: 'File berhasil diupload' });
      });
    });
    
    client.on('error', (err) => {
      return res.json({ success: false, message: 'Gagal terhubung ke FTP', error: err.message });
    });
    
    client.connect({
      host: server.ftp_host,
      port: server.ftp_port || 21,
      user: server.ftp_user,
      password: server.ftp_password
    });
  });
});

// File Management Routes
app.post('/servers/:id/delete-file', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  const { fileName } = req.body;

  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    const serverDir = path.join(__dirname, 'servers', `${serverId}`);
    const filePath = path.join(serverDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.json({ success: false, message: 'File tidak ditemukan' });
    }
    
    try {
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        fs.rmdirSync(filePath, { recursive: true });
      } else {
        fs.unlinkSync(filePath);
      }
      
      res.json({ success: true, message: 'File berhasil dihapus' });
    } catch (e) {
      res.json({ success: false, message: 'Gagal menghapus file', error: e.message });
    }
  });
});

app.post('/servers/:id/create-folder', requireLogin, (req, res) => {
  const serverId = req.params.id;
  const userId = req.session.userId;
  const { folderPath } = req.body;

  db.get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, userId], (err, server) => {
    if (err || !server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    const serverDir = path.join(__dirname, 'servers', `${serverId}`);
    const targetPath = path.join(serverDir, folderPath);
    
    try {
      fs.mkdirSync(targetPath, { recursive: true });
      res.json({ success: true, message: 'Folder berhasil dibuat' });
    } catch (e) {
      res.json({ success: false, message: 'Gagal membuat folder', error: e.message });
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server berjalan pada port ${PORT}`);
});
