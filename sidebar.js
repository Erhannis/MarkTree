document.addEventListener('DOMContentLoaded', () => {
  loadMarksTree();

  document.getElementById('new-folder').onclick = () => {
    const folderName = prompt('Enter folder name:');
    if (folderName) {
      browser.runtime.sendMessage({ action: 'createFolder', folderName: folderName, parentId: 'root' });
    }
  };

  document.getElementById('new-mark').onclick = () => {
    browser.runtime.sendMessage({ action: 'createMark', folderId: 'root' });
  };

  function loadMarksTree() {
    browser.storage.local.get('marksTree').then(result => {
      if (result.marksTree) {
        renderMarksTree(result.marksTree);
      }
    });
  }

  function renderMarksTree(tree) {
    const container = document.getElementById('sidebar-content');
    container.innerHTML = ''; // Clear existing content
    renderFolder(tree.folders['root'], container, tree);
  }

  function renderFolder(folder, container, tree) {
    const folderElement = document.createElement('div');
    folderElement.className = 'folder';
    folderElement.textContent = folder.name;
    folderElement.oncontextmenu = (event) => {
      event.preventDefault();
      event.stopPropagation();

      // Remove any existing custom context menu
      const existingMenu = document.querySelector('.context-menu');
      if (existingMenu) {
        existingMenu.remove();
      }

      const folderId = folder.id;
      const contextMenu = document.createElement('div');
      contextMenu.className = 'context-menu';

      const addMarkOption = document.createElement('div');
      addMarkOption.textContent = 'New Mark';
      addMarkOption.onclick = () => {
        browser.runtime.sendMessage({ action: 'createMark', folderId: folderId });
        contextMenu.remove();
      };
      contextMenu.appendChild(addMarkOption);

      const addFolderOption = document.createElement('div');
      addFolderOption.textContent = 'New Folder';
      addFolderOption.onclick = () => {
        const folderName = prompt('Enter folder name:');
        if (folderName) {
          browser.runtime.sendMessage({ action: 'createFolder', folderName: folderName, parentId: folderId });
        }
        contextMenu.remove();
      };
      contextMenu.appendChild(addFolderOption);

      const deleteOption = document.createElement('div');
      deleteOption.textContent = 'Delete';
      deleteOption.onclick = () => {
        if (folderId !== 'root') {
          if (confirm('Are you sure you want to delete this folder and all its contents?')) {
            browser.runtime.sendMessage({ action: 'deleteFolder', folderId: folderId });
          }
        } else {
          alert('Cannot delete the root folder.');
        }
        contextMenu.remove();
      };
      contextMenu.appendChild(deleteOption);

      contextMenu.style.position = 'absolute';
      contextMenu.style.top = `${event.clientY}px`;
      contextMenu.style.left = `${event.clientX}px`;
      contextMenu.style.background = 'white';
      contextMenu.style.border = '1px solid #ccc';
      contextMenu.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
      contextMenu.style.padding = '5px';
      contextMenu.style.zIndex = '1000';

      document.body.appendChild(contextMenu);

      document.addEventListener('click', () => {
        if (contextMenu.parentNode) {
          contextMenu.parentNode.removeChild(contextMenu);
        }
      }, { once: true });
    };

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'children';

    folder.children.forEach(childId => {
      if (tree.folders[childId]) {
        renderFolder(tree.folders[childId], childrenContainer, tree);
      } else if (tree.marks[childId]) {
        renderMark(tree.marks[childId], childrenContainer);
      }
    });

    folderElement.appendChild(childrenContainer);
    container.appendChild(folderElement);
  }

  function renderMark(mark, container) {
    const markElement = document.createElement('div');
    markElement.className = 'mark';
    markElement.textContent = `${mark.title} (${mark.url})`;
    markElement.onclick = () => {
      browser.tabs.update(mark.tabId, { active: true });
    };
    markElement.oncontextmenu = (event) => {
      event.preventDefault();
      event.stopPropagation();

      // Remove any existing custom context menu
      const existingMenu = document.querySelector('.context-menu');
      if (existingMenu) {
        existingMenu.remove();
      }

      const markId = mark.id;
      const contextMenu = document.createElement('div');
      contextMenu.className = 'context-menu';

      const deleteOption = document.createElement('div');
      deleteOption.textContent = 'Delete';
      deleteOption.onclick = () => {
        browser.runtime.sendMessage({ action: 'deleteMark', markId: markId });
        contextMenu.remove();
      };
      contextMenu.appendChild(deleteOption);

      contextMenu.style.position = 'absolute';
      contextMenu.style.top = `${event.clientY}px`;
      contextMenu.style.left = `${event.clientX}px`;
      contextMenu.style.background = 'white';
      contextMenu.style.border = '1px solid #ccc';
      contextMenu.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
      contextMenu.style.padding = '5px';
      contextMenu.style.zIndex = '1000';

      document.body.appendChild(contextMenu);

      document.addEventListener('click', () => {
        if (contextMenu.parentNode) {
          contextMenu.parentNode.removeChild(contextMenu);
        }
      }, { once: true });
    };
    container.appendChild(markElement);
  }

  // Listen for messages from the background script
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'updateMarks') {
      loadMarksTree();
    }
  });
});
