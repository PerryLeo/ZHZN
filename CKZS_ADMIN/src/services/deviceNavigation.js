let selectedDevice = null;

export const setSelectedDevice = (device) => {
  selectedDevice = device ? { ...device } : null;
};

export const getSelectedDevice = () => selectedDevice;
