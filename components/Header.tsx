import React from 'react';
import { useAppContext } from '../App';
import { Page } from '../types';

const getPageTitle = (page: Page) => {
    switch(page) {
        case Page.Settings: return "Settings";
        case Page.CaseSelection: return "Case Selection";
        case Page.LiveSession: return "Practice Session";
        case Page.Feedback: return "Session Report";
        case Page.Privacy: return "Privacy Statement";
        default: return "";
    }
}

const Header: React.FC = () => {
    const { currentPage, resetApp } = useAppContext();

    return (
        <header className="bg-stanford-charcoal text-white shadow-md mb-8">
            <div className="container mx-auto p-4 flex justify-between items-center">
                <button onClick={resetApp} className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                    <img src="https://i.postimg.cc/Hx4HyG16/Chat-GPT-Image-Nov-17-2025-08-43-13-AM.png" alt="Home" className="h-6 w-6"/>
                    <span className="font-semibold">Home</span>
                </button>
                <h1 className="text-xl md:text-2xl font-serif font-bold">
                    {getPageTitle(currentPage)}
                </h1>
                <div className="w-24 md:w-16"></div> {/* Spacer to balance home button */}
            </div>
        </header>
    );
};

export default Header;