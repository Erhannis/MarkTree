let marksTree = {
  folders: {},
  marks: {}
};

// Utility functions to manage the marks tree
function createMark(tab) {
  const mark = {
    title: tab.title,
    url: tab.url,
    tabId: tab.id
  };
  // Add mark to the marksTree (update this logic as needed)
  marksTree.marks[tab.id] = mark;
  saveMarksTree();
  notifySidebar();
}

function removeMark(tabId) {
  delete marksTree.marks[tabId];
  saveMarksTree();
  notifySidebar();
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
