const { useState, useRef, useEffect, useCallback } = dc;

function FileNameModal({ onSave, onCancel, initialFileName, isDarkMode, focusCanvas }) {
  const [fileName, setFileName] = useState(initialFileName);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSave = () => {
    if (fileName.trim() !== '') {
      onSave(fileName.trim());
    } else {
      if (dc.app && dc.app.flash && typeof dc.app.flash.error === 'function') {
          dc.app.flash.error('Filename cannot be empty!');
      } else {
          alert('Filename cannot be empty!');
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  const currentTheme = isDarkMode ? {
    modalBackground: 'rgba(15, 15, 15, 0.98)', 
    inputBackground: 'rgba(30, 30, 30, 0.9)', 
    inputBorder: 'rgba(139, 92, 246, 0.2)',
    textColor: '#ffffff', 
    buttonSaveBackground: '#8b5cf6', 
    buttonSaveHover: '#7c3aed',
    buttonCancelBackground: 'rgba(50, 50, 50, 0.8)', 
    buttonCancelHover: 'rgba(60, 60, 60, 0.9)',
  } : {
    modalBackground: 'rgba(255, 255, 255, 0.98)', 
    inputBackground: '#f5f5f5', 
    inputBorder: 'rgba(139, 92, 246, 0.3)',
    textColor: '#111', 
    buttonSaveBackground: '#8b5cf6', 
    buttonSaveHover: '#7c3aed',
    buttonCancelBackground: '#e0e0e0', 
    buttonCancelHover: '#d0d0d0',
  };

  const modalOverlayStyle = {
    position: 'fixed', 
    top: 0, 
    left: 0, 
    width: '100%', 
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)', 
    display: 'flex',
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 1000,
    backdropFilter: 'blur(8px)',
  };
  const modalContentStyle = {
    backgroundColor: currentTheme.modalBackground, 
    padding: '28px', 
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)', 
    color: currentTheme.textColor,
    maxWidth: '450px', 
    width: '90%', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '20px',
    border: `1px solid ${isDarkMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)'}`,
    backdropFilter: 'blur(40px)',
  };
  const inputStyle = {
    padding: '12px 14px', 
    borderRadius: '8px', 
    border: `1px solid ${currentTheme.inputBorder}`,
    backgroundColor: currentTheme.inputBackground, 
    color: currentTheme.textColor,
    fontSize: '14px', 
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  };
  const modalButtonContainerStyle = { 
    display: 'flex', 
    justifyContent: 'flex-start', 
    gap: '10px', 
    marginTop: '8px' 
  };
  const buttonStyle = {
    padding: '11px 20px', 
    borderRadius: '8px', 
    border: 'none', 
    cursor: 'pointer',
    fontSize: '13px', 
    fontWeight: '600', 
    transition: 'all 0.15s ease', 
    color: 'white',
  };
  const saveButtonStyle = { 
    ...buttonStyle, 
    backgroundColor: currentTheme.buttonSaveBackground,
    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)',
  };
  const cancelButtonStyle = { 
    ...buttonStyle, 
    backgroundColor: currentTheme.buttonCancelBackground,
    color: currentTheme.textColor,
  };

  return h('div', { style: modalOverlayStyle },
    h('div', { style: modalContentStyle },
      h('h3', { 
        style: { 
          margin: '0 0 4px 0', 
          color: currentTheme.textColor, 
          fontSize: '18px', 
          fontWeight: '600',
          textAlign: 'left',
        } 
      }, "Save Canvas"),
      h('p', { 
        style: { 
          color: currentTheme.textColor, 
          margin: '0 0 12px 0', 
          fontSize: '13px', 
          opacity: 0.7,
          textAlign: 'left',
        } 
      }, "Enter a filename for your canvas:"),
      h('input', {
        type: "text", 
        value: fileName, 
        onChange: (e) => setFileName(e.target.value),
        onKeyPress: handleKeyPress, 
        ref: inputRef, 
        style: inputStyle, 
        placeholder: "my-canvas-data",
        onFocus: (e) => {
          e.target.style.borderColor = '#8b5cf6';
          e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
        },
        onBlur: (e) => {
          e.target.style.borderColor = currentTheme.inputBorder;
          e.target.style.boxShadow = 'none';
        },
      }),
      h('div', { style: modalButtonContainerStyle },
        h('button', {
          onClick: handleSave, 
          style: saveButtonStyle,
          onMouseEnter: (e) => {
            e.target.style.backgroundColor = currentTheme.buttonSaveHover;
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.35)';
          },
          onMouseLeave: (e) => {
            e.target.style.backgroundColor = currentTheme.buttonSaveBackground;
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.25)';
          },
        }, "Save"),
        h('button', {
          onClick: () => { onCancel(); focusCanvas(); }, 
          style: cancelButtonStyle,
          onMouseEnter: (e) => {
            e.target.style.backgroundColor = currentTheme.buttonCancelHover;
          },
          onMouseLeave: (e) => {
            e.target.style.backgroundColor = currentTheme.buttonCancelBackground;
          },
        }, "Cancel")
      )
    )
  );
}

function BasicView({ children, setCanvasRef, onCanvasMouseDown, handleWheel, isSpacebarDownRef, isCanvasDraggingRef,
  selectedBoxIds, deleteSelectedBox, isCanvasLocked, setSelectedBoxIds, setIsEditing, setEditingBoxProps, setShowAddMenu, focusCanvas,
  onCopyObjects, onPasteObjects, onCutObjects
}) {
  const viewRef = useRef(null);
  const originalExecuteCommandRef = useRef(null);
  const originalExecuteRef = useRef(null);
  const ourOverriddenExecuteCommandByIdRef = useRef(null);
  const ourOverriddenExecuteRef = useRef(null);

  useEffect(() => {
    if (viewRef.current) {
      setCanvasRef.current = viewRef.current;
    }
  }, [setCanvasRef]);

  const handleKeyDown = useCallback((event) => {
    const isCanvasCurrentlyActive = viewRef.current === document.activeElement;

    if (!isCanvasCurrentlyActive) return;

    const isInputFocused = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA';
    const isMetaOrCtrl = event.metaKey || event.ctrlKey;

    if (isMetaOrCtrl) {
      if (event.code === 'KeyC') { if (!isInputFocused) { event.preventDefault(); onCopyObjects(); } return; }
      if (event.code === 'KeyX') { if (!isInputFocused) { event.preventDefault(); onCutObjects(); } return; }
      if (event.code === 'KeyV') { if (!isInputFocused) { event.preventDefault(); onPasteObjects(); } return; }
    }

    if (!isInputFocused && (event.code === 'Delete' || event.code === 'Backspace')) {
      event.preventDefault();
      if (selectedBoxIds.length > 0 && !isCanvasLocked) deleteSelectedBox();
      else if (isCanvasLocked && dc.app?.flash?.error) dc.app.flash.error("Canvas is locked. Cannot delete boxes.");
      return;
    }
    if (event.code === 'Escape') {
      if (!isInputFocused) {
        if (selectedBoxIds.length > 0) { setSelectedBoxIds([]); setIsEditing(false); setEditingBoxProps(null); }
        setShowAddMenu(false);
      }
      return;
    }
    if (event.code === 'Space' && !isInputFocused) { event.preventDefault(); return; }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') return;
  }, [deleteSelectedBox, selectedBoxIds, isCanvasLocked, setSelectedBoxIds, setIsEditing, setEditingBoxProps, setShowAddMenu, viewRef, onCopyObjects, onCutObjects, onPasteObjects]);

  const handleFocus = useCallback(() => {
    if (dc.app?.commands) {
      if (!ourOverriddenExecuteCommandByIdRef.current || dc.app.commands.executeCommandById !== ourOverriddenExecuteCommandByIdRef.current) {
        originalExecuteCommandRef.current = dc.app.commands.executeCommandById;
        originalExecuteRef.current = dc.app.commands.execute;

        const customExecuteCommandById = (commandId) => {
          if (viewRef.current === document.activeElement) {
            if (['workspace:close', 'pip:close', 'editor:copy', 'editor:paste', 'editor:cut'].includes(commandId)) {
              return originalExecuteCommandRef.current?.call(dc.app.commands, commandId) ?? true;
            }
            return false;
          }
          return originalExecuteCommandRef.current?.call(dc.app.commands, commandId) ?? true;
        };
        const customExecute = (command) => {
          if (viewRef.current === document.activeElement) {
            if (command && ['workspace:close', 'pip:close', 'editor:copy', 'editor:paste', 'editor:cut'].includes(command.id)) {
              return originalExecuteRef.current?.call(dc.app.commands, command) ?? true;
            }
            return false;
          }
          return originalExecuteRef.current?.call(dc.app.commands, command) ?? true;
        };

        dc.app.commands.executeCommandById = customExecuteCommandById;
        dc.app.commands.execute = customExecute;
        ourOverriddenExecuteCommandByIdRef.current = customExecuteCommandById;
        ourOverriddenExecuteRef.current = customExecute;
      }
    }
  }, [viewRef]);

  const handleBlur = useCallback(() => {
    if (dc.app?.commands && dc.app.commands.executeCommandById === ourOverriddenExecuteCommandByIdRef.current) {
      if (originalExecuteCommandRef.current) dc.app.commands.executeCommandById = originalExecuteCommandRef.current;
      if (originalExecuteRef.current) dc.app.commands.execute = originalExecuteRef.current;
    }
    originalExecuteCommandRef.current = null;
    originalExecuteRef.current = null;
    ourOverriddenExecuteCommandByIdRef.current = null;
    ourOverriddenExecuteRef.current = null;
  }, []);

  useEffect(() => {
    const currentViewRef = viewRef.current;
    if (!currentViewRef) return;
    focusCanvas();
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    currentViewRef.addEventListener('focus', handleFocus);
    currentViewRef.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      currentViewRef.removeEventListener('focus', handleFocus);
      currentViewRef.removeEventListener('blur', handleBlur);
      handleBlur();
    };
  }, [handleKeyDown, handleFocus, handleBlur, focusCanvas]);

  return h('div', {
    ref: viewRef, tabIndex: 0,
    style: {
      height: '100%', width: '100%', padding: '0px', border: 'none', borderRadius: '8px',
      backgroundColor: 'transparent', boxShadow: 'none', outline: 'none',
      transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', position: 'relative',
      cursor: selectedBoxIds.length > 0 ? 'default' : (isSpacebarDownRef.current ? (isCanvasDraggingRef.current ? "grabbing" : "grab") : "default"),
    },
    onMouseDown: onCanvasMouseDown,
    onWheel: handleWheel,
  }, children);
}

return { BasicView, FileNameModal };
