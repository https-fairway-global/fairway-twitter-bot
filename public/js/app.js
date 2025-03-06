document.addEventListener('DOMContentLoaded', function() {
  console.log('App initialized');
  
  // Button event handlers
  setupButtonHandlers();
  
  // Load initial data
  loadSchedules();
  loadDashboardData();
});

// Set up event handlers for all buttons
function setupButtonHandlers() {
  // Schedule buttons
  const optimizeSchedulesBtn = document.getElementById('optimizeSchedules');
  const addScheduleBtn = document.getElementById('addSchedule');
  const saveScheduleBtn = document.getElementById('saveSchedule');
  
  // Manual action buttons
  const triggerTweetBtn = document.getElementById('triggerTweet');
  const collectMetricsBtn = document.getElementById('collectMetrics');
  const checkMentionsBtn = document.getElementById('checkMentions');
  const triggerAutoFollowBtn = document.getElementById('triggerAutoFollow');
  
  // Add event listeners if elements exist
  if (optimizeSchedulesBtn) {
    optimizeSchedulesBtn.addEventListener('click', optimizeSchedules);
  }
  
  if (addScheduleBtn) {
    addScheduleBtn.addEventListener('click', showAddScheduleModal);
  }
  
  if (saveScheduleBtn) {
    saveScheduleBtn.addEventListener('click', saveSchedule);
  }
  
  if (triggerTweetBtn) {
    triggerTweetBtn.addEventListener('click', createTweetNow);
  }
  
  if (collectMetricsBtn) {
    collectMetricsBtn.addEventListener('click', collectMetricsNow);
  }
  
  if (checkMentionsBtn) {
    checkMentionsBtn.addEventListener('click', checkMentionsNow);
  }
  
  if (triggerAutoFollowBtn) {
    triggerAutoFollowBtn.addEventListener('click', runAutoFollowNow);
  }
}

// Button action functions
function optimizeSchedules() {
  console.log('Optimizing schedules...');
  // Call API endpoint
  fetch('/api/schedules/optimize', {
    method: 'POST',
  })
  .then(response => response.json())
  .then(data => {
    alert('Schedules optimized successfully!');
    loadSchedules(); // Reload schedules after optimization
  })
  .catch(error => {
    console.error('Error optimizing schedules:', error);
    alert('Failed to optimize schedules. Check console for details.');
  });
}

function showAddScheduleModal() {
  console.log('Showing add schedule modal...');
  // Reset form
  document.getElementById('scheduleForm').reset();
  document.getElementById('scheduleId').value = ''; // Clear hidden ID for new schedule
  document.getElementById('scheduleModalTitle').textContent = 'Add Schedule';
  
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
  modal.show();
}

function saveSchedule() {
  console.log('Saving schedule...');
  const scheduleId = document.getElementById('scheduleId').value;
  const cronExpression = document.getElementById('cronExpression').value;
  const topicPreference = document.getElementById('topicPreference').value;
  const isActive = document.getElementById('scheduleActive').checked;
  
  if (!cronExpression) {
    alert('Please enter a cron expression');
    return;
  }
  
  const scheduleData = {
    id: scheduleId || undefined,
    cronExpression,
    topicPreference,
    active: isActive
  };
  
  // Call API endpoint
  fetch('/api/schedules', {
    method: scheduleId ? 'PUT' : 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(scheduleData),
  })
  .then(response => response.json())
  .then(data => {
    alert('Schedule saved successfully!');
    loadSchedules(); // Reload schedules after saving
    
    // Hide modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('scheduleModal'));
    modal.hide();
  })
  .catch(error => {
    console.error('Error saving schedule:', error);
    alert('Failed to save schedule. Check console for details.');
  });
}

function editSchedule(scheduleId) {
  console.log('Editing schedule:', scheduleId);
  
  // Get schedule data
  fetch(`/api/schedules/${scheduleId}`)
  .then(response => response.json())
  .then(schedule => {
    // Populate form
    document.getElementById('scheduleId').value = schedule.id;
    document.getElementById('cronExpression').value = schedule.cronExpression;
    document.getElementById('topicPreference').value = schedule.topicPreference;
    document.getElementById('scheduleActive').checked = schedule.active;
    
    // Update modal title
    document.getElementById('scheduleModalTitle').textContent = 'Edit Schedule';
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
    modal.show();
  })
  .catch(error => {
    console.error('Error fetching schedule:', error);
    alert('Failed to fetch schedule data. Check console for details.');
  });
}

function deleteSchedule(scheduleId) {
  if (confirm('Are you sure you want to delete this schedule?')) {
    console.log('Deleting schedule:', scheduleId);
    
    // Call API endpoint
    fetch(`/api/schedules/${scheduleId}`, {
      method: 'DELETE',
    })
    .then(response => response.json())
    .then(data => {
      alert('Schedule deleted successfully!');
      loadSchedules(); // Reload schedules after deletion
    })
    .catch(error => {
      console.error('Error deleting schedule:', error);
      alert('Failed to delete schedule. Check console for details.');
    });
  }
}

function createTweetNow() {
  console.log('Creating tweet now...');
  
  // Call API endpoint
  fetch('/api/tweet/create', {
    method: 'POST',
  })
  .then(response => response.json())
  .then(data => {
    alert('Tweet created successfully!');
  })
  .catch(error => {
    console.error('Error creating tweet:', error);
    alert('Failed to create tweet. Check console for details.');
  });
}

function collectMetricsNow() {
  console.log('Collecting metrics now...');
  
  // Call API endpoint
  fetch('/api/analytics/collect', {
    method: 'POST',
  })
  .then(response => response.json())
  .then(data => {
    alert('Metrics collection started!');
  })
  .catch(error => {
    console.error('Error collecting metrics:', error);
    alert('Failed to collect metrics. Check console for details.');
  });
}

function checkMentionsNow() {
  console.log('Checking mentions now...');
  
  // Call API endpoint
  fetch('/user-interactions/check-mentions')
  .then(response => response.json())
  .then(data => {
    alert('Mentions check completed!');
  })
  .catch(error => {
    console.error('Error checking mentions:', error);
    alert('Failed to check mentions. Check console for details.');
  });
}

function runAutoFollowNow() {
  console.log('Running auto-follow now...');
  
  // Call API endpoint
  fetch('/api/tweet/auto-follow', {
    method: 'POST',
  })
  .then(response => response.json())
  .then(data => {
    alert('Auto-follow process completed! ' + (data.message || ''));
  })
  .catch(error => {
    console.error('Error running auto-follow:', error);
    alert('Failed to run auto-follow. Check console for details.');
  });
}

// Load data functions
function loadSchedules() {
  console.log('Loading schedules...');
  
  fetch('/api/schedules')
  .then(response => response.json())
  .then(schedules => {
    const schedulesTable = document.getElementById('schedulesTable');
    if (!schedulesTable) return;
    
    schedulesTable.innerHTML = '';
    
    schedules.forEach(schedule => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td>${schedule.id}</td>
        <td>${schedule.cronExpression}</td>
        <td>${schedule.topicPreference || 'Random'}</td>
        <td>
          <span class="badge ${schedule.active ? 'bg-success' : 'bg-danger'}">
            ${schedule.active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>${schedule.lastRun ? new Date(schedule.lastRun).toLocaleString() : 'Never'}</td>
        <td>
          <button class="btn btn-sm btn-primary btn-icon me-1" onclick="editSchedule('${schedule.id}')">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteSchedule('${schedule.id}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
      
      schedulesTable.appendChild(row);
    });
    
    if (schedules.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="6" class="text-center">No schedules found</td>';
      schedulesTable.appendChild(row);
    }
  })
  .catch(error => {
    console.error('Error loading schedules:', error);
  });
}

function loadDashboardData() {
  console.log('Loading dashboard data...');
  
  fetch('/dashboard/api/data')
  .then(response => response.json())
  .then(data => {
    // Update summary stats
    updateSummaryStats(data.summary);
    
    // Update charts if Chart.js is available
    if (typeof Chart !== 'undefined') {
      updateEngagementChart(data.recentTweets);
      updateTopicPerformanceChart(data.topicPerformance);
    }
  })
  .catch(error => {
    console.error('Error loading dashboard data:', error);
  });
}

function updateSummaryStats(summary) {
  // Update summary statistics on the dashboard
  const elements = {
    totalTweets: document.getElementById('totalTweets'),
    totalEngagements: document.getElementById('totalEngagements'),
    avgEngagementRate: document.getElementById('avgEngagementRate'),
    bestTopic: document.getElementById('bestTopic')
  };
  
  // Update elements if they exist
  for (const [key, element] of Object.entries(elements)) {
    if (element && summary[key] !== undefined) {
      if (key === 'avgEngagementRate') {
        element.textContent = summary[key].toFixed(2) + '%';
      } else {
        element.textContent = summary[key];
      }
    }
  }
}

// Make functions globally available for onclick handlers
window.editSchedule = editSchedule;
window.deleteSchedule = deleteSchedule; 