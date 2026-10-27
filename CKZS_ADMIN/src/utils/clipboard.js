export const copyText = async (text) => {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 权限受限时继续尝试兼容复制。
    }
  }

  const activeElement = document.activeElement;
  const selection = window.getSelection();
  const ranges = [];
  for (let index = 0; selection && index < selection.rangeCount; index += 1) {
    ranges.push(selection.getRangeAt(index).cloneRange());
  }
  const inputSelection = activeElement && typeof activeElement.selectionStart === 'number'
    ? [activeElement.selectionStart, activeElement.selectionEnd, activeElement.selectionDirection]
    : null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;font-size:16px;';
  document.body.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    // 兼容局域网 HTTP 页面中不可用的 Clipboard API。
    if (!document.execCommand('copy')) throw new Error('Copy failed');
  } finally {
    textarea.remove();
    activeElement?.focus({ preventScroll: true });
    if (inputSelection) activeElement.setSelectionRange(...inputSelection);
    if (selection) {
      selection.removeAllRanges();
      ranges.forEach(range => selection.addRange(range));
    }
  }
};
