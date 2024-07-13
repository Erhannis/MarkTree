document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded event fired');
  loadMarksTree();

  document.getElementById('new-folder').onclick = () => {
    const folderName = prompt('Enter folder name:');
    if (folderName) {
      console.log(`Creating new folder: ${folderName}`);
      browser.runtime.sendMessage({ action: 'createFolder', folderName: folderName, parentId: 'root' });
    }
  };

  document.getElementById('new-mark').onclick = () => {
    console.log('Creating new mark in root');
    browser.runtime.sendMessage({ action: 'createMark', folderId: 'root' });
  };

  let selectedItems = new Set();
  let currentTree = null; // Define a global variable to hold the current tree state

  function loadMarksTree() {
    console.log('Loading marks tree');
    browser.storage.local.get('marksTree').then(result => {
      if (result.marksTree) {
        currentTree = result.marksTree; // Store the tree state in the global variable
        renderMarksTree(currentTree);
      }
    });
  }

  function renderMarksTree(tree) {
    console.log('Rendering marks tree', tree);
    const container = document.getElementById('sidebar-content');
    container.innerHTML = ''; // Clear existing content
    renderFolder(tree.folders['root'], container, tree);
  }

  function renderFolder(folder, container, tree) {
    console.log(`Rendering folder: ${folder.name}`, folder);
    const folderElement = document.createElement('div');
    folderElement.className = 'folder';
    folderElement.textContent = folder.name;
    folderElement.dataset.id = folder.id;
    folderElement.draggable = true;

    folderElement.onclick = (event) => {
      console.log('Folder clicked', folder.id, event);
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
      console.log('Folder drag started', folder.id);
      event.dataTransfer.setData('text/plain', folder.id);
    };

    folderElement.ondragover = (event) => {
      event.preventDefault();
      console.log('Folder drag over', folder.id);
    };

    folderElement.ondrop = (event) => {
      event.preventDefault();
      const draggedId = event.dataTransfer.getData('text/plain');
      console.log('Folder drop', folder.id, draggedId);
      if (draggedId && draggedId !== folder.id && !isDescendant(draggedId, folder.id, tree)) {
        moveItem(draggedId, folder.id, tree);
      }
    };

    folderElement.oncontextmenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      console.log('Folder context menu', folder.id);
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
    console.log(`Rendering mark: ${mark.title}`, mark);
    const markElement = document.createElement('div');
    markElement.className = 'mark';
    markElement.textContent = `${mark.title} (${mark.url})`;
    markElement.dataset.id = mark.id;
    markElement.draggable = true;

    markElement.onclick = (event) => {
      console.log('Mark clicked', mark.id, event);
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
      console.log('Mark drag started', mark.id);
      event.dataTransfer.setData('text/plain', mark.id);
    };

    markElement.ondragover = (event) => {
      event.preventDefault();
      console.log('Mark drag over', mark.id);
    };

    markElement.ondrop = (event) => {
      event.preventDefault();
      const draggedId = event.dataTransfer.getData('text/plain');
      console.log('Mark drop', mark.id, draggedId);
      if (draggedId && draggedId !== mark.id) {
        moveItem(draggedId, mark.folderId, tree);
      }
    };

    markElement.oncontextmenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      console.log('Mark context menu', mark.id);
      showContextMenu(event, mark.id, false);
    };

    container.appendChild(markElement);
  }

  function toggleSelect(element) {
    const id = element.dataset.id;
    console.log('Toggle select', id);
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
    console.log('Select item', id);
    selectedItems.add(id);
    element.classList.add('selected');
  }

  function clearSelection() {
    console.log('Clear selection');
    selectedItems.forEach(id => {
      const element = document.querySelector(`[data-id="${id}"]`);
      if (element) {
        element.classList.remove('selected');
      }
    });
    selectedItems.clear();
  }

  function selectRange(targetElement) {
    console.log('Select range to', targetElement.dataset.id);
    // Select range logic can be added here if needed
  }

  function showContextMenu(event, id, isFolder) {
    console.log('Show context menu', id, isFolder);
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
        console.log('Context menu - New Mark', id);
        browser.runtime.sendMessage({ action: 'createMark', folderId: id });
        contextMenu.remove();
      };
      contextMenu.appendChild(addMarkOption);

      const addFolderOption = document.createElement('div');
      addFolderOption.textContent = 'New Folder';
      addFolderOption.onclick = () => {
        const folderName = prompt('Enter folder name:');
        console.log('Context menu - New Folder', id, folderName);
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
      console.log('Context menu - Delete', id);
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
    console.log('Move item', draggedId, targetFolderId);
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
    console.log('Is descendant', childId, parentId);
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
    console.log("saveMarksTree", tree);
    browser.storage.local.set({ marksTree: tree });
  }

  function notifySidebar() {
    console.log("notifySidebar");
    browser.runtime.sendMessage({ action: 'updateMarks' });
  }

  // Listen for key presses to delete selected items
  document.addEventListener('keydown', (event) => {
    console.log('Key down', event.key);
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (confirm('Are you sure you want to delete the selected items?')) {
        selectedItems.forEach(itemId => {
          console.log('Deleting item', itemId);
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
    console.log('Message received', message);
    if (message.action === 'updateMarks') {
      loadMarksTree();
    }
  });
});
