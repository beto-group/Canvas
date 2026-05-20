const { useState, useRef, useEffect, useCallback, Fragment } = dc;

const filename = dc.resolvePath("src/App.jsx") || 
  (typeof app !== 'undefined' && app.vault.getFiles().find(f => f.path.endsWith("CANVAS/src/App.jsx"))?.path) ||
  "_RESOURCES/DATACORE/_DONE/CANVAS/src/App.jsx";
const currentDir = filename.substring(0, filename.lastIndexOf('/'));

const { ScreenModeHelper } = await dc.require(currentDir + "/components/ScreenModeHelper.jsx");
const { BasicView, FileNameModal } = await dc.require(currentDir + "/components/BasicView.jsx");
const { CanvasControls, useCanvasPersistence, useCanvasInteractions, EditPanel } = await dc.require(currentDir + "/components/CanvasControls.jsx");
const { Box, useBoxManagement } = await dc.require(currentDir + "/components/Box.jsx");

const ZOOM_SPEED = 0.05;
const PAN_SPEED = 0.5;

function getGridColor(type, zoom, theme) {
  let opacity;
  let baseColor;

  if (type === 'minor') {
    opacity = zoom > 0.5 ? 0.2 : 0;
    baseColor = theme.gridMinor;
  } else if (type === 'major') {
    opacity = zoom > 0.2 && zoom <= 2 ? 0.3 : 0;
    baseColor = theme.gridMajor;
  } else if (type === 'super') {
    opacity = zoom <= 0.2 || zoom > 2 ? 0.4 : 0;
    baseColor = theme.gridSuper;
  }
  return baseColor.replace('__opacity__', opacity);
}

function InfiniteCanvas({ isDarkMode: propIsDarkMode, engine, saveState }) {
  const dcInstance = engine || dc;

  const [position, setPosition] = useState({ x: -200, y: -200 });
  const [zoom, setZoom] = useState(1);
  const [isDarkMode, setIsDarkMode] = useState(propIsDarkMode !== undefined ? propIsDarkMode : true);
  const [isCanvasLocked, setIsCanvasLocked] = useState(false);

  const outerContainerRef = useRef(null);
  const interactiveCanvasRef = useRef(null);
  const addMenuRef = useRef(null);
  const loadMenuRef = useRef(null);

  const positionRef = useRef(position);
  const zoomRef = useRef(zoom);
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const isSpacebarDownRef = useRef(false);
  const isControlDownRef = useRef(false);
  const isShiftDownRef = useRef(false);

  const copiedBoxesRef = useRef([]);
  const lastKnownMouseScreenPosRef = useRef({ x: 0, y: 0 });

  const [boxes, setBoxes] = useState([
    { id: 'box1', x: 200, y: 200, width: 100, height: 100, baseColor: "white", opacity: 0.7, backgroundColor: "rgb(0, 150, 255)", border: "none", label: "Sample (200,200)", type: 'text', componentName: '', autoReload: false, props: {} },
    { id: 'box2', x: 800, y: 800, width: 100, height: 100, baseColor: "white", opacity: 0.7, backgroundColor: "rgb(255, 100, 0)", border: "none", label: "Far Box (800,800)", type: 'text', componentName: '', autoReload: false, props: {} },
    { id: 'box3', x: 450, y: 450, width: 150, height: 70, baseColor: "black", opacity: 0.9, backgroundColor: "rgb(100, 200, 50)", border: "none", label: "Another Box", type: 'text', componentName: '', autoReload: false, props: {} },
    { id: 'box4', x: 100, y: 500, width: 80, height: 80, baseColor: "white", opacity: 0.6, backgroundColor: "rgb(200, 50, 150)", border: "none", label: "Circle", type: 'circle', componentName: '', autoReload: false, props: {} },
  ]);
  const [selectedBoxIds, setSelectedBoxIds] = useState([]);

  const [isEditing, setIsEditing] = useState(false);
  const [editingBoxProps, setEditingBoxProps] = useState(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState(null);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [availableSaves, setAvailableSaves] = useState([]);
  const defaultFileName = "my-canvas-data";

  const screenHelperRef = useRef(null);
  const originalParentRefForWindow = useRef(null);
  const originalParentRefForPiP = useRef(null);

  const themes = {
    light: {
      background: '#f5f5f5', border: '#333',
      gridMinor: 'rgba(200, 200, 200, __opacity__)',
      gridMajor: 'rgba(150, 150, 150, __opacity__)',
      gridSuper: 'rgba(100, 100, 100, __opacity__)',
      textColor: '#111',
      accent: '#8b5cf6',
    },
    dark: {
      background: '#0a0a0a', border: '#1a1a1a',
      gridMinor: 'rgba(30, 30, 30, __opacity__)',
      gridMajor: 'rgba(45, 45, 45, __opacity__)',
      gridSuper: 'rgba(60, 60, 60, __opacity__)',
      textColor: '#ffffff',
      accent: '#8b5cf6',
    }
  };
  const currentTheme = isDarkMode ? themes.dark : themes.light;

  const defaultContainerStyle = `
    height: 60vh; width: 100%; padding: 10px; border: 2px solid ${currentTheme.border};
    border-radius: 8px; overflow: hidden; background: ${currentTheme.background}; position: relative;
    box-shadow: 0 4px 24px rgba(0, 0, 0, ${isDarkMode ? '0.5' : '0.1'});
  `;

  const focusCanvas = useCallback(() => {
    if (interactiveCanvasRef.current && document.activeElement !== interactiveCanvasRef.current) {
        interactiveCanvasRef.current.focus();
    }
  }, []);

  const screenToWorld = useCallback((clientX, clientY) => {
    const canvas = interactiveCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const worldX = (screenX - positionRef.current.x) / zoomRef.current;
    const worldY = (screenY - positionRef.current.y) / zoomRef.current;
    return { x: worldX, y: worldY };
  }, [interactiveCanvasRef]);

  const {
    createNewBox, deleteSelectedBox, toggleEditPanel,
    handleSaveEdit, handleCancelEdit, handleChangeEditField,
    handleAddCustomProp, handleRemoveCustomProp, handleChangeCustomProp
  } = useBoxManagement({
    boxes, setBoxes, selectedBoxIds, setSelectedBoxIds,
    isEditing, setIsEditing, editingBoxProps, setEditingBoxProps,
    setShowAddMenu, screenToWorld, canvasRef: interactiveCanvasRef,
    isDarkMode, isCanvasLocked, dc: dcInstance, focusCanvas
  });

  const handleCopyObjects = useCallback(() => {
    if (isCanvasLocked) {
      if (dcInstance.app?.flash?.error) { dcInstance.app.flash.error("Canvas is locked. Cannot copy boxes."); }
      return;
    }
    if (selectedBoxIds.length > 0) {
      const selectedBoxes = boxes.filter(box => selectedBoxIds.includes(box.id));
      copiedBoxesRef.current = JSON.parse(JSON.stringify(selectedBoxes));
      if (dcInstance.app?.flash?.info) { dcInstance.app.flash.info(`Copied ${selectedBoxes.length} box(es).`); }
    } else {
      if (dcInstance.app?.flash?.info) { dcInstance.app.flash.info("No boxes selected to copy."); }
    }
  }, [boxes, selectedBoxIds, isCanvasLocked, dcInstance.app]);

  const handlePasteObjects = useCallback(() => {
    if (isCanvasLocked) {
      if (dcInstance.app?.flash?.error) { dcInstance.app.flash.error("Canvas is locked. Cannot paste boxes."); }
      return;
    }
    if (copiedBoxesRef.current.length > 0) {
      const newPastedBoxes = copiedBoxesRef.current.map(box => ({
        ...box,
        id: `box-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        x: box.x + 20, y: box.y + 20,
      }));
      setBoxes(prevBoxes => [...prevBoxes, ...newPastedBoxes]);
      setSelectedBoxIds(newPastedBoxes.map(b => b.id));
      setIsEditing(false); setEditingBoxProps(null); setShowAddMenu(false);
      focusCanvas();
      if (dcInstance.app?.flash?.success) { dcInstance.app.flash.success(`Pasted ${newPastedBoxes.length} box(es).`); }
    } else {
      if (dcInstance.app?.flash?.info) { dcInstance.app.flash.info("Nothing copied to paste."); }
    }
  }, [setBoxes, setSelectedBoxIds, setIsEditing, setEditingBoxProps, setShowAddMenu, focusCanvas, isCanvasLocked, dcInstance.app]);

  const handleCutObjects = useCallback(() => {
    if (isCanvasLocked) {
      if (dcInstance.app?.flash?.error) { dcInstance.app.flash.error("Canvas is locked. Cannot cut boxes."); }
      return;
    }
    if (selectedBoxIds.length > 0) {
      const count = selectedBoxIds.length;
      handleCopyObjects();
      deleteSelectedBox();
      if (dcInstance.app?.flash?.success) { dcInstance.app.flash.success(`Cut ${count} box(es).`); }
    } else {
      if (dcInstance.app?.flash?.info) { dcInstance.app.flash.info("No boxes selected to cut."); }
    }
  }, [selectedBoxIds, handleCopyObjects, deleteSelectedBox, isCanvasLocked, dcInstance.app]);

  const {
    isCanvasDraggingRef, handleWheel, handleBoxMouseDown, handleHandleMouseDown, onCanvasMouseDown,
  } = useCanvasInteractions({
    canvasRef: interactiveCanvasRef, positionRef, zoomRef, setPosition, setZoom,
    boxes, setBoxes, selectedBoxIds, setSelectedBoxIds, screenToWorld,
    ZOOM_SPEED, PAN_SPEED, setIsEditing, setEditingBoxProps, setShowAddMenu,
    addMenuRef, isSpacebarDownRef, isControlDownRef, isShiftDownRef,
    setMarqueeRect, isCanvasLocked, lastKnownMouseScreenPosRef, focusCanvas,
  });

  const resetView = useCallback(() => {
    const canvas = interactiveCanvasRef.current;
    if (!canvas || boxes.length === 0) {
      setPosition({ x: -200, y: -200 }); setZoom(1);
    } else {
      const rect = canvas.getBoundingClientRect();
      let minWorldX = Infinity, minWorldY = Infinity, maxWorldX = -Infinity, maxWorldY = -Infinity;
      boxes.forEach(box => {
        minWorldX = Math.min(minWorldX, box.x); minWorldY = Math.min(minWorldY, box.y);
        maxWorldX = Math.max(maxWorldX, box.x + box.width); maxWorldY = Math.max(maxWorldY, box.y + box.height);
      });
      const worldContentWidth = maxWorldX - minWorldX; const worldContentHeight = maxWorldY - minWorldY;
      const effectiveContentWidth = worldContentWidth > 0 ? worldContentWidth : 100;
      const effectiveContentHeight = worldContentHeight > 0 ? worldContentHeight : 100;
      const newZoom = Math.max(0.1, Math.min(rect.width / (effectiveContentWidth * 1.1), rect.height / (effectiveContentHeight * 1.1), 10));
      const newPosX = (rect.width / 2) - ((minWorldX + worldContentWidth / 2) * newZoom);
      const newPosY = (rect.height / 2) - ((minWorldY + worldContentHeight / 2) * newZoom);
      setPosition({ x: newPosX, y: newPosY }); setZoom(newZoom);
    }
    setIsEditing(false); setEditingBoxProps(null); setSelectedBoxIds([]); setShowAddMenu(false);
    focusCanvas();
  }, [boxes, setPosition, setZoom, setIsEditing, setEditingBoxProps, setSelectedBoxIds, setShowAddMenu, interactiveCanvasRef, focusCanvas]);

  const currentScreenModeRef = useRef("browser");
  
  const handleModeChange = useCallback(() => {
    setTimeout(() => {
        resetView();
    }, 150);
  }, [resetView]);

  const {
    handleSaveCanvas, handleLoadCanvas, handleModalSave, handleModalCancel, loadSpecificCanvas,
    deleteCanvas, listSavedCanvases,
  } = useCanvasPersistence({
    boxes, setBoxes, position, setPosition, zoom, setZoom,
    isDarkMode, setIsDarkMode, isCanvasLocked, setIsCanvasLocked,
    setSelectedBoxIds, setIsEditing, setEditingBoxProps, setShowAddMenu,
    setShowSaveModal, setShowLoadMenu, setAvailableSaves, dc: dcInstance, focusCanvas,
  });

  useEffect(() => {
    listSavedCanvases();
  }, [listSavedCanvases]);

  useEffect(() => {
    if (saveState && typeof saveState === 'string') {
      let fileNameToLoad = saveState.trim();
      if (!fileNameToLoad.endsWith('.json')) { fileNameToLoad += '.json'; }
      loadSpecificCanvas(fileNameToLoad);
    }
  }, [saveState, loadSpecificCanvas]);

  const hasInitialResetRef = useRef(false);
  
  useEffect(() => {
    if (!hasInitialResetRef.current && interactiveCanvasRef.current) {
      const timer = setTimeout(() => {
        hasInitialResetRef.current = true;
        resetView();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [boxes.length, resetView, interactiveCanvasRef]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.code === 'Space') isSpacebarDownRef.current = true;
      if (e.key === 'Control' || e.key === 'Meta') isControlDownRef.current = true;
      if (e.key === 'Shift') isShiftDownRef.current = true;
    };
    const handleGlobalKeyUp = (e) => {
      if (e.code === 'Space') isSpacebarDownRef.current = false;
      if (e.key === 'Control' || e.key === 'Meta') isControlDownRef.current = false;
      if (e.key === 'Shift') isShiftDownRef.current = false;
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    document.addEventListener('keyup', handleGlobalKeyUp);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
      document.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, []);
  
  const minorGridSize = 20 * zoom;
  const majorGridSize = minorGridSize * 5;
  const superGridSize = majorGridSize * 5;

  const minorGridColor = getGridColor('minor', zoom, currentTheme);
  const majorGridColor = getGridColor('major', zoom, currentTheme);
  const superGridColor = getGridColor('super', zoom, currentTheme);

  const containerStyle = {
    background: currentTheme.background,
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden"
  };

  return (
    h('div', {
      ref: outerContainerRef,
      style: containerStyle
    },
      h(ScreenModeHelper, {
        helperRef: screenHelperRef, containerRef: outerContainerRef, defaultStyle: defaultContainerStyle,
        originalParentRefForWindow: originalParentRefForWindow, originalParentRefForPiP: originalParentRefForPiP,
        allowedScreenModes: ["browser", "window", "pip"], engine: dcInstance.app, isDarkMode: isDarkMode,
        onModeChange: handleModeChange, initialMode: "browser",
        onModeUpdate: (mode) => { currentScreenModeRef.current = mode; },
      }),

      h(BasicView, {
        setCanvasRef: interactiveCanvasRef, onCanvasMouseDown: onCanvasMouseDown, handleWheel: handleWheel,
        isSpacebarDownRef: isSpacebarDownRef, isCanvasDraggingRef: isCanvasDraggingRef, selectedBoxIds: selectedBoxIds,
        deleteSelectedBox: deleteSelectedBox, isCanvasLocked: isCanvasLocked, setSelectedBoxIds: setSelectedBoxIds,
        setIsEditing: setIsEditing, setEditingBoxProps: setEditingBoxProps, setShowAddMenu: setShowAddMenu, focusCanvas,
        onCopyObjects: handleCopyObjects, onPasteObjects: handlePasteObjects, onCutObjects: handleCutObjects,
      },
        h('div', {
          id: "grid-layer",
          style: {
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            backgroundImage: `linear-gradient(to right, ${minorGridColor} 1px, transparent 1px), linear-gradient(to bottom, ${minorGridColor} 1px, transparent 1px), linear-gradient(to right, ${majorGridColor} 1px, transparent 1px), linear-gradient(to bottom, ${majorGridColor} 1px, transparent 1px), linear-gradient(to right, ${superGridColor} 1px, transparent 1px), linear-gradient(to bottom, ${superGridColor} 1px, transparent 1px)`,
            backgroundSize: `${minorGridSize}px ${minorGridSize}px, ${minorGridSize}px ${minorGridSize}px, ${majorGridSize}px ${majorGridSize}px, ${majorGridSize}px ${majorGridSize}px, ${superGridSize}px ${superGridSize}px, ${superGridSize}px ${superGridSize}px`,
            backgroundPosition: `${position.x}px ${position.y}px`, zIndex: 1,
          }
        },
          h(CanvasControls, {
            resetView, isDarkMode, setIsDarkMode, showAddMenu, setShowAddMenu, createNewBox, deleteSelectedBox, selectedBoxIds, toggleEditPanel,
            addMenuRef, isCanvasLocked, setIsCanvasLocked, handleSaveCanvas, handleLoadCanvas, availableSaves, loadSpecificCanvas, loadMenuRef, showLoadMenu, setShowLoadMenu, focusCanvas,
            deleteCanvas,
          }),
          
          isEditing && editingBoxProps && h(EditPanel, {
            editingBoxProps, handleChangeEditField, handleSaveEdit, handleCancelEdit,
            isDarkMode, currentTheme, focusCanvas,
            onAddCustomProp: handleAddCustomProp,
            onRemoveCustomProp: handleRemoveCustomProp,
            onChangeCustomProp: handleChangeCustomProp,
          }),

          marqueeRect && h('div', {
            style: { position: 'absolute', border: '1px dashed #007bff', backgroundColor: 'rgba(0, 123, 255, 0.1)', left: `${marqueeRect.x}px`, top: `${marqueeRect.y}px`, width: `${marqueeRect.width}px`, height: `${marqueeRect.height}px`, pointerEvents: 'none', zIndex: 5, }
          }),

          h('div', {
            style: { transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`, transformOrigin: "0 0", position: "absolute", width: "1px", height: "1px" }
          },
            boxes.map(box =>
              h(Box, {
                key: box.id, box: box, isSelected: selectedBoxIds.includes(box.id), onMouseDownBox: handleBoxMouseDown, onMouseDownHandle: handleHandleMouseDown,
                globalIsDarkMode: isDarkMode, h: h, dc: dcInstance, isCanvasLocked,
              })
            )
          )
        )
      ),
      showSaveModal && h(FileNameModal, {
        onSave: handleModalSave, onCancel: handleModalCancel, initialFileName: defaultFileName, isDarkMode: isDarkMode, focusCanvas,
      })
    )
  );
}

return { View: InfiniteCanvas, InfiniteCanvas };
