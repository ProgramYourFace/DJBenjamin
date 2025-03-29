document.addEventListener('DOMContentLoaded', () => {
  const currentCategoryElem = document.getElementById('currentCategoryPreview');
  const upcomingCategoriesElem = document.getElementById('upcomingCategoriesPreview');
  const bodyElement = document.body; // To apply theme

  // Function to update the display
  function updateDisplay(data) {
      if (!data) return;

      currentCategoryElem.textContent = data.currentCategory || 'N/A';

      upcomingCategoriesElem.innerHTML = ''; // Clear previous
      if (data.upcomingCategories && data.upcomingCategories.length > 0) {
          data.upcomingCategories.forEach(category => {
              const li = document.createElement('li');
              li.textContent = category;
              upcomingCategoriesElem.appendChild(li);
          });
           // Fill remaining slots if less than 3 upcoming
           while (upcomingCategoriesElem.children.length < 3) {
               const li = document.createElement('li');
               li.textContent = '-';
               upcomingCategoriesElem.appendChild(li);
           }
      } else {
          // Display placeholders if no upcoming songs
          for (let i = 0; i < 3; i++) {
               const li = document.createElement('li');
               li.textContent = '-';
               upcomingCategoriesElem.appendChild(li);
           }
      }
  }

   // Function to apply theme
   function applyTheme(theme) {
      if (!theme) return;
      bodyElement.style.setProperty('--primary-color', theme.primary || '#3498db');
      bodyElement.style.setProperty('--bg-color', theme.bg || '#2c3e50');
      bodyElement.style.setProperty('--text-color', theme.text || '#ecf0f1');
   }

  // Initial load from localStorage
  try {
      const initialData = localStorage.getItem('musicPlayerData');
      if (initialData) {
          updateDisplay(JSON.parse(initialData));
      }
       const initialTheme = localStorage.getItem('musicPlayerTheme');
       if (initialTheme) {
           applyTheme(JSON.parse(initialTheme));
       }
  } catch (e) {
      console.error("Error reading initial data from localStorage:", e);
  }


  // Listen for changes from the main window via localStorage
  window.addEventListener('storage', (event) => {
      if (event.key === 'musicPlayerData') {
          try {
               const newData = JSON.parse(event.newValue);
               updateDisplay(newData);
          } catch (e) {
               console.error("Error parsing updated data from localStorage:", e);
          }
      } else if (event.key === 'musicPlayerTheme') {
           try {
               const newTheme = JSON.parse(event.newValue);
               applyTheme(newTheme);
           } catch (e) {
               console.error("Error parsing updated theme from localStorage:", e);
           }
      }
  });

});