// Content script that runs on web pages to rotate videos or the entire page

// Keep track of the current state
let currentState = {
  degrees: 0,
  target: 'video',
  videoIndex: -1,
  isRemoteOnly: true,
  rotateLocalVideo: false,
  localVideoDegrees: 0
};

// Store references to wrapped videos
const wrappedVideos = new Map();

// Function to identify if a video is likely a local/self video
function isLocalVideo(video) {
  // Common patterns for local videos in video conferencing apps
  // 1. Size - local videos are often smaller
  const isSmall = video.offsetWidth < 200 || video.offsetHeight < 200;
  
  // 2. Position - local videos are often in corners
  const rect = video.getBoundingClientRect();
  const isInCorner = (
    (rect.right > window.innerWidth - 250 && rect.bottom > window.innerHeight - 250) || // bottom right
    (rect.left < 250 && rect.bottom > window.innerHeight - 250) // bottom left
  );
  
  // 3. Classes/attributes that might indicate local video
  const hasLocalClasses = video.className.toLowerCase().includes('local') || 
                         video.className.toLowerCase().includes('self') ||
                         video.className.toLowerCase().includes('user');
  
  // Return true if the video matches multiple criteria
  return (isSmall && isInCorner) || hasLocalClasses;
}

// Function to get all videos on the page
function getVideos() {
  const allVideos = Array.from(document.querySelectorAll('video'));
  
  if (currentState.isRemoteOnly) {
    // Filter out local videos
    return allVideos.filter(video => !isLocalVideo(video));
  }
  
  return allVideos;
}

// Function to get local videos on the page
function getLocalVideos() {
  const allVideos = Array.from(document.querySelectorAll('video'));
  return allVideos.filter(video => isLocalVideo(video));
}

// Function to create a wrapper for a video element
function createVideoWrapper(video) {
  // Check if this video is already wrapped
  if (wrappedVideos.has(video)) {
    return wrappedVideos.get(video);
  }
  
  // Create wrapper element
  const wrapper = document.createElement('div');
  wrapper.className = 'video-rotate-wrapper';
  
  // Set wrapper style to maintain video dimensions and positioning
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  wrapper.style.display = 'flex';
  wrapper.style.justifyContent = 'center';
  wrapper.style.alignItems = 'center';
  wrapper.style.overflow = 'hidden';
  wrapper.style.position = 'relative';
  
  // Clone the video's computed styles to the wrapper
  const videoStyles = window.getComputedStyle(video);
  if (videoStyles.position === 'absolute' || videoStyles.position === 'fixed') {
    wrapper.style.position = videoStyles.position;
    wrapper.style.top = videoStyles.top;
    wrapper.style.left = videoStyles.left;
    wrapper.style.right = videoStyles.right;
    wrapper.style.bottom = videoStyles.bottom;
    wrapper.style.zIndex = videoStyles.zIndex;
  }
  
  // Replace the video with the wrapper
  const parent = video.parentNode;
  parent.insertBefore(wrapper, video);
  wrapper.appendChild(video);
  
  // Adjust video style for proper rotation
  video.style.maxWidth = '100%';
  video.style.maxHeight = '100%';
  video.style.objectFit = 'contain';
  
  // Store the wrapper reference
  wrappedVideos.set(video, wrapper);
  
  return wrapper;
}

// Function to apply rotation to a video
function rotateVideo(video, degrees) {
  const wrapper = createVideoWrapper(video);
  
  // Reset any previous transformations
  video.style.transform = '';
  wrapper.style.transform = '';
  
  if (degrees === 0) {
    // Reset to original state
    video.style.maxWidth = '100%';
    video.style.maxHeight = '100%';
    return;
  }
  
  // Apply rotation transformation
  video.style.transform = `rotate(${degrees}deg)`;
  
  // Adjust dimensions based on rotation angle
  if (degrees === 90 || degrees === 270) {
    // For 90° or 270° rotations, swap width and height constraints
    const aspectRatio = video.videoWidth / video.videoHeight;
    
    if (aspectRatio > 1) {
      // Landscape video being rotated to portrait orientation
      video.style.maxWidth = '100%';
      video.style.maxHeight = 'none';
      video.style.width = 'auto';
      video.style.height = '100%';
    } else {
      // Portrait video being rotated to landscape orientation
      video.style.maxHeight = '100%';
      video.style.maxWidth = 'none';
      video.style.height = 'auto';
      video.style.width = '100%';
    }
    
    // Scale to fit
    wrapper.style.transform = 'scale(0.8)';
  }
}

// Function to rotate the entire page
function rotatePage(degrees) {
  // Remove any existing rotation class
  document.body.classList.remove('rotate-90', 'rotate-180', 'rotate-270');
  
  if (degrees === 0) {
    return;
  }
  
  // Add the appropriate rotation class
  document.body.classList.add(`rotate-${degrees}`);
}

// Function to apply rotation based on current state
function applyRotation() {
  if (currentState.target === 'video') {
    // Get all videos
    const videos = getVideos();
    
    // Reset all videos first
    videos.forEach(video => rotateVideo(video, 0));
    
    // Apply rotation to specific or all videos
    if (currentState.videoIndex >= 0 && currentState.videoIndex < videos.length) {
      // Rotate specific video
      rotateVideo(videos[currentState.videoIndex], currentState.degrees);
    } else {
      // Rotate all videos
      videos.forEach(video => rotateVideo(video, currentState.degrees));
    }
    
    // Handle local video rotation if enabled
    if (currentState.rotateLocalVideo) {
      const localVideos = getLocalVideos();
      localVideos.forEach(video => rotateVideo(video, currentState.localVideoDegrees));
    }
  } else {
    // Rotate the entire page
    rotatePage(currentState.degrees);
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  switch (request.action) {
    case 'rotate':
      currentState.degrees = request.degrees;
      currentState.target = request.target;
      currentState.videoIndex = request.videoIndex;
      currentState.isRemoteOnly = request.isRemoteOnly;
      
      // Apply the rotation
      applyRotation();
      
      sendResponse({success: true});
      break;
      
    case 'rotateLocal':
      currentState.rotateLocalVideo = request.enabled;
      currentState.localVideoDegrees = request.degrees;
      
      // Apply local video rotation
      const rotateLocalVideos = getLocalVideos(); // Renamed to avoid conflict
      if (request.enabled) {
        rotateLocalVideos.forEach(video => rotateVideo(video, request.degrees));
      } else {
        rotateLocalVideos.forEach(video => rotateVideo(video, 0));
      }
      
      sendResponse({success: true});
      break;
      
    case 'getVideoCount':
      const videos = getVideos();
      sendResponse({count: videos.length});
      break;
      
    case 'getLocalVideoCount':
      const localVideos = getLocalVideos(); // This declaration conflicts with the one above
      sendResponse({count: localVideos.length});
      break;
      
    case 'setRemoteOnly':
      currentState.isRemoteOnly = request.isRemoteOnly;
      applyRotation();
      sendResponse({success: true});
      break;
      
    case 'getState':
      sendResponse(currentState);
      break;
  }
  
  return true; // Keep the message channel open for async responses
});

// Add CSS for page rotation
const style = document.createElement('style');
style.textContent = `
  .rotate-90 {
    transform: rotate(90deg);
    transform-origin: center center;
    height: 100vw;
    width: 100vh;
    overflow: auto;
    position: absolute;
    top: 0;
    left: 0;
  }
  
  .rotate-180 {
    transform: rotate(180deg);
    transform-origin: center center;
  }
  
  .rotate-270 {
    transform: rotate(270deg);
    transform-origin: center center;
    height: 100vw;
    width: 100vh;
    overflow: auto;
    position: absolute;
    top: 0;
    left: 0;
  }
`;
document.head.appendChild(style);

// Apply rotation on page load if there's a saved state
applyRotation();


// New function to intercept and transform getUserMedia
function setupMediaStreamHook() {
  // Store the original getUserMedia function
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
  
  // Replace getUserMedia with our custom version
  navigator.mediaDevices.getUserMedia = async function(constraints) {
    // Call the original method to get the stream
    const originalStream = await originalGetUserMedia.call(this, constraints);
    
    // Only process if video is requested and we want to rotate local video
    if (constraints.video && currentState.rotateLocalVideo) {
      try {
        // Create video element to receive the original stream
        const videoElement = document.createElement('video');
        videoElement.srcObject = originalStream;
        videoElement.autoplay = true;
        videoElement.muted = true;
        
        // Wait for video to be ready
        await new Promise(resolve => {
          videoElement.onloadedmetadata = () => {
            videoElement.play();
            resolve();
          };
        });
        
        // Create a canvas to draw the rotated video
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas dimensions to match video
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        
        // Function to draw rotated video frames to canvas
        function drawRotatedVideo() {
          // Clear the canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Save the canvas state
          ctx.save();
          
          // Translate to center of canvas
          ctx.translate(canvas.width / 2, canvas.height / 2);
          
          // Rotate by the specified degrees
          ctx.rotate((currentState.localVideoDegrees * Math.PI) / 180);
          
          // Draw the video frame (centered)
          ctx.drawImage(
            videoElement,
            -canvas.width / 2,
            -canvas.height / 2,
            canvas.width,
            canvas.height
          );
          
          // Restore canvas state
          ctx.restore();
          
          // Schedule the next frame
          requestAnimationFrame(drawRotatedVideo);
        }
        
        // Start drawing frames
        drawRotatedVideo();
        
        // Capture the canvas as a stream
        const transformedStream = canvas.captureStream();
        
        // Add audio tracks from original stream to the transformed stream
        originalStream.getAudioTracks().forEach(track => {
          transformedStream.addTrack(track);
        });
        
        // Return the transformed stream instead of the original
        return transformedStream;
      } catch (error) {
        console.error('Error transforming webcam stream:', error);
        // Fall back to original stream if there's an error
        return originalStream;
      }
    }
    
    // If no video constraints or rotation not enabled, return original stream
    return originalStream;
  };
  
  console.log('MediaStream hook installed - webcam rotation enabled');
}

// Initialize the media stream hook when the extension loads
setupMediaStreamHook();