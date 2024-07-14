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
    // Add the spacer element
    const spacer = document.createElement('div');
    spacer.className = 'spacer';
    container.appendChild(spacer);
  }

  function renderFolder(folder, container, tree) {
    console.log(`Rendering folder: ${folder.name}`, folder);
    const folderElement = document.createElement('div');
    folderElement.className = 'folder';
    folderElement.textContent = folder.name;
    folderElement.dataset.id = folder.id;
    folderElement.draggable = true;

    if (folder.collapsed) {
      folderElement.classList.add('collapsed');
    }

    folderElement.onclick = (event) => {
      console.log('Folder clicked', folder.id, event);
      if (event.ctrlKey || event.metaKey) {
        toggleSelect(folderElement);
      } else if (event.shiftKey) {
        selectRange(folderElement);
      } else {
        clearSelection();
        selectItem(folderElement);
        toggleCollapse(folderElement);
        browser.runtime.sendMessage({ action: 'toggleFolderCollapse', folderId: folder.id });
      }
      event.stopPropagation();
    };

    folderElement.ondragstart = (event) => {
      console.log('Folder drag started', folder.id);
      const draggedIds = Array.from(selectedItems);
      event.dataTransfer.setData('text/plain', JSON.stringify(draggedIds));
      event.stopPropagation();
    };

    folderElement.ondragover = (event) => {
      event.preventDefault();
      console.log('Folder drag over', folder.id);
      event.stopPropagation();
    };

    folderElement.ondrop = (event) => {
      event.preventDefault();
      const draggedIds = JSON.parse(event.dataTransfer.getData('text/plain'));
      console.log('Folder drop', folder.id, draggedIds);
      browser.runtime.sendMessage({ action: 'moveItems', draggedIds: draggedIds, targetFolderId: folder.id });
      event.stopPropagation();
    };

    folderElement.oncontextmenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      console.log('Folder context menu', folder.id);
      clearSelection();
      selectItem(folderElement);
      showContextMenu(event, folder.id, true);
    };

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'children';

    if (folder.collapsed) {
      childrenContainer.classList.add('collapsed');
    }

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
      event.stopPropagation();
    };

    markElement.ondragstart = (event) => {
      console.log('Mark drag started', mark.id);
      const draggedIds = Array.from(selectedItems);
      event.dataTransfer.setData('text/plain', JSON.stringify(draggedIds));
      event.stopPropagation();
    };

    markElement.ondragover = (event) => {
      event.preventDefault();
      console.log('Mark drag over', mark.id);
      event.stopPropagation();
    };

    markElement.ondrop = (event) => {
      event.preventDefault();
      const draggedIds = JSON.parse(event.dataTransfer.getData('text/plain'));
      console.log('Mark drop', mark.id, draggedIds);
      browser.runtime.sendMessage({ action: 'moveItems', draggedIds: draggedIds, targetFolderId: mark.folderId });
      event.stopPropagation();
    };

    markElement.oncontextmenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      console.log('Mark context menu', mark.id);
      clearSelection();
      selectItem(markElement);
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
    const targetId = targetElement.dataset.id;
    const allItems = Array.from(document.querySelectorAll('.folder, .mark'));
    const selectedArray = Array.from(selectedItems);
    const firstSelected = selectedArray[0];
    const lastSelected = selectedArray[selectedArray.length - 1];

    let startIndex = allItems.findIndex(element => element.dataset.id === firstSelected);
    let endIndex = allItems.findIndex(element => element.dataset.id === lastSelected);
    let targetIndex = allItems.findIndex(element => element.dataset.id === targetId);

    let indexA = Math.min(startIndex, endIndex, targetIndex);
    let indexB = Math.max(startIndex, endIndex, targetIndex);
    [startIndex, endIndex] = [indexA, indexB];

    let startItem = allItems[startIndex];
    let endItem = allItems[endIndex];

    const parentChain = (element) => {
        let chain = [];
        while (element) {
            chain.push(element);
            element = element.parentNode.closest('.folder');
        }
        return chain;
    };

    let firstChain = parentChain(document.querySelector(`[data-id="${startItem.dataset.id}"]`));
    let lastChain = parentChain(document.querySelector(`[data-id="${endItem.dataset.id}"]`));

    // Find the common ancestor
    let commonAncestor = null;
    for (let item of firstChain) {
        if (lastChain.includes(item)) {
            commonAncestor = item;
            break;
        }
    }

    // If no common ancestor found, use root
    if (!commonAncestor) {
        commonAncestor = document.querySelector('[data-id="root"]');
    }

    // Collect all items between the range
    let rangeItems = [];
    let withinRange = false;

    for (let i = 0; i < allItems.length; i++) {
        let element = allItems[i];
        if (element === startItem || element === endItem) {
            withinRange = !withinRange;
            rangeItems.push(element);
        } else if (withinRange) {
            rangeItems.push(element);
        }
    }

    // Select all items within the range and under the common ancestor
    clearSelection();
    for (let item of rangeItems) {
        if (item.parentNode.closest('.folder') === commonAncestor) {
            selectItem(item);
        }
    }
  }

  function toggleCollapse(element) {
    console.log('Toggle collapse', element.dataset.id);
    const childrenContainer = element.querySelector('.children');
    if (childrenContainer) {
      childrenContainer.classList.toggle('collapsed');
      element.classList.toggle('collapsed');
    }
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

      const openInNewWindowOption = document.createElement('div');
      openInNewWindowOption.textContent = 'Open in new window';
      openInNewWindowOption.onclick = () => {
        console.log('Context menu - Open in new window', id);
        browser.runtime.sendMessage({ action: 'openFolderInNewWindow', folderId: id });
        contextMenu.remove();
      };
      contextMenu.appendChild(openInNewWindowOption);

      const hideTabsOption = document.createElement('div');
      hideTabsOption.textContent = 'Hide tabs';
      hideTabsOption.onclick = () => {
        console.log('Context menu - Hide tabs', id);
        browser.runtime.sendMessage({ action: 'hideFolderTabs', folderId: id });
        contextMenu.remove();
      };
      contextMenu.appendChild(hideTabsOption);
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
