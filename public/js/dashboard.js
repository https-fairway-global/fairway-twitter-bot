document.addEventListener('DOMContentLoaded', function() {
  console.log('Dashboard initialized');
  
  // Format timestamps to be more readable
  const timestamps = document.querySelectorAll('small');
  timestamps.forEach(timestamp => {
    const date = new Date(timestamp.textContent);
    if (!isNaN(date)) {
      timestamp.textContent = formatDate(date);
    }
  });
  
  // Format percentages to have 2 decimal places
  const percentages = document.querySelectorAll('.card-title, strong');
  percentages.forEach(element => {
    if (element.textContent.includes('%')) {
      const value = parseFloat(element.textContent);
      if (!isNaN(value)) {
        element.textContent = value.toFixed(2) + '%';
      }
    }
  });
});

function formatDate(date) {
  // Format date as MM/DD/YYYY HH:MM
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${formatTime(date)}`;
}

function formatTime(date) {
  // Format time as HH:MM AM/PM
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12
  
  return `${hours}:${minutes} ${ampm}`;
} 