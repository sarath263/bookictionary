import React, { useState, useEffect } from 'react';
import {
  Menu,
  Bookmark,
  Search,
  Mic,
  ChevronRight,
  Home,
  BookOpen,
  History,
  X,
  Settings,
  Info,
  Share2,
  Moon,
  Sun,
  Monitor
} from 'lucide-react';
import './index.css';
import { List } from 'react-window';



const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
let allData = {};

function App() {
  const [activeLetter, setActiveLetter] = useState('A');
  const [activeTab, setActiveTab] = useState('Words');
  const [wordList, setWordList] = useState([]);
  const [dbUpdatedCounter, setDbUpdatedCounter] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'system';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      if (theme === 'system') {
        root.setAttribute('data-theme', mediaQuery.matches ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', theme);
      }
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [theme]);

  const toggleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const getThemeIcon = () => {
    if (theme === 'light') return <Sun size={20} />;
    if (theme === 'dark') return <Moon size={20} />;
    return <Monitor size={20} />;
  };

  const getThemeLabel = () => {
    if (theme === 'light') return 'Light Theme';
    if (theme === 'dark') return 'Dark Theme';
    return 'Device Theme';
  };

  // Initialize Web Worker for background pre-fetching
  useEffect(() => {
    const worker = new Worker(new URL('./dbWorker.js', import.meta.url), { type: 'module' });
    worker.postMessage({ type: 'START_PREFETCH' });

    worker.onmessage = (e) => {
      if (e.data.type === 'PROGRESS') {
        // Trigger a reload of data if the active letter was just fetched or DB got populated
        setDbUpdatedCounter(prev => prev + 1);
      }
      if (e.data?.parsedWords) {
        allData[e.data.letter] = e.data.parsedWords;
      }
      if (e.data.type === 'COMPLETE' && e.data?.allData) {
        allData = e.data.allData;
      }
    };

    return () => worker.terminate();
  }, []);

  // Load words from IndexedDB when activeLetter changes or DB is updated
  useEffect(() => {
    let isMounted = true;

    const loadData = () => {
      const letterLower = activeLetter.toLowerCase();

      const request = indexedDB.open('DictionaryDB', 6);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('words')) {
          const store = db.createObjectStore('words', { keyPath: 'word' });
          store.createIndex('lowerWord', 'lowerWord', { unique: false });
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('words')) return;

        try {
          const tx = db.transaction('words', 'readonly');
          const store = tx.objectStore('words');

          if (store.indexNames.contains('lowerWord')) {
            const index = store.index('lowerWord');
            const prefix = letterLower;
            const range = IDBKeyRange.bound(prefix, prefix + '\uffff');
            const getAllReq = index.getAll(range);

            getAllReq.onsuccess = () => {
              if (isMounted && getAllReq.result) {
                const results = getAllReq.result.filter(item =>
                  item.lowerWord.startsWith(prefix)
                );
                allData[activeLetter] = results;
                setWordList(results);
              }
            };
          } else {
            const getAllReq = store.getAll();
            getAllReq.onsuccess = () => {
              if (isMounted && getAllReq.result) {
                const results = getAllReq.result.filter(item =>
                  (item.lowerWord || item.word.toLowerCase()).startsWith(letterLower)
                );
                allData[activeLetter] = results;
                setWordList(results);
              }
            };
          }
        } catch (e) {
          console.error("Error querying IndexedDB", e);
        }
      };
    };
    if (allData?.[activeLetter]?.length > 0) {
      setWordList(allData[activeLetter]);
    } else {
      loadData();
    }
    return () => { isMounted = false; };
  }, [activeLetter, dbUpdatedCounter]);

  return (
    <>
      <header className="header">
        <button className="icon-button" onClick={() => setIsMenuOpen(true)}>
          <Menu size={24} />
        </button>
        <h1>English Dictionary</h1>
        <button className="icon-button">
          <Bookmark size={24} />
        </button>
      </header>

      <div className="search-container">
        <div className="search-box">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search for a word..."
          />
          <button className="icon-button">
            <Mic size={20} className="search-icon" />
          </button>
        </div>
      </div>

      <main className="main-content">
        <div className="alphabet-index">
          {alphabet.map(letter => (
            <div
              key={letter}
              className={`letter ${activeLetter === letter ? 'active' : ''}`}
              onClick={() => setActiveLetter(letter)}
            >
              {letter}
            </div>
          ))}
        </div>

        <div className="word-list">

          <List
            rowComponent={({ index: idx, style }) => (
              <div key={idx} className="word-item" style={style}>
                <div className="word-info">
                  <div className="word-header">
                    <span className="word-title">{wordList?.[idx].word}</span>
                    <span className="word-type">{wordList?.[idx].type}</span>
                  </div>
                  <span className="word-def">{wordList?.[idx].def}</span>
                </div>
                <ChevronRight size={20} className="chevron-icon" />
              </div>
            )}
            rowCount={wordList.length}
            rowHeight={75}
            rowProps={{ wordList }}
          />
        </div>
      </main>

      <nav className="bottom-nav">
        <div
          className={`nav-item ${activeTab === 'Home' ? 'active' : ''}`}
          onClick={() => setActiveTab('Home')}
        >
          <Home size={24} />
          <span>Home</span>
        </div>
        <div
          className={`nav-item ${activeTab === 'Words' ? 'active' : ''}`}
          onClick={() => setActiveTab('Words')}
        >
          <BookOpen size={24} />
          <span>Words</span>
        </div>
        <div
          className={`nav-item ${activeTab === 'Bookmarks' ? 'active' : ''}`}
          onClick={() => setActiveTab('Bookmarks')}
        >
          <Bookmark size={24} />
          <span>Bookmarks</span>
        </div>
        <div
          className={`nav-item ${activeTab === 'History' ? 'active' : ''}`}
          onClick={() => setActiveTab('History')}
        >
          <History size={24} />
          <span>History</span>
        </div>
      </nav>

      <div className={`drawer-backdrop ${isMenuOpen ? 'open' : ''}`} onClick={() => setIsMenuOpen(false)}></div>
      <div className={`side-drawer ${isMenuOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h2>Menu</h2>
          <button className="icon-button" onClick={() => setIsMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <div className="drawer-menu">
          <div className="drawer-item">
            <Settings size={20} />
            <span>Settings</span>
          </div>
          <div className="drawer-item" onClick={toggleTheme}>
            {getThemeIcon()}
            <span>{getThemeLabel()}</span>
          </div>
          <div className="drawer-item">
            <Share2 size={20} />
            <span>Share App</span>
          </div>
          <div className="drawer-item">
            <Info size={20} />
            <span>About</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
