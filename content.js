// Content script to handle rotation of page elements

// Store the current state
let currentState = {
  degrees: 0,
  target: 'video',
  selectedVideoIndex: -1, // -1 means no specific video selected
  isRemoteOnly: true // Default to rotating only remote videos (not local/self video)
};

// Function to apply rotation to videos only
function rotateVideos(degrees) {
  const videos = document.querySelectorAll('video');
  
  // If we have a specific video selected, only rotate that one
  if (currentState.selectedVideoIndex >= 0 && currentState.selectedVideoIndex < videos.length) {
    applyRotationToVideo(videos[currentState.selectedVideoIndex], degrees);
  } else {
    // Otherwise rotate all applicable videos
    videos.forEach(video => {
      applyRotationToVideo(video, degrees);
    });
  }
  
  // Add a mutation observer to handle dynamically added videos (common in video calls)
  setupVideoObserver();
  
  return true;
}

// Set up a mutation observer to catch new videos added to the DOM
function setupVideoObserver() {
  // If we already have an observer, no need to create another
  if (window._videoObserver) return;
  
  // Create a new observer
  window._videoObserver = new MutationObserver(mutations => {
    let newVideosFound = false;
    
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(node => {
          // Check if the added node is a video
          if (node.nodeName === 'VIDEO') {
            newVideosFound = true;
            if (currentState.degrees !== 0) {
              applyRotationToVideo(node, currentState.degrees);
            }
          }
          // Check if the added node contains videos
          else if (node.nodeType === 1) { // Element node
            const videos = node.querySelectorAll('video');
            if (videos.length) {
              newVideosFound = true;
              if (currentState.degrees !== 0) {
                videos.forEach(video => applyRotationToVideo(video, currentState.degrees));
              }
            }
          }
        });
      }
    });
  });
  
  // Start observing the document with the configured parameters
  window._videoObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Helper function to apply rotation to a single video
function applyRotationToVideo(video, degrees) {
  // Check if this is a local video (user's own video)
  if (currentState.isRemoteOnly && isLocalVideo(video)) {
    return; // Skip rotation for local videos when in remote-only mode
  }

  // Remove any existing rotation classes
  video.classList.remove('rotate-90', 'rotate-180', 'rotate-270');
  
  // Apply new rotation if needed
  if (degrees === 90) {
    video.classList.add('rotate-90');
  } else if (degrees === 180) {
    video.classList.add('rotate-180');
  } else if (degrees === 270) {
    video.classList.add('rotate-270');
  }
  
  // Ensure video is visible and properly sized after rotation
  if (degrees !== 0) {
    // Create or get a wrapper for the video if it doesn't have one
    let wrapper = video.parentElement.classList.contains('video-rotation-wrapper') 
      ? video.parentElement 
      : createVideoWrapper(video);
    
    // Set proper sizing for the video based on rotation angle
    if (degrees === 90 || degrees === 270) {
      // For 90/270 degree rotations, we need to adjust dimensions more carefully
      const videoAspect = video.videoWidth / video.videoHeight;
      const containerAspect = wrapper.clientWidth / wrapper.clientHeight;
      
      // Calculate the best fit dimensions
      if (containerAspect > 1) { // Landscape container
        video.style.width = 'auto';
        video.style.height = '100%';
        video.style.maxWidth = '100vh';
        video.style.maxHeight = '100%';
      } else { // Portrait container
        video.style.width = '100%';
        video.style.height = 'auto';
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100vw';
      }
    } else { // 180 degree rotation
      video.style.maxWidth = '100%';
      video.style.maxHeight = '100%';
      video.style.width = 'auto';
      video.style.height = 'auto';
    }
    
    video.style.objectFit = 'contain';
    
    // Make sure the wrapper is visible and properly configured
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'center';
    wrapper.style.alignItems = 'center';
    wrapper.style.overflow = 'hidden';
  } else {
    // Reset styles when rotation is removed
    video.style.maxWidth = '';
    video.style.maxHeight = '';
    video.style.width = '';
    video.style.height = '';
    video.style.objectFit = '';
    
    // If the video has a wrapper, reset its styles too
    if (video.parentElement.classList.contains('video-rotation-wrapper')) {
      video.parentElement.style.display = '';
      video.parentElement.style.justifyContent = '';
      video.parentElement.style.alignItems = '';
      video.parentElement.style.overflow = '';
    }
  }
}

// Helper function to detect if a video is the local/self video
function isLocalVideo(video) {
  // Common patterns to identify local videos in video conferencing apps
  
  // 1. Check for size - local videos are often smaller
  const isSmallVideo = video.clientWidth < 200 || video.clientHeight < 200;
  
  // 2. Check for position - local videos are often in corners
  const rect = video.getBoundingClientRect();
  const isInCorner = (
    (rect.right > window.innerWidth - 250 && rect.bottom > window.innerHeight - 250) || // Bottom right
    (rect.left < 250 && rect.bottom > window.innerHeight - 250) // Bottom left
  );
  
  // 3. Check for common class names or parent elements that indicate local video
  const hasLocalClasses = (
    video.classList.contains('local') || 
    video.classList.contains('self') ||
    video.classList.contains('user-video') ||
    (video.parentElement && (
      video.parentElement.classList.contains('local-participant') ||
      video.parentElement.classList.contains('self-view')
    ))
  );
  
  // 4. Check for muted attribute - local videos are often muted
  const isMuted = video.muted;
  
  // Combine these checks - if multiple indicators suggest it's a local video
  return (isSmallVideo && isInCorner) || hasLocalClasses || (isSmallVideo && isMuted);
}

// Helper function to create a wrapper for a video
function createVideoWrapper(video) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('video-rotation-wrapper');
  
  // Get original video container dimensions
  const originalWidth = video.clientWidth;
  const originalHeight = video.clientHeight;
  
  // Set wrapper styles
  wrapper.style.width = originalWidth ? `${originalWidth}px` : '100%';
  wrapper.style.height = originalHeight ? `${originalHeight}px` : '100%';
  wrapper.style.display = 'flex';
  wrapper.style.justifyContent = 'center';
  wrapper.style.alignItems = 'center';
  wrapper.style.overflow = 'hidden';
  wrapper.style.position = 'relative';
  
  // Replace video with wrapper containing the video
  video.parentNode.insertBefore(wrapper, video);
  wrapper.appendChild(video);
  
  return wrapper;
}

// Function to apply rotation to the entire page
function rotatePage(degrees) {
  // Remove any existing rotation classes
  document.body.classList.remove('rotate-90', 'rotate-180', 'rotate-270');
  
  // Apply new rotation if needed
  if (degrees === 90) {
    document.body.classList.add('rotate-90');
  } else if (degrees === 180) {
    document.body.classList.add('rotate-180');
  } else if (degrees === 270) {
    document.body.classList.add('rotate-270');
  }
  
  return true;
}

// Function to apply rotation based on target
function applyRotation(degrees, target, videoIndex = -1, isRemoteOnly = true) {
  // Update current state
  currentState.degrees = degrees;
  currentState.target = target;
  currentState.selectedVideoIndex = videoIndex;
  currentState.isRemoteOnly = isRemoteOnly;
  
  // Apply rotation based on target
  if (target === 'video') {
    return rotateVideos(degrees);
  } else if (target === 'page') {
    return rotatePage(degrees);
  }
  
  return false;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'rotate') {
    const success = applyRotation(
      request.degrees, 
      request.target, 
      request.videoIndex,
      request.isRemoteOnly !== undefined ? request.isRemoteOnly : true // Default to remote-only if not specified
    );
    sendResponse({success: success});
  } else if (request.action === 'getState') {
    sendResponse(currentState);
  } else if (request.action === 'getVideoCount') {
    // Return the count of applicable video elements on the page
    let videoCount = 0;
    const videos = document.querySelectorAll('video');
    
    // If we're in remote-only mode, only count remote videos
    if (currentState.isRemoteOnly) {
      videos.forEach(video => {
        if (!isLocalVideo(video)) {
          videoCount++;
        }
      });
    } else {
      videoCount = videos.length;
    }
    
    sendResponse({count: videoCount});
  } else if (request.action === 'setRemoteOnly') {
    // Update the remote-only setting
    currentState.isRemoteOnly = request.isRemoteOnly;
    
    // If we have an active rotation, reapply it with the new setting
    if (currentState.degrees !== 0) {
      applyRotation(
        currentState.degrees,
        currentState.target,
        currentState.selectedVideoIndex,
        currentState.isRemoteOnly
      );
    }
    
    sendResponse({success: true});
  }
  return true; // Keep the message channel open for async responses
});

// Initialize when the content script is injected
function initialize() {
  // Check if we need to apply rotation (e.g., if the user refreshed the page)
  if (currentState.degrees !== 0) {
    applyRotation(currentState.degrees, currentState.target, currentState.selectedVideoIndex);
  }
}

// Run initialization
initialize();