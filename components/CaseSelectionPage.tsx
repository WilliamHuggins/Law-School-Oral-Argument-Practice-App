
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useAppContext } from '../App';
import { Page, Case } from '../types';
import { CASE_LIBRARY } from '../constants';
import { BookIcon, SearchIcon, UploadIcon } from './icons';

const API_KEY = process.env.API_KEY;

// Service to fetch case data using the Gemini API with Google Search grounding
const caseService = {
  fetchCaseSummary: async (query: string): Promise<Case | null> => {
    if (!API_KEY) {
      console.error("API Key not found.");
      return null;
    }
    
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const prompt = `
You are a legal research assistant. Your task is to use Google Search to find the most relevant landmark U.S. court case based on the user's search query.

Search Query: "${query}"

After finding the case, provide the following information in a structured format with each field on a new line:
Title: [Full Case Title with year]
Category: [Relevant Legal Category]
Summary: [A concise, multi-sentence summary of the case, focusing on the core legal issue, the court's holding, and its significance.]

Respond ONLY with the text in the format above. Do not add any conversational text, introductions, or markdown formatting. If you cannot find a relevant case, respond with the exact text "CASE_NOT_FOUND".
`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
        },
      });
      
      const responseText = response.text.trim();

      if (responseText === 'CASE_NOT_FOUND' || !responseText) {
        return null;
      }

      // Parse the structured text response
      const lines = responseText.split('\n').filter(line => line.trim() !== '');
      const caseData: Partial<Case> = {};
      let summaryLines: string[] = [];
      let summaryStarted = false;

      lines.forEach(line => {
        if (line.startsWith('Title: ')) {
          caseData.title = line.substring('Title: '.length).trim();
          summaryStarted = false;
        } else if (line.startsWith('Category: ')) {
          caseData.category = line.substring('Category: '.length).trim();
          summaryStarted = false;
        } else if (line.startsWith('Summary: ')) {
          summaryLines.push(line.substring('Summary: '.length).trim());
          summaryStarted = true;
        } else if (summaryStarted) {
          summaryLines.push(line.trim());
        }
      });
      
      if (summaryLines.length > 0) {
          caseData.summary = summaryLines.join('\n');
      }

      if (caseData.title && caseData.category && caseData.summary) {
        return caseData as Case;
      } else {
        console.error("Failed to parse AI response:", { responseText, parsedData: caseData });
        return null; // Return null if parsing fails to show error message to user
      }

    } catch (error) {
      console.error("Error fetching case summary from AI:", error);
      return null;
    }
  }
};


const CaseSelectionPage: React.FC = () => {
  const { setSelectedCase, setPage } = useAppContext();
  const [activeTab, setActiveTab] = useState<'library' | 'fetch' | 'custom'>('fetch');
  const [selectedCategory, setSelectedCategory] = useState<string>(CASE_LIBRARY[0].name);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [customSummary, setCustomSummary] = useState('');
  const [localSelectedCase, setLocalSelectedCase] = useState<Case | null>(null);

  const handleCaseSelect = (caseItem: Case) => {
    setLocalSelectedCase(caseItem);
  };

  const handleFetch = async () => {
    if (!searchQuery) return;
    setIsFetching(true);
    setFetchError(null);
    setLocalSelectedCase(null);
    try {
      const result = await caseService.fetchCaseSummary(searchQuery);
      if (result) {
        setLocalSelectedCase(result);
      } else {
        setFetchError('Case not found. Please check your keywords or try another search.');
      }
    } catch (error) {
      setFetchError('An error occurred while fetching the case summary.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleCustomSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomSummary(e.target.value);
    if (e.target.value.trim()) {
        setLocalSelectedCase({
            title: 'Custom Case',
            summary: e.target.value,
            category: 'Custom',
        });
    } else {
        setLocalSelectedCase(null);
    }
  };

  const startSession = () => {
    if (localSelectedCase) {
      setSelectedCase(localSelectedCase);
      setPage(Page.LiveSession);
    }
  };

  const tabButtonStyle = (tabName: 'library' | 'fetch' | 'custom') => 
    `flex-1 py-3 px-4 text-center font-semibold border-b-4 transition-colors duration-300 ${
      activeTab === tabName 
        ? 'border-stanford-red text-stanford-red' 
        : 'border-transparent text-gray-500 hover:text-stanford-red hover:border-red-200'
    }`;

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-3xl font-serif font-bold mb-8 text-center">Select Your Case</h2>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex border-b mb-6">
          <button onClick={() => setActiveTab('library')} className={tabButtonStyle('library')}><BookIcon className="inline-block mr-2 h-5 w-5"/>Case Library</button>
          <button onClick={() => setActiveTab('fetch')} className={tabButtonStyle('fetch')}><SearchIcon className="inline-block mr-2 h-5 w-5"/>Fetch Case</button>
          <button onClick={() => setActiveTab('custom')} className={tabButtonStyle('custom')}><UploadIcon className="inline-block mr-2 h-5 w-5"/>Provide Your Own</button>
        </div>

        <div>
          {activeTab === 'library' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1">
                <h3 className="font-semibold mb-2">Categories</h3>
                <ul className="space-y-1">
                  {CASE_LIBRARY.map(cat => (
                    <li key={cat.name}>
                      <button 
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`w-full text-left px-3 py-2 rounded ${selectedCategory === cat.name ? 'bg-stanford-red text-white' : 'hover:bg-gray-100'}`}
                      >
                        {cat.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="md:col-span-3">
                <h3 className="font-semibold mb-2">{selectedCategory} Cases</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {CASE_LIBRARY.find(cat => cat.name === selectedCategory)?.cases.map(caseItem => (
                    <button
                      key={caseItem.title}
                      onClick={() => handleCaseSelect(caseItem)}
                      className={`w-full text-left p-3 border rounded-lg transition-all ${localSelectedCase?.title === caseItem.title ? 'border-stanford-red bg-red-50 ring-2 ring-stanford-red' : 'border-gray-200 hover:border-stanford-red'}`}
                    >
                      <p className="font-bold">{caseItem.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{caseItem.summary.substring(0, 100)}...</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fetch' && (
            <div>
              <p className="text-sm text-gray-600 mb-4">Enter keywords, a topic, or a case name/citation to fetch a summary.</p>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g., 'right to an attorney' or 'Marbury v. Madison'"
                  className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm focus:ring-stanford-red focus:border-stanford-red"
                  onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                />
                <button onClick={handleFetch} disabled={isFetching || !searchQuery} className="px-6 py-2 bg-stanford-red text-white font-semibold rounded-md shadow-sm hover:bg-red-800 disabled:bg-gray-400">
                  {isFetching ? 'Fetching...' : 'Fetch'}
                </button>
              </div>
              {fetchError && <p className="text-red-600 mt-2 text-sm">{fetchError}</p>}
            </div>
          )}

          {activeTab === 'custom' && (
             <div>
                <p className="text-sm text-gray-600 mb-2">Paste your case summary below.</p>
                <textarea
                    value={customSummary}
                    onChange={handleCustomSummaryChange}
                    rows={10}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-stanford-red focus:border-stanford-red"
                    placeholder="Paste your case facts, issues, and holding here..."
                ></textarea>
            </div>
          )}
        </div>
      </div>
      
      {localSelectedCase && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md border-l-4 border-stanford-green">
            <h3 className="text-xl font-bold font-serif mb-2">{localSelectedCase.title}</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{localSelectedCase.summary}</p>
        </div>
      )}

      <div className="text-center mt-12">
        <button 
          onClick={startSession}
          disabled={!localSelectedCase}
          className="w-full md:w-auto px-12 py-3 bg-stanford-green text-white text-lg font-semibold rounded-lg shadow-md hover:bg-green-800 transition-colors duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Start Session
        </button>
      </div>
    </div>
  );
};

export default CaseSelectionPage;
