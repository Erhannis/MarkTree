let marksTree = {
  folders: {
    "root": {
      id: "root",
      name: "root",
      children: []
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
  });
}

function handleTabUpdate(tabId, changeInfo, tab) {
  console.log("handleTabUpdate", tabId, changeInfo, tab);
  if (changeInfo.status === 'complete') {
    const existingMarkId = Object.keys(marksTree.marks).find(id => marksTree.marks[id].tabId === tabId);
    if (existingMarkId) {
      console.log("Tab already has a mark:", existingMarkId);
      return; // Tab already has a mark, no need to create another one
    }

    if (tabsForNewMarks.has(tabId)) {
      const folderId = tabToFolderMap[tabId] || 'root';
      createMark(tab, folderId);
      tabsForNewMarks.delete(tabId);
      delete tabToFolderMap[tabId];
    } else {
      browser.tabs.query({ active: true, currentWindow: true }).then(activeTabs => {
        const activeTab = activeTabs[0];
        const activeMarkId = Object.keys(marksTree.marks).find(id => marksTree.marks[id].tabId === activeTab.id);
        const folderId = activeMarkId ? marksTree.marks[activeMarkId].folderId : 'root';
        createMark(tab, folderId);
      });
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
    parentId: parentId
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
    createNewMark('root');
  } else if (command === 'close_mark') {
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      const tabId = tabs[0].id;
      browser.tabs.remove(tabId);
      removeMark(`mark-${tabId}`);
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
  }
});

loadMarksTree();
