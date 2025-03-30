document.addEventListener('DOMContentLoaded', () => {
  const folderInput = document.getElementById('folderInput');
  const categoryList = document.getElementById('categoryList');
  const songList = document.getElementById('songList');
  const queueList = document.getElementById('queueList');
  const audioPlayer = document.getElementById('audioPlayer');
  const currentSongDisplay = document.getElementById('currentSong');
  const currentCategoryDisplay = document.getElementById('currentCategory');
  const openPreviewButton = document.getElementById('openPreview');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn'); // Basic: restarts song or plays previous if tracked
  const volumeSlider = document.getElementById('volumeSlider');
  const songSearch = document.getElementById('songSearch');
  const clearSearch = document.getElementById('clearSearch');

  // Theme Customization
  const primaryColorInput = document.getElementById('primaryColor');
  const bgColorInput = document.getElementById('bgColor');
  const textColorInput = document.getElementById('textColor');

  // YouTube Modal elements
  const youtubeModal = document.getElementById('youtubeModal');
  const youtubeUrlInput = document.getElementById('youtubeUrl');
  const youtubeSongNameInput = document.getElementById('youtubeSongName');
  const youtubeCategoryInput = document.getElementById('youtubeCategory');
  const youtubeCategoryList = document.getElementById('youtubeCategoryList');
  const addYoutubeRequestBtn = document.getElementById('addYoutubeRequest');
  const closeYoutubeModalBtn = youtubeModal.querySelector('.close-button');
  const addYoutubeToQueueBtn = document.getElementById('addYoutubeToQueue');
  const addYoutubeNextBtn = document.getElementById('addYoutubeNext');

  // Custom Timeline elements
  const timelineContainer = document.getElementById('customTimelineContainer');
  const timelineSlider = document.getElementById('timelineSlider');
  const currentTimeDisplay = document.getElementById('currentTimeDisplay');
  const durationDisplay = document.getElementById('durationDisplay');
  let timelineUpdateInterval = null; // To store the interval ID for YouTube updates
  let isSeeking = false; // Flag to prevent updates during scrubbing

  // YouTube Player elements
  let ytPlayer;

  let musicLibrary = {}; // Structure: { "Category Name": [ { name: "song.mp3", file: File Object, category: "Category Name" }, ... ] }
  let playQueue = []; // Array of song objects { name: "...", file: File, category: "..." }
  let currentTrackIndex = -1; // Index in playQueue of the currently loaded/playing track
  let currentCategory = null;
  let previewWindow = null;
  let currentSearchQuery = ""; // Store the current search query

  // --- Initialization ---
  loadTheme(); // Load saved theme colors
  updateQueueDisplay(); // Initial empty display

  // YouTube IFrame API Setup
  var tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  // This function creates an <iframe> (and YouTube player) after the API code downloads.
  window.onYouTubeIframeAPIReady = function() {
    console.log("YouTube IFrame API Ready");
    ytPlayer = new YT.Player('youtubePlayer', {
      height: '180', // Smaller size, can be hidden
      width: '320',
      playerVars: {
        'playsinline': 1
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange
      }
    });
  }

  // The API will call this function when the video player is ready.
  function onPlayerReady(event) {
    console.log("YouTube Player Ready");
    // Player is ready, potentially do initial setup if needed
  }

  // The API calls this function when the player's state changes.
  function onPlayerStateChange(event) {
    console.log("YouTube Player State Change:", event.data);
    const playIcon = playPauseBtn.querySelector('i');

    if (event.data == YT.PlayerState.ENDED) {
      console.log("YouTube video ended.");
      if (playIcon) playIcon.className = 'fas fa-play'; // Set to play icon
      clearTimelineUpdateInterval(); // Stop updates
      // If the currently playing song is a YouTube song, play the next in the main queue
      if (currentTrackIndex !== -1 && playQueue[currentTrackIndex].type === 'youtube') {
        // Use a small delay to prevent potential race conditions
        setTimeout(() => playNextInQueue(true), 100); 
      }
    } else if (event.data === YT.PlayerState.PLAYING) {
        if (playIcon) playIcon.className = 'fas fa-pause'; // Set to pause icon
        if (!audioPlayer.paused) audioPlayer.pause();
        startTimelineUpdates(); // Start polling for YT time
    } else if (event.data === YT.PlayerState.PAUSED) {
        if (playIcon) playIcon.className = 'fas fa-play'; // Set to play icon
        clearTimelineUpdateInterval(); // Stop updates
    } else if (event.data === YT.PlayerState.BUFFERING) {
         clearTimelineUpdateInterval(); // Stop updates during buffering
    } else if (event.data === YT.PlayerState.CUED) {
        if (playIcon) playIcon.className = 'fas fa-play'; // Set to play icon
        clearTimelineUpdateInterval(); // Stop updates
        updateTimelineDisplay(); // Update display once when cued
    }
  }

  // Function to extract YouTube Video ID from various URL formats
  function getYouTubeVideoId(url) {
      if (!url) return null;
      var regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      var match = url.match(regExp);
      return (match && match[2].length == 11) ? match[2] : null;
  }

  // --- Event Listeners ---
  folderInput.addEventListener('change', handleFolderSelect);
  categoryList.addEventListener('click', handleCategoryClick);
  songList.addEventListener('click', handleSongClick); // Using event delegation
  queueList.addEventListener('click', handleQueueClick); // Using event delegation
  audioPlayer.addEventListener('ended', () => playNextInQueue(true)); // true = song ended naturally
  audioPlayer.addEventListener('play', () => playPauseBtn.querySelector('i').className = 'fas fa-pause');
  audioPlayer.addEventListener('pause', () => playPauseBtn.querySelector('i').className = 'fas fa-play');
  audioPlayer.addEventListener('volumechange', () => volumeSlider.value = audioPlayer.volume);


  playPauseBtn.addEventListener('click', togglePlayPause);
  nextBtn.addEventListener('click', () => playNextInQueue(false)); // false = manual button press
  prevBtn.addEventListener('click', playPrevious); // Implement basic previous logic
  volumeSlider.addEventListener('input', (e) => {
    const volume = e.target.value;
    if (currentTrackIndex !== -1 && playQueue[currentTrackIndex].type === 'youtube') {
        // Control YouTube Volume (0-100)
        if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
            ytPlayer.setVolume(volume * 100);
        }
    } else {
        // Control Local Audio Volume (0-1)
        audioPlayer.volume = volume;
    }
  });

  openPreviewButton.addEventListener('click', openPreview);

  primaryColorInput.addEventListener('input', (e) => updateTheme('--primary-color', e.target.value));
  bgColorInput.addEventListener('input', (e) => updateTheme('--bg-color', e.target.value));
  textColorInput.addEventListener('input', (e) => updateTheme('--text-color', e.target.value));

  // Search functionality
  songSearch.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.trim().toLowerCase();
      displaySongsInCategory(currentCategory, currentSearchQuery);
  });
  
  clearSearch.addEventListener('click', () => {
      songSearch.value = "";
      currentSearchQuery = "";
      displaySongsInCategory(currentCategory);
  });

  // YouTube Modal Listeners
  addYoutubeRequestBtn.addEventListener('click', openYoutubeModal);
  closeYoutubeModalBtn.addEventListener('click', closeYoutubeModal);
  window.addEventListener('click', (event) => {
    if (event.target == youtubeModal) {
      closeYoutubeModal();
    }
  });
  addYoutubeToQueueBtn.addEventListener('click', handleAddYoutubeRequest);
  addYoutubeNextBtn.addEventListener('click', () => handleAddYoutubeRequest(true));

  // --- Drag and Drop for Queue ---
  let draggedItem = null;

  queueList.addEventListener('dragstart', (e) => {
      if (e.target.tagName === 'LI') {
          draggedItem = e.target;
          setTimeout(() => e.target.classList.add('dragging'), 0); // Make it visually distinct
          e.dataTransfer.effectAllowed = 'move';
          // Store index for reordering logic
          e.dataTransfer.setData('text/plain', Array.from(queueList.children).indexOf(draggedItem));
      }
  });

  queueList.addEventListener('dragend', (e) => {
      if (draggedItem) {
          draggedItem.classList.remove('dragging');
          draggedItem = null;
           // Remove any lingering drop indicators
          document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
      }
  });

  queueList.addEventListener('dragover', (e) => {
      e.preventDefault(); // Necessary to allow dropping
      e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest('li');
       // Remove previous indicators
      document.querySelectorAll('.drop-indicator').forEach(el => el.remove());

      if (target && target !== draggedItem && target.parentElement === queueList) {
           const rect = target.getBoundingClientRect();
           const offsetY = e.clientY - rect.top;
           const indicator = document.createElement('div');
           indicator.className = 'drop-indicator';

           // Decide where to place indicator (above or below target)
           if (offsetY > target.offsetHeight / 2) {
               // Place below
               target.parentNode.insertBefore(indicator, target.nextSibling);
           } else {
               // Place above
               target.parentNode.insertBefore(indicator, target);
           }
      } else if (!target && queueList.children.length > 0 && e.target === queueList) {
          // If dragging over empty space at the bottom, indicate adding to end
           const indicator = document.createElement('div');
           indicator.className = 'drop-indicator';
           queueList.appendChild(indicator);
      }
  });

   queueList.addEventListener('dragleave', (e) => {
      // Clean up indicator if mouse leaves the list entirely or a list item quickly
      if (e.relatedTarget && !queueList.contains(e.relatedTarget)) {
         document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
      }
  });


  queueList.addEventListener('drop', (e) => {
      e.preventDefault();
      document.querySelectorAll('.drop-indicator').forEach(el => el.remove()); // Clean up indicator

      if (draggedItem) {
          const oldIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
          let newIndex;

          const targetLi = e.target.closest('li');

          if (targetLi && targetLi !== draggedItem) {
              const targetIndex = Array.from(queueList.children).indexOf(targetLi);
              const rect = targetLi.getBoundingClientRect();
              const offsetY = e.clientY - rect.top;

              if (offsetY > targetLi.offsetHeight / 2) {
                  // Dropped below the target item
                  newIndex = targetIndex + 1;
                  queueList.insertBefore(draggedItem, targetLi.nextSibling);
              } else {
                  // Dropped above the target item
                  newIndex = targetIndex;
                  queueList.insertBefore(draggedItem, targetLi);
              }
               // Adjust newIndex if moving downwards
               if (oldIndex < newIndex) {
                  newIndex--;
               }

          } else if (!targetLi && e.target === queueList) {
               // Dropped in empty space at the end
               newIndex = playQueue.length; // Will be length before reorder
               queueList.appendChild(draggedItem);
               if (oldIndex < newIndex) {
                  newIndex--;
               }
          }
           else {
              // Dropped on itself or outside LI but inside queueList where targetLi is null
              // (like padding space if any) - Don't move or reorder logic.
              // Or handle placing at the end if that's desired.
              // For simplicity, we can just let it snap back if not dropping near another item.
              return; // Exit drop handler if not a valid target position
          }

          // --- Reorder the actual playQueue array ---
          const [movedItem] = playQueue.splice(oldIndex, 1);
          playQueue.splice(newIndex, 0, movedItem);

          // Update currentTrackIndex if the currently playing track moved
          if (currentTrackIndex === oldIndex) {
              currentTrackIndex = newIndex;
          } else if (currentTrackIndex > oldIndex && currentTrackIndex <= newIndex) {
               // Item moved from before current to after current
               currentTrackIndex--;
          } else if (currentTrackIndex < oldIndex && currentTrackIndex >= newIndex) {
               // Item moved from after current to before current
               currentTrackIndex++;
          }


          console.log("Reordered Queue:", playQueue.map(s => s.name));
          console.log("Current index after reorder:", currentTrackIndex);
          updateQueueDisplay(); // Update display to reflect new order
          updatePreviewData(); // Update preview window
      }
  });

  // Timeline Event Listeners
  timelineSlider.addEventListener('input', handleTimelineScrub);
  timelineSlider.addEventListener('mousedown', () => { isSeeking = true; }); // Pause updates while scrubbing
  timelineSlider.addEventListener('mouseup', () => { isSeeking = false; });

  // Update audio player time display on timeupdate
  audioPlayer.addEventListener('timeupdate', updateTimelineDisplay);
  audioPlayer.addEventListener('loadedmetadata', updateTimelineDisplay); // Update duration when metadata loads
  audioPlayer.addEventListener('play', () => {
      playPauseBtn.querySelector('i').className = 'fas fa-pause';
      clearTimelineUpdateInterval(); // Ensure YT interval is cleared
  });
  audioPlayer.addEventListener('pause', () => {
      playPauseBtn.querySelector('i').className = 'fas fa-play';
  });

  // --- Functions ---

  function handleFolderSelect(event) {
      const files = event.target.files;
      if (!files.length) return;

      musicLibrary = {}; // Reset library
      categoryList.innerHTML = ''; // Clear UI
      songList.innerHTML = '';   // Clear UI

      // Initialize the "All" category
      musicLibrary["All"] = [];

      console.log(`Processing ${files.length} file entries...`);

      // Helper function to check if a file is an audio file
      function isAudioFile(filename) {
          const audioExtensions = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.opus', '.wma', '.webm'];
          filename = filename.toLowerCase();
          return audioExtensions.some(ext => filename.endsWith(ext));
      }

      for (const file of files) {
           // webkitRelativePath includes the folder structure
          const pathParts = file.webkitRelativePath.split('/');
          if (pathParts.length < 2 || !isAudioFile(file.name)) {
               console.log(`Skipping: ${file.webkitRelativePath} (not an audio file in a subfolder?)`);
               continue; // Expecting structure like Category/song.extension
          }

          const categoryName = pathParts[pathParts.length - 2]; // Second to last part is category
          const fileName = pathParts[pathParts.length - 1]; // Last part is filename
          
          // Remove file extension from song name for display
          const songName = fileName.replace(/\.[^/.]+$/, "");

          // Create song object
          const songObj = {
              name: songName,
              fileName: fileName, // Keep the original filename with extension
              file: file, // Keep the File object
              category: categoryName
          };

          // Add to the specific category
          if (!musicLibrary[categoryName]) {
              musicLibrary[categoryName] = [];
              // Add category to UI (except "All" which will be added separately)
              const li = document.createElement('li');
              li.textContent = categoryName;
              li.dataset.category = categoryName; // Store category name
              categoryList.appendChild(li);
          }
          musicLibrary[categoryName].push(songObj);
          
          // Also add to the "All" category
          musicLibrary["All"].push(songObj);
      }

      // Add the "All" category to UI at the top
      if (musicLibrary["All"].length > 0) {
          const allLi = document.createElement('li');
          allLi.textContent = "All";
          allLi.dataset.category = "All";
          allLi.classList.add('active'); // Make "All" active by default
          // Insert at the beginning of the list
          categoryList.insertBefore(allLi, categoryList.firstChild);
      }
      
      console.log("Music library processed:", musicLibrary);
      if (Object.keys(musicLibrary).length > 0) {
          // Select the "All" category by default
          selectCategory("All");
      }
  }

  function handleCategoryClick(event) {
      if (event.target.tagName === 'LI') {
          // Remove active class from previously selected
          const currentActive = categoryList.querySelector('.active');
          if (currentActive) {
              currentActive.classList.remove('active');
          }
          // Add active class to clicked item
          event.target.classList.add('active');
          selectCategory(event.target.dataset.category);
      }
  }

  function selectCategory(categoryName) {
      currentCategory = categoryName;
      // Reset search when changing categories
      songSearch.value = "";
      currentSearchQuery = "";
      // Display songs in the selected category
      displaySongsInCategory(categoryName);
  }

  function displaySongsInCategory(categoryName, searchQuery = "") {
      songList.innerHTML = ''; // Clear previous songs
      
      if (!musicLibrary[categoryName]) return;
      
      // Create a filtered array of songs based on search query
      const filteredSongs = searchQuery 
          ? musicLibrary[categoryName].filter(song => 
              song.name.toLowerCase().includes(searchQuery))
          : musicLibrary[categoryName];
      
      if (filteredSongs.length === 0) {
          // Show "No matches" message if search returns no results
          const noMatches = document.createElement('li');
          noMatches.textContent = searchQuery 
              ? `No songs matching "${searchQuery}"` 
              : "No songs in this category";
          noMatches.style.fontStyle = "italic";
          noMatches.style.opacity = "0.7";
          noMatches.style.justifyContent = "center";
          songList.appendChild(noMatches);
          return;
      }
      
      // Display filtered songs
      filteredSongs.forEach((song, index) => {
          const li = document.createElement('li');
          li.innerHTML = `
              <span>${song.name}</span>
              <div class="song-actions">
                  <button data-action="addNext" data-category="${song.category}" data-index="${musicLibrary[song.category].indexOf(song)}" title="Add Next">
                    <i class="fas fa-step-forward"></i>
                  </button>
                  <button data-action="addToQueue" data-category="${song.category}" data-index="${musicLibrary[song.category].indexOf(song)}" title="Add to Queue">
                    <i class="fas fa-plus"></i>
                  </button>
              </div>
          `;
          // Double click to add and play immediately
          li.addEventListener('dblclick', () => {
              addToQueue(song, true); // Add and play immediately
          });
          songList.appendChild(li);
      });
  }

  function handleSongClick(event) {
       // Get the button element (could be the button itself or an icon inside the button)
       const button = event.target.closest('button');
       
       if (button) {
          const action = button.dataset.action;
          const categoryName = button.dataset.category;
          const songIndex = parseInt(button.dataset.index, 10);
          const song = musicLibrary[categoryName]?.[songIndex];

          if (song) {
              if (action === 'addNext') {
                  addNext(song);
              } else if (action === 'addToQueue') {
                  addToQueue(song);
              }
          }
       }
  }

   function handleQueueClick(event) {
       // Check if clicked on a button or icon inside button
       const button = event.target.closest('button');
       
       if (button && button.dataset.action === 'remove') {
          const indexToRemove = parseInt(button.dataset.index, 10);
          removeFromQueue(indexToRemove);
       } else if (event.target.closest('li') && !button) { // Click on LI (but not button) plays it
          const queueLi = event.target.closest('li');
          const indexToPlay = Array.from(queueList.children).indexOf(queueLi);
           if (indexToPlay !== -1 && indexToPlay < playQueue.length) {
              playTrack(indexToPlay);
          }
       }
   }

  function addNext(song) {
      if (currentTrackIndex === -1) { // If nothing is playing, add to start
          playQueue.unshift(song);
          playTrack(0); // Start playing it
      } else { // Insert after the current track
          playQueue.splice(currentTrackIndex + 1, 0, song);
      }
      updateQueueDisplay();
      updatePreviewData();
  }

  function addToQueue(song, playImmediately = false) {
      playQueue.push(song);
      updateQueueDisplay();
      updatePreviewData();
      // If nothing is playing, start playing the newly added song
      if (audioPlayer.paused && currentTrackIndex === -1 || playImmediately) {
           playTrack(playQueue.length - 1); // Play the last added song
      }
  }

   function removeFromQueue(index) {
      if (index < 0 || index >= playQueue.length) return;

      playQueue.splice(index, 1);

      // Adjust currentTrackIndex if needed
      if (index === currentTrackIndex) {
          // If the removed track was playing, stop playback and play next (if any)
          audioPlayer.pause();
          audioPlayer.src = ''; // Clear source
          currentTrackIndex = -1; // Reset index
          currentSongDisplay.textContent = 'None';
          currentCategoryDisplay.textContent = 'N/A';
          playNextInQueue(false); // false indicates a manual action, not a song ending
      } else if (index < currentTrackIndex) {
          // If removed track was before the current one, decrement index
          currentTrackIndex--;
      }

      updateQueueDisplay();
      updatePreviewData();
   }

  function playTrack(index) {
      if (index < 0 || index >= playQueue.length) {
           console.log("Invalid index or end of queue reached.");
           audioPlayer.pause();
           audioPlayer.style.display = 'block'; // Show local player when queue ends
           if (ytPlayer && typeof ytPlayer.stopVideo === 'function') ytPlayer.stopVideo(); // Stop YouTube player
           clearTimelineUpdateInterval(); // Clear interval
           currentTrackIndex = -1;
           currentSongDisplay.textContent = 'None';
           currentCategoryDisplay.textContent = 'N/A';
           updateQueueDisplay(); // Highlight might need resetting
           updatePreviewData();
           return;
      }

      currentTrackIndex = index;
      const song = playQueue[currentTrackIndex];
      timelineContainer.style.display = 'flex'; // Show timeline

      console.log(`Attempting to play: ${song.name} (Type: ${song.type || 'local'})`);
      currentSongDisplay.textContent = song.name;
      currentCategoryDisplay.textContent = song.category;
      updateQueueDisplay(); // Update highlighting
      updatePreviewData(); // Send data to preview window

      clearTimelineUpdateInterval(); // Clear previous interval

      if (song.type === 'youtube') {
          // Play YouTube video
          audioPlayer.style.display = 'none'; // Hide local player
          if (!audioPlayer.paused) audioPlayer.pause(); // Pause local audio player
          if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
              console.log(`Loading YouTube video ID: ${song.videoId}`);
              // Sync volume before loading
              if (typeof ytPlayer.setVolume === 'function') {
                  ytPlayer.setVolume(volumeSlider.value * 100);
              }
              ytPlayer.loadVideoById(song.videoId);
              // Small delay seems to help ensure playback starts reliably after load
              setTimeout(() => {
                  if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
                      ytPlayer.playVideo();
                      playPauseBtn.querySelector('i').className = 'fas fa-play'; // Set to play initially
                  }    
              }, 500);
              
          } else {
              console.error("YouTube player is not ready or loadVideoById is not available.");
              audioPlayer.style.display = 'block'; // Show local player again on error
              timelineContainer.style.display = 'none'; // Hide timeline on error
              playNextInQueue(true); // Attempt to skip to next
          }
      } else {
          // Play local audio file
          audioPlayer.style.display = 'block'; // Show local player
          if (ytPlayer && typeof ytPlayer.pauseVideo === 'function' && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
              ytPlayer.pauseVideo(); // Pause YouTube player if playing
          }
          // Sync volume
          audioPlayer.volume = volumeSlider.value;
          // Use createObjectURL to create a playable URL from the File object
          // Revoke previous object URL if one exists to free memory
          if (audioPlayer.currentSrc && audioPlayer.currentSrc.startsWith('blob:')) {
               URL.revokeObjectURL(audioPlayer.currentSrc);
          }
          audioPlayer.src = URL.createObjectURL(song.file);
          audioPlayer.play()
              .then(() => {
                  console.log(`Playing local file: ${song.name} from ${song.category}`);
                  playPauseBtn.querySelector('i').className = 'fas fa-pause'; // Set to pause initially
                  // Updates are already done above
              })
              .catch(error => {
                  console.error("Error playing local track:", error);
                  playPauseBtn.querySelector('i').className = 'fas fa-play'; // Set to play initially
                  timelineContainer.style.display = 'none'; // Hide timeline on error
                  playNextInQueue(true); // Attempt to skip to next
              });
      }
  }

  function togglePlayPause() {
      const playIcon = playPauseBtn.querySelector('i');
      if (currentTrackIndex === -1 && playQueue.length > 0) {
           // If nothing selected, play first in queue
           playTrack(0);
       } else if (currentTrackIndex !== -1) {
           const currentSong = playQueue[currentTrackIndex];
           if (currentSong.type === 'youtube') {
               // Control YouTube Player
               if (ytPlayer && typeof ytPlayer.getPlayerState === 'function') {
                   const playerState = ytPlayer.getPlayerState();
                   if (playerState === YT.PlayerState.PLAYING) {
                       ytPlayer.pauseVideo();
                       playPauseBtn.querySelector('i').className = 'fas fa-play'; // Set to play initially
                   } else if (playerState === YT.PlayerState.PAUSED || playerState === YT.PlayerState.CUED) {
                       ytPlayer.playVideo();
                       playPauseBtn.querySelector('i').className = 'fas fa-pause'; // Set to pause initially
                   }
                   // Note: We might need to handle other states like BUFFERING or ENDED if necessary
               } else {
                   console.error("YouTube player not ready or available.");
               }
           } else {
               // Control Local Audio Player
               if (audioPlayer.paused) {
                   audioPlayer.play().catch(e => console.error("Play error:", e));
                   // Icon updated by event listener
               } else {
                   audioPlayer.pause();
                   // Icon updated by event listener
               }
           }
       } else {
           console.log("Queue is empty. Add songs to play.");
       }
  }

   function playNextInQueue(isSongEnded = true) {
       if (currentTrackIndex === -1) {
           // No song is currently playing, just play the first song if available
           if (playQueue.length > 0) {
               playTrack(0);
           } else {
               console.log("Queue is empty.");
           }
           return;
       }
       
       if (isSongEnded) {
           // Song ended naturally, remove it from queue and play next
           const finishedIndex = currentTrackIndex;
           
           // Remove the finished song
           playQueue.splice(finishedIndex, 1);
           
           // Reset current track index since we've removed the song
           currentTrackIndex = -1;
           
           // Update display after removal
           updateQueueDisplay();
           updatePreviewData();
           
           // Play the next song if queue is not empty
           if (playQueue.length > 0) {
               playTrack(0);
           } else {
               // Queue is now empty
               console.log("End of queue.");
               audioPlayer.pause();
               currentSongDisplay.textContent = 'None (Queue Finished)';
               currentCategoryDisplay.textContent = 'N/A';
               updateQueueDisplay();
               updatePreviewData();
           }
       } else {
           // Manual next button press, just play the next song without removing current
           const nextIndex = currentTrackIndex + 1;
           if (nextIndex < playQueue.length) {
               playTrack(nextIndex);
           } else {
               // Reached end of queue
               console.log("End of queue reached.");
               if (playQueue.length > 0) {
                   // Loop back to first song
                   playTrack(0);
               } else {
                   console.log("Queue is empty.");
               }
           }
       }
   }

   function playPrevious() {
       if (currentTrackIndex === -1) return; // Nothing playing

       const currentSong = playQueue[currentTrackIndex];

       if (currentSong.type === 'youtube') {
           // If it's a YouTube song, always try to play the previous track index
           if (currentTrackIndex > 0) {
               playTrack(currentTrackIndex - 1);
           } else {
               // If it's the first track, restart the video (no previous track)
                if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
                   ytPlayer.seekTo(0);
               } else {
                   console.error("YouTube player not ready or seekTo unavailable for restart.");
               }
           }
       } else {
           // Local file logic: restart if > 3s played or first track, else play previous
           if (audioPlayer.currentTime > 3 || currentTrackIndex <= 0) {
               audioPlayer.currentTime = 0;
           } else {
               // Play the actual previous track (index check already handled indirectly)
               playTrack(currentTrackIndex - 1);
           }
       }
   }


  function updateQueueDisplay() {
      queueList.innerHTML = ''; // Clear current list
      playQueue.forEach((song, index) => {
          const li = document.createElement('li');
          li.draggable = true; // Make list item draggable
          
          // Add YouTube icon if it's a YouTube song
          const youtubeIcon = song.type === 'youtube' 
              ? `<i class="fab fa-youtube youtube-icon" title="YouTube Request"></i> `
              : '';
              
          li.innerHTML = `
              <span>${index + 1}. ${youtubeIcon}${song.name} (${song.category})</span>
              <div class="queue-actions">
                   <button data-action="remove" data-index="${index}" title="Remove from queue">
                     <i class="fas fa-trash-alt"></i>
                   </button>
              </div>
          `;
          // Highlight the currently playing track
          if (index === currentTrackIndex) {
              li.style.fontWeight = 'bold'; // Simple highlight
              li.style.backgroundColor = 'var(--secondary-color)';
          }
          queueList.appendChild(li);
      });
  }

  function openPreview() {
      if (previewWindow && !previewWindow.closed) {
          previewWindow.focus();
      } else {
          previewWindow = window.open('preview.html', 'MusicPreview', 'width=500,height=400,resizable,scrollbars=yes');
          // Initial data push after window opens (give it a slight delay to load)
          setTimeout(updatePreviewData, 500);
      }
  }

  function updatePreviewData() {
       // Prepare data for preview window
      const currentCat = currentTrackIndex !== -1 ? playQueue[currentTrackIndex].category : 'N/A';

      const upcoming = [];
      for (let i = 1; i <= 3; i++) {
           const nextIndex = currentTrackIndex + i;
           if (nextIndex < playQueue.length) {
               upcoming.push(playQueue[nextIndex].category);
           } else {
               break; // No more songs in queue
           }
       }

      const previewData = {
          currentCategory: currentCat,
          upcomingCategories: upcoming
      };

      // Use localStorage for simple cross-window communication
      try {
          localStorage.setItem('musicPlayerData', JSON.stringify(previewData));
      } catch (e) {
          console.error("Error writing to localStorage:", e);
          // Handle potential storage full errors etc.
      }

       // Also apply theme changes to localStorage if the preview window is open
       // or might be opened later.
      const themeData = {
          primary: primaryColorInput.value,
          bg: bgColorInput.value,
          text: textColorInput.value
      };
      try {
          localStorage.setItem('musicPlayerTheme', JSON.stringify(themeData));
      } catch (e) {
          console.error("Error writing theme to localStorage:", e);
      }
  }

  // --- YouTube Request Modal Functions ---
  function openYoutubeModal() {
      // Populate category datalist
      youtubeCategoryList.innerHTML = ''; // Clear previous
      Object.keys(musicLibrary)
          .filter(cat => cat !== "All") // Exclude "All"
          .sort() // Optional: sort categories alphabetically
          .forEach(cat => {
              const option = document.createElement('option');
              option.value = cat;
              youtubeCategoryList.appendChild(option);
          });
      // Reset form fields
      youtubeUrlInput.value = '';
      youtubeSongNameInput.value = '';
      youtubeCategoryInput.value = '';
      youtubeModal.style.display = 'block';
      youtubeUrlInput.focus(); // Focus URL input
  }

  function closeYoutubeModal() {
      youtubeModal.style.display = 'none';
  }

  function handleAddYoutubeRequest(addNextFlag = false) {
      const url = youtubeUrlInput.value.trim();
      const videoId = getYouTubeVideoId(url);
      const songName = youtubeSongNameInput.value.trim() || "YouTube Request"; // Default name
      let category = youtubeCategoryInput.value.trim() || "YouTube"; // Default category

      if (!videoId) {
          alert("Invalid YouTube URL. Please enter a valid link.");
          return;
      }
      
      if (!category) {
        alert("Please enter or select a category.");
        return;
      }

      const youtubeSong = {
          type: 'youtube', // Identify this as a YouTube song
          name: songName,
          videoId: videoId,
          category: category,
          file: null, // No local file
          fileName: `youtube_${videoId}` // Create a unique identifier
      };

      if (addNextFlag) {
          addNext(youtubeSong);
      } else {
          addToQueue(youtubeSong);
      }
      
      console.log("Added YouTube Request:", youtubeSong);
      closeYoutubeModal(); // Close modal after adding
  }

  // --- Theme Customization Functions ---
  function updateTheme(variableName, value) {
      document.documentElement.style.setProperty(variableName, value);
      saveTheme();
      updatePreviewData(); // Also push theme update via storage
  }

  function saveTheme() {
      const theme = {
          primary: primaryColorInput.value,
          bg: bgColorInput.value,
          text: textColorInput.value
      };
      try {
          localStorage.setItem('musicPlayerTheme', JSON.stringify(theme));
      } catch (e) {
          console.error("Error saving theme to localStorage:", e);
      }
  }

  function loadTheme() {
      try {
          const savedTheme = localStorage.getItem('musicPlayerTheme');
          if (savedTheme) {
              const theme = JSON.parse(savedTheme);
              primaryColorInput.value = theme.primary || '#3498db';
              bgColorInput.value = theme.bg || '#2c3e50';
              textColorInput.value = theme.text || '#ecf0f1';

              updateTheme('--primary-color', primaryColorInput.value);
              updateTheme('--bg-color', bgColorInput.value);
              updateTheme('--text-color', textColorInput.value);
          }
      } catch (e) {
           console.error("Error loading theme from localStorage:", e);
      }
  }

  // --- Timeline Functions ---
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function updateTimelineDisplay() {
    if (isSeeking) return; // Don't update UI while user is scrubbing

    let currentTime = 0;
    let duration = 0;
    const song = currentTrackIndex !== -1 ? playQueue[currentTrackIndex] : null;

    if (song) {
        if (song.type === 'youtube' && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
            currentTime = ytPlayer.getCurrentTime();
            duration = ytPlayer.getDuration();
        } else if (song.type !== 'youtube' && audioPlayer) {
            currentTime = audioPlayer.currentTime;
            duration = audioPlayer.duration;
        }
    }
    
    // Handle cases where duration might be NaN or Infinity
    if (isNaN(duration) || !isFinite(duration)) {
        duration = 0;
    }
    if (isNaN(currentTime) || currentTime < 0) {
        currentTime = 0;
    }
    
    // Prevent current time exceeding duration visually
    currentTime = Math.min(currentTime, duration);

    currentTimeDisplay.textContent = formatTime(currentTime);
    durationDisplay.textContent = formatTime(duration);
    timelineSlider.value = duration > 0 ? (currentTime / duration) * 100 : 0;
    // Update slider background fill (optional visual enhancement)
    const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
    timelineSlider.style.background = `linear-gradient(to right, var(--primary-color) ${percentage}%, rgba(255, 255, 255, 0.2) ${percentage}%)`;
  }

  function resetTimelineDisplay() {
      currentTimeDisplay.textContent = '0:00';
      durationDisplay.textContent = '0:00';
      timelineSlider.value = 0;
      timelineSlider.style.background = `rgba(255, 255, 255, 0.2)`;
  }

  function handleTimelineScrub(event) {
    if (currentTrackIndex === -1) return;
    
    const song = playQueue[currentTrackIndex];
    const sliderValue = event.target.value; // Value is 0-100
    let seekTime = 0;

    if (song.type === 'youtube' && ytPlayer && typeof ytPlayer.getDuration === 'function') {
        const duration = ytPlayer.getDuration();
        if (duration > 0) {
            seekTime = (sliderValue / 100) * duration;
            ytPlayer.seekTo(seekTime, true); // Seek and allow resume
            updateTimelineDisplay(); // Update UI immediately after scrub
        }
    } else if (song.type !== 'youtube' && audioPlayer && isFinite(audioPlayer.duration)) {
        const duration = audioPlayer.duration;
        if (duration > 0) {
            seekTime = (sliderValue / 100) * duration;
            audioPlayer.currentTime = seekTime;
            updateTimelineDisplay(); // Update UI immediately after scrub
        }
    }
  }

  function startTimelineUpdates() {
    clearTimelineUpdateInterval(); // Clear any existing interval
    if (currentTrackIndex !== -1 && playQueue[currentTrackIndex].type === 'youtube') {
        timelineUpdateInterval = setInterval(() => {
            if (ytPlayer && typeof ytPlayer.getPlayerState === 'function' && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                updateTimelineDisplay();
            }
        }, 250); // Poll YouTube time every 250ms
    }
  }

  function clearTimelineUpdateInterval() {
    if (timelineUpdateInterval) {
        clearInterval(timelineUpdateInterval);
        timelineUpdateInterval = null;
    }
  }

}); // End DOMContentLoaded