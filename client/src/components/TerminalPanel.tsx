import * as React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X } from 'lucide-react';
import Terminal from './Terminal';
import { Button } from './ui/button';

interface TerminalTab {
  id: string;
  title: string;
}

function SortableTab({ tab, isActive, onSelect, onClose, tabCount }: {
  tab: TerminalTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  tabCount: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-3 py-1.5 text-xs font-mono border-r border-cyan-500/30 cursor-pointer transition-all ${
        isActive 
          ? 'bg-gradient-to-b from-cyan-500/20 to-purple-500/20 text-cyan-400 border-b-2 border-b-cyan-400' 
          : 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10'
      }`}
      onClick={onSelect}
    >
      <div {...attributes} {...listeners} className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50"></div>
        <span>{tab.title}</span>
      </div>
      {tabCount > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export default function TerminalPanel() {
  const [tabs, setTabs] = React.useState<TerminalTab[]>([
    { id: 'terminal-1', title: 'Terminal 1' }
  ]);
  const [activeTabId, setActiveTabId] = React.useState('terminal-1');
  const tabCounterRef = React.useRef(1);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTabs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  function addNewTab() {
    tabCounterRef.current += 1;
    const newTab: TerminalTab = {
      id: `terminal-${tabCounterRef.current}`,
      title: `Terminal ${tabCounterRef.current}`
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }

  function closeTab(id: string) {
    if (tabs.length === 1) return;
    
    const tabIndex = tabs.findIndex(t => t.id === id);
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    
    if (activeTabId === id) {
      const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
      setActiveTabId(newTabs[newActiveIndex].id);
    }
  }

  function switchToNextTab() {
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    setActiveTabId(tabs[nextIndex].id);
  }

  function switchToPrevTab() {
    const currentIndex = tabs.findIndex(t => t.id === activeTabId);
    const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
    setActiveTabId(tabs[prevIndex].id);
  }

  // Keyboard shortcuts
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+T: New tab
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        addNewTab();
      }
      // Ctrl+W: Close tab
      if (e.ctrlKey && e.key === 'w' && tabs.length > 1) {
        e.preventDefault();
        closeTab(activeTabId);
      }
      // Ctrl+Tab: Next tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        switchToNextTab();
      }
      // Ctrl+Shift+Tab: Previous tab
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        switchToPrevTab();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId]);

  return (
    <div className="h-full flex flex-col bg-black/80 backdrop-blur-sm border-l border-cyan-500/30">
      <div className="h-10 border-b border-cyan-500/30 flex items-center bg-gradient-to-r from-purple-900/30 to-cyan-900/30">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-center flex-1 overflow-x-auto">
            <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
              {tabs.map((tab) => (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  onSelect={() => setActiveTabId(tab.id)}
                  onClose={() => closeTab(tab.id)}
                  tabCount={tabs.length}
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>
        
        <Button
          onClick={addNewTab}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 mx-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20"
          title="New Terminal (Ctrl+T)"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex-1 relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${tab.id === activeTabId ? 'block' : 'hidden'}`}
          >
            <Terminal terminalId={tab.id} isActive={tab.id === activeTabId} />
          </div>
        ))}
      </div>
    </div>
  );
}
