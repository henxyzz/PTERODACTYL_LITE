
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
// Toast notification system
function showToast(message, type) {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 300);
  });
  
  // Create new toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Create toast content with icon
  let icon = '';
  if (type === 'success') {
    icon = '<span style="color: var(--success-color); margin-right: 10px;">✓</span>';
  } else if (type === 'error') {
    icon = '<span style="color: var(--danger-color); margin-right: 10px;">✕</span>';
  }
  
  toast.innerHTML = `${icon}${message}`;
  
  document.body.appendChild(toast);
  
  // Add animation delay
  setTimeout(() => {
    toast.className += ' show';
  }, 100);
  
  // Auto hide after delay
  setTimeout(() => {
    toast.className = toast.className.replace('show', '');
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 400);
  }, 5000);
}

// System info animation and update
function updateSystemInfo() {
  const cpuBar = document.getElementById('cpu-bar');
  const ramBar = document.getElementById('ram-bar');
  const cpuElement = document.getElementById('cpu-usage');
  const ramElement = document.getElementById('ram-usage');
  
  if (cpuBar && ramBar && cpuElement && ramElement) {
    // Simulasi update (dalam implementasi nyata, ini akan mengambil data dari server)
    const cpuUsage = Math.floor(Math.random() * 100);
    const ramUsage = Math.floor(Math.random() * 5000); // Simulate MB usage
    
    // Animate the bar transition
    cpuBar.style.transition = 'width 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    ramBar.style.transition = 'width 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    cpuBar.style.width = `${cpuUsage}%`;
    ramBar.style.width = `${(ramUsage / 8192) * 100}%`; // Assuming 8GB total
    
    // Animate the counter (for CPU)
    animateCounter(cpuElement, cpuUsage, '%');
    
    // For RAM usage in MB
    animateCounter(ramElement, ramUsage, ' MB');
  }
}

// Counter animation function
function animateCounter(element, targetValue, suffix) {
  const currentValue = parseInt(element.textContent);
  const diff = targetValue - currentValue;
  const duration = 1000; // 1 second
  const startTime = performance.now();
  
  function updateCounter(currentTime) {
    const elapsedTime = currentTime - startTime;
    
    if (elapsedTime < duration) {
      const progress = elapsedTime / duration;
      // Easing function for smooth animation
      const easedProgress = cubicBezier(0.42, 0, 0.58, 1, progress);
      const newValue = Math.floor(currentValue + (diff * easedProgress));
      element.textContent = `${newValue}${suffix}`;
      requestAnimationFrame(updateCounter);
    } else {
      element.textContent = `${targetValue}${suffix}`;
    }
  }
  
  requestAnimationFrame(updateCounter);
}

// Cubic bezier easing function
function cubicBezier(x1, y1, x2, y2, t) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  
  function sampleCurveX(t) {
    return ((ax * t + bx) * t + cx) * t;
  }
  
  function sampleCurveY(t) {
    return ((ay * t + by) * t + cy) * t;
  }
  
  function solveCurveX(x) {
    let t0 = 0;
    let t1 = 1;
    let t2 = x;
    
    for (let i = 0; i < 8; i++) {
      const x2 = sampleCurveX(t2);
      if (Math.abs(x2 - x) < 0.001) {
        return t2;
      }
      const d2 = (3 * ax * t2 + 2 * bx) * t2 + cx;
      if (Math.abs(d2) < 1e-6) {
        break;
      }
      t2 = t2 - (x2 - x) / d2;
    }
    
    // Fall back to bisection
    while (t0 < t1) {
      const x2 = sampleCurveX(t2);
      if (Math.abs(x2 - x) < 0.001) {
        return t2;
      }
      if (x > x2) {
        t0 = t2;
      } else {
        t1 = t2;
      }
      t2 = (t1 - t0) * 0.5 + t0;
    }
    
    return t2;
  }
  
  return sampleCurveY(solveCurveX(t));
}

// Server card hover effects
function initServerCards() {
  const serverCards = document.querySelectorAll('.server-card');
  
  serverCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-8px)';
      card.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.3), 0 0 15px rgba(0, 255, 213, 0.4)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
    });
  });
}

// Server actions
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
      showToast(data.message, 'success');
      document.getElementById(`status-${serverId}`).textContent = 'running';
      document.getElementById(`status-${serverId}`).className = 'server-status status-running';
      
      // Update buttons
      const actionBtns = document.querySelector(`#status-${serverId}`).closest('.server-card').querySelector('.server-actions');
      actionBtns.innerHTML = actionBtns.innerHTML.replace(
        `<button onclick="startServer(${serverId})" class="btn btn-success">Start</button>`,
        `<button onclick="stopServer(${serverId})" class="btn btn-danger">Stop</button>`
      );
    } else {
      showToast(data.message, 'error');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    showToast('Terjadi kesalahan saat menjalankan server', 'error');
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
      showToast(data.message, 'success');
      document.getElementById(`status-${serverId}`).textContent = 'stopped';
      document.getElementById(`status-${serverId}`).className = 'server-status status-stopped';
      
      // Update buttons
      const actionBtns = document.querySelector(`#status-${serverId}`).closest('.server-card').querySelector('.server-actions');
      actionBtns.innerHTML = actionBtns.innerHTML.replace(
        `<button onclick="stopServer(${serverId})" class="btn btn-danger">Stop</button>`,
        `<button onclick="startServer(${serverId})" class="btn btn-success">Start</button>`
      );
    } else {
      showToast(data.message, 'error');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    showToast('Terjadi kesalahan saat menghentikan server', 'error');
  });
}

function deleteServer(serverId) {
  if (confirm('Apakah Anda yakin ingin menghapus server ini? Tindakan ini tidak dapat dibatalkan.')) {
    document.getElementById(`delete-form-${serverId}`).submit();
  }
}

// Initialize dashboard
function initDashboard() {
  if (document.getElementById('dashboard-page')) {
    // Initialize system info
    updateSystemInfo();
    setInterval(updateSystemInfo, 5000);
    
    // Initialize server cards
    initServerCards();
    
    // Add typing animation to welcome message
    const welcomeMsg = document.querySelector('.card-header span');
    if (welcomeMsg) {
      const originalText = welcomeMsg.textContent;
      welcomeMsg.textContent = '';
      
      const typingSpeed = 50; // ms per character
      let charIndex = 0;
      
      const typingInterval = setInterval(() => {
        if (charIndex < originalText.length) {
          welcomeMsg.textContent += originalText.charAt(charIndex);
          charIndex++;
        } else {
          clearInterval(typingInterval);
          welcomeMsg.style.borderRight = 'none';
        }
      }, typingSpeed);
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);
