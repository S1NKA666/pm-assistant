function checkStatus() {
  const backendVal = document.getElementById('backend-status');
  const jiraVal = document.getElementById('jira-status');

  backendVal.innerText = 'Checking...';
  backendVal.className = 'status-val disconnected';
  jiraVal.innerText = 'Checking...';
  jiraVal.className = 'status-val disconnected';

  // 1. Проверяем бэкенд
  fetch('http://localhost:5000/api/settings')
    .then(response => {
      if (response.ok) {
        backendVal.innerText = 'Connected';
        backendVal.className = 'status-val connected';
        
        // 2. Проверяем Jira
        return fetch('http://localhost:5000/api/jira/test');
      } else {
        throw new Error('Backend responded with error');
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data && data.success) {
        jiraVal.innerText = 'Connected';
        jiraVal.className = 'status-val connected';
      } else {
        jiraVal.innerText = data.error || 'Failed';
        jiraVal.className = 'status-val disconnected';
      }
    })
    .catch(err => {
      console.error(err);
      backendVal.innerText = 'Offline';
      backendVal.className = 'status-val disconnected';
      jiraVal.innerText = 'Offline';
      jiraVal.className = 'status-val disconnected';
    });
}

document.getElementById('check-btn').addEventListener('click', checkStatus);

document.getElementById('open-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:5173' }); // По умолчанию адрес Vite-React
});

// Проверить при открытии
document.addEventListener('DOMContentLoaded', checkStatus);
