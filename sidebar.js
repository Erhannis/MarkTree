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
      const folderId = folder.id;
      console.log("oncontextmenu: ", folderId);
      const contextMenu = document.createElement('div');
      contextMenu.className = 'context-menu';
      const addMarkOption = document.createElement('div');
      addMarkOption.textContent = 'Add Mark';
      addMarkOption.onclick = () => {
        browser.runtime.sendMessage({ action: 'createMark', folderId: folderId });
        document.body.removeChild(contextMenu);
      };
      contextMenu.appendChild(addMarkOption);
      contextMenu.style.position = 'absolute';
      contextMenu.style.top = `${event.clientY}px`;
      contextMenu.style.left = `${event.clientX}px`;
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
    container.appendChild(markElement);
  }

  // Listen for messages from the background script
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'updateMarks') {
      loadMarksTree();
    }
  });
});
