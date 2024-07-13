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

  let selectedItems = new Set();
  let currentTree = null; // Define a global variable to hold the current tree state

  function loadMarksTree() {
    browser.storage.local.get('marksTree').then(result => {
      if (result.marksTree) {
        currentTree = result.marksTree; // Store the tree state in the global variable
        renderMarksTree(currentTree);
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
    folderElement.dataset.id = folder.id;
    folderElement.draggable = true;

    folderElement.onclick = (event) => {
      if (event.ctrlKey || event.metaKey) {
        toggleSelect(folderElement);
      } else if (event.shiftKey) {
        selectRange(folderElement);
      } else {
        clearSelection();
        selectItem(folderElement);
      }
    };

    folderElement.ondragstart = (event) => {
      event.dataTransfer.setData('text/plain', folder.id);
    };

    folderElement.ondragover = (event) => {
      event.preventDefault();
    };

    folderElement.ondrop = (event) => {
      event.preventDefault();
      const draggedId = event.dataTransfer.getData('text/plain');
      if (draggedId && draggedId !== folder.id && !isDescendant(draggedId, folder.id, tree)) {
        moveItem(draggedId, folder.id, tree);
      }
    };

    folderElement.oncontextmenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      showContextMenu(event, folder.id, true);
    };

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'children';

    folder.children.forEach(childId => {
      if (tree.folders[childId]) {
        renderFolder(tree.folders[childId], childrenContainer, tree);
      } else if (tree.marks[childId]) {
        renderMark(tree.marks[childId], childrenContainer, tree);
      }
    });

    folderElement.appendChild(childrenContainer);
    container.appendChild(folderElement);
  }

  function renderMark(mark, container, tree) {
    const markElement = document.createElement('div');
    markElement.className = 'mark';
    markElement.textContent = `${mark.title} (${mark.url})`;
    markElement.dataset.id = mark.id;
    markElement.draggable = true;

    markElement.onclick = (event) => {
      if (event.ctrlKey || event.metaKey) {
        toggleSelect(markElement);
      } else if (event.shiftKey) {
        selectRange(markElement);
      } else {
        clearSelection();
        selectItem(markElement);
      }
    };

    markElement.ondragstart = (event) => {
      event.dataTransfer.setData('text/plain', mark.id);
    };

    markElement.ondragover = (event) => {
      event.preventDefault();
    };

    markElement.ondrop = (event) => {
      event.preventDefault();
      const draggedId = event.dataTransfer.getData('text/plain');
      if (draggedId && draggedId !== mark.id) {
        moveItem(draggedId, mark.folderId, tree);
      }
    };

    markElement.oncontextmenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      showContextMenu(event, mark.id, false);
    };

    container.appendChild(markElement);
  }

  function toggleSelect(element) {
    const id = element.dataset.id;
    if (selectedItems.has(id)) {
      selectedItems.delete(id);
      element.classList.remove('selected');
    } else {
      selectedItems.add(id);
      element.classList.add('selected');
    }
  }

  function selectItem(element) {
    const id = element.dataset.id;
    selectedItems.add(id);
    element.classList.add('selected');
  }

  function clearSelection() {
    selectedItems.forEach(id => {
      const element = document.querySelector(`[data-id="${id}"]`);
      if (element) {
        element.classList.remove('selected');
      }
    });
    selectedItems.clear();
  }

  function selectRange(targetElement) {
    // Select range logic can be added here if needed
  }

  function showContextMenu(event, id, isFolder) {
    // Remove any existing custom context menu
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';

    if (isFolder) {
      const addMarkOption = document.createElement('div');
      addMarkOption.textContent = 'New Mark';
      addMarkOption.onclick = () => {
        browser.runtime.sendMessage({ action: 'createMark', folderId: id });
        contextMenu.remove();
      };
      contextMenu.appendChild(addMarkOption);

      const addFolderOption = document.createElement('div');
      addFolderOption.textContent = 'New Folder';
      addFolderOption.onclick = () => {
        const folderName = prompt('Enter folder name:');
        if (folderName) {
          browser.runtime.sendMessage({ action: 'createFolder', folderName: folderName, parentId: id });
        }
        contextMenu.remove();
      };
      contextMenu.appendChild(addFolderOption);
    }

    const deleteOption = document.createElement('div');
    deleteOption.textContent = 'Delete';
    deleteOption.onclick = () => {
      if (confirm('Are you sure you want to delete the selected items?')) {
        selectedItems.forEach(itemId => {
          if (currentTree.folders[itemId]) {
            browser.runtime.sendMessage({ action: 'deleteFolder', folderId: itemId });
          } else if (currentTree.marks[itemId]) {
            browser.runtime.sendMessage({ action: 'deleteMark', markId: itemId });
          }
        });
        contextMenu.remove();
      }
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
  }

  function moveItem(draggedId, targetFolderId, tree) {
    if (tree.folders[draggedId]) {
      const folder = tree.folders[draggedId];
      const parentFolder = tree.folders[folder.parentId];
      parentFolder.children = parentFolder.children.filter(id => id !== draggedId);
      folder.parentId = targetFolderId;
      tree.folders[targetFolderId].children.push(draggedId);
    } else if (tree.marks[draggedId]) {
      const mark = tree.marks[draggedId];
      const parentFolder = tree.folders[mark.folderId];
      parentFolder.children = parentFolder.children.filter(id => id !== draggedId);
      mark.folderId = targetFolderId;
      tree.folders[targetFolderId].children.push(draggedId);
    }
    saveMarksTree(tree);
    notifySidebar();
  }

  function isDescendant(childId, parentId, tree) {
    if (childId === parentId) {
      return true;
    }
    const folder = tree.folders[childId];
    if (folder && folder.parentId) {
      return isDescendant(folder.parentId, parentId, tree);
    }
    return false;
  }

  function saveMarksTree(tree) {
    console.log("saveMarksTree");
    browser.storage.local.set({ marksTree: tree });
  }

  function notifySidebar() {
    console.log("notifySidebar");
    browser.runtime.sendMessage({ action: 'updateMarks' });
  }

  // Listen for key presses to delete selected items
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (confirm('Are you sure you want to delete the selected items?')) {
        selectedItems.forEach(itemId => {
          if (currentTree.folders[itemId]) {
            browser.runtime.sendMessage({ action: 'deleteFolder', folderId: itemId });
          } else if (currentTree.marks[itemId]) {
            browser.runtime.sendMessage({ action: 'deleteMark', markId: itemId });
          }
        });
      }
    }
  });

  // Listen for messages from the background script
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'updateMarks') {
      loadMarksTree();
    }
  });
});
