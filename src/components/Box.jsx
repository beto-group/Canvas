const { useState, useRef, useEffect, useCallback, Fragment } = dc;

function useBoxManagement({
  boxes, setBoxes, selectedBoxIds, setSelectedBoxIds, isEditing, setIsEditing,
  editingBoxProps, setEditingBoxProps, setShowAddMenu, screenToWorld,
  canvasRef, isDarkMode, isCanvasLocked, dc, focusCanvas
}) {

  const createNewBox = useCallback((type) => {
    if (isCanvasLocked) {
      if (dc.app && dc.app.flash && typeof dc.app.flash.error === 'function') {
        dc.app.flash.error("Canvas is locked. Cannot add new boxes.");
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const { x: worldCenterX, y: worldCenterY } = screenToWorld(
      rect.left + rect.width / 2, rect.top + rect.height / 2
    );

    let newBoxWidth = 120, newBoxHeight = 80, newLabel = "";
    let defaultOpacity = 0.7, defaultBorder = "none";
    let defaultBaseColor, defaultBackgroundColor;
    let componentName = '';

    const randomRGBValue = () => Math.floor(Math.random() * 200) + 50;
    const randomShapeColor = `rgb(${randomRGBValue()}, ${randomRGBValue()}, ${randomRGBValue()})`;

    if (type === 'text') {
      defaultBackgroundColor = randomShapeColor; defaultBaseColor = 'white'; newLabel = 'Sample Text';
    } else if (type === 'pure-text') {
      newBoxWidth = 150; newBoxHeight = 30; defaultBackgroundColor = 'transparent';
      defaultBaseColor = isDarkMode ? 'white' : 'black'; newLabel = 'Pure Text';
    } else if (type === 'circle') {
      newBoxWidth = 100; newBoxHeight = 100; defaultBackgroundColor = randomShapeColor;
      defaultBaseColor = 'white'; newLabel = '';
    } else if (type === 'triangle') {
      newBoxWidth = 100; newBoxHeight = 100; defaultBackgroundColor = 'transparent';
      defaultBaseColor = randomShapeColor; newLabel = '';
    } else if (type === 'datacore-component') {
      newBoxWidth = 300; newBoxHeight = 200;
      defaultBackgroundColor = isDarkMode ? 'rgba(50, 50, 50, 0.7)' : 'rgba(200, 200, 200, 0.7)';
      defaultBaseColor = isDarkMode ? 'white' : 'black';
      defaultBorder = `1px dashed ${isDarkMode ? '#888' : '#666'}`;
      defaultOpacity = 1; newLabel = 'Datacore Component (Edit to Configure)';
    }

    const newBox = {
      id: `box-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      x: worldCenterX - newBoxWidth / 2, y: worldCenterY - newBoxHeight / 2,
      width: newBoxWidth, height: newBoxHeight,
      baseColor: defaultBaseColor, backgroundColor: defaultBackgroundColor,
      opacity: defaultOpacity, border: defaultBorder, label: newLabel,
      type: type, componentName: componentName,
      autoReload: false,
      props: {},
    };

    const propsArray = Object.entries(newBox.props || {}).map(([key, value]) => ({ key, value }));

    setBoxes(prevBoxes => [...prevBoxes, newBox]);
    setSelectedBoxIds([newBox.id]);
    setIsEditing(true);
    setEditingBoxProps({ ...newBox, propsArray });
    setShowAddMenu(false);
    focusCanvas();
  }, [setBoxes, setSelectedBoxIds, setIsEditing, setEditingBoxProps, setShowAddMenu, screenToWorld, canvasRef, isDarkMode, isCanvasLocked, dc, focusCanvas]);

  const deleteSelectedBox = useCallback(() => {
    if (isCanvasLocked) {
      if (dc.app && dc.app.flash && typeof dc.app.flash.error === 'function') {
          dc.app.flash.error("Canvas is locked. Cannot delete boxes.");
      }
      return;
    }
    if (selectedBoxIds.length === 0) {
      if (dc.app && dc.app.flash && typeof dc.app.flash.info === 'function') {
          dc.app.flash.info("No boxes selected to delete.");
      }
      return;
    }

    setBoxes(prevBoxes => prevBoxes.filter(box => !selectedBoxIds.includes(box.id)));
    if (dc.app && dc.app.flash && typeof dc.app.flash.success === 'function') {
        dc.app.flash.success(`Deleted ${selectedBoxIds.length} box(es).`);
    }
    setSelectedBoxIds([]);
    setIsEditing(false);
    setEditingBoxProps(null);
    setShowAddMenu(false);
    focusCanvas();
  }, [selectedBoxIds, setBoxes, setSelectedBoxIds, setIsEditing, setEditingBoxProps, setShowAddMenu, isCanvasLocked, dc, focusCanvas]);

  const toggleEditPanel = useCallback(() => {
    if (selectedBoxIds.length === 1) {
      const selectedBoxId = selectedBoxIds[0];
      if (isEditing) {
        setIsEditing(false);
        setEditingBoxProps(null);
      } else {
        const boxToEdit = boxes.find(b => b.id === selectedBoxId);
        if (boxToEdit) {
          const propsArray = Object.entries(boxToEdit.props || {}).map(([key, value]) => ({ key, value: String(value) }));
          setIsEditing(true);
          setEditingBoxProps({ ...boxToEdit, propsArray });
        }
      }
    } else {
        setIsEditing(false);
        setEditingBoxProps(null);
    }
    setShowAddMenu(false);
    focusCanvas();
  }, [selectedBoxIds, isEditing, boxes, setIsEditing, setEditingBoxProps, setShowAddMenu, focusCanvas]);

  const handleSaveEdit = useCallback(() => {
    const propsObject = (editingBoxProps.propsArray || []).reduce((acc, prop) => {
        if (prop.key && prop.key.trim() !== '') {
            acc[prop.key.trim()] = prop.value;
        }
        return acc;
    }, {});
    
    const MIN_SIZE = 20;

    let finalWidth = parseFloat(editingBoxProps.width);
    if (isNaN(finalWidth) || finalWidth < MIN_SIZE) {
      finalWidth = MIN_SIZE;
    }

    let finalHeight = parseFloat(editingBoxProps.height);
    if (isNaN(finalHeight) || finalHeight < MIN_SIZE) {
      finalHeight = MIN_SIZE;
    }

    const finalBoxData = { 
        ...editingBoxProps, 
        props: propsObject,
        width: finalWidth,
        height: finalHeight,
    };
    delete finalBoxData.propsArray;

    setBoxes(prevBoxes => prevBoxes.map(box => {
      if (box.id === finalBoxData.id) {
        return finalBoxData;
      }
      return box;
    }));
    setIsEditing(false);
    setEditingBoxProps(null);
  }, [editingBoxProps, setBoxes, setIsEditing, setEditingBoxProps]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingBoxProps(null);
  }, [setIsEditing, setEditingBoxProps]);

  const handleChangeEditField = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setEditingBoxProps(prev => {
      let updatedValue;
      if (type === 'checkbox') {
        updatedValue = checked;
      } else if (name === 'opacity') {
        updatedValue = parseFloat(value);
        if (isNaN(updatedValue)) updatedValue = 0;
        updatedValue = Math.max(0, Math.min(1, updatedValue));
      } else if (name === 'width' || name === 'height') {
        updatedValue = value;
      } else {
        updatedValue = value;
      }
      return { ...prev, [name]: updatedValue };
    });
  }, [setEditingBoxProps]);

  const handleAddCustomProp = useCallback(() => {
    setEditingBoxProps(prev => {
        const newPropsArray = [...(prev.propsArray || []), { key: '', value: '' }];
        return { ...prev, propsArray: newPropsArray };
    });
  }, [setEditingBoxProps]);

  const handleRemoveCustomProp = useCallback((index) => {
    setEditingBoxProps(prev => {
        const newPropsArray = prev.propsArray.filter((_, i) => i !== index);
        return { ...prev, propsArray: newPropsArray };
    });
  }, [setEditingBoxProps]);

  const handleChangeCustomProp = useCallback((index, field, value) => {
    setEditingBoxProps(prev => {
        const newPropsArray = [...prev.propsArray];
        newPropsArray[index] = { ...newPropsArray[index], [field]: value };
        return { ...prev, propsArray: newPropsArray };
    });
  }, [setEditingBoxProps]);

  return {
    createNewBox, deleteSelectedBox, toggleEditPanel,
    handleSaveEdit, handleCancelEdit, handleChangeEditField,
    handleAddCustomProp, handleRemoveCustomProp, handleChangeCustomProp
  };
}

function Box({ box, isSelected, onMouseDownBox, onMouseDownHandle, globalIsDarkMode, h, dc, isCanvasLocked }) {
  const [LoadedChildComponent, setLoadedChildComponent] = useState(null);
  const [isLoadingComponent, setIsLoadingComponent] = useState(false);
  const [componentLoadError, setComponentLoadError] = useState(null);
  const [componentRuntimeError, setComponentRuntimeError] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const sandboxRef = useRef(null);
  
  const currentPath = dc.useCurrentPath();
  
  const lastTempFileRef = useRef(null);
  const componentFilePathRef = useRef(null);
  const shouldUseTempFileRef = useRef(false);

  useEffect(() => {
    if (!LoadedChildComponent || box.type !== 'datacore-component') return;
    
    const sandboxBoundary = sandboxRef.current;
    if (!sandboxBoundary) return;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.classList && node.classList.contains('component-render-root')) {
              const escapedElement = document.querySelector('.component-render-root');
              if (escapedElement && !sandboxBoundary.contains(escapedElement)) {
                const viewContent = sandboxBoundary.querySelector('.view-content');
                if (viewContent) {
                  viewContent.appendChild(escapedElement);
                  if (escapedElement.style.position === 'absolute') {
                    escapedElement.style.position = 'relative';
                  }
                }
              }
            }
          });
        }
      });
    });
    
    observer.observe(sandboxBoundary, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => observer.disconnect();
  }, [LoadedChildComponent, box.type]);
  
  useEffect(() => {
    return () => {
      if (lastTempFileRef.current) {
        app.vault.adapter.exists(lastTempFileRef.current).then(exists => {
          if (exists) {
            app.vault.adapter.remove(lastTempFileRef.current).catch(console.error);
          }
        });
      }
    };
  }, []);

  useEffect(() => {
    setComponentRuntimeError(null); 

    if (!dc) {
      setComponentLoadError("Datacore engine not available.");
      setLoadedChildComponent(null); setIsLoadingComponent(false); return;
    }

    if (box.type === 'datacore-component' && box.componentName) {
      setIsLoadingComponent(true); setComponentLoadError(null);
      let isMounted = true; 

      (async () => {
        try {
          console.log(`[Box Loading] Starting load for component: ${box.componentName}, reloadTrigger: ${reloadTrigger}, autoReload: ${box.autoReload}, shouldUseTemp: ${shouldUseTempFileRef.current}`);
          
          const allFiles = app.vault.getMarkdownFiles();
          const matchingFiles = allFiles.filter(file => 
            file.name.toLowerCase().includes(box.componentName.toLowerCase()) && 
            file.name.includes('.component') &&
            file.name.endsWith('.md')
          );
          
          if (matchingFiles.length === 0) {
            throw new Error(`No component found matching "${box.componentName}"`);
          }
          
          const file = matchingFiles[0];
          let filePath = file.path;
          
          console.log(`[Box Loading] Found component file: ${filePath}`);
          
          componentFilePathRef.current = filePath;
          
          if (box.autoReload && shouldUseTempFileRef.current && reloadTrigger > 0) {
            console.log(`[Box Hot-Reload] Hot-reload conditions met, creating temp file from: ${componentFilePathRef.current}`);
            const adapter = app.vault.adapter;
            
            const fileContent = await adapter.read(filePath);
            console.log(`[Box Hot-Reload] Read ${fileContent.length} bytes from source file`);
            
            const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
            const tempDir = `${currentDir}/temp`;
            
            if (!(await adapter.exists(tempDir))) {
              console.log(`[Box Hot-Reload] Creating temp directory: ${tempDir}`);
              await adapter.mkdir(tempDir);
            }
            
            if (lastTempFileRef.current && await adapter.exists(lastTempFileRef.current)) {
              console.log(`[Box Hot-Reload] Removing old temp file: ${lastTempFileRef.current}`);
              await adapter.remove(lastTempFileRef.current);
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const timestamp = Date.now();
            const simpleFileName = file.name.replace('.component.md', '').replace('.md', '').replace(/[^a-zA-Z0-9]/g, '-');
            const tempFileName = `temp-${simpleFileName}-${timestamp}.md`;
            const tempFilePath = `${tempDir}/${tempFileName}`;
            
            await adapter.write(tempFilePath, fileContent);
            console.log(`[Box Hot-Reload] Created temp file: ${tempFilePath} (${fileContent.length} bytes)`);
            
            await new Promise(resolve => setTimeout(resolve, 150));
            
            let tempFile = app.vault.getAbstractFileByPath(tempFilePath);
            let retries = 0;
            while (!tempFile && retries < 10) {
              await new Promise(resolve => setTimeout(resolve, 50));
              tempFile = app.vault.getAbstractFileByPath(tempFilePath);
              retries++;
            }
            
            if (!tempFile) {
              throw new Error(`Temp file not found in vault after creation: ${tempFilePath}`);
            }
            
            lastTempFileRef.current = tempFilePath;
            
            filePath = tempFilePath;
            console.log(`[Box Hot-Reload] Vault recognized temp file after ${retries} retries. Loading from: ${tempFilePath}`);
          } else {
            console.log(`[Box Loading] Loading directly from original file (no temp): ${filePath}`);
          }
          
          const fileContent = await app.vault.read(await app.vault.getAbstractFileByPath(filePath));
          const headerMatch = fileContent.match(/^#\s+(\w+)/m);
          const header = headerMatch?.[1] || "ViewComponent";
          
          console.log(`[Box Loading] Auto-detected header: ${header} from file: ${filePath}`);
          
          const resolvedPath = dc.resolvePath(filePath);
          const linkToComponent = dc.headerLink(resolvedPath, header);
          console.log(`[Box Loading] Resolved component link: ${linkToComponent}`);
          
          const dynamicModule = await dc.require(linkToComponent);
          console.log(`[Box Loading] Module loaded successfully:`, typeof dynamicModule);

          if (!isMounted) return;

          let ComponentToLoad = null;
          if (typeof dynamicModule === 'function') {
            ComponentToLoad = dynamicModule;
          } else if (dynamicModule && typeof dynamicModule === 'object') {
            const keys = Object.keys(dynamicModule);
            if (keys.length > 0) ComponentToLoad = dynamicModule[keys[0]];
          }

          if (typeof ComponentToLoad !== 'function') {
            throw new Error("Module did not export a renderable component.");
          }

          setLoadedChildComponent(() => ComponentToLoad);
        } catch (error) {
          if (!isMounted) return;
          console.error(`Error loading component '${box.componentName}':`, error);
          setComponentLoadError(error.message || "Failed to load component.");
          setLoadedChildComponent(null);
        } finally {
          if (isMounted) {
            setIsLoadingComponent(false);
          }
        }
      })();

      return () => { isMounted = false; };
    } else {
      setLoadedChildComponent(null); setIsLoadingComponent(false);
      if (box.type === 'datacore-component') {
          setComponentLoadError("Missing component name.");
      } else {
          setComponentLoadError(null);
      }
      return;
    }
  }, [box.type, box.componentName, box.autoReload, box.id, dc, reloadTrigger]);

  const handleReload = useCallback(async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (isLoadingComponent) {
      console.log('[Box Hot-Reload] Already loading, skipping reload');
      return;
    }
    
    console.log(`[Box Hot-Reload] Manual reload triggered for: ${box.componentName}`);
    shouldUseTempFileRef.current = true;
    setReloadTrigger(t => {
      console.log('[Box Hot-Reload] Incrementing reload trigger from', t, 'to', t + 1);
      return t + 1;
    });
    
    if (dc.app && dc.app.flash && typeof dc.app.flash.info === 'function') {
        dc.app.flash.info(`Reloading component: ${box.componentName}`);
    }
  }, [isLoadingComponent, dc.app, box.componentName]);

  const resizeHandleStyle = useCallback((type) => {
    const handleSize = 8;
    const offset = -handleSize / 2;
    const common = {
      position: 'absolute', width: `${handleSize}px`, height: `${handleSize}px`,
      background: 'white', border: '1px solid #007bff', borderRadius: '2px', zIndex: 4, cursor: 'default',
    };
    switch (type) {
      case 'tl': return { ...common, cursor: 'nwse-resize', left: offset, top: offset };
      case 't': return { ...common, cursor: 'ns-resize', left: '50%', transform: `translateX(-50%)`, top: offset };
      case 'tr': return { ...common, cursor: 'nesw-resize', right: offset, top: offset };
      case 'l': return { ...common, cursor: 'ew-resize', top: '50%', transform: `translateY(-50%)`, left: offset };
      case 'r': return { ...common, cursor: 'ew-resize', top: '50%', transform: `translateY(-50%)`, right: offset };
      case 'bl': return { ...common, cursor: 'nesw-resize', left: offset, bottom: offset };
      case 'b': return { ...common, cursor: 'ns-resize', left: '50%', transform: `translateX(-50%)`, bottom: offset };
      case 'br': return { ...common, cursor: 'nwse-resize', right: offset, bottom: offset };
      default: return {};
    }
  }, []);

  const renderShapeContent = () => {
    if (box.type === 'triangle') {
      return h('div', {
        style: { width: 0, height: 0, borderLeft: `${box.width / 2}px solid transparent`, borderRight: `${box.width / 2}px solid transparent`, borderBottom: `${box.height}px solid ${box.baseColor}` }
      }, String(box.label || ''));
    } else if (box.type === 'datacore-component') {
      let componentDisplayContent;
      const errorStyle = { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'red', backgroundColor: globalIsDarkMode ? 'rgba(50,0,0,0.7)' : 'rgba(255,220,220,0.7)', border: '1px solid red', padding: '10px', boxSizing: 'border-box', fontSize: '12px', overflow: 'auto', textAlign: 'center' };
      const preStyle = { whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '10px', textAlign: 'left', maxHeight: '80px', overflowY: 'auto', background: globalIsDarkMode ? '#403030' : '#fff0f0', padding: '5px', borderRadius: '4px', border: '1px dashed #ff8080', width: 'calc(100% - 10px)', margin: '5px auto' };

      if (isLoadingComponent) {
        componentDisplayContent = h('div', { style: { color: box.baseColor || (globalIsDarkMode ? 'white' : 'black'), fontSize: '14px', textAlign: 'center', lineHeight: 'normal', padding: '10px'} }, 'Loading component...');
      } else if (componentLoadError) {
        componentDisplayContent = h('div', { style: errorStyle }, h('p', { style: { margin: '0 0 5px 0', fontWeight: 'bold' } }, `Component Load Error:`), h('pre', { style: preStyle }, componentLoadError) );
      } else if (componentRuntimeError) {
        componentDisplayContent = h('div', { style: errorStyle }, h('p', { style: { margin: '0 0 5px 0', fontWeight: 'bold' } }, `Component Runtime Error:`), h('pre', { style: preStyle }, componentRuntimeError.toString()), componentRuntimeError.stack && h('pre', { style: {...preStyle, maxHeight: '60px', fontSize: '9px'} }, componentRuntimeError.stack.substring(0, 300) + (componentRuntimeError.stack.length > 300 ? '...' : '')) );
      } else if (LoadedChildComponent) {
        try {
          componentDisplayContent = h('div', { 
            ref: sandboxRef,
            className: 'component-sandbox-isolator',
            style: { 
              width: '100%', 
              height: '100%', 
              position: 'relative',
              overflow: 'hidden',
              isolation: 'isolate'
            }
          },
            h('div', {
              className: 'workspace-leaf-content component-sandbox-boundary',
              'data-sandbox': 'true',
              style: {
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                position: 'absolute',
                top: 0,
                left: 0,
                display: 'flex',
                flexDirection: 'column',
                contain: 'layout style paint'
              }
            },
              h('div', {
                className: 'view-content',
                style: {
                  width: '100%',
                  height: '100%',
                  overflow: 'auto',
                  position: 'relative',
                  flex: 1
                }
              },
                h('div', {
                  className: 'component-render-root',
                  style: { width: '100%', height: '100%' }
                },
                  h(LoadedChildComponent, {
                    key: `${box.componentName}-${reloadTrigger}`,
                    isDarkMode: globalIsDarkMode,
                    ...(box.props || {})
                  })
                )
              )
            )
          );
        } catch (error) {
          console.error(`Runtime error rendering component '${box.componentName}':`, error);
          if (!componentRuntimeError) { setComponentRuntimeError(error); }
          componentDisplayContent = h('div', { style: errorStyle }, h('p', { style: { margin: '0 0 5px 0', fontWeight: 'bold' } }, `Render Error (will update):`), h('pre', { style: preStyle }, error.toString()) );
        }
      } else {
        componentDisplayContent = h('div', { style: { color: box.baseColor || (globalIsDarkMode ? 'white' : 'black'), fontSize: '14px', textAlign: 'center', lineHeight: 'normal', padding: '10px' } }, String(box.label || "Configure Datacore Component"));
      }

      if (!componentDisplayContent || (typeof componentDisplayContent === 'object' && !componentDisplayContent.type)) {
        componentDisplayContent = h('div', { style: { color: 'red', fontSize: '14px', textAlign: 'center', padding: '10px' } }, 'Component render error');
      }

      return componentDisplayContent;
    } else if (box.type === 'text' || box.type === 'pure-text' || box.type === 'circle') {
      return String(box.label || '');
    } else {
      return null;
    }
  };
  
  const isAutoReloadEnabled = box.type === 'datacore-component' && box.autoReload;
  
  return (
    h('div', {
      className: "box-container",
      style: {
        position: "absolute", left: `${box.x}px`, top: `${box.y}px`,
        width: `${box.width}px`, height: `${box.height}px`,
        background: box.backgroundColor, opacity: box.opacity, 
        border: box.border,
        borderRadius: box.type === 'circle' ? '50%' : '4px',
        display: "flex", alignItems: "center", justifyContent: "center",
        color: box.baseColor,
        fontSize: box.type === 'pure-text' ? '24px' : '16px',
        fontWeight: box.type === 'pure-text' ? 'bold' : 'normal',
        cursor: isCanvasLocked ? 'default' : (isSelected ? 'grab' : 'pointer'),
        pointerEvents: isCanvasLocked && box.type !== 'datacore-component' ? 'none' : 'auto',
        boxShadow: isSelected ? "0 0 0 2px #007bff, 0 0 0 4px rgba(0, 123, 255, 0.3)" : "none",
        zIndex: isSelected ? 3 : 2,
        transition: 'box-shadow 0.1s ease-out',
        touchAction: 'none',
        overflow: 'visible',
        ...(box.type === 'datacore-component' ? { justifyContent: 'flex-start', alignItems: 'flex-start', padding: '0' } : {})
      },
      onMouseDown: (e) => {
        if (box.type === 'datacore-component') {
          e.stopPropagation();
        }
        onMouseDownBox(e, box.id);
      }
    },
      isAutoReloadEnabled && h('div', {
        style: { 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          border: `2px solid ${globalIsDarkMode ? 'rgba(147, 51, 234, 0.6)' : 'rgba(147, 51, 234, 0.8)'}`, 
          borderRadius: 'inherit', 
          pointerEvents: 'none',
          boxShadow: `0 0 12px ${globalIsDarkMode ? 'rgba(147, 51, 234, 0.3)' : 'rgba(147, 51, 234, 0.2)'}`
        }
      }),
      isAutoReloadEnabled && h('button', {
        title: "Hot-Reload Component (Click to refresh)",
        onClick: handleReload,
        onMouseDown: (e) => {
          e.stopPropagation();
          e.preventDefault();
        },
        style: { 
          position: 'absolute', 
          top: '4px', 
          right: '4px', 
          zIndex: 10, 
          width: '32px', 
          height: '32px', 
          padding: '0',
          background: globalIsDarkMode ? 'rgba(20, 20, 25, 0.98)' : 'rgba(255, 255, 255, 0.98)', 
          border: `2px solid ${globalIsDarkMode ? 'rgba(147, 51, 234, 0.9)' : 'rgba(147, 51, 234, 0.7)'}`,
          borderRadius: '8px', 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          transition: 'all 0.15s ease',
          boxShadow: `0 2px 10px ${globalIsDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.2)'}, 0 0 20px ${globalIsDarkMode ? 'rgba(147, 51, 234, 0.3)' : 'rgba(147, 51, 234, 0.2)'}`,
          backdropFilter: 'blur(10px)',
          pointerEvents: 'auto'
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.background = globalIsDarkMode ? 'rgba(147, 51, 234, 0.25)' : 'rgba(147, 51, 234, 0.2)';
          e.currentTarget.style.transform = 'scale(1.08) rotate(90deg)';
          e.currentTarget.style.borderColor = globalIsDarkMode ? 'rgba(147, 51, 234, 1)' : 'rgba(147, 51, 234, 0.9)';
          e.currentTarget.style.boxShadow = `0 4px 16px ${globalIsDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.25)'}, 0 0 30px ${globalIsDarkMode ? 'rgba(147, 51, 234, 0.5)' : 'rgba(147, 51, 234, 0.4)'}`;
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.background = globalIsDarkMode ? 'rgba(20, 20, 25, 0.98)' : 'rgba(255, 255, 255, 0.98)';
          e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
          e.currentTarget.style.borderColor = globalIsDarkMode ? 'rgba(147, 51, 234, 0.9)' : 'rgba(147, 51, 234, 0.7)';
          e.currentTarget.style.boxShadow = `0 2px 10px ${globalIsDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.2)'}, 0 0 20px ${globalIsDarkMode ? 'rgba(147, 51, 234, 0.3)' : 'rgba(147, 51, 234, 0.2)'}`;
        }
      }, h(dc.Icon, { icon: 'refresh-cw', style: { width: '18px', height: '18px', color: globalIsDarkMode ? 'rgba(147, 51, 234, 1)' : 'rgba(147, 51, 234, 0.9)', transition: 'inherit' } })
      ),
      
      h('div', { className: 'shape-content-wrapper', style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, 
        renderShapeContent()
      ),

      ...(isSelected && !isCanvasLocked ? (
        ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'].map(handleType =>
          h('div', { key: handleType, className: "resize-handle", style: resizeHandleStyle(handleType), onMouseDown: (e) => onMouseDownHandle(e, box.id, handleType) })
        )
      ) : [])
    )
  );
}

return { Box, useBoxManagement };
