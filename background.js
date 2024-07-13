let marksTree = {
  folders: {
    "root": {
      name: "root",
      children: []
    }
  },
  marks: {}
};

// Utility functions to manage the marks tree
function createMark(tab, folderId = "root") {
  const markId = `mark-${tab.id}`;
  const mark = {
    id: markId,
    title: tab.title,
    url: tab.url,
    tabId: tab.id,
    folderId: folderId
  };
  // Add mark to the marksTree
  marksTree.marks[markId] = mark;
  marksTree.folders[folderId].children.push(markId);
  saveMarksTree();
  notifySidebar();
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
    children: []
  };
  marksTree.folders[folderId] = folder;
  marksTree.folders[parentId].children.push(folderId);
  saveMarksTree();
  notifySidebar();
}

function removeFolder(folderId) {
  const folder = marksTree.folders[folderId];
  if (folder && folder.children.length === 0) {
    const parent = marksTree.folders[folder.parentId];
    parent.children = parent.children.filter(id => id !== folderId);
    delete marksTree.folders[folderId];
    saveMarksTree();
    notifySidebar();
  }
}

function updateMark(tabId, updateInfo) {
  const markId = `mark-${tabId}`;
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
      createMark(tabs[0]);
      browser.tabs.create({ url: 'about:blank' });
    });
  } else if (command === 'close_mark') {
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      const tabId = tabs[0].id;
      browser.tabs.remove(tabId);
      removeMark(tabId);
    });
  }
});

browser.tabs.onCreated.addListener(tab => {
  createMark(tab);
});

browser.tabs.onRemoved.addListener(tabId => {
  removeMark(tabId);
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

loadMarksTree();
