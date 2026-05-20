const { useState, useRef, useEffect, useCallback } = dc;

function getInt(val) {
  return parseInt(val, 10) || 0;
}

function resetScreenMode(container, defaultStyle, originalParentRefForWindow, originalParentRefForPiP) {
  if (document.fullscreenElement === container) {
    document.exitFullscreen?.();
  }

  if (container._placeholderForBrowser && container._placeholderForBrowser.parentNode) {
    container._placeholderForBrowser.parentNode.replaceChild(container, container._placeholderForBrowser);
    delete container._placeholderForBrowser;
    delete container._originalParentForBrowser;
  }

  if (container._parentPositionInfo?.element) {
    container._parentPositionInfo.element.style.position =
      container._parentPositionInfo.original === "static"
        ? ""
        : container._parentPositionInfo.original;
    delete container._parentPositionInfo;
  }

  if (container.parentNode === document.body) {
    if (originalParentRefForWindow.current) {
      originalParentRefForWindow.current.appendChild(container);
      originalParentRefForWindow.current = null;
    } else if (originalParentRefForPiP.current) {
      originalParentRefForPiP.current.appendChild(container);
      originalParentRefForPiP.current = null;
    }
  }

  if (container._pipDragAttached) {
    window.removeEventListener("mousemove", container._pipDragAttached.dragMove);
    window.removeEventListener("mouseup", container._pipDragAttached.dragEnd);
    if (container._pipDragBar) {
        container._pipDragBar.removeEventListener("mousedown", container._pipDragAttached.dragStart);
        if (container._pipDragBar.parentNode === container) {
            container.removeChild(container._pipDragBar);
        }
        delete container._pipDragBar;
    }
    delete container._pipDragAttached;
    delete container._pipDragging;
  }
  if (container._pipResizers) {
    container._pipResizers.forEach(resizer => {
      if (resizer.parentNode === container) {
        container.removeChild(resizer);
      }
    });
    delete container._pipResizers;
  }
  delete container._pipReset;

  if (!container.getAttribute('data-is-independent-pip')) {
      container.style.cssText = defaultStyle;
  }
  console.log("[resetScreenMode] Container reset complete.");
}

function applyBrowserMode(container) {
  if (document.fullscreenElement === container) {
    document.exitFullscreen?.();
  }
  
  let targetPaneContent = container.closest('.workspace-leaf-content');
  if (!targetPaneContent) {
    console.error("[applyBrowserMode] Could not find workspace-leaf-content ancestor!");
    return;
  }
  
  const contentWrapper = targetPaneContent.querySelector('.view-content') || targetPaneContent;

  if (!container._originalParentForBrowser) {
    container._originalParentForBrowser = container.parentNode;
    container._placeholderForBrowser = document.createElement("div");
    container._placeholderForBrowser.style.display = "none";
    container.parentNode.insertBefore(container._placeholderForBrowser, container);
  }

  if (!container._parentPositionInfo) {
    const originalPosition = window.getComputedStyle(contentWrapper).position;
    container._parentPositionInfo = {
      element: contentWrapper,
      original: originalPosition,
    };

    if (originalPosition === "static") {
      contentWrapper.style.position = "relative";
    }
  }

  if (container.parentNode !== contentWrapper) {
    contentWrapper.appendChild(container);
  }

  Object.assign(container.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "9998",
    overflow: "auto",
    margin: "0",
    padding: "0",
    border: "none",
    borderRadius: "0"
  });
}

function toggleFullscreenOnBrowserMode(container) {
  if (document.fullscreenElement === container) {
    document.exitFullscreen?.();
  } else {
    container.requestFullscreen?.() ||
      container.webkitRequestFullscreen?.() ||
      container.mozRequestFullScreen?.() ||
      container.msRequestFullscreen?.();
  }
}

function applyWindowStyle(container) {
  Object.assign(container.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    zIndex: "9999",
    margin: "0",
    padding: "0",
    border: "none",
    borderRadius: "0",
    boxSizing: "border-box"
  });
}

function applyPipStyle(container) {
  Object.assign(container.style, {
    position: "fixed",
    top: "calc(100% - 300px - 10px)",
    left: "calc(100% - 400px - 10px)",
    width: "400px",
    height: "300px",
    zIndex: "10000",
    backgroundColor: container.style.backgroundColor || "#2c2c2c",
    border: "2px solid #444",
    borderRadius: "4px",
    cursor: "default",
    boxSizing: "border-box",
    padding: "0",
    overflow: "hidden"
  });
}

function setupPipDrag(container) {
  if (container._pipDragAttached) return;

  const dragBar = document.createElement("div");
  dragBar.className = "pip-drag-bar";
  Object.assign(dragBar.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "25px",
    background: "rgba(0,0,0,0.1)",
    cursor: "grab",
    zIndex: 10500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '12px',
    borderTopLeftRadius: '4px',
    borderTopRightRadius: '4px',
    userSelect: 'none',
  });
  dragBar.textContent = 'DRAG';

  const dragHandlers = {
    dragStart: (e) => {
      if (e.target !== dragBar) return;
      e.preventDefault();
      container._pipDragging = true;
      container._pipStartX = e.clientX;
      container._pipStartY = e.clientY;
      const computed = getComputedStyle(container);
      container._pipOrigTop = getInt(computed.top);
      container._pipOrigLeft = getInt(computed.left);
      dragBar.style.cursor = 'grabbing';
    },
    dragMove: (e) => {
      if (!container._pipDragging) return;
      const deltaX = e.clientX - container._pipStartX;
      const deltaY = e.clientY - container._pipStartY;
      container.style.top = `${container._pipOrigTop + deltaY}px`;
      container.style.left = `${container._pipOrigLeft + deltaX}px`;
    },
    dragEnd: () => {
      container._pipDragging = false;
      dragBar.style.cursor = 'grab';
    }
  };

  dragBar.addEventListener("mousedown", dragHandlers.dragStart);
  window.addEventListener("mousemove", dragHandlers.dragMove);
  window.addEventListener("mouseup", dragHandlers.dragEnd);

  container.appendChild(dragBar);
  container._pipDragBar = dragBar;
  container._pipDragAttached = dragHandlers;
}

function setupPipCornerResizers(container) {
  if (container._pipResizers && container._pipResizers.length > 0) return;

  const corners = [
    { corner: "topLeft", style: { top: "-5px", left: "-5px", cursor: "nwse-resize" } },
    { corner: "topRight", style: { top: "-5px", right: "-5px", cursor: "nesw-resize" } },
    { corner: "bottomRight", style: { bottom: "-5px", right: "-5px", cursor: "nwse-resize" } },
    { corner: "bottomLeft", style: { bottom: "-5px", left: "-5px", cursor: "nesw-resize" } }
  ];
  const resizers = [];
  const handleSize = 10;

  corners.forEach(({ corner, style }) => {
    const resizer = document.createElement("div");
    resizer.className = `pip-resizer pip-resizer-${corner}`;
    Object.assign(resizer.style, {
      position: "absolute",
      width: `${handleSize}px`,
      height: `${handleSize}px`,
      background: "#007bff",
      border: "1px solid white",
      borderRadius: "2px",
      zIndex: 10500,
      ...style
    });

    resizer.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      resizer._resizing = true;
      resizer._startX = e.clientX;
      resizer._startY = e.clientY;
      const computed = getComputedStyle(container);
      resizer._origWidth = getInt(computed.width);
      resizer._origHeight = getInt(computed.height);
      resizer._origTop = getInt(computed.top);
      resizer._origLeft = getInt(computed.left);
      resizer._corner = corner;
    });
    resizers.push(resizer);
    container.appendChild(resizer);
  });
  container._pipResizers = resizers;

  const resizeMove = (e) => {
    if (!container._pipResizers) return;
    container._pipResizers.forEach((resizer) => {
      if (!resizer._resizing) return;

      const deltaX = e.clientX - resizer._startX;
      const deltaY = e.clientY - resizer._startY;
      let newWidth = resizer._origWidth;
      let newHeight = resizer._origHeight;
      let newLeft = resizer._origLeft;
      let newTop = resizer._origTop;

      switch (resizer._corner) {
        case "bottomRight":
          newWidth = Math.max(200, resizer._origWidth + deltaX);
          newHeight = Math.max(150, resizer._origHeight + deltaY);
          break;
        case "bottomLeft":
          newWidth = Math.max(200, resizer._origWidth - deltaX);
          newHeight = Math.max(150, resizer._origHeight + deltaY);
          newLeft = resizer._origLeft + deltaX;
          break;
        case "topRight":
          newWidth = Math.max(200, resizer._origWidth + deltaX);
          newHeight = Math.max(150, resizer._origHeight - deltaY);
          newTop = resizer._origTop + deltaY;
          break;
        case "topLeft":
          newWidth = Math.max(200, resizer._origWidth - deltaX);
          newHeight = Math.max(150, resizer._origHeight - deltaY);
          newLeft = resizer._origLeft + deltaX;
          newTop = resizer._origTop + deltaY;
          break;
      }
      container.style.width = `${newWidth}px`;
      container.style.height = `${newHeight}px`;
      container.style.top = `${newTop}px`;
      container.style.left = `${newLeft}px`;
    });
  };

  const resizeEnd = () => {
    if (container._pipResizers) {
      container._pipResizers.forEach((resizer) => {
        resizer._resizing = false;
      });
    }
  };

  window.addEventListener("mousemove", resizeMove);
  window.addEventListener("mouseup", resizeEnd);
}

function spawnIndependentPip(AppComponent, isDarkMode) {
  const hostDiv = document.createElement("div");
  hostDiv.setAttribute('data-is-independent-pip', 'true');
  hostDiv.style.backgroundColor = isDarkMode ? '#2c2c2c' : 'white';
  document.body.appendChild(hostDiv);

  const closeIndependentPip = () => {
    resetScreenMode(hostDiv, '', { current: null }, { current: null });
    dc.preact.render(null, hostDiv);
    if (hostDiv.parentNode) {
      hostDiv.parentNode.removeChild(hostDiv);
    }
  };

  dc.preact.render(
    h(AppComponent, {
        isDarkMode: isDarkMode,
    }),
    hostDiv
  );

  applyPipStyle(hostDiv);
  setupPipDrag(hostDiv);
  setupPipCornerResizers(hostDiv);

  const closeButton = document.createElement('button');
  closeButton.textContent = 'X';
  Object.assign(closeButton.style, {
    position: 'absolute',
    top: '0',
    right: '0',
    zIndex: '10600',
    cursor: 'pointer',
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderTopRightRadius: '4px',
    borderBottomLeftRadius: '4px',
    width: '25px',
    height: '25px',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
  });
  closeButton.onclick = closeIndependentPip;
  if (hostDiv._pipDragBar) {
      hostDiv._pipDragBar.appendChild(closeButton);
  } else {
      hostDiv.appendChild(closeButton);
  }
}

const ScreenModeHelper = ({
  helperRef,
  initialMode = "default",
  containerRef,
  defaultStyle,
  originalParentRefForWindow,
  originalParentRefForPiP,
  allowedScreenModes = ["browser", "window", "pip"],
  engine,
  AppComponent,
  isDarkMode,
  onModeChange,
  onModeUpdate,
}) => {
  const [activeMode, setActiveMode] = useState(
    allowedScreenModes.includes(initialMode) ? initialMode : "default"
  );
  
  const [isInFullscreen, setIsInFullscreen] = useState(false);

  // FullTab stylesheet injection system to hide Obsidian bars/footers
  useEffect(() => {
    let styleEl = null;
    if (activeMode === "browser") {
      console.log("[ScreenModeHelper] Browser mode active. Injecting FullTab stylesheet.");
      styleEl = document.createElement("style");
      styleEl.id = "fulltab-immersive-stylesheet";
      styleEl.textContent = `
        .status-bar, 
        .view-footer, 
        .workspace-leaf-content-footer { 
          display: none !important; 
        }
      `;
      document.head.appendChild(styleEl);
    }
    return () => {
      if (styleEl) {
        console.log("[ScreenModeHelper] Removing FullTab stylesheet.");
        styleEl.remove();
      }
    };
  }, [activeMode]);

  const toggleMode = useCallback((mode, forceApply = false) => {
    console.group(`[ScreenModeHelper.toggleMode] Toggling to: '${mode}' from '${activeMode}' (forceApply=${forceApply})`);

    const container = containerRef.current;
    if (!container) {
        console.warn("[ScreenModeHelper.toggleMode] Container ref is null.");
        console.groupEnd();
        return;
    }

    if (activeMode === "browser" && mode === "browser" && !forceApply) {
      toggleFullscreenOnBrowserMode(container);
      console.groupEnd();
      return;
    }

    if ((activeMode === "window" && mode === "window") || (activeMode === "pip" && mode === "pip")) {
      if (!forceApply) {
        toggleMode("browser", true);
        console.groupEnd();
        return;
      }
    }

    let newActiveMode = "default";
    if (mode !== "character") {
        if (forceApply) {
            newActiveMode = mode;
        } else {
            newActiveMode = mode;
        }
    }
    
    const isGoingFromBrowserToOtherMode = (activeMode === "browser" && (newActiveMode === "window" || newActiveMode === "pip"));
    
    if (activeMode !== newActiveMode && !isGoingFromBrowserToOtherMode) {
        resetScreenMode(container, defaultStyle, originalParentRefForWindow, originalParentRefForPiP);
    } else if (isGoingFromBrowserToOtherMode) {
        if (container._parentPositionInfo?.element) {
            const originalPos = container._parentPositionInfo.original;
            container._parentPositionInfo.element.style.position =
                originalPos === "static" ? "" : originalPos;
        }
    }
    
    setActiveMode(newActiveMode);
    
    if (typeof onModeUpdate === 'function') {
      onModeUpdate(newActiveMode);
    }

    if (newActiveMode === "default") {
      console.log("[ScreenModeHelper.toggleMode] Reset to default completed.");
    } else if (newActiveMode === "browser") {
      if (container._placeholderForBrowser && container._placeholderForBrowser.parentNode) {
        const placeholder = container._placeholderForBrowser;
        placeholder.parentNode.replaceChild(container, placeholder);
        
        if (container._parentPositionInfo?.element) {
          container._parentPositionInfo.element.style.position =
            container._parentPositionInfo.original === "static" ? "" : container._parentPositionInfo.original;
        }
        
        delete container._placeholderForBrowser;
        delete container._originalParentForBrowser;
        delete container._parentPositionInfo;
      } else {
        applyBrowserMode(container);
      }
    } else if (newActiveMode === "window") {
      if (container.parentNode !== document.body && activeMode !== "browser") {
        originalParentRefForWindow.current = container.parentNode;
      }
      if (container.parentNode !== document.body) {
        document.body.appendChild(container);
      }
      applyWindowStyle(container);
    } else if (newActiveMode === "pip") {
      if (container.parentNode !== document.body && activeMode !== "browser") {
        originalParentRefForPiP.current = container.parentNode;
      }
      if (container.parentNode !== document.body) {
        document.body.appendChild(container);
      }
      applyPipStyle(container);
      setupPipDrag(container);
      setupPipCornerResizers(container);
    } else if (mode === "character") {
      if (AppComponent) {
        spawnIndependentPip(AppComponent, isDarkMode);
      }
    }

    if (engine) {
      setTimeout(() => {
        if (typeof engine.resize === 'function') {
            engine.resize();
        }
      }, 100);
    }
    
    if (typeof onModeChange === 'function') {
        onModeChange();
    }

    console.groupEnd();
  }, [
      activeMode, containerRef, originalParentRefForWindow, originalParentRefForPiP, 
      defaultStyle, engine, isDarkMode, AppComponent, 
      onModeChange, onModeUpdate
  ]);

  useEffect(() => {
    if (helperRef) {
      helperRef.current = { toggleMode };
    }
  }, [helperRef, toggleMode]);

  const initialModeAppliedRef = useRef(false);

  useEffect(() => {
    if (initialMode !== "default" && containerRef.current && !initialModeAppliedRef.current) {
      initialModeAppliedRef.current = true;
      if (initialMode !== "character") {
        toggleMode(initialMode, true);
      }
    }
  }, [initialMode, containerRef.current, toggleMode]);

  useEffect(() => {
    let observer;
    let resizeTimeout;
    if (containerRef.current && engine) {
      observer = new ResizeObserver((entries) => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          entries.forEach((entry) => {
            const { width } = entry.contentRect;
            let scalingFactor;
            if (activeMode === "pip") {
              scalingFactor = 0.25;
            } else {
              const baseWidth = 400;
              scalingFactor = baseWidth / width;
              scalingFactor = Math.max(0.25, Math.min(scalingFactor, 1));
              const extraFactor = 1 * (window.devicePixelRatio || 1);
              scalingFactor = scalingFactor / extraFactor;
              scalingFactor = Math.max(0.001, scalingFactor);
            }

            if (engine && typeof engine.setHardwareScalingLevel === 'function') {
                engine.setHardwareScalingLevel(scalingFactor);
            }

            if (engine && typeof engine.resize === 'function') {
                engine.resize();
            }
          });
        }, 300);
      });
      observer.observe(containerRef.current);
    }
    return () => {
      if (observer && containerRef.current) {
        observer.unobserve(containerRef.current);
      }
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, [containerRef, engine, activeMode]);

  useEffect(() => {
      const handleFullscreenChange = () => {
          const inFullscreen = !!document.fullscreenElement;
          setIsInFullscreen(inFullscreen);
      };

      const handleFullscreenError = (event) => {
          console.error("[FullscreenEvent] Fullscreen error:", event);
      };

      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('fullscreenerror', handleFullscreenError);

      return () => {
          document.removeEventListener('fullscreenchange', handleFullscreenChange);
          document.removeEventListener('fullscreenerror', handleFullscreenError);
      };
  }, [activeMode]);

  const modeIcons = {
    browser: "maximize",
    window: "square",
    pip: "picture-in-picture-2",
    default: "circle",
  };

  const buttonStyle = (isActive) => ({
    width: "48px",
    height: "48px",
    cursor: "pointer",
    backgroundColor: isActive ? "rgba(139, 92, 246, 0.2)" : "rgba(0, 0, 0, 0.3)",
    border: isActive ? "1px solid rgba(139, 92, 246, 0.5)" : "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0",
    transition: "all 0.2s ease",
    backdropFilter: "blur(10px)",
    pointerEvents: "auto",
    userSelect: "none",
  });

  const modesToDisplay = allowedScreenModes.filter((mode) => mode !== "none" && mode !== "character");

  return h('div', {
    style: {
      position: "absolute",
      top: "16px",
      right: "16px",
      zIndex: 9999,
      display: "flex",
      gap: "8px",
      background: "rgba(0, 0, 0, 0.3)",
      borderRadius: "12px",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      pointerEvents: "auto",
      userSelect: "none",
      padding: "8px",
    }
  },
    modesToDisplay.map((mode) => {
      let tooltipText = mode.charAt(0).toUpperCase() + mode.slice(1) + " Mode";
      if (mode === "browser") {
        tooltipText = activeMode === "browser" ? "Exit Fullscreen (ESC)" : "Enter Fullscreen";
      }
      
      return h('button', {
        key: mode,
        type: "button",
        onMouseDown: (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleMode(mode);
        },
        style: buttonStyle(mode === "browser" ? isInFullscreen : activeMode === mode),
        title: tooltipText,
      },
        h(dc.Icon, { 
          icon: modeIcons[mode], 
          style: { 
            fontSize: "20px", 
            color: (mode === "browser" ? isInFullscreen : activeMode === mode) ? "#8b5cf6" : "rgba(255, 255, 255, 0.7)",
            pointerEvents: "none",
          } 
        })
      );
    }),
    activeMode === "pip" && h('button', {
      type: "button",
      onMouseDown: (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMode("pip");
      },
      style: buttonStyle(false),
      title: "Close Pip",
    },
      h(dc.Icon, { 
        icon: "x", 
        style: { 
          fontSize: "20px", 
          color: "rgba(255, 255, 255, 0.7)",
          pointerEvents: "none",
        } 
      })
    )
  );
};

return { ScreenModeHelper };
