import React from 'react';
import { useAppContext } from '../App';
import { Page } from '../types';

const HomePage: React.FC = () => {
  const { setPage } = useAppContext();

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen text-center p-6"
      style={{
        backgroundImage: "url('https://i.postimg.cc/SxGqX2Ms/Chat-GPT-Image-Nov-15-2025-12-04-39-PM.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-0" />
      
      <header className="relative z-10 w-full max-w-4xl">
        <div className="flex flex-col justify-center items-center mb-6">
          <img src="https://i.postimg.cc/Hx4HyG16/Chat-GPT-Image-Nov-17-2025-08-43-13-AM.png" alt="Gavel Icon" className="h-20 w-20 mb-4" />
          <h1 className="text-3xl md:text-5xl font-serif font-bold text-stanford-charcoal">
            Stanford Law School<br />Oral Argument Coach
          </h1>
        </div>
        <p className="text-lg md:text-xl text-stanford-charcoal mt-2">
          Practice your oral arguments with an AI Judge in a realistic moot court simulation.
        </p>
      </header>
      
      <section className="relative z-10 my-12 max-w-3xl text-left text-base md:text-lg text-stanford-charcoal leading-relaxed bg-white/50 p-6 rounded-lg shadow-md">
        <p>
          Welcome to your AI-powered moot court practice arena. This app lets you simulate appellate oral arguments with an AI judge and optional AI co-counsel. You can use a summary of a real case or your own case summary to argue, all in a realistic courtroom setting with voice interaction. Configure your session settings, practice speaking naturally, and receive a full transcript and feedback at the end.
        </p>
      </section>

      <button
        onClick={() => setPage(Page.Settings)}
        className="relative z-10 px-10 py-4 bg-stanford-red text-white text-xl font-semibold rounded-lg shadow-md hover:bg-red-800 transition-colors duration-300 transform hover:scale-105"
      >
        Begin Practice
      </button>

      <footer className="absolute bottom-4 text-xs text-gray-600 font-medium z-10 px-4">
        <p>
          This app is brought to you by the Robert Crown Law Library.
          <br />
          Created by Will Huggins using Google AI Studio. © 2025. |{' '}
          <button 
            onClick={() => setPage(Page.Privacy)} 
            className="underline hover:text-stanford-red"
          >
            Privacy Statement
          </button>
        </p>
      </footer>
    </div>
  );
};

export default HomePage;
