// Popup script to handle user interactions and communicate with content script

// Store the current rotation state
let currentRotation = 0;
let targetMode = 'video'; // Default to rotating videos only
let selectedVideoIndex = -1; // -1 means no specific video selected
let totalVideos = 0; // Total number of videos on the page
let isRemoteOnly = true; // Default to rotating only remote videos (not local/self video)

// Function to update status message
function updateStatus(message) {
  document.getElementById('status').textContent = message;
}

// Function to send rotation command to the active tab
function applyRotation(degrees, target, videoIndex = -1) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'rotate',
      degrees: degrees,
      target: target,
      videoIndex: videoIndex,
      isRemoteOnly: isRemoteOnly
    }, function(response) {
      if (response && response.success) {
        let statusMessage = `Applied ${degrees}° rotation to `;
        if (target === 'video') {
          if (videoIndex >= 0) {
            statusMessage += `video ${videoIndex + 1} of ${totalVideos}.`;
          } else {
            statusMessage += isRemoteOnly ? 'remote videos only.' : 'all videos.';
          }
        } else {
          statusMessage += 'entire page.';
        }
        updateStatus(statusMessage);
        currentRotation = degrees;
      } else {
        updateStatus('Failed to apply rotation. Try refreshing the page.');
      }
    });
  });
}

// Function to update the video counter display
function updateVideoCounter() {
  document.getElementById('videoCounter').textContent = 
    `Video ${selectedVideoIndex + 1} of ${totalVideos}`;
}

// Function to check how many videos are on the page
function checkVideoCount() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'getVideoCount',
      isRemoteOnly: isRemoteOnly
    }, function(response) {
      if (response && response.count !== undefined) {
        totalVideos = response.count;
        
        // Update UI based on video count
        const videoSelectionGroup = document.getElementById('videoSelectionGroup');
        if (totalVideos > 0) {
          videoSelectionGroup.style.display = 'block';
          
          // Initialize selected video if not already set
          if (selectedVideoIndex < 0 || selectedVideoIndex >= totalVideos) {
            selectedVideoIndex = 0;
          }
          
          updateVideoCounter();
          updateStatus(`Found ${totalVideos} ${isRemoteOnly ? 'remote ' : ''}video${totalVideos !== 1 ? 's' : ''}`);
        } else {
          videoSelectionGroup.style.display = 'none';
          updateStatus(`No ${isRemoteOnly ? 'remote ' : ''}videos found on this page.`);
        }
      }
    });
  });
}

// Initialize popup and add event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Rotation buttons
  document.getElementById('rotate90').addEventListener('click', function() {
    applyRotation(90, targetMode);
  });
  
  document.getElementById('rotate180').addEventListener('click', function() {
    applyRotation(180, targetMode);
  });
  
  document.getElementById('rotate270').addEventListener('click', function() {
    applyRotation(270, targetMode);
  });
  
  document.getElementById('reset').addEventListener('click', function() {
    applyRotation(0, targetMode);
  });
  
  // Target selection buttons
  document.getElementById('rotateVideo').addEventListener('click', function() {
    targetMode = 'video';
    updateStatus('Target mode set to videos only');
    // Check for videos on the page
    checkVideoCount();
    // Apply current rotation to new target
    if (currentRotation !== 0) {
      applyRotation(currentRotation, targetMode, selectedVideoIndex);
    }
  });
  
  document.getElementById('rotateAll').addEventListener('click', function() {
    targetMode = 'page';
    document.getElementById('videoSelectionGroup').style.display = 'none';
    updateStatus('Target mode set to entire page');
    // Apply current rotation to new target
    if (currentRotation !== 0) {
      applyRotation(currentRotation, targetMode);
    }
  });
  
  // Remote-only toggle
  document.getElementById('remoteOnlyToggle').addEventListener('change', function() {
    isRemoteOnly = this.checked;
    
    // Send message to update the content script
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'setRemoteOnly',
        isRemoteOnly: isRemoteOnly
      });
    });
    
    updateStatus(`Set to rotate ${isRemoteOnly ? 'only remote' : 'all'} videos`);
    
    // Reapply current rotation with new setting
    if (currentRotation !== 0 && targetMode === 'video') {
      applyRotation(currentRotation, targetMode, selectedVideoIndex);
    }
    
    // Refresh video count as it may change with the new filter
    checkVideoCount();
  });
  
  // Video selection navigation
  document.getElementById('prevVideo').addEventListener('click', function() {
    if (totalVideos > 0) {
      selectedVideoIndex = (selectedVideoIndex - 1 + totalVideos) % totalVideos;
      updateVideoCounter();
      updateStatus(`Selected video ${selectedVideoIndex + 1} of ${totalVideos}`);
      
      // Apply current rotation to newly selected video
      if (currentRotation !== 0) {
        applyRotation(currentRotation, targetMode, selectedVideoIndex);
      }
    }
  });
  
  document.getElementById('nextVideo').addEventListener('click', function() {
    if (totalVideos > 0) {
      selectedVideoIndex = (selectedVideoIndex + 1) % totalVideos;
      updateVideoCounter();
      updateStatus(`Selected video ${selectedVideoIndex + 1} of ${totalVideos}`);
      
      // Apply current rotation to newly selected video
      if (currentRotation !== 0) {
        applyRotation(currentRotation, targetMode, selectedVideoIndex);
      }
    }
  });
  
  document.getElementById('applyToSelected').addEventListener('click', function() {
    if (totalVideos > 0 && selectedVideoIndex >= 0) {
      applyRotation(currentRotation, 'video', selectedVideoIndex);
    }
  });
  
  // Check current state of the page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: 'getState'}, function(response) {
      if (response) {
        currentRotation = response.degrees || 0;
        targetMode = response.target || 'video';
        updateStatus(`Current rotation: ${currentRotation}° on ${targetMode === 'video' ? 'videos' : 'page'}`);
      }
    });
  });
});