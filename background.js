let marksTree = {
  folders: {
    "root": {
      id: "root",
      name: "root",
      children: [],
      collapsed: false // Add collapsed property
    }
  },
  marks: {}
};

let tabsForNewMarks = new Set();
let tabToFolderMap = {};

// Utility functions to manage the marks tree
function createMark(tab, folderId = "root") {
  console.log("createMark", tab, folderId);
  const markId = `mark-${Date.now()}`;
  const mark = {
    id: markId,
    title: tab.title,
    url: tab.url,
    tabId: tab.id,
    folderId: folderId
  };
  marksTree.marks[markId] = mark;
  marksTree.folders[folderId].children.push(markId);
  saveMarksTree();
  notifySidebar();
}

function createNewMark(folderId = "root") {
  console.log("createNewMark", folderId);
  browser.tabs.create({ url: 'about:blank' }).then(newTab => {
    tabsForNewMarks.add(newTab.id);
    tabToFolderMap[newTab.id] = folderId;
    //RAINY Focus the address bar of the new tab
  });
}

function handleTabUpdate(tabId, changeInfo, tab) {
  console.log("handleTabUpdate", tabId, changeInfo, tab);
  if (changeInfo.status === 'complete') {
    const existingMarkId = Object.keys(marksTree.marks).find(id => marksTree.marks[id].tabId === tabId);
    if (existingMarkId) {
      console.log("Updating existing mark:", existingMarkId);
      updateMark(tabId, { url: tab.url, title: tab.title });
    } else if (tabsForNewMarks.has(tabId)) {
      const folderId = tabToFolderMap[tabId] || 'root';
      createMark(tab, folderId);
      tabsForNewMarks.delete(tabId);
      delete tabToFolderMap[tabId];
    } else {
      if (!tabsForNewMarks.has(tab.id)) {
        browser.tabs.query({ active: true, currentWindow: true }).then(activeTabs => {
          const activeTab = activeTabs[0];
          const activeMarkId = Object.keys(marksTree.marks).find(id => marksTree.marks[id].tabId === activeTab.id);
          const folderId = activeMarkId ? marksTree.marks[activeMarkId].folderId : 'root';
          createMark(tab, folderId);
        });
      }
    }
  }
}

function removeMark(markId) {
  console.log("removeMark", markId);
  const mark = marksTree.marks[markId];
  if (mark) {
    const folder = marksTree.folders[mark.folderId];
    folder.children = folder.children.filter(id => id !== markId);
    delete marksTree.marks[markId];
    saveMarksTree();
    notifySidebar();
  }
}

function createFolder(folderName, parentId = "root") {
  console.log("createFolder", folderName, parentId);
  const folderId = `folder-${Date.now()}`;
  const folder = {
    id: folderId,
    name: folderName,
    children: [],
    parentId: parentId,
    collapsed: false // Add collapsed property
  };
  marksTree.folders[folderId] = folder;
  marksTree.folders[parentId].children.push(folderId);
  saveMarksTree();
  notifySidebar();
}

function removeFolder(folderId) {
  console.log("removeFolder", folderId);
  const folder = marksTree.folders[folderId];
  if (folder) {
    folder.children.forEach(childId => {
      if (marksTree.folders[childId]) {
        removeFolder(childId);
      } else if (marksTree.marks[childId]) {
        removeMark(childId);
      }
    });
    if (folderId !== "root") {
      const parent = marksTree.folders[folder.parentId];
      parent.children = parent.children.filter(id => id !== folderId);
      delete marksTree.folders[folderId];
    }
    saveMarksTree();
    notifySidebar();
  }
}

function updateMark(tabId, updateInfo) {
  console.log("updateMark", tabId, updateInfo);
  const markId = Object.keys(marksTree.marks).find(id => marksTree.marks[id].tabId === tabId);
  const mark = marksTree.marks[markId];
  if (mark) {
    if (updateInfo.title) {
      mark.title = updateInfo.title;
    }
    if (updateInfo.url) {
      mark.url = updateInfo.url;
    }
    saveMarksTree();
    notifySidebar();
  }
}

function moveItem(draggedId, targetFolderId) {
  console.log('Move item', draggedId, targetFolderId);
  if (isDescendant(targetFolderId, draggedId)) {
    console.error('Cannot move folder into one of its descendants');
    return;
  }
  if (marksTree.folders[draggedId]) {
    const folder = marksTree.folders[draggedId];
    const parentFolder = marksTree.folders[folder.parentId];
    parentFolder.children = parentFolder.children.filter(id => id !== draggedId);
    folder.parentId = targetFolderId;
    marksTree.folders[targetFolderId].children.push(draggedId);
  } else if (marksTree.marks[draggedId]) {
    const mark = marksTree.marks[draggedId];
    const parentFolder = marksTree.folders[mark.folderId];
    parentFolder.children = parentFolder.children.filter(id => id !== draggedId);
    mark.folderId = targetFolderId;
    marksTree.folders[targetFolderId].children.push(draggedId);
  }
  saveMarksTree();
  notifySidebar();
}

function toggleFolderCollapse(folderId) {
  console.log("toggleFolderCollapse", folderId);
  if (marksTree.folders[folderId]) {
    marksTree.folders[folderId].collapsed = !marksTree.folders[folderId].collapsed;
    saveMarksTree();
    notifySidebar();
  }
}

function isDescendant(childId, parentId) {
  console.log('Is descendant', childId, parentId);
  if (childId === parentId) {
    return true;
  }
  const folder = marksTree.folders[childId];
  if (folder && folder.parentId) {
    return isDescendant(folder.parentId, parentId);
  }
  return false;
}

function openFolderInNewWindow(folderId) {
  const folder = marksTree.folders[folderId];
  if (folder) {
    const urls = folder.children
      .filter(id => marksTree.marks[id])
      .map(id => marksTree.marks[id].url);
    browser.windows.create({ url: urls });
  }
}

function hideFolderTabs(folderId) {
  const folder = marksTree.folders[folderId];
  if (folder) {
    folder.children
      .filter(id => marksTree.marks[id])
      .forEach(id => browser.tabs.remove(marksTree.marks[id].tabId));
  }
}

function saveMarksTree() {
  console.log("saveMarksTree");
  browser.storage.local.set({ marksTree });
}

function loadMarksTree() {
  console.log("loadMarksTree");
  browser.storage.local.get('marksTree').then(result => {
    if (result.marksTree) {
      marksTree = result.marksTree;
    }
  });
}

function notifySidebar() {
  console.log("notifySidebar");
  browser.runtime.sendMessage({ action: 'updateMarks' });
}

browser.commands.onCommand.addListener(command => {
  console.log("onCommand", command);
  if (command === 'new_mark') {
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      const activeTab = tabs[0];
      const activeMarkId = Object.keys(marksTree.marks).find(id => marksTree.marks[id].tabId === activeTab.id);
      const folderId = activeMarkId ? marksTree.marks[activeMarkId].folderId : 'root';
      createNewMark(folderId);
    });
  } else if (command === 'close_mark') {
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      const tabId = tabs[0].id;
      const markId = Object.keys(marksTree.marks).find(id => marksTree.marks[id].tabId === tabId);
      if (markId) {
        removeMark(markId);
      }
      browser.tabs.remove(tabId);
    });
  } else if (command === 'new_tab_with_mark') {
    browser.tabs.query({ active: true, currentWindow: true }).then(activeTabs => {
      const activeTab = activeTabs[0];
      const activeMarkId = Object.keys(marksTree.marks).find(id => marksTree.marks[id].tabId === activeTab.id);
      const folderId = activeMarkId ? marksTree.marks[activeMarkId].folderId : 'root';
      createNewMark(folderId);
    });
  }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  handleTabUpdate(tabId, changeInfo, tab);
});

browser.tabs.onRemoved.addListener(tabId => {
  console.log("onRemoved", tabId);
  removeMark(`mark-${tabId}`);
});

// Context menu for opening a link with a corresponding mark
browser.contextMenus.create({
  id: "open-with-mark",
  title: "Open with Mark",
  contexts: ["link"]
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  console.log("contextMenus.onClicked", info, tab);
  if (info.menuItemId === "open-with-mark") {
    browser.tabs.create({ url: info.linkUrl }).then(newTab => {
      createMark(newTab);
    });
  }
});

// Listen for messages from sidebar
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("onMessage", message);
  if (message.action === 'createMark') {
    createNewMark(message.folderId);
  } else if (message.action === 'createFolder') {
    createFolder(message.folderName, message.parentId);
  } else if (message.action === 'deleteFolder') {
    removeFolder(message.folderId);
  } else if (message.action === 'deleteMark') {
    removeMark(message.markId);
  } else if (message.action === 'moveItem') {
    moveItem(message.draggedId, message.targetFolderId);
  } else if (message.action === 'toggleFolderCollapse') {
    toggleFolderCollapse(message.folderId);
  } else if (message.action === 'openFolderInNewWindow') {
    openFolderInNewWindow(message.folderId);
  } else if (message.action === 'hideFolderTabs') {
    hideFolderTabs(message.folderId);
  }
});

loadMarksTree();

// Add listener for browser action to open the sidebar
browser.browserAction.onClicked.addListener(() => {
  browser.sidebarAction.open();
});
