
// File Manager JavaScript
let currentPath = '';
let currentFile = '';
let currentZipFile = '';

// Show tab content
function showTab(tabId) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.style.display = 'none';
  });
  
  // Deactivate all tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab
  document.getElementById(tabId).style.display = 'block';
  
  // Activate the button
  document.querySelector(`.tab-btn[onclick="showTab('${tabId}')"]`).classList.add('active');
  
  // If files tab is selected, load files
  if (tabId === 'files-tab') {
    loadFiles(currentPath);
  }
}

// Load files from server
function loadFiles(path = '') {
  currentPath = path;
  document.getElementById('current-path').textContent = path ? path : '/ (root)';
  
  const fileListBody = document.getElementById('file-list-body');
  fileListBody.innerHTML = `
    <div class="loading-files">
      <div class="spinner"></div>
      <p>Loading files...</p>
    </div>
  `;
  
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  
  // Fetch files
  fetch(`/servers/${serverId}/files?dir=${path}`)
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        showToast(data.message, 'error');
        return;
      }
      
      // Sort files: directories first, then alphabetically
      const sortedFiles = data.files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      
      // Render file list
      let html = '';
      
      // Add parent directory entry if not in root
      if (path) {
        html += `
          <div class="file-item directory" onclick="navigateToParent()">
            <div class="file-name">
              <span class="file-icon">📁</span>
              ..
            </div>
            <div class="file-size"></div>
            <div class="file-modified"></div>
            <div class="file-action-buttons"></div>
          </div>
        `;
      }
      
      // Add files and directories
      sortedFiles.forEach(file => {
        const fileIcon = file.isDirectory ? '📁' : getFileIcon(file.name);
        const fileSize = file.isDirectory ? '-' : formatFileSize(file.size);
        const modified = new Date(file.modified).toLocaleString();
        const filePath = path ? `${path}/${file.name}` : file.name;
        
        html += `
          <div class="file-item ${file.isDirectory ? 'directory' : ''}" data-path="${filePath}">
            <div class="file-name" onclick="${file.isDirectory ? `loadFiles('${filePath}')` : `viewFile('${filePath}')`}">
              <span class="file-icon">${fileIcon}</span>
              ${file.name}
            </div>
            <div class="file-size">${fileSize}</div>
            <div class="file-modified">${modified}</div>
            <div class="file-action-buttons">
              ${file.isDirectory ? '' : `<button class="file-action-btn" onclick="editFile('${filePath}')">Edit</button>`}
              ${file.name.endsWith('.zip') ? `<button class="file-action-btn" onclick="unzipFile('${filePath}')">Unzip</button>` : ''}
              <button class="file-action-btn" onclick="renameFile('${filePath}')">Rename</button>
              <button class="file-action-btn" onclick="deleteFile('${filePath}')">Delete</button>
            </div>
          </div>
        `;
      });
      
      // Update file list
      fileListBody.innerHTML = html || `<p style="text-align: center; padding: 1rem;">No files found</p>`;
    })
    .catch(error => {
      console.error('Error loading files:', error);
      fileListBody.innerHTML = `<p style="text-align: center; padding: 1rem; color: #ff3860;">Error loading files: ${error.message}</p>`;
    });
}

// Navigate to parent directory
function navigateToParent() {
  const pathParts = currentPath.split('/');
  pathParts.pop();
  const parentPath = pathParts.join('/');
  loadFiles(parentPath);
}

// Get appropriate icon for file type
function getFileIcon(fileName) {
  const extension = fileName.split('.').pop().toLowerCase();
  
  // Define icons based on file extension
  const icons = {
    js: '📜',
    py: '🐍',
    txt: '📝',
    json: '📊',
    html: '🌐',
    css: '🎨',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    pdf: '📑',
    zip: '📦',
    rar: '📦',
    gz: '📦',
    mp3: '🎵',
    mp4: '🎬',
    sh: '⚙️',
    properties: '⚙️'
  };
  
  return icons[extension] || '📄';
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// View file
function viewFile(filePath) {
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  
  // Fetch file content
  fetch(`/servers/${serverId}/file?fileName=${encodeURIComponent(filePath)}`)
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        showToast(data.message, 'error');
        return;
      }
      
      if (data.isDirectory) {
        loadFiles(filePath);
      } else {
        editFile(filePath);
      }
    })
    .catch(error => {
      console.error('Error viewing file:', error);
      showToast('Error viewing file: ' + error.message, 'error');
    });
}

// Edit file
function editFile(filePath) {
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  currentFile = filePath;
  
  // Fetch file content
  fetch(`/servers/${serverId}/file?fileName=${encodeURIComponent(filePath)}`)
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        showToast(data.message, 'error');
        return;
      }
      
      if (data.isDirectory) {
        loadFiles(filePath);
        return;
      }
      
      // Open edit modal
      document.getElementById('edit-modal-title').textContent = `Edit File: ${filePath.split('/').pop()}`;
      document.getElementById('file-editor').value = data.content;
      document.getElementById('edit-modal').style.display = 'block';
    })
    .catch(error => {
      console.error('Error editing file:', error);
      showToast('Error editing file: ' + error.message, 'error');
    });
}

// Save file edit
function saveFileEdit() {
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  const content = document.getElementById('file-editor').value;
  
  // Send to server
  fetch(`/servers/${serverId}/edit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileName: currentFile,
      content: content
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast('File saved successfully', 'success');
        closeModal('edit-modal');
      } else {
        showToast(data.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error saving file:', error);
      showToast('Error saving file: ' + error.message, 'error');
    });
}

// Show unzip dialog
function unzipFile(filePath) {
  currentZipFile = filePath;
  document.getElementById('zip-file-name').textContent = filePath.split('/').pop();
  document.getElementById('unzip-modal').style.display = 'block';
}

// Confirm unzip
function confirmUnzip() {
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  
  // Send to server
  fetch(`/servers/${serverId}/unzip`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileName: currentZipFile
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast('File extracted successfully', 'success');
        closeModal('unzip-modal');
        refreshFiles();
      } else {
        showToast(data.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error extracting file:', error);
      showToast('Error extracting file: ' + error.message, 'error');
    });
}

// Show rename dialog
function renameFile(filePath) {
  currentFile = filePath;
  document.getElementById('new-file-name').value = filePath.split('/').pop();
  document.getElementById('rename-modal').style.display = 'block';
}

// Confirm rename
function confirmRename() {
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  const newName = document.getElementById('new-file-name').value;
  
  if (!newName) {
    showToast('Please enter a valid name', 'error');
    return;
  }
  
  // Calculate paths
  const oldPathParts = currentFile.split('/');
  oldPathParts.pop();
  const parentPath = oldPathParts.join('/');
  const newPath = parentPath ? `${parentPath}/${newName}` : newName;
  
  // Send to server
  fetch(`/servers/${serverId}/rename`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      oldName: currentFile,
      newName: newPath
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast('File renamed successfully', 'success');
        closeModal('rename-modal');
        refreshFiles();
      } else {
        showToast(data.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error renaming file:', error);
      showToast('Error renaming file: ' + error.message, 'error');
    });
}

// Delete file
function deleteFile(filePath) {
  if (!confirm(`Are you sure you want to delete ${filePath}?`)) {
    return;
  }
  
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  
  // Send to server
  fetch(`/servers/${serverId}/delete-file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileName: filePath
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast('File deleted successfully', 'success');
        refreshFiles();
      } else {
        showToast(data.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error deleting file:', error);
      showToast('Error deleting file: ' + error.message, 'error');
    });
}

// Show upload modal
function showUploadModal() {
  document.getElementById('file-upload').value = '';
  document.querySelector('.upload-progress').style.display = 'none';
  document.getElementById('upload-modal').style.display = 'block';
}

// Upload file
function uploadFile() {
  const fileInput = document.getElementById('file-upload');
  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('Please select a file to upload', 'error');
    return;
  }
  
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  
  // Show progress
  const progressBar = document.getElementById('upload-progress-bar');
  const progressText = document.getElementById('upload-progress-text');
  document.querySelector('.upload-progress').style.display = 'flex';
  
  // Upload file
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `/servers/${serverId}/upload`, true);
  
  // Track progress
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      const percentComplete = Math.round((event.loaded / event.total) * 100);
      progressBar.style.width = percentComplete + '%';
      progressText.textContent = percentComplete + '%';
    }
  };
  
  xhr.onload = function() {
    if (xhr.status === 200) {
      const response = JSON.parse(xhr.responseText);
      if (response.success) {
        showToast('File uploaded successfully', 'success');
        closeModal('upload-modal');
        refreshFiles();
      } else {
        showToast(response.message, 'error');
      }
    } else {
      showToast('Upload failed', 'error');
    }
  };
  
  xhr.send(formData);
}

// Create new file
function createNewFile() {
  const fileName = prompt('Enter file name:');
  if (!fileName) return;
  
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
  
  // Send to server
  fetch(`/servers/${serverId}/edit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileName: filePath,
      content: ''
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast('File created successfully', 'success');
        refreshFiles();
        // Open the file for editing
        setTimeout(() => editFile(filePath), 500);
      } else {
        showToast(data.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error creating file:', error);
      showToast('Error creating file: ' + error.message, 'error');
    });
}

// Create new folder
function createNewFolder() {
  const folderName = prompt('Enter folder name:');
  if (!folderName) return;
  
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
  
  // Send to server
  fetch(`/servers/${serverId}/create-folder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      folderPath: folderPath
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast('Folder created successfully', 'success');
        refreshFiles();
      } else {
        showToast(data.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error creating folder:', error);
      showToast('Error creating folder: ' + error.message, 'error');
    });
}

// Refresh files
function refreshFiles() {
  loadFiles(currentPath);
}

// Close modal
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// Show toast notification
function showToast(message, type = 'success') {
  // Check if toast container exists
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '20px';
    toastContainer.style.right = '20px';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }
  
  // Create toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Show toast (with animation)
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// FTP Functions
// Save FTP config
function saveFtpConfig() {
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  
  const ftpHost = document.getElementById('ftp-host').value;
  const ftpPort = document.getElementById('ftp-port').value;
  const ftpUser = document.getElementById('ftp-user').value;
  const ftpPassword = document.getElementById('ftp-password').value;
  
  // Send to server
  fetch(`/servers/${serverId}/ftp/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      host: ftpHost,
      port: ftpPort,
      user: ftpUser,
      password: ftpPassword
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast('FTP configuration saved', 'success');
      } else {
        showToast(data.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error saving FTP config:', error);
      showToast('Error saving FTP config: ' + error.message, 'error');
    });
}

// Test FTP connection
function testFtpConnection() {
  // First save the config
  saveFtpConfig();
  
  // Then test connection
  setTimeout(() => {
    // Get server ID from URL
    const serverId = window.location.pathname.split('/').pop();
    
    // Send to server
    fetch(`/servers/${serverId}/ftp/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showToast('FTP connection successful', 'success');
        } else {
          showToast(data.message, 'error');
        }
      })
      .catch(error => {
        console.error('Error testing FTP connection:', error);
        showToast('Error testing FTP connection: ' + error.message, 'error');
      });
  }, 500);
}

// Connect to FTP
function connectFtp() {
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  
  // Show loading
  document.getElementById('ftp-file-list-body').innerHTML = `
    <div class="loading-files">
      <div class="spinner"></div>
      <p>Connecting to FTP...</p>
    </div>
  `;
  
  // Send to server
  fetch(`/servers/${serverId}/ftp/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast('FTP connection successful', 'success');
        
        // Render FTP files
        let html = '';
        if (data.files && data.files.length > 0) {
          data.files.forEach(file => {
            const fileType = file.type === 'd' ? 'Directory' : 'File';
            const fileIcon = file.type === 'd' ? '📁' : '📄';
            
            html += `
              <div class="file-item">
                <div class="file-name">
                  <span class="file-icon">${fileIcon}</span>
                  ${file.name}
                </div>
                <div class="file-size">${formatFileSize(file.size || 0)}</div>
                <div class="file-type">${fileType}</div>
                <div class="file-action-buttons">
                  <button class="file-action-btn" onclick="downloadFromFtp('${file.name}')">Download</button>
                </div>
              </div>
            `;
          });
        } else {
          html = `<p class="ftp-status">No files found on FTP server.</p>`;
        }
        
        document.getElementById('ftp-file-list-body').innerHTML = html;
      } else {
        document.getElementById('ftp-file-list-body').innerHTML = `<p class="ftp-status">${data.message}</p>`;
        showToast(data.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error connecting to FTP:', error);
      document.getElementById('ftp-file-list-body').innerHTML = `<p class="ftp-status">Error connecting to FTP: ${error.message}</p>`;
      showToast('Error connecting to FTP: ' + error.message, 'error');
    });
}

// Upload to FTP
function uploadToFtp() {
  // First check if FTP is configured
  const ftpHost = document.getElementById('ftp-host').value;
  if (!ftpHost) {
    showToast('Please configure FTP settings first', 'error');
    return;
  }
  
  const localFile = prompt('Enter local file path (relative to server root):', '');
  if (!localFile) return;
  
  const remoteFile = prompt('Enter remote file path:', localFile);
  if (!remoteFile) return;
  
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  
  // Send to server
  fetch(`/servers/${serverId}/ftp/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      localPath: localFile,
      remotePath: remoteFile
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast('File uploaded to FTP successfully', 'success');
        refreshFtp();
      } else {
        showToast(data.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error uploading to FTP:', error);
      showToast('Error uploading to FTP: ' + error.message, 'error');
    });
}

// Download from FTP
function downloadFromFtp(remotePath) {
  const localPath = prompt('Enter local file path (relative to server root):', remotePath);
  if (!localPath) return;
  
  // Get server ID from URL
  const serverId = window.location.pathname.split('/').pop();
  
  // Send to server
  fetch(`/servers/${serverId}/ftp/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      remotePath,
      localPath
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast('File downloaded from FTP successfully', 'success');
      } else {
        showToast(data.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error downloading from FTP:', error);
      showToast('Error downloading from FTP: ' + error.message, 'error');
    });
}

// Refresh FTP connection
function refreshFtp() {
  connectFtp();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Load files on page load
  if (document.getElementById('file-list-body')) {
    loadFiles();
  }
  
  // Add event listeners
  window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
  });
});
