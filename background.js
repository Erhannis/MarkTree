let marksTree = {
  folders: {
    "root": {
      id: "root",
      name: "root",
      children: [],
      collapsed: false
    }
  },
  marks: {}
};

let tabsForNewMarks = new Set();
let tabToFolderMap = {};

// FIX BUG-2: tracks tabs opened to reopen a closed-tab mark (tabId → markId)
let tabsForReopening = new Map();

// FIX BUG-4: queue tab update events that arrive before loadMarksTree() resolves
let treeLoaded = false;
let pendingTabUpdates = [];

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
  browser.sessions.setTabValue(tab.id, 'markId', markId);
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
  if (changeInfo.status !== 'complete') return;

  // Step 1: tab was opened by activateOrOpenMark — reconnect to existing mark
  if (tabsForReopening.has(tabId)) {
    const markId = tabsForReopening.get(tabId);
    tabsForReopening.delete(tabId);
    updateMarkById(markId, { url: tab.url, title: tab.title });
    browser.sessions.setTabValue(tabId, 'markId', markId);
    return;
  }

  // Step 2: use sessions API to identify what this tab is
  browser.sessions.getTabValue(tabId, 'markId').then(markId => {
    if (markId !== undefined && marksTree.marks[markId]) {
      const mark = marksTree.marks[markId];

      if (mark.tabId === tabId) {
        // 2a: same tab already associated with this mark — just update url/title
        console.log("Updating existing mark:", markId);
        updateMarkById(markId, { url: tab.url, title: tab.title });
        return;
      }

      // 2b: markId found but tabId differs — session restore or tab duplication
      browser.tabs.get(mark.tabId).then(
        () => {
          // Original tab still alive → this is a duplicate tab → create a new mark
          console.log("Duplicate tab detected for mark:", markId, "— creating new mark");
          createMark(tab, mark.folderId);
        },
        () => {
          // Original tab gone → session restore → reconnect this tab to the existing mark
          console.log("Session restore detected for mark:", markId, "— reconnecting tabId", tabId);
          mark.tabId = tabId;
          browser.sessions.setTabValue(tabId, 'markId', markId);
          updateMarkById(markId, { url: tab.url, title: tab.title });
        }
      );
      return;
    }

    // Step 3: no sessions markId — new tab
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
  });
}

// FIX BUG-13: suppress recursive save/notify during folder deletion; only save once at top level
function removeMark(markId, suppressSaveAndNotify = false) {
  console.log("removeMark", markId);
  const mark = marksTree.marks[markId];
  if (mark) {
    const folder = marksTree.folders[mark.folderId];
    folder.children = folder.children.filter(id => id !== markId);
    delete marksTree.marks[markId];
    if (!suppressSaveAndNotify) {
      saveMarksTree();
      notifySidebar();
    }
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
    collapsed: false
  };
  marksTree.folders[folderId] = folder;
  marksTree.folders[parentId].children.push(folderId);
  saveMarksTree();
  notifySidebar();
}

// FIX BUG-13: suppress recursive save/notify; only save once at top level
function removeFolder(folderId, suppressSaveAndNotify = false) {
  console.log("removeFolder", folderId);
  const folder = marksTree.folders[folderId];
  if (folder) {
    // Snapshot children before iteration; recursive calls modify the arrays
    const children = folder.children.slice();
    children.forEach(childId => {
      if (marksTree.folders[childId]) {
        removeFolder(childId, true);
      } else if (marksTree.marks[childId]) {
        removeMark(childId, true);
      }
    });
    if (folderId !== "root") {
      const parent = marksTree.folders[folder.parentId];
      parent.children = parent.children.filter(id => id !== folderId);
      delete marksTree.folders[folderId];
    }
    if (!suppressSaveAndNotify) {
      saveMarksTree();
      notifySidebar();
    }
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

// FIX BUG-2: update mark by markId directly (used when reopening a closed-tab mark)
function updateMarkById(markId, updateInfo) {
  console.log("updateMarkById", markId, updateInfo);
  const mark = marksTree.marks[markId];
  if (mark) {
    if (updateInfo.title) mark.title = updateInfo.title;
    if (updateInfo.url)   mark.url   = updateInfo.url;
    saveMarksTree();
    notifySidebar();
  }
}

function moveItems(draggedIds, targetFolderId) {
  console.log('Move items', draggedIds, targetFolderId);
  draggedIds.forEach(draggedId => {
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
  });
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

// FIX BUG-3: update mark tabIds before onUpdated fires, preventing duplicate mark creation.
// FIX BUG-5: was using folder.children[index] (unfiltered) instead of the filtered markIds array,
//            causing wrong tabId assignments when the folder contains subfolders.
function openFolderInNewWindow(folderId) {
  const folder = marksTree.folders[folderId];
  if (folder) {
    // Keep markIds and urls aligned by filtering together
    const markIds = folder.children.filter(id => marksTree.marks[id]);
    const urls    = markIds.map(id => marksTree.marks[id].url);
    browser.windows.create({ url: urls }).then(win => {
      // win.tabs is available immediately in the promise resolution, before tabs finish
      // loading, so we update tabIds here before any onUpdated(complete) can fire.
      win.tabs.forEach((tab, index) => {
        const markId = markIds[index];
        if (marksTree.marks[markId]) {
          marksTree.marks[markId].tabId = tab.id;
          browser.sessions.setTabValue(tab.id, 'markId', markId);
        }
      });
      saveMarksTree();
      notifySidebar();
    });
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

// FIX BUG-2: sidebar sends activateOrOpenMark; background handles tab creation so it can
//            register the new tabId in tabsForReopening before onUpdated fires.
function activateOrOpenMark(markId) {
  const mark = marksTree.marks[markId];
  if (!mark) return;
  browser.tabs.query({}).then(tabs => {
    const existingTab = tabs.find(tab => tab.id === mark.tabId);
    if (existingTab) {
      browser.tabs.update(mark.tabId, { active: true });
      browser.windows.update(existingTab.windowId, { focused: true });
    } else {
      browser.tabs.create({ url: mark.url }).then(newTab => {
        // Register before onUpdated(complete) fires so handleTabUpdate updates
        // the existing mark instead of creating a duplicate.
        tabsForReopening.set(newTab.id, markId);
        mark.tabId = newTab.id;
        browser.sessions.setTabValue(newTab.id, 'markId', markId);
        saveMarksTree();
      });
    }
  });
}

function saveMarksTree() {
  console.log("saveMarksTree");
  browser.storage.local.set({ marksTree });
}

// FIX BUG-4: set treeLoaded and flush any tab events that arrived before storage resolved.
function loadMarksTree() {
  console.log("loadMarksTree");
  browser.storage.local.get('marksTree').then(result => {
    if (result.marksTree) {
      marksTree = result.marksTree;
    }
    // Backfill setTabValue for any marks that predate the sessions API change.
    // For each open tab that matches a mark but has no stored markId, set it now
    // so the next restart can reconnect correctly without a tabId scan.
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => {
        const markId = Object.keys(marksTree.marks).find(id => marksTree.marks[id].tabId === tab.id);
        if (markId) {
          browser.sessions.getTabValue(tab.id, 'markId').then(existing => {
            if (existing === undefined) {
              browser.sessions.setTabValue(tab.id, 'markId', markId);
            }
          });
        }
      });
    });
    treeLoaded = true;
    for (const args of pendingTabUpdates) {
      handleTabUpdate(...args);
    }
    pendingTabUpdates = [];
  });
}

function notifySidebar() {
  console.log("notifySidebar");
  browser.runtime.sendMessage({ action: 'updateMarks' }).catch(() => {
    // Sidebar may not be open; ignore the error.
  });
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
  }
});

// FIX BUG-4: queue events that arrive before loadMarksTree() resolves to prevent
//            them from saving an empty tree and wiping stored data.
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!treeLoaded) {
    if (changeInfo.status === 'complete') {
      pendingTabUpdates.push([tabId, changeInfo, tab]);
    }
    return;
  }
  handleTabUpdate(tabId, changeInfo, tab);
});

// FIX BUG-6: the original listener called removeMark(`mark-${tabId}`) which never matched
// anything (mark IDs are mark-${Date.now()}, not mark-${tabId}). The intended behavior is
// that marks survive tab closure, so this listener is intentionally removed per todo.txt.

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
  } else if (message.action === 'activateOrOpenMark') {
    // FIX BUG-1/2: was 'updateMark' with wrong args (message.markId instead of tabId+updateInfo).
    // Tab creation now lives in background to avoid race with onUpdated.
    activateOrOpenMark(message.markId);
  } else if (message.action === 'moveItems') {
    moveItems(message.draggedIds, message.targetFolderId);
  } else if (message.action === 'toggleFolderCollapse') {
    toggleFolderCollapse(message.folderId);
  } else if (message.action === 'openFolderInNewWindow') {
    openFolderInNewWindow(message.folderId);
  } else if (message.action === 'hideFolderTabs') {
    hideFolderTabs(message.folderId);
  } else if (message.action === 'updateMarks') {
    // Sidebar imported a new tree — reload so background in-memory state stays in sync.
    // Without this, the next saveMarksTree() call would overwrite the imported tree.
    loadMarksTree();
  }
});

loadMarksTree();

// Add listener for browser action to open the sidebar
browser.browserAction.onClicked.addListener(() => {
  browser.sidebarAction.open();
});
