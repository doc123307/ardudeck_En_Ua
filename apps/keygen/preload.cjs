const { contextBridge, ipcRenderer } = require('electron');

const call = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('keygen', {
  state: call('state'),
  issue: call('issue'),
  updateRecord: call('registry:update'),
  deleteRecord: call('registry:delete'),
  exportRegistry: call('registry:export'),
  copy: call('copy'),
  saveKeyFile: call('key-file:save'),
  createSigningKey: call('signing-key:create'),
  exportSigningKey: call('signing-key:export'),
  importSigningKey: call('signing-key:import'),
  setSettings: call('settings:set'),
  loadSheet: call('sheet:load'),
  openDataDir: call('data-dir:open'),
});
