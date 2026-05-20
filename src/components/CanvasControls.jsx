const { useState, useRef, useEffect, useCallback, Fragment } = dc;

function getInt(val) {
  return parseInt(val, 10) || 0;
}

function useCanvasInteractions({
  canvasRef, positionRef, zoomRef, setPosition, setZoom,
  boxes, setBoxes, selectedBoxIds, setSelectedBoxIds, screenToWorld,
  ZOOM_SPEED, PAN_SPEED, setIsEditing, setEditingBoxProps, setShowAddMenu,
  addMenuRef, isSpacebarDownRef, isControlDownRef, isShiftDownRef,
  setMarqueeRect, isCanvasLocked, lastKnownMouseScreenPosRef, focusCanvas
}) {
  const isCanvasDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const isBoxDraggingRef = useRef(false);
  const isResizingBoxRef = useRef(false);
  const resizeHandle = useRef(null);
  const initialBoxProps = useRef(null);
  const initialSelectedBoxStates = useRef([]);
  const isMarqueeSelectingRef = useRef(false);
  const marqueeStartScreenPosRef = useRef({ x: 0, y: 0 });
  const initialWorldMousePosRef = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e) => {
    if (isCanvasLocked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const currentPosition = positionRef.current;
    const currentZoom = zoomRef.current;
    
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const prevZoom = currentZoom;
        const zoomFactor = e.deltaY > 0 ? 1 / (1 + ZOOM_SPEED) : (1 + ZOOM_SPEED);
        const newZoom = Math.max(0.1, Math.min(prevZoom * zoomFactor, 10));
        const worldMouseX_before = (mouseX - currentPosition.x) / prevZoom;
        const worldMouseY_before = (mouseY - currentPosition.y) / prevZoom;
        const newPosX = mouseX - (worldMouseX_before * newZoom);
        const newPosY = mouseY - (worldMouseY_before * newZoom);
        setZoom(newZoom);
        setPosition({ x: newPosX, y: newPosY });
    } else {
        let dx = e.deltaX !== 0 ? -e.deltaX * PAN_SPEED : 0;
        let dy = e.deltaY !== 0 ? -e.deltaY * PAN_SPEED : 0;
        if (dx !== 0 || dy !== 0) {
            e.preventDefault();
            setPosition((prevPos) => ({ x: prevPos.x + dx, y: prevPos.y + dy }));
        }
    }
  }, [canvasRef, positionRef, zoomRef, setPosition, setZoom, ZOOM_SPEED, PAN_SPEED, isCanvasLocked]);

  const handleBoxMouseDown = useCallback((e, boxId) => {
    const box = boxes.find(b => b.id === boxId);
    if (!box) return;

    if (isCanvasLocked) {
        if (box.type === 'datacore-component') {
            return; 
        }
        e.stopPropagation();
        e.preventDefault();
        return;
    }

    e.stopPropagation();

    let newSelectedIds = [...selectedBoxIds];
    const isBoxCurrentlySelected = newSelectedIds.includes(boxId);
    
    let shouldInitDrag = true;

    if (isShiftDownRef.current) {
        newSelectedIds = isBoxCurrentlySelected ? newSelectedIds.filter(id => id !== boxId) : [...newSelectedIds, boxId];
    } else if (isControlDownRef.current) {
        newSelectedIds = isBoxCurrentlySelected ? newSelectedIds.filter(id => id !== boxId) : [...newSelectedIds, boxId];
    } else {
        if (!isBoxCurrentlySelected) {
            newSelectedIds = [boxId];
        }
    }

    setSelectedBoxIds(newSelectedIds);
    setShowAddMenu(false);

    if (newSelectedIds.length === 1) {
        const boxToEdit = boxes.find(b => b.id === newSelectedIds[0]);
        if (boxToEdit) {
            const propsArray = Object.entries(boxToEdit.props || {}).map(([key, value]) => ({ key, value: String(value) }));
            setEditingBoxProps({ ...boxToEdit, propsArray });
            setIsEditing(true);
        }
        if (box.type === 'datacore-component' && !isBoxCurrentlySelected && !isControlDownRef.current && !isShiftDownRef.current) {
            shouldInitDrag = false;
        }
    } else {
        setEditingBoxProps(null);
        setIsEditing(false);
    }

    if (shouldInitDrag && newSelectedIds.length > 0) {
        isBoxDraggingRef.current = true;
        initialSelectedBoxStates.current = boxes
            .filter(b => newSelectedIds.includes(b.id))
            .map(b => ({ ...b }));
        initialWorldMousePosRef.current = screenToWorld(e.clientX, e.clientY);
    }
    
    focusCanvas();
    e.preventDefault();
  }, [boxes, selectedBoxIds, isControlDownRef, isShiftDownRef, screenToWorld, setSelectedBoxIds, setIsEditing, setEditingBoxProps, setShowAddMenu, isCanvasLocked, focusCanvas]);

  const handleHandleMouseDown = useCallback((e, boxId, handleType) => {
    if (isCanvasLocked) return;
    e.stopPropagation(); e.preventDefault();
    const box = boxes.find(b => b.id === boxId);
    if (!box) return;
    setSelectedBoxIds([boxId]);
    isResizingBoxRef.current = true;
    setIsEditing(false);
    setShowAddMenu(false);
    resizeHandle.current = handleType;
    initialBoxProps.current = { ...box };
    focusCanvas();
  }, [boxes, setSelectedBoxIds, setIsEditing, setShowAddMenu, isCanvasLocked, focusCanvas]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    lastKnownMouseScreenPosRef.current = { x: e.clientX, y: e.clientY };

    if (isCanvasDraggingRef.current) {
      const dxScreen = e.clientX - lastMousePosRef.current.x;
      const dyScreen = e.clientY - lastMousePosRef.current.y;
      setPosition((prevPos) => ({ x: prevPos.x + dxScreen, y: prevPos.y + dyScreen }));
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    } else if (isBoxDraggingRef.current && initialSelectedBoxStates.current.length > 0) {
      const { x: worldMouseX, y: worldMouseY } = screenToWorld(e.clientX, e.clientY);
      const deltaX = worldMouseX - initialWorldMousePosRef.current.x;
      const deltaY = worldMouseY - initialWorldMousePosRef.current.y;
      setBoxes(prevBoxes => {
          const newBoxesMap = new Map(prevBoxes.map(box => [box.id, { ...box }]));
          initialSelectedBoxStates.current.forEach(initialBoxState => {
              const boxToUpdate = newBoxesMap.get(initialBoxState.id);
              if (boxToUpdate) {
                  boxToUpdate.x = initialBoxState.x + deltaX;
                  boxToUpdate.y = initialBoxState.y + deltaY;
              }
          });
          return Array.from(newBoxesMap.values());
      });
    } else if (isResizingBoxRef.current && initialBoxProps.current) {
      const { x: worldMouseX, y: worldMouseY } = screenToWorld(e.clientX, e.clientY);
      const initial = initialBoxProps.current;
      const handle = resizeHandle.current;
      const minSize = 20;

      setBoxes(prevBoxes => prevBoxes.map(box => {
        if (box.id === initial.id) {
          let newX = initial.x, newY = initial.y, newWidth = initial.width, newHeight = initial.height;
          const initialRight = initial.x + initial.width;
          const initialBottom = initial.y + initial.height;

          if (handle.includes('r')) {
            newWidth = Math.max(minSize, worldMouseX - initial.x);
          }
          if (handle.includes('l')) {
            const desiredWidth = initialRight - worldMouseX;
            if (desiredWidth >= minSize) {
              newWidth = desiredWidth;
              newX = worldMouseX;
            } else {
              newWidth = minSize;
              newX = initialRight - minSize;
            }
          }

          if (handle.includes('b')) {
            newHeight = Math.max(minSize, worldMouseY - initial.y);
          }
          if (handle.includes('t')) {
            const desiredHeight = initialBottom - worldMouseY;
            if (desiredHeight >= minSize) {
              newHeight = desiredHeight;
              newY = worldMouseY;
            } else {
              newHeight = minSize;
              newY = initialBottom - minSize;
            }
          }
          
          return { ...box, x: newX, y: newY, width: newWidth, height: newHeight };
        }
        return box;
      }));
    } else if (isMarqueeSelectingRef.current) {
      const startX = marqueeStartScreenPosRef.current.x;
      const startY = marqueeStartScreenPosRef.current.y;
      const currentX = e.clientX;
      const currentY = e.clientY;
      const rect = canvas.getBoundingClientRect();
      setMarqueeRect({
        x: Math.min(startX, currentX) - rect.left,
        y: Math.min(startY, currentY) - rect.top,
        width: Math.abs(startX - currentX),
        height: Math.abs(startY - currentY),
      });

      const marqueeWorldStart = screenToWorld(startX, startY);
      const marqueeWorldEnd = screenToWorld(currentX, currentY);
      const marqueeMinX = Math.min(marqueeWorldStart.x, marqueeWorldEnd.x);
      const marqueeMinY = Math.min(marqueeWorldStart.y, marqueeWorldEnd.y);
      const marqueeMaxX = Math.max(marqueeWorldStart.x, marqueeWorldEnd.x);
      const marqueeMaxY = Math.max(marqueeWorldStart.y, marqueeWorldEnd.y);
      
      const boxesInMarquee = boxes.filter(box => {
        const boxMaxX = box.x + box.width, boxMaxY = box.y + box.height;
        return !(boxMaxX < marqueeMinX || box.x > marqueeMaxX || boxMaxY < marqueeMinY || box.y > marqueeMaxY);
      }).map(box => box.id);

      if (isControlDownRef.current || isShiftDownRef.current) {
        const combined = new Set([...selectedBoxIds, ...boxesInMarquee]);
        setSelectedBoxIds([...combined]);
      } else {
        setSelectedBoxIds(boxesInMarquee);
      }
    }
  }, [setPosition, setBoxes, screenToWorld, canvasRef, setMarqueeRect, initialWorldMousePosRef, initialBoxProps, initialSelectedBoxStates, boxes, selectedBoxIds, setSelectedBoxIds, isControlDownRef, isShiftDownRef]);

  const handleMouseUp = useCallback((event) => {
    isCanvasDraggingRef.current = false;
    isBoxDraggingRef.current = false;
    isResizingBoxRef.current = false;
    resizeHandle.current = null;
    initialBoxProps.current = null;
    initialSelectedBoxStates.current = [];
    
    if (isMarqueeSelectingRef.current) {
        isMarqueeSelectingRef.current = false;
        setMarqueeRect(null);
        focusCanvas();
    }
  }, [setMarqueeRect, focusCanvas]);

  const onCanvasMouseDown = useCallback((e) => {
    const isClickOnInteractiveElement = e.target.closest('.box-container, .edit-panel, .screen-mode-button, .burger-menu-button');
    if (isCanvasLocked && !isClickOnInteractiveElement) { e.preventDefault(); e.stopPropagation(); return; }
    if (isClickOnInteractiveElement || (addMenuRef.current && addMenuRef.current.contains(e.target))) { return; }
    if (!isControlDownRef.current && !isSpacebarDownRef.current && !isShiftDownRef.current) {
        setSelectedBoxIds([]);
        setIsEditing(false);
        setEditingBoxProps(null);
        setShowAddMenu(false);
    }
    if (isSpacebarDownRef.current) {
        isCanvasDraggingRef.current = true;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    } else {
        isMarqueeSelectingRef.current = true;
        marqueeStartScreenPosRef.current = { x: e.clientX, y: e.clientY };
    }
    e.preventDefault();
    focusCanvas();
  }, [setSelectedBoxIds, setIsEditing, setEditingBoxProps, setShowAddMenu, addMenuRef, isSpacebarDownRef, isControlDownRef, isShiftDownRef, isCanvasLocked, focusCanvas]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return {
    isCanvasDraggingRef,
    handleWheel,
    handleBoxMouseDown,
    handleHandleMouseDown,
    onCanvasMouseDown,
  };
}

function useCanvasPersistence({
  boxes, setBoxes,
  position, setPosition,
  zoom, setZoom,
  isDarkMode, setIsDarkMode,
  isCanvasLocked, setIsCanvasLocked,
  setSelectedBoxIds,
  setIsEditing,
  setEditingBoxProps,
  setShowAddMenu,
  setShowSaveModal,
  setShowLoadMenu,
  setAvailableSaves,
  dc,
  focusCanvas
}) {
  const performSave = useCallback(async (userFileName) => {
    const folderPath = ".datacore/dc.canvas";

    userFileName = userFileName.trim();
    if (!userFileName.endsWith('.json')) {
      userFileName += '.json';
    }
    const fullPath = `${folderPath}/${userFileName}`;

    const canvasData = {
      canvasState: {
        position: position,
        zoom: zoom,
        isDarkMode: isDarkMode,
        isCanvasLocked: isCanvasLocked,
      },
      boxes: boxes,
    };

    try {
        const adapter = app.vault.adapter;

        if (!adapter) {
            console.error("Obsidian app.vault.adapter is not available.");
            if (dc.app?.flash?.error) {
                dc.app.flash.error("Obsidian file system API is not available. Cannot save.");
            }
            return;
        }

        const folderExists = await adapter.exists(folderPath);
        if (!folderExists) {
            await adapter.mkdir(folderPath);
        }

        await adapter.write(fullPath, JSON.stringify(canvasData, null, 2));
        if (dc.app?.flash?.success) {
            dc.app.flash.success(`Canvas '${userFileName}' saved successfully!`);
        }
        focusCanvas();
    } catch (error) {
        console.error("Error saving canvas:", error);
        if (dc.app?.flash?.error) {
            dc.app.flash.error(`Failed to save canvas: ${error.message}`);
        }
    }
  }, [boxes, position, zoom, isDarkMode, isCanvasLocked, dc.app, focusCanvas]);

  const listSavedCanvases = useCallback(async () => {
    const folderPath = ".datacore/dc.canvas";
    const adapter = app.vault.adapter;

    if (!adapter) {
        console.error("Obsidian app.vault.adapter is not available. Cannot list files.");
        if (dc.app?.flash?.error) {
            dc.app.flash.error("Obsidian file system API is not available. Cannot list files.");
        }
        setAvailableSaves([]);
        return;
    }

    try {
        const folderExists = await adapter.exists(folderPath);
        if (!folderExists) {
            setAvailableSaves([]);
            return;
        }

        const files = await adapter.list(folderPath);
        const jsonFiles = files.files
                               .filter(f => f.endsWith('.json'))
                               .map(f => f.substring(folderPath.length + 1));

        setAvailableSaves(jsonFiles);
    } catch (error) {
        console.error("Error listing canvas files:", error);
        setAvailableSaves([]);
    }
  }, [setAvailableSaves, dc.app]);

  const loadSpecificCanvas = useCallback(async (filename) => {
    const folderPath = ".datacore/dc.canvas";
    const fullPath = `${folderPath}/${filename}`;
    const adapter = app.vault.adapter;

    if (!adapter) {
        console.error("Obsidian app.vault.adapter is not available. Cannot load file.");
        return;
    }

    try {
        const fileContent = await adapter.read(fullPath);
        const loadedData = JSON.parse(fileContent);

        if (loadedData.canvasState) {
            setPosition(loadedData.canvasState.position);
            setZoom(loadedData.canvasState.zoom);
            setIsDarkMode(loadedData.canvasState.isDarkMode ?? true);
            setIsCanvasLocked(loadedData.canvasState.isCanvasLocked ?? false);
        }
        if (loadedData.boxes) {
            setBoxes(loadedData.boxes);
        }

        setSelectedBoxIds([]);
        setIsEditing(false);
        setEditingBoxProps(null);
        setShowAddMenu(false);
        focusCanvas();

        if (dc.app?.flash?.success) {
            dc.app.flash.success(`Canvas '${filename}' loaded successfully!`);
        }
    } catch (error) {
        console.error(`Error loading canvas '${filename}':`, error);
        if (dc.app?.flash?.error) {
            dc.app.flash.error(`Failed to load canvas '${filename}': ${error.message}`);
        }
    }
  }, [setBoxes, setPosition, setZoom, setIsDarkMode, setIsCanvasLocked, setSelectedBoxIds, setIsEditing, setEditingBoxProps, setShowAddMenu, dc.app, focusCanvas]);

  const handleModalSave = useCallback(async (filename) => {
    setShowSaveModal(false);
    await performSave(filename);
    await listSavedCanvases();
  }, [performSave, setShowSaveModal, listSavedCanvases]);

  const handleModalCancel = useCallback(() => {
    setShowSaveModal(false);
    focusCanvas();
  }, [setShowSaveModal, focusCanvas]);

  const handleSaveCanvas = useCallback(() => {
    if (isCanvasLocked) {
      if (dc.app?.flash?.error) {
        dc.app.flash.error("Canvas is locked. Cannot save.");
      }
      return;
    }
    if (boxes.length === 0) {
      if (dc.app?.flash?.info) {
        dc.app.flash.info("Nothing to save! Add some boxes first.");
      }
      return;
    }
    setShowSaveModal(true);
  }, [isCanvasLocked, boxes, setShowSaveModal, dc.app]);

  const handleLoadCanvas = useCallback(async () => {
    await listSavedCanvases();
    setShowLoadMenu(true);
  }, [listSavedCanvases, setShowLoadMenu]);

  const deleteCanvas = useCallback(async (filename) => {
    const folderPath = ".datacore/dc.canvas";
    const fullPath = `${folderPath}/${filename}`;
    const adapter = app.vault.adapter;

    if (!adapter) {
      console.error("Obsidian app.vault.adapter is not available.");
      return;
    }

    try {
      await adapter.remove(fullPath);
      if (dc.app?.flash?.success) {
        dc.app.flash.success(`Canvas '${filename}' deleted successfully!`);
      }
      await listSavedCanvases();
    } catch (error) {
      console.error("Error deleting canvas:", error);
    }
  }, [dc.app, listSavedCanvases]);

  return {
    handleSaveCanvas, handleLoadCanvas,
    handleModalSave, handleModalCancel, loadSpecificCanvas,
    deleteCanvas, listSavedCanvases,
  };
}

function EditPanel({ 
    editingBoxProps, handleChangeEditField, handleSaveEdit, handleCancelEdit, 
    isDarkMode, currentTheme, focusCanvas,
    onAddCustomProp, onRemoveCustomProp, onChangeCustomProp
}) {
  if (!editingBoxProps) return null;

  const theme = isDarkMode ? 
    { background: '#0a0a0a', border: '#1a1a1a', textColor: '#ffffff', inputBackground: 'rgba(0, 0, 0, 0.3)' } : 
    { background: '#f5f5f5', border: '#333', textColor: '#111', inputBackground: 'rgba(255, 255, 255, 0.5)' };
  
  const safeTheme = currentTheme || theme;

  const [availableComponents, setAvailableComponents] = useState([]);
  
  useEffect(() => {
    const allFiles = app.vault.getMarkdownFiles();
    const componentFiles = allFiles.filter(file => 
      file.path.includes('_RESOURCES/DATACORE') &&
      file.path.endsWith('.component.md')
    );
    
    const components = componentFiles.map(file => {
      const fileName = file.name.replace('.md', '');
      const parts = fileName.split('.');
      const componentName = parts[2] || parts[1];
      
      return {
        displayName: componentName.charAt(0).toUpperCase() + componentName.slice(1),
        fileName: fileName,
        path: file.path
      };
    });
    
    setAvailableComponents(components.sort((a, b) => a.displayName.localeCompare(b.displayName)));
  }, []);
  
  const handleQuickLoadComponent = (fileName) => {
    handleChangeEditField({ target: { name: 'componentName', value: fileName } });
  };

  const toHexColor = (color) => {
    if (!color) return '#000000';
    if (color.startsWith('#')) return color.length === 7 ? color : '#000000';
    return '#000000';
  };

  const [panelPosition, setPanelPosition] = useState(() => {
    const saved = localStorage.getItem('canvas-edit-panel-position');
    return saved ? JSON.parse(saved) : { top: 80, right: 20 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('canvas-edit-panel-position', JSON.stringify(panelPosition));
  }, [panelPosition]);

  const handlePanelWheel = (e) => {
    e.stopPropagation();
  };

  const handleMouseDown = (e) => {
    if (!e.target.closest('.edit-panel-header')) return;
    
    setIsDragging(true);
    const rect = panelRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!panelRef.current) return;
      
      const container = panelRef.current.parentElement;
      const containerRect = container.getBoundingClientRect();
      
      let newLeft = e.clientX - containerRect.left - dragOffset.x;
      let newTop = e.clientY - containerRect.top - dragOffset.y;
      
      const panelWidth = panelRef.current.offsetWidth;
      const panelHeight = panelRef.current.offsetHeight;
      
      newLeft = Math.max(0, Math.min(newLeft, containerRect.width - panelWidth));
      newTop = Math.max(0, Math.min(newTop, containerRect.height - panelHeight));
      
      setPanelPosition({ 
        top: newTop, 
        left: newLeft,
        right: undefined
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const inputStyle = {
    padding: '10px 12px', 
    borderRadius: '6px',
    border: `1px solid ${isDarkMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(51, 51, 51, 0.3)'}`,
    background: isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.5)',
    color: isDarkMode ? '#ffffff' : '#111',
    fontSize: '13px',
    transition: 'border-color 0.2s ease, background 0.2s ease',
  };
  const labelStyle = { 
    fontSize: '13px', 
    margin: 0, 
    cursor: 'default',
    fontWeight: '500',
    color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
  };
  const fieldContainerStyle = { display: 'flex', flexDirection: 'column', gap: '6px' };
  const buttonGroupStyle = { display: 'flex', justifyContent: 'flex-end', gap: '10px' };
  const buttonStyle = {
    padding: '10px 18px', 
    borderRadius: '8px', 
    border: 'none',
    color: 'white', 
    cursor: 'pointer', 
    transition: 'all 0.2s ease',
    fontWeight: '500',
    fontSize: '14px',
  };

  return (
    h('div', {
      ref: panelRef,
      className: "edit-panel",
      onWheel: handlePanelWheel,
      onMouseDown: handleMouseDown,
      style: {
        position: 'absolute',
        top: panelPosition.top !== undefined ? `${panelPosition.top}px` : undefined,
        right: panelPosition.right !== undefined ? `${panelPosition.right}px` : undefined,
        left: panelPosition.left !== undefined ? `${panelPosition.left}px` : undefined,
        background: isDarkMode ? 'rgba(10, 10, 10, 0.95)' : 'rgba(245, 245, 245, 0.95)',
        border: `1px solid ${isDarkMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(51, 51, 51, 0.3)'}`,
        borderRadius: '12px',
        zIndex: 11,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        color: safeTheme.textColor,
        width: '300px',
        maxHeight: 'calc(100% - 40px)', 
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(20px)',
        cursor: isDragging ? 'grabbing' : 'default',
        userSelect: 'none',
      }
    },
      h('h3', { 
        className: 'edit-panel-header',
        style: { 
            margin: '0', 
            padding: '16px 18px', 
            fontSize: '16px', 
            color: safeTheme.textColor, 
            flexShrink: 0,
            borderBottom: `1px solid ${isDarkMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(51, 51, 51, 0.2)'}`,
            fontWeight: '600',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
        } 
      }, [
        h(dc.Icon, { icon: 'grip-horizontal', style: { width: '18px', height: '18px' } }),
        "Edit Box Properties"
      ]),

      h('div', {
          style: {
              overflowY: 'auto',
              flex: '1 1 auto',
              padding: '15px',
              display: 'flex',
              flexDirection: 'column',
              gap: '15px',
          }
      },
        (editingBoxProps.type === 'text' ||
         editingBoxProps.type === 'pure-text' ||
         editingBoxProps.type === 'datacore-component' ||
         editingBoxProps.type === 'circle' ||
         editingBoxProps.type === 'triangle'
        ) &&
        h('div', { style: fieldContainerStyle },
          h('label', { htmlFor: "edit-label", style: labelStyle }, "Label:"),
          h('input', {
            id: "edit-label", type: "text", name: "label", value: String(editingBoxProps.label || ''),
            onChange: handleChangeEditField, style: inputStyle
          })
        ),
  
        editingBoxProps.type === 'datacore-component' && h(Fragment, null,
          h('div', { style: fieldContainerStyle },
            h('label', { htmlFor: "edit-componentName", style: labelStyle }, "Component Name:"),
            h('input', {
              id: "edit-componentName", type: "text", name: "componentName", value: editingBoxProps.componentName || '',
              onChange: handleChangeEditField, placeholder: "e.g., D.q.world888.component", style: inputStyle
            }),
            h('div', { style: { fontSize: '11px', color: isDarkMode ? '#888' : '#666', marginTop: '4px', fontStyle: 'italic' } },
              "Enter the filename (without .md) - component auto-loads"
            )
          ),
          
          availableComponents.length > 0 && h('div', { style: { ...fieldContainerStyle, paddingTop: '8px' } },
            h('label', { style: { ...labelStyle, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' } },
              h(dc.Icon, { icon: 'zap', style: { fontSize: '12px', color: '#8b5cf6' } }),
              "Quick Load:"
            ),
            h('div', { 
              onWheel: (e) => e.stopPropagation(),
              style: { 
                display: 'flex', 
                gap: '4px', 
                flexWrap: 'wrap',
                maxHeight: '120px',
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '6px',
                background: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)',
                borderRadius: '6px',
                border: `1px solid ${isDarkMode ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)'}`,
              } 
            },
              availableComponents.map((component, idx) => (
                h('button', {
                  key: idx,
                  type: 'button',
                  onClick: () => handleQuickLoadComponent(component.fileName),
                  style: {
                    padding: '6px 10px',
                    background: editingBoxProps.componentName === component.fileName 
                      ? 'rgba(139, 92, 246, 0.25)' 
                      : isDarkMode ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.6)',
                    border: editingBoxProps.componentName === component.fileName
                      ? '1px solid rgba(139, 92, 246, 0.6)'
                      : `1px solid ${isDarkMode ? 'rgba(80, 80, 80, 0.3)' : 'rgba(51, 51, 51, 0.2)'}`,
                    borderRadius: '4px',
                    color: isDarkMode ? '#ffffff' : '#111',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: editingBoxProps.componentName === component.fileName ? '600' : '500',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    height: '28px',
                    flexShrink: 0,
                    whiteSpace: 'nowrap'
                  },
                  onMouseEnter: (e) => {
                    if (editingBoxProps.componentName !== component.fileName) {
                      e.target.style.background = 'rgba(139, 92, 246, 0.15)';
                      e.target.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                    }
                  },
                  onMouseLeave: (e) => {
                    if (editingBoxProps.componentName !== component.fileName) {
                      e.target.style.background = isDarkMode ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.6)';
                      e.target.style.borderColor = isDarkMode ? 'rgba(80, 80, 80, 0.3)' : 'rgba(51, 51, 51, 0.2)';
                    }
                  },
                  title: component.path
                },
                  editingBoxProps.componentName === component.fileName && h(dc.Icon, { icon: 'check', style: { fontSize: '10px' } }),
                  component.displayName
                )
              ))
            )
          ),
          
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)', borderRadius: '4px' } },
              h('input', {
                  type: 'checkbox', id: 'edit-autoReload', name: 'autoReload', checked: !!editingBoxProps.autoReload,
                  onChange: handleChangeEditField, style: { width: '18px', height: '18px', accentColor: '#7c3aed', cursor: 'pointer', flexShrink: 0 }
              }),
              h('label', { htmlFor: 'edit-autoReload', style: { ...labelStyle, cursor: 'pointer', flex: 1, userSelect: 'none' } }, 'Enable Quick Reload')
          ),
  
          h('div', { style: { borderTop: `1px solid ${safeTheme.border}`, paddingTop: '15px' } },
              h('h4', { style: { margin: '0 0 10px 0', fontSize: '16px' } }, "Custom Properties"),
              (editingBoxProps.propsArray || []).map((prop, index) => (
                  h('div', { key: index, style: { display: 'flex', gap: '5px', alignItems: 'center', marginBottom: '8px' } },
                      h('input', { type: 'text', placeholder: 'Prop Name', value: prop.key, onChange: (e) => onChangeCustomProp(index, 'key', e.target.value), style: { ...inputStyle, flex: 1 } }),
                      h('input', { type: 'text', placeholder: 'Prop Value', value: prop.value, onChange: (e) => onChangeCustomProp(index, 'value', e.target.value), style: { ...inputStyle, flex: 1 } }),
                      h('button', {
                          title: 'Remove Property', onClick: () => onRemoveCustomProp(index),
                          style: {
                              padding: '0', width: '30px', height: '30px', border: 'none', background: '#dc3545', color: 'white', borderRadius: '4px',
                              cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }
                      }, h(dc.Icon, { icon: 'x', style: { fontSize: '14px' } }))
                  )
              )),
              h('button', { onClick: onAddCustomProp, style: { ...buttonStyle, background: '#28a745', width: '100%', marginTop: '5px' } }, "Add Property")
          )
        ),
  
        (editingBoxProps.type === 'pure-text' || editingBoxProps.type === 'datacore-component' || editingBoxProps.type === 'triangle') &&
        h('div', { style: fieldContainerStyle },
          h('label', { htmlFor: "edit-baseColor", style: labelStyle }, editingBoxProps.type === 'pure-text' ? 'Text Color:' : 'Shape/Border Color:'),
          h('div', { style: { display: 'flex', gap: '5px', alignItems: 'center' } },
            h('input', { 
              id: "edit-baseColor", 
              type: "text", 
              name: "baseColor", 
              value: editingBoxProps.baseColor, 
              onChange: handleChangeEditField, 
              style: { ...inputStyle, flex: 1 }, 
              placeholder: 'e.g., #ffffff or rgba(...)' 
            }),
            h('input', {
              type: "color",
              value: toHexColor(editingBoxProps.baseColor),
              onChange: (e) => handleChangeEditField({ target: { name: 'baseColor', value: e.target.value } }),
              style: {
                width: '50px',
                height: '36px',
                border: `2px solid ${isDarkMode ? '#444' : '#ccc'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                flexShrink: 0,
              },
              title: 'Pick color'
            })
          )
        ),
        (editingBoxProps.type === 'text' || editingBoxProps.type === 'circle') &&
        h('div', { style: fieldContainerStyle },
          h('label', { htmlFor: "edit-textColor", style: labelStyle }, 'Text Color:'),
          h('div', { style: { display: 'flex', gap: '5px', alignItems: 'center' } },
            h('input', { 
              id: "edit-textColor", 
              type: "text", 
              name: "baseColor", 
              value: editingBoxProps.baseColor, 
              onChange: handleChangeEditField, 
              style: { ...inputStyle, flex: 1 }, 
              placeholder: 'e.g., #ffffff or rgba(...)' 
            }),
            h('input', {
              type: "color",
              value: toHexColor(editingBoxProps.baseColor),
              onChange: (e) => handleChangeEditField({ target: { name: 'baseColor', value: e.target.value } }),
              style: {
                width: '50px',
                height: '36px',
                border: `2px solid ${isDarkMode ? '#444' : '#ccc'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                flexShrink: 0,
              },
              title: 'Pick text color'
            })
          )
        ),
        (editingBoxProps.type === 'text' || editingBoxProps.type === 'circle' || editingBoxProps.type === 'datacore-component') &&
        h('div', { style: fieldContainerStyle },
          h('label', { htmlFor: "edit-backgroundColor", style: labelStyle }, "Background Color:"),
          h('div', { style: { display: 'flex', gap: '5px', alignItems: 'center' } },
            h('input', { 
              id: "edit-backgroundColor", 
              type: "text", 
              name: "backgroundColor", 
              value: editingBoxProps.backgroundColor, 
              onChange: handleChangeEditField, 
              style: { ...inputStyle, flex: 1 }, 
              placeholder: 'e.g., rgba(50,50,50,0.7)' 
            }),
            h('input', {
              type: "color",
              value: toHexColor(editingBoxProps.backgroundColor),
              onChange: (e) => handleChangeEditField({ target: { name: 'backgroundColor', value: e.target.value } }),
              style: {
                width: '50px',
                height: '36px',
                border: `2px solid ${isDarkMode ? '#444' : '#ccc'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                flexShrink: 0,
              },
              title: 'Pick color'
            })
          )
        ),
  
        h('div', { style: { display: 'flex', gap: '10px', width: '100%' } },
          h('div', { style: { ...fieldContainerStyle, flex: 1 } },
            h('label', { htmlFor: 'edit-width', style: labelStyle }, 'Width:'),
            h('input', { id: 'edit-width', type: 'number', name: 'width', value: editingBoxProps.width, onChange: handleChangeEditField, style: { ...inputStyle, width: '100%', boxSizing: 'border-box' } })
          ),
          h('div', { style: { ...fieldContainerStyle, flex: 1 } },
            h('label', { htmlFor: 'edit-height', style: labelStyle }, 'Height:'),
            h('input', { id: 'edit-height', type: 'number', name: 'height', value: editingBoxProps.height, onChange: handleChangeEditField, style: { ...inputStyle, width: '100%', boxSizing: 'border-box' } })
          )
        ),
  
        h('div', { style: fieldContainerStyle },
          h('label', { htmlFor: "edit-opacity", style: labelStyle }, `Opacity: ${Math.round(editingBoxProps.opacity * 100)}%`),
          h('input', { id: "edit-opacity", type: "range", name: "opacity", min: "0", max: "1", step: "0.01", value: editingBoxProps.opacity, onChange: handleChangeEditField, style: { width: '100%', accentColor: '#007bff' } })
        )
      ),

      h('div', {
        style: {
            padding: '15px',
            flexShrink: 0,
            borderTop: `1px solid ${currentTheme.border}`,
            background: currentTheme.background
        }
      },
        h('div', { style: buttonGroupStyle },
          h('button', { 
            onClick: () => { handleCancelEdit(); focusCanvas(); }, 
            style: { ...buttonStyle, background: isDarkMode ? 'rgba(100, 100, 100, 0.5)' : 'rgba(150, 150, 150, 0.5)' },
            onMouseEnter: (e) => e.target.style.background = isDarkMode ? 'rgba(120, 120, 120, 0.6)' : 'rgba(130, 130, 130, 0.6)',
            onMouseLeave: (e) => e.target.style.background = isDarkMode ? 'rgba(100, 100, 100, 0.5)' : 'rgba(150, 150, 150, 0.5)',
          }, "Cancel"),
          h('button', { 
            onClick: () => { handleSaveEdit(); focusCanvas(); }, 
            style: { ...buttonStyle, background: 'rgba(139, 92, 246, 0.8)' },
            onMouseEnter: (e) => e.target.style.background = 'rgba(139, 92, 246, 1)',
            onMouseLeave: (e) => e.target.style.background = 'rgba(139, 92, 246, 0.8)',
          }, "Save")
        )
      )
    )
  );
}

function CanvasControls({
  resetView, isDarkMode, setIsDarkMode, showAddMenu, setShowAddMenu,
  createNewBox, deleteSelectedBox, selectedBoxIds, toggleEditPanel,
  addMenuRef, isCanvasLocked,
  setIsCanvasLocked, handleSaveCanvas, handleLoadCanvas, availableSaves,
  loadSpecificCanvas, loadMenuRef, showLoadMenu, setShowLoadMenu, focusCanvas,
  deleteCanvas
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const burgerMenuContainerRef = useRef(null);

  const currentTheme = isDarkMode ? 
    { background: '#0a0a0a', border: '#8b5cf6', textColor: '#ffffff', hover: 'rgba(139, 92, 246, 0.15)' } : 
    { background: '#f5f5f5', border: '#8b5cf6', textColor: '#111', hover: 'rgba(139, 92, 246, 0.1)' };

  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
    setActiveSection(null);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const isClickOnButton = event.target.closest('.burger-menu-button');
      const isClickInsideMenu = burgerMenuContainerRef.current && burgerMenuContainerRef.current.contains(event.target);

      if (isMenuOpen && !isClickOnButton && !isClickInsideMenu) {
        setIsMenuOpen(false);
        setActiveSection(null);
        focusCanvas();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, focusCanvas]);

  const handleSelectLoadedCanvas = useCallback((filename) => {
    loadSpecificCanvas(filename);
    setIsMenuOpen(false);
    setActiveSection(null);
    focusCanvas();
  }, [loadSpecificCanvas, focusCanvas]);

  const menuItemStyle = {
    padding: '12px 20px',
    background: 'none',
    border: 'none',
    color: currentTheme.textColor,
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    textAlign: 'left',
    transition: 'all 0.15s ease',
    borderLeft: '2px solid transparent',
  };

  const sectionHeaderStyle = {
    padding: '16px 20px 8px 20px',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: '#8b5cf6',
    opacity: 0.6,
    marginTop: '8px',
  };

  return h('div', { 
    ref: burgerMenuContainerRef,
    style: {
      position: 'absolute',
      top: '16px',
      left: '16px',
      zIndex: 10,
      fontFamily: 'Inter, sans-serif'
    }
  },
    h('button', {
      className: 'burger-menu-button',
      onClick: toggleMenu,
      style: {
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'}`,
        background: isDarkMode ? '#1a1a1a' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#000000',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
      },
      onMouseEnter: (e) => e.target.style.transform = 'scale(1.05)',
      onMouseLeave: (e) => e.target.style.transform = 'scale(1)'
    }, h(dc.Icon, { icon: isMenuOpen ? 'x' : 'menu', style: { fontSize: '18px' } })),

    isMenuOpen && h('div', {
      style: {
        position: 'absolute',
        top: '48px',
        left: 0,
        width: '260px',
        borderRadius: '12px',
        background: isDarkMode ? '#111111' : '#ffffff',
        border: `1px solid ${isDarkMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(51, 51, 51, 0.2)'}`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        padding: '6px 0',
        backdropFilter: 'blur(10px)',
      }
    },
      h('div', { style: sectionHeaderStyle }, "Canvas Navigation"),
      h('button', {
        style: menuItemStyle,
        onClick: () => { resetView(); setIsMenuOpen(false); },
        onMouseEnter: (e) => { e.target.style.background = currentTheme.hover; e.target.style.borderLeft = '2px solid #8b5cf6'; },
        onMouseLeave: (e) => { e.target.style.background = 'none'; e.target.style.borderLeft = '2px solid transparent'; }
      }, h(dc.Icon, { icon: 'home', style: { fontSize: '14px' } }), "Reset View"),

      h('button', {
        style: menuItemStyle,
        onClick: () => { setIsCanvasLocked(!isCanvasLocked); setIsMenuOpen(false); },
        onMouseEnter: (e) => { e.target.style.background = currentTheme.hover; e.target.style.borderLeft = '2px solid #8b5cf6'; },
        onMouseLeave: (e) => { e.target.style.background = 'none'; e.target.style.borderLeft = '2px solid transparent'; }
      }, h(dc.Icon, { icon: isCanvasLocked ? 'lock' : 'unlock', style: { fontSize: '14px' } }), isCanvasLocked ? "Unlock Canvas" : "Lock Canvas"),

      h('button', {
        style: menuItemStyle,
        onClick: () => { setIsDarkMode(!isDarkMode); setIsMenuOpen(false); },
        onMouseEnter: (e) => { e.target.style.background = currentTheme.hover; e.target.style.borderLeft = '2px solid #8b5cf6'; },
        onMouseLeave: (e) => { e.target.style.background = 'none'; e.target.style.borderLeft = '2px solid transparent'; }
      }, h(dc.Icon, { icon: isDarkMode ? 'sun' : 'moon', style: { fontSize: '14px' } }), isDarkMode ? "Light Mode" : "Dark Mode"),

      h('div', { style: sectionHeaderStyle }, "Shapes Manager"),
      h('button', {
        style: menuItemStyle,
        onClick: () => setActiveSection(activeSection === 'shapes' ? null : 'shapes'),
        onMouseEnter: (e) => { e.target.style.background = currentTheme.hover; e.target.style.borderLeft = '2px solid #8b5cf6'; },
        onMouseLeave: (e) => { e.target.style.background = 'none'; e.target.style.borderLeft = '2px solid transparent'; }
      }, h(dc.Icon, { icon: 'plus-circle', style: { fontSize: '14px' } }), activeSection === 'shapes' ? "Hide Options ▲" : "Show Options ▼"),

      activeSection === 'shapes' && h('div', {
        style: {
          background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }
      },
        ['text', 'pure-text', 'circle', 'triangle', 'datacore-component'].map(type =>
          h('button', {
            key: type,
            onClick: () => { createNewBox(type); setIsMenuOpen(false); setActiveSection(null); },
            style: {
              padding: '8px 12px',
              background: isDarkMode ? '#1e1e1e' : '#f0f0f0',
              border: 'none',
              borderRadius: '6px',
              color: isDarkMode ? '#ffffff' : '#000000',
              cursor: 'pointer',
              fontSize: '12px',
              textAlign: 'left',
              fontWeight: '500',
              transition: 'background 0.2s ease',
            },
            onMouseEnter: (e) => e.target.style.background = '#8b5cf6',
            onMouseLeave: (e) => e.target.style.background = isDarkMode ? '#1e1e1e' : '#f0f0f0'
          }, `+ Add ${type.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}`)
        )
      ),

      h('div', { style: sectionHeaderStyle }, "Canvas Management"),
      h('button', {
        style: menuItemStyle,
        onClick: () => setActiveSection(activeSection === 'saves' ? null : 'saves'),
        onMouseEnter: (e) => { e.target.style.background = currentTheme.hover; e.target.style.borderLeft = '2px solid #8b5cf6'; },
        onMouseLeave: (e) => { e.target.style.background = 'none'; e.target.style.borderLeft = '2px solid transparent'; }
      }, h(dc.Icon, { icon: 'save', style: { fontSize: '14px' } }), activeSection === 'saves' ? "Hide Saves ▲" : "Manage Saves ▼"),

      activeSection === 'saves' && h('div', {
        style: {
          background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }
      },
        h('button', {
          onClick: () => { handleSaveCanvas(); setIsMenuOpen(false); },
          style: {
            padding: '10px',
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)',
          }
        }, [h(dc.Icon, { icon: 'save', style: { fontSize: '13px' } }), "Save Canvas"]),

        h('div', { style: { fontSize: '10px', fontWeight: '700', color: '#8b5cf6', margin: '4px 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.5px' } }, "Load Canvas"),
        availableSaves.length === 0 ?
          h('div', { style: { padding: '6px 0', color: isDarkMode ? '#666' : '#999', fontSize: '11px', fontStyle: 'italic', textAlign: 'center' } }, "No saves found") :
          h('div', {
            style: { display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }
          },
            availableSaves.map(filename =>
              h('div', { key: filename, style: { display: 'flex', gap: '4px', alignItems: 'center' } },
                h('button', {
                  onClick: () => handleSelectLoadedCanvas(filename),
                  style: {
                    flex: 1,
                    padding: '8px',
                    background: isDarkMode ? '#1e1e1e' : '#f0f0f0',
                    border: 'none',
                    borderRadius: '4px',
                    color: isDarkMode ? '#ffffff' : '#000000',
                    cursor: 'pointer',
                    fontSize: '11px',
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }
                }, [
                  h(dc.Icon, { icon: 'file-text', style: { fontSize: '12px', flexShrink: 0 } }),
                  h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, filename.replace('.json', ''))
                ]),
                h('button', {
                  onClick: () => { if (confirm(`Delete "${filename.replace('.json', '')}"?`)) deleteCanvas(filename); },
                  style: {
                    padding: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }
                }, h(dc.Icon, { icon: 'trash-2', style: { fontSize: '12px' } }))
              )
            )
          )
      )
    )
  );
}

return { CanvasControls, EditPanel, useCanvasPersistence, useCanvasInteractions };
