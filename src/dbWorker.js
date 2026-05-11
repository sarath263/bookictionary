const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));

self.onmessage = async (e) => {
  if (e.data.type === 'START_PREFETCH') {
    const request = indexedDB.open('DictionaryDB', 3);

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

    request.onsuccess = async (event) => {
      const db = event.target.result;

      const checkTx = db.transaction('metadata', 'readonly');
      const metaStore = checkTx.objectStore('metadata');
      const getReq = metaStore.get('prefetchComplete');

      getReq.onsuccess = async () => {
        if (getReq.result && getReq.result.value === true) {
          self.postMessage({ type: 'COMPLETE' });
          return;
        }
        let allData = {};
        for (const letter of alphabet) {
          try {
            // Check if letter is already fetched
            const letterCheckTx = db.transaction('metadata', 'readonly');
            const letterReq = letterCheckTx.objectStore('metadata').get(`letter_${letter}`);

            const isFetched = await new Promise((resolve) => {
              letterReq.onsuccess = () => resolve(letterReq.result?.value === true);
              letterReq.onerror = () => resolve(false);
            });

            if (isFetched) {
              self.postMessage({ type: 'PROGRESS', letter });
              continue;
            }

            const rawData = await import(`./assets/data/${letter}.json`);
            const dict = rawData.default || rawData;
            const parsedWords = [];

            for (const [word, details] of Object.entries(dict)) {
              const meanings = details.MEANINGS || {};
              const meaningKeys = Object.keys(meanings);
              if (meaningKeys.length > 0) {
                const meaningArr = meanings[meaningKeys[0]];
                parsedWords.push({
                  word: word,
                  lowerWord: word.toLowerCase(),
                  type: meaningArr[0] || '',
                  def: meaningArr[1] || ''
                });
              } else {
                parsedWords.push({
                  word: word,
                  lowerWord: word.toLowerCase(),
                  type: '',
                  def: 'No definition available.'
                });
              }
            }

            const tx = db.transaction(['words', 'metadata'], 'readwrite');
            const store = tx.objectStore('words');
            const meta = tx.objectStore('metadata');
            allData[letter] = parsedWords;
            parsedWords.forEach(w => {
              store.put(w);
            });
            meta.put({ key: `letter_${letter}`, value: true });

            await new Promise((resolve, reject) => {
              tx.oncomplete = resolve;
              tx.onerror = reject;
            });


            self.postMessage({ type: 'PROGRESS', letter, parsedWords });
          } catch (err) {
            console.error(`Error processing ${letter}:`, err);
          }
        }

        const markTx = db.transaction('metadata', 'readwrite');
        markTx.objectStore('metadata').put({ key: 'prefetchComplete', value: true });

        self.postMessage({ type: 'COMPLETE', allData });
      };

      request.onerror = (err) => {
        console.error('Worker IndexedDB error:', err);
      };
    };
  }
};
