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

// Utility functions to manage the marks tree
function createMark(tab, folderId = "root") {
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
  browser.tabs.create({ url: 'about:blank' }).then(newTab => {
    tabsForNewMarks.add(newTab.id);
    browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
      if (tabId === newTab.id && changeInfo.status === 'complete') {
        createMark(tab, folderId);
        browser.tabs.onUpdated.removeListener(listener);
        tabsForNewMarks.delete(tabId);
      }
    });
  });
}

function removeMark(markId) {
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
  browser.storage.local.set({ marksTree });
}

function loadMarksTree() {
  browser.storage.local.get('marksTree').then(result => {
    if (result.marksTree) {
      marksTree = result.marksTree;
    }
  });
}

function notifySidebar() {
  browser.runtime.sendMessage({ action: 'updateMarks' });
}

browser.commands.onCommand.addListener(command => {
  if (command === 'new_mark') {
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      createNewMark('root');
    });
  } else if (command === 'close_mark') {
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      const tabId = tabs[0].id;
      browser.tabs.remove(tabId);
      removeMark(`mark-${tabId}`);
    });
  }
});

browser.tabs.onCreated.addListener(tab => {
  if (!tabsForNewMarks.has(tab.id)) {
    createMark(tab);
  }
});

browser.tabs.onRemoved.addListener(tabId => {
  removeMark(`mark-${tabId}`);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url || changeInfo.title) {
    updateMark(tabId, changeInfo);
  }
});

// Context menu for opening a link with a corresponding mark
browser.contextMenus.create({
  id: "open-with-mark",
  title: "Open with Mark",
  contexts: ["link"]
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-with-mark") {
    browser.tabs.create({ url: info.linkUrl }).then(newTab => {
      createMark(newTab);
    });
  }
});

// Listen for messages from sidebar
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
