
// Fungsi untuk mengontrol server
function startServer(serverId) {
  fetch(`/servers/${serverId}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      document.getElementById(`status-${serverId}`).textContent = 'running';
      document.getElementById(`status-${serverId}`).className = 'server-status status-running';
      showToast(data.message, 'success');
    } else {
      showToast(data.message, 'error');
    }
  })
  .catch(error => {
    showToast('Terjadi kesalahan pada server', 'error');
  });
}

function stopServer(serverId) {
  fetch(`/servers/${serverId}/stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      document.getElementById(`status-${serverId}`).textContent = 'stopped';
      document.getElementById(`status-${serverId}`).className = 'server-status status-stopped';
      showToast(data.message, 'success');
    } else {
      showToast(data.message, 'error');
    }
  })
  .catch(error => {
    showToast('Terjadi kesalahan pada server', 'error');
  });
}

function deleteServer(serverId) {
  if (confirm('Apakah Anda yakin ingin menghapus server ini? Tindakan ini tidak dapat dibatalkan.')) {
    document.getElementById(`delete-form-${serverId}`).submit();
  }
}

// Toast notification
function showToast(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.className += ' show';
  }, 100);
  
  setTimeout(() => {
    toast.className = toast.className.replace('show', '');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Update sistem info
function updateSystemInfo() {
  const cpuBar = document.getElementById('cpu-bar');
  const ramBar = document.getElementById('ram-bar');
  
  if (cpuBar && ramBar) {
    // Simulasi update (dalam implementasi nyata, ini akan mengambil data dari server)
    const cpuUsage = Math.floor(Math.random() * 100);
    const ramUsage = Math.floor(Math.random() * 100);
    
    cpuBar.style.width = `${cpuUsage}%`;
    ramBar.style.width = `${ramUsage}%`;
    
    document.getElementById('cpu-usage').textContent = `${cpuUsage}%`;
    document.getElementById('ram-usage').textContent = `${ramUsage}%`;
  }
}

// Update setiap 5 detik
if (document.getElementById('dashboard-page')) {
  updateSystemInfo();
  setInterval(updateSystemInfo, 5000);
}
