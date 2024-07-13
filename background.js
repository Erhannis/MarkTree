let marksTree = {
  folders: {},
  marks: {}
};

// Utility functions to manage the marks tree
function createMark(tab) {
  console.log("createMark", tab);
  const mark = {
    title: tab.title,
    url: tab.url,
    tabId: tab.id
  };
  // Add mark to the marksTree (update this logic as needed)
  marksTree.marks[tab.id] = mark;
  saveMarksTree();
}

function removeMark(tabId) {
  console.log("removeMark", tabId);
  delete marksTree.marks[tabId];
  saveMarksTree();
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

browser.commands.onCommand.addListener(command => {
  if (command === 'new_mark') {
    console.log("command: new_mark");
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      createMark(tabs[0]);
      browser.tabs.create({ url: 'about:blank' });
    });
  } else if (command === 'close_mark') {
    console.log("command: close_mark");
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      const tabId = tabs[0].id;
      browser.tabs.remove(tabId);
      removeMark(tabId);
    });
  }
});

browser.contextMenus.create({
  id: "open-with-mark",
  title: "Open with Mark",
  contexts: ["link"]
});
  
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-with-mark") {
    console.log("command: open-with-mark");
    createMark(tab);
    browser.tabs.create({ url: info.linkUrl });
  }
});

browser.tabs.onCreated.addListener(tab => {
  console.log("heard: browser.tabs.onCreated");
  createMark(tab);
});

browser.tabs.onRemoved.addListener(tabId => {
  console.log("heard: browser.tabs.onRemoved");
  removeMark(tabId);
});

loadMarksTree();
